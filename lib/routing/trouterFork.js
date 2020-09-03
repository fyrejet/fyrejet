'use strict'

const pathToRegexp = require('path-to-regexp')
const methods = require('./methods')

module.exports = class Trouter {
  constructor (options) {
    this.opts = {}
    this.opts.strict = false
    this.opts.sensitive = options.sensitive || false
    this.routes = []

    methods.forEach(method => {
      const methodUpperCase = method !== 'all' ? method.toUpperCase() : ''
      this[method] = this.add.bind(this, methodUpperCase)
    })
  }

  exposeRoutes () {
    return this.routes
  }

  modifySetting (setting, value) {
    this.opts[setting] = value
  }

  use (route, ...fns) {
    let api = false
    let propsAsFns = false
    let noEtag = false

    if (fns.includes('api')) {
      let index = fns.indexOf('api')
      fns.splice(index, 1)
      api = true
    }
    if (fns.includes('propsAsFns')) {
      let index = fns.indexOf('propsAsFns')
      fns.splice(index, 1)
      propsAsFns = true
    }
    if (fns.includes('noEtag')) {
      let index = indRouteArgs.indexOf('noEtag')
      fns.splice(index, 1)
      noEtag = true
    }

    // let's find out the number of args a function accepts
    let init = false
    if (!route || route === '*') route = '/'
    const handlersArgsNum = []
    fns.forEach(fn => {
      const fnString = fn.toString()
      const argsNum = fnString.match(/\(\s*(.*?)\s*\)/)[1].split(', ').length
      handlersArgsNum.push(argsNum)
    })
    if (fns.length === 1 && fns[0][0].init) {
      init = true
    }

    const starCatchAll = false
    const useOpts = Object.assign({}, this.opts)
    useOpts.end = false
    useOpts.strict = false
    const handlers = [].concat.apply([], fns)
    let pattern
    let keys = []
    if (route instanceof RegExp) {
      pattern = route
      keys = 'regex'
    } else {
      pattern = pathToRegexp(route, keys, useOpts)
      keys = keys.map(item => item.name)
      keys = keys.filter(item => item !== 0)
      if (route && typeof route === 'string' && route !== '*') keys = routeStringPatternsTester(route, keys)
    }

    this.routes.push({ keys, pattern, path: route, method: '', handlers, handlersArgsNum, starCatchAll, middleware: true, init, api, propsAsFns, noEtag })
    return this
  }

  add (method, route, ...fns) {
    let api = false
    let propsAsFns = false
    let noEtag = false

    if (fns.includes('api')) {
      let index = fns.indexOf('api')
      fns.splice(index, 1)
      api = true
    }
    if (fns.includes('propsAsFns')) {
      let index = fns.indexOf('propsAsFns')
      fns.splice(index, 1)
      propsAsFns = true
    }
    if (fns.includes('noEtag')) {
      let index = indRouteArgs.indexOf('noEtag')
      fns.splice(index, 1)
      noEtag = true
    }
    // let's find out the number of args a function accepts
    const handlersArgsNum = []
    fns.forEach(fn => {
      const fnString = fn.toString()
      const argsNum = fnString.match(/\(\s*(.*?)\s*\)/)[1].split(', ').length
      handlersArgsNum.push(argsNum)
    })

    let starCatchAll = false
    if (route === '*') {
      route = '/*'
      starCatchAll = true
    }
    const routeOpts = Object.assign({}, this.opts)
    routeOpts.end = true
    let keys = []
    let pattern
    if (route instanceof RegExp) {
      pattern = route
      keys = 'regex'
    } else {
      pattern = pathToRegexp(route, keys, routeOpts)
      keys = keys.map(item => item.name)
      keys = keys.filter(item => item !== 0)
      if (route && typeof route === 'string' && route !== '*') keys = routeStringPatternsTester(route, keys)
    }

    const handlers = [].concat.apply([], fns)
    this.routes.push({ keys, pattern, path: route, method, handlers, handlersArgsNum, starCatchAll, api, propsAsFns, noEtag })
    return this
  }

  find (method, url, req, res) {
    const isHEAD = (method === 'HEAD')
    let i = 0; let tmp; const arr = this.routes
    let handlers = []; let handlersArgsNum = []; const routes = []; let specialType = false; let noEtag = false
    for (; i < arr.length; i++) {
      tmp = arr[i]
      if (tmp.method.length === 0 || tmp.method === method || isHEAD && tmp.method === 'GET') {
        const test = tmp.pattern.exec(url)

        if (test != null) {
          routes.push(tmp)
          
          if (!specialType) {
            if (tmp.api) specialType = 'api';
            else if (tmp.propsAsFns) specialType = 'properties as functions'
          }
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

    const z = { handlers, handlersArgsNum, url, sRoutes: routes, specialType, noEtag }
    return z
  }
}

function routeStringPatternsTester (pat, keys) {
  if (!pat) pat = ''
  const special = ['?', '+', '*']
  const regexAllSpecialChars = /(\?*\+*\**\(*\)*\[*\]*\.*)/
  let includes = false

  for (let n = 0, o = special.length; n < o; n++) {
    if (pat.indexOf(special[n]) > -1) {
      includes = true
      break
    }
  }

  if (includes) {
    function specialHunt (item) {
      const regex = /\*|\((.*)\)/
      let exec = regex.exec(item)
      while (exec) {
        keys.push(i)
        item = item.replace(/\*|\((.*)\)/, '')
        i++
        exec = regex.exec(item)
      }
    }
    pat = pat.split('/')
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
