'use strict'

import type { FyrejetRequest, FyrejetResponse, Middleware, Nullable, SingleOrArray, HttpMethod, FyrejetApp } from "../types";
import type { ChangeSequentialConfig, GetSequentialConfig, SequentialConfig } from "./types";
import { type Key, pathToRegexp } from "../pathToRegexp";

const methods = require('./methods').default
const { v4: uuidv4 } = require('uuid')

export const REGEX_KEY = 'regex'

type AdditionalRouterProperties = {
	id: Nullable<string|number>;
	changeSequentialConfig: Nullable<ChangeSequentialConfig>;
	getSequentialConfig: Nullable<GetSequentialConfig>;
	mountedRouters: Record<string|number, string|RegExp|string[]>;
	lookup: Middleware;
	fyrejetApp: FyrejetApp;
}

type AddRouteByMethod = (route: string, ...fns: Middleware[]) => void;

export type Route = {
	keys: (string|number)[],
	pattern: RegExp,
	path: string | RegExp,
	method: string,
	handlers: Middleware[],
	handlersArgsNum: number[],
	starCatchAll: boolean,
	middleware?: boolean,
	init?: boolean,
	noEtag: boolean,
	guid: string,
}

type RouteHandlersAndSettings = {
	handlers: Middleware[],
	settings: {
		noEtag: boolean,
	}
}

export type Match = {
	handlers: Middleware[],
	handlersArgsNum: number[],
	url: string | RegExp,
	routes: Route[],
	noEtag?: boolean,
	urlProperVerified?: string,
}

export type MountedRouters = Record<string|number, string|RegExp|string[]>

export class Trouter {
  
  id?: Nullable<string|number>;
  changeSequentialConfig: Nullable<ChangeSequentialConfig>;
  getSequentialConfig: Nullable<GetSequentialConfig>;
  opts: SequentialConfig;
  mountedRouters: MountedRouters;
  lookup: Middleware;
  routes: Route[];
  fyrejetApp: FyrejetApp;
  availableMethodsForRoute: Record<string, string[]>
  paramHandlers: Record<string, string>



  constructor (options: SequentialConfig, additionalRouterProperties: AdditionalRouterProperties) {
    this.opts = {}
    this.opts.strict = false
    this.opts.sensitive = options.sensitive || false
    this.routes = []
	
	const {id, changeSequentialConfig, getSequentialConfig, mountedRouters, lookup, fyrejetApp} = additionalRouterProperties;
	this.id = id;
	this.changeSequentialConfig = changeSequentialConfig;
	this.getSequentialConfig = getSequentialConfig;
	this.mountedRouters = mountedRouters;
	this.lookup = lookup;
	this.fyrejetApp = fyrejetApp;
	this.availableMethodsForRoute = {}
	this.paramHandlers = {}

  }

  useMiddleware = (path: SingleOrArray<string>, ...fns: Middleware[]) => {
    if (!Array.isArray(path)) path = [path]
    path.forEach(item => {
      this.use(item, ...fns)
    })

    return this.fyrejetApp
  }

  exposeRoutes () {
    return this.routes
  }

  modifySetting (setting: string, value: unknown) {
    this.opts[setting] = value
  }


  filterFnsAndGetRouteSettings(fns: (string|Middleware)[]) : RouteHandlersAndSettings {
	let noEtag = false;
	if (fns.includes('api')) {
		const index = fns.indexOf('api')
		fns.splice(index, 1)
	}
	if (fns.includes('propsAsFns')) {
		const index = fns.indexOf('propsAsFns')
		fns.splice(index, 1)
	}
	if (fns.includes('noEtag')) {
		const index = fns.indexOf('noEtag')
		fns.splice(index, 1)
		noEtag = true;
	}

	return {
		handlers: fns.filter(fn => {
			return typeof fn === 'function'
		}) as Middleware[],
		settings: {
			noEtag
		}
	}

  }

  // use (route: string, ...fns: (Middleware|string)[]) {
  use (...args: (Middleware|SingleOrArray<string>|SingleOrArray<RegExp>)[]) {

	let route: string|RegExp;
	let fns: (Middleware|string)[]

	if (!args.length) return this;
	if (typeof args[0] === 'function') {
		route = '/'
		fns = args as (Middleware|string)[];
	}
	else {
		const [tmpRoute, ...tmpFns] = args;
		if (Array.isArray(tmpRoute)) {
			tmpRoute.forEach(route => {
				this.use(route, ...tmpFns)
			})
			return this;
		}
		route = tmpRoute;
		fns = tmpFns as (Middleware|string)[];
	}

	const {handlers: fnsPostFlag, settings} = this.filterFnsAndGetRouteSettings(fns)
	const {noEtag} = settings

    // let's find out the number of args a function accepts
    let init = false
    if (!route || route === '*') route = '/'
    const handlersArgsNum : number[] = []
    fnsPostFlag.forEach(fn => {
      const fnString = fn.toString()
	  const match = fnString.match(/\(\s*(.*?)\s*\)/)
	  if (!match) return handlersArgsNum.push(3)
      const argsNum = match[1].split(', ').length
      handlersArgsNum.push(argsNum)
    })
    if (fnsPostFlag.length === 1 && fnsPostFlag[0].init) {
      init = true
    }

    const starCatchAll = false
    const useOpts = Object.assign({}, this.opts)
    useOpts.end = false
    useOpts.strict = false
    const handlers = [...fnsPostFlag]
    let pattern : RegExp
    let keys : (string|number)[] = []
    if (route instanceof RegExp) {
      pattern = route
      keys = ['regex']
    } else {
	  const tmpKeys : Key[] = []
      pattern = pathToRegexp(route, tmpKeys, useOpts) as RegExp
      keys = tmpKeys.map(item => item.name)
      keys = keys.filter(item => item !== 0)
      if (route && typeof route === 'string' && route !== '*') keys = routeStringPatternsTester(route, keys)
    }

    this.routes.push({ keys, pattern, path: route, method: '', handlers, handlersArgsNum, starCatchAll, middleware: true, init, noEtag, guid: uuidv4() })

	if (fnsPostFlag[0].id) {
		// caching router -> pattern relation for urls pattern replacement
		const parseOpts = { strict: false, end: false, sensitive: this.opts.sensitive || false }
		const pattern = pathToRegexp(route, [], parseOpts)
		this.mountedRouters[fnsPostFlag[0].id] = pattern
	}
    return this
  }

  add (method: HttpMethod, route: string | RegExp, ...fns: (Middleware|string)[]) {

	if (method.toUpperCase() === 'ALL') method = ''

	const {handlers: fnsPostFlag, settings} = this.filterFnsAndGetRouteSettings(fns)
	const {noEtag} = settings

    // let's find out the number of args a function accepts
    const handlersArgsNum : number[] = []
    fnsPostFlag.forEach(fn => {
      const fnString = fn.toString()
	  const match = fnString.match(/\(\s*(.*?)\s*\)/)
	  if (!match) return handlersArgsNum.push(3)
      const argsNum = match[1].split(', ').length
      handlersArgsNum.push(argsNum)
    })

    let starCatchAll = false
    if (route === '*') {
      route = '/*'
      starCatchAll = true
    }
    const routeOpts = Object.assign({}, this.opts)
    routeOpts.end = true
    let keys : (string|number)[] = []
    let pattern : RegExp
    if (route instanceof RegExp) {
      pattern = route
      keys = [REGEX_KEY]
    } else {
	  const tmpKeys : Key[] = []
      pattern = pathToRegexp(route, tmpKeys, routeOpts) as RegExp
      keys = tmpKeys.map(item => item.name)
      keys = keys.filter(item => item !== 0)
      if (route && typeof route === 'string' && route !== '*') keys = routeStringPatternsTester(route, keys)
    }

    const handlers = [...fnsPostFlag]
    this.routes.push({ keys, pattern, path: route, method, handlers, handlersArgsNum, starCatchAll, noEtag, guid: uuidv4() })
    return this
  }

  on(method: HttpMethod, route: string | RegExp, ...fns: (Middleware|string)[]) {
	return this.add(method, route, ...fns)
  }

  find (method: string, url: string, req: FyrejetRequest, res: FyrejetResponse) : Match {
    const isHEAD = (method === 'HEAD')
    let i = 0; let tmp; const arr = this.routes
    let handlers : Middleware[] = []; let handlersArgsNum : number[] = []; const routes = []; let noEtag = false
    for (; i < arr.length; i++) {
      tmp = arr[i]
      if (tmp.method.length === 0 || tmp.method === method || (isHEAD && tmp.method === 'GET')) {
        const test = tmp.pattern.exec(url)

        if (test !== null) {
          routes.push(tmp)

          if (!noEtag) {
            if (tmp.noEtag) noEtag = true
          }
          if (tmp.handlers.length > 1) {
            handlers = handlers.concat(tmp.handlers)
            handlersArgsNum = handlersArgsNum.concat(tmp.handlersArgsNum)
          } else {
            handlers.push(tmp.handlers[0])
            handlersArgsNum.push(tmp.handlersArgsNum[0])
          }
        }
      } // else not a match
    }
    const routeData = { handlers, handlersArgsNum, url, routes, noEtag }
    return routeData
  }
}

function routeStringPatternsTester (pattern: string, keys: (string|number)[]) : (string|number)[] {
  if (!pattern) pattern = ''
  const special = ['?', '+', '*']
  const regexAllSpecialChars = /(\?*\+*\**\(*\)*\[*\]*\.*)/
  let includes = false

  for (let n = 0, o = special.length; n < o; n++) {
    if (pattern.indexOf(special[n]) > -1) {
      includes = true
      break
    }
  }

  if (includes) {
    function specialHunt (item: string) {
      const regex = /\*|\((.*)\)/
      let exec = regex.exec(item)
      while (exec) {
        keys.push(i)
        item = item.replace(/\*|\((.*)\)/, '')
        i++
        exec = regex.exec(item)
      }
    }
    const pat = pattern.split('/')
    pat.shift()
    keys = []
    let i = 0
    pat.forEach((item) => {
      if (item.indexOf(':') >= 0) {
        const items = item.split(':')
        items.shift()
        items.forEach(item => {
          let includes = false
          let location
          for (let n = 0, o = special.length; n < o; n++) {
            location = item.indexOf(special[n])
            if (location > -1) {
              includes = true
              break
            }
          }
          let keyName
          if (includes) { // location becomes cutoff location
            keyName = item.slice(0, location)
          } else {
            keyName = item
          }
          if (keyName[0] !== '(') {
            keyName = keyName.replace(new RegExp(regexAllSpecialChars.source, regexAllSpecialChars.flags + 'gi'), '') // ugly regex to remove special characters from param name
            keys.push(keyName)
          }
          if (item.search(/(\?|\+|\*)/) >= 0) {
            return specialHunt(item)
          }
        })
        return
      }
      if (item.search(/(\?|\+|\*)/) >= 0) {
        return specialHunt(item)
      }
    })
  }
  return keys
}

export default Trouter