'use strict'

import sequential from './sequential'
import methods from './methods'
import pathToRegexp from '../pathToRegexp'
import depd from 'depd'

import type { Key } from "../pathToRegexp"
import type { FyrejetApp, FyrejetRequest, FyrejetResponse, HttpMethod, Middleware, NextFunction, SingleOrArray } from "../types"
import type { SequentialConfig } from "./types"

const deprecate = depd('fyrejet')

function mergeAndDeduplicateArrays<T>(arr1: T[], arr2: T[]): T[] {
	return [...new Set([...(arr1||[]), ...(arr2||[])])];
}

module.exports = (options: SequentialConfig, service : FyrejetApp) => {
  const routes : Set<string> = new Set()
  const router = sequential(options, service)
  router.paramHandlers = {}

  router.availableMethodsForRoute = {} // needed to store data for potential OPTIONS request

  // attach router id
  service.id = router.id

  function addMethodToRouteMethodsList (urlPath: string|RegExp, method: string) {
	const methodUpperCase = method.toUpperCase();
	if (methodUpperCase === 'ALL') return; // OPTIONS should not be affected by ALL
    let urlPaths = [urlPath]
	if (urlPath instanceof RegExp) {
		urlPaths = [urlPath.toString()]
	}
    else if (!service.get('strict routing')) {
      if (urlPath[urlPath.length - 1] === '/') {
        urlPaths.push(urlPath.slice(0, urlPath.length - 1))
      } else {
        urlPaths.push(urlPath + '/')
      }
    }
    for (let n = 0; n < urlPaths.length; n++) {
      const urlPath = urlPaths[n] as string;
	  router.availableMethodsForRoute[urlPath] = mergeAndDeduplicateArrays(router.availableMethodsForRoute[urlPath], [methodUpperCase])
      if (router.availableMethodsForRoute[urlPath].length === 1) router.availableMethodsForRoute[urlPath].push('HEAD')
    }
  }

  // attach routes registration shortcuts
  methods.forEach((method: HttpMethod) => {
    service[method] = (route: SingleOrArray<string|RegExp>, ...fns: (Middleware|string)[]) => {
      
	  if (typeof route === 'string' && !fns?.length) {
        if (method === 'get') { // little hack
          return service.set(route)
        } else {
          return service // no sense to create a route without handlers.
        }
      }

      if (!Array.isArray(route)) {
        route = [route]
      }

      // support multiple paths registration
      const argsExceptPath = fns

      // for arch path
      route.forEach(urlPath => {
        let indRouteArgs : (string|Middleware)[] = []
        let keys : (string|number)[] = []

		const tmpKeys : Key[] = [] 
        pathToRegexp(urlPath, tmpKeys)
        keys = tmpKeys.map(x => x.name)
        keys.forEach(key => {
          if (router.paramHandlers.FYREJET_GLOBAL_PARAM) {
            indRouteArgs = indRouteArgs.concat(router.paramHandlers.FYREJET_GLOBAL_PARAM)
          }
          if (router.paramHandlers[key]) {
            indRouteArgs = indRouteArgs.concat(router.paramHandlers[key])
          }
        })

        indRouteArgs = indRouteArgs.concat(argsExceptPath)

        indRouteArgs.forEach(arg => {
          if (typeof arg !== 'function' && arg !== 'api' && arg !== 'propsAsFns' && arg !== 'noEtag') {
            throw new Error(capitalizeFirstLetter(typeof arg))
          }
        })

        addMethodToRouteMethodsList(urlPath, method)

		let methodUpper = method.toUpperCase()
        routes.add(`${methodUpper}${indRouteArgs[0]}`)
		router.add(methodUpper, urlPath, ...indRouteArgs)
      })

      return service
    }
  })

  service.del = deprecate.function(service.delete, 'app.del: Use app.delete instead')

  // attach router
  service.getRouter = () => router

  // attach routes
  service.routes = () => [...routes]

  service.lookup = (req: FyrejetRequest, res: FyrejetResponse, next: NextFunction) => router.lookup.apply(router, [req,res,next])
  service.find = (method: string, url: string, req: FyrejetRequest, res: FyrejetResponse) => router.find.apply(router, [method, url, req, res])

  return service
}

function capitalizeFirstLetter (str: string) : string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
