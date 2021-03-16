'use strict'

/**
 * @see: https://github.com/jkyberneees/0http#0http---sequential-default-router
 */
const sequential = require('./sequential')
const methods = require('./methods')
const pathToRegexp = require('path-to-regexp')
var deprecate = require('depd')('fyrejet')

module.exports = (options, service = {}) => {
  const routes = new Set()
  const router = sequential(options)
  router.paramHandlers = {}

  router.availableMethodsForRoute = {} // needed to store data for potential OPTIONS request

  // attach router id
  service.id = router.id

  // attach use method
  router.useMiddleware = (path, ...fns) => {
    if (!Array.isArray(path)) path = [path]
    path.forEach(item => {
      router.use(item, ...fns)
    })

    return service
  }

  function addMethodsToRouteMethodsList(urlPath, method) {
    const urlPaths = [urlPath];
    if (!service.get('strict routing')) {
      if (urlPath[urlPath.length-1] === '/') {
        urlPaths.push(urlPath.slice(0,urlPath.length-1))
      }
      else {
        urlPaths.push(urlPath+'/')
      }
    }
    for (let n=0; n < urlPaths.length; n++) {
      let urlPath = urlPaths[n];
      if (!router.availableMethodsForRoute[urlPath]) router.availableMethodsForRoute[urlPath] = []
      if (!router.availableMethodsForRoute[urlPath].includes(method.toUpperCase()) && method !== 'all') router.availableMethodsForRoute[urlPath].push(method.toUpperCase())
      if (router.availableMethodsForRoute[urlPath].length === 1) router.availableMethodsForRoute[urlPath].push('HEAD')
    }
    
  }

  // attach routes registration shortcuts
  methods.forEach((method) => {
    service[method] = (...args) => {
      if (args.length === 1) {
        if (method === 'get') { // little hack
          return service.set(args[0])
        } else {
          return service // no sense to create a route without handlers.
        }
      }

      if (!Array.isArray(args[0])) {
        args[0] = [args[0]]
      }

      // support multiple paths registration
      const argsExceptPath = args.slice(1)

      // for arch path
      args[0].forEach(urlPath => {
        let indRouteArgs = []
        let keys = []

        pathToRegexp(urlPath, keys)
        keys = keys.map(x => x.name)
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

        indRouteArgs.unshift(urlPath)
        
        addMethodsToRouteMethodsList(urlPath, method)
        
        routes.add(`${method.toUpperCase()}${indRouteArgs[0]}`)
        router[method].apply(router, indRouteArgs)
      })

      return service
    }
  })

  service.del = deprecate.function(service.delete, 'app.del: Use app.delete instead')

  // attach router
  service.getRouter = () => router

  // attach routes
  service.routes = () => [...routes]

  service.lookup = (...args) => router.lookup.apply(router, args)
  service.find = (...args) => router.find.apply(router, args)

  return service
}

function capitalizeFirstLetter (string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}
