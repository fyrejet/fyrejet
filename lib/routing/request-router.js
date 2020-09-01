'use strict'

/**
 * @see: https://github.com/jkyberneees/0http#0http---sequential-default-router
 */
const sequential = require('./sequential')
// var expressRouterProto = require('express/lib/router')
const methods = require('./methods')
const pathToRegexp = require('path-to-regexp')
var deprecate = require('depd')('fyrejet')

module.exports = (options, service = {}) => {
  const routes = new Set()
  const apiRoutes = {}
  const specialRoutes = {}
  const propsAsFnsRoutes = {}
  const noEtagRoutes = {}
  const router = sequential(options)
  router.paramHandlers = {}

  router.availableMethodsForRoute = {} // needed to store data for potential OPTIONS request

  // attach router id
  service.id = router.id

  // attach use method
  router.useMiddleware = (path, args) => {
    if (!Array.isArray(path)) path = [path]
    path.forEach(item => {
      router.use(item, args)
    })

    return service
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

        if (indRouteArgs.includes('api')) {
          const index = indRouteArgs.indexOf('api')
          indRouteArgs.splice(index, 1)
          apiRoutes[urlPath] = true
          specialRoutes[urlPath] = true
        }
        if (indRouteArgs.includes('propsAsFns')) {
          const index = indRouteArgs.indexOf('propsAsFns')
          indRouteArgs.splice(index, 1)
          propsAsFnsRoutes[urlPath] = true
          specialRoutes[urlPath] = true
        }
        if (indRouteArgs.includes('noEtag')) {
          const index0 = indRouteArgs.indexOf('noEtag')
          indRouteArgs.splice(index0, 1)
          noEtagRoutes[urlPath] = true
        }
        indRouteArgs.forEach(arg => {
          if (typeof arg !== 'function') {
            throw new Error(capitalizeFirstLetter(typeof arg))
          }
        })
        indRouteArgs.unshift(urlPath)
        if (!router.availableMethodsForRoute[urlPath]) router.availableMethodsForRoute[urlPath] = []
        if (!router.availableMethodsForRoute[urlPath].includes(method.toUpperCase()) && method !== 'all') router.availableMethodsForRoute[urlPath].push(method.toUpperCase())
        if (router.availableMethodsForRoute[urlPath].length === 1) router.availableMethodsForRoute[urlPath].push('HEAD')
        routes.add(`${method.toUpperCase()}${indRouteArgs[0]}`)
        router[method].apply(router, indRouteArgs)
      })

      return service
    }
  })

  service.del = deprecate.function(service.delete, 'app.del: Use app.delete instead')

  service.apiRoutes = apiRoutes
  service.specialRoutes = specialRoutes
  service.propsAsFnsRoutes = propsAsFnsRoutes
  service.noEtagRoutes = noEtagRoutes

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
