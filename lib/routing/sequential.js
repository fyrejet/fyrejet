'use strict'

// Forked from jkybernees's excellent 0http

const Trouter = require('./trouterFork')
const next = require('./next')
const LRU = require('lru-cache')
const pathToRegexp = require('path-to-regexp')
var queryparams = require('./query')
const onChange = require('on-change')

module.exports = (config = {}) => {
  config.mountpath = ''
  config.cacheSize = config.routerCacheSize || config.cacheSize || 2000
  config.defaultRoute = config.defaultRoute || ((req, res) => {
    res.defaultErrHandler(false) // 404 error
  })
  config.sensitive = config.caseSensitive

  if (config.errorHandler === undefined) {
    config.errorHandler = (err, req, res) => {
      res.statusCode = 500
      res.end(err.message)
    }
  }
  if (config.cacheSize === undefined) {
    config.cacheSize = 1000
  }
  if (config.id === undefined) {
    config.id = (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase()
  }

  const routers = {}
  const hasCache = config.cacheSize > 0
  const cache = hasCache ? new LRU(config.cacheSize) : null
  const router = new Trouter(config)
  router.id = config.id

  router.changeSequentialConfig = (option, value) => {
    if (option && (value || value === null)) {
      config[option] = value
    }
  }

  router.getSequentialConfig = () => { return config }

  const _use = router.use

  router.use = (prefix, ...middlewares) => {
    if (typeof prefix === 'function') {
      middlewares = [prefix]
      prefix = '/'
    }
    if (Array.isArray(prefix)) {
      prefix.forEach(path => {
        router.use(path, middlewares)
      })
      return this
    }
    _use.call(router, prefix, middlewares)

    if (middlewares[0].id) {
      // caching router -> pattern relation for urls pattern replacement

      const parseOpts = { strict: false, end: false, sensitive: config.sensitive || false }
      const pattern = pathToRegexp(prefix, [], parseOpts)
      routers[middlewares[0].id] = pattern
    }

    return this
  }

  router.lookup = (req, res, step) => {
    function init () {
      if (!req.rData_internal) {
        req.originalUrl = req.url // if there is no req.rData_internal, it means there is no req.originalUrl either
        req.rData_internal = {
          url: req.url || '/',
          method: req.method,
          tree: [],
          appPrev: [],
          reqPropertiesEssential: [],
          reqProperties: [],
          urlPrevious: []
        }
        res.locals = Object.create(null) // res.locals is rather convenient at times, so we leave it even for API routes
        req.paramsCalled = {} // needed for app.param
        return
      }
      if (req.lastPattern) {
        const reqUrlCopy = req.rData_internal.url
        req.rData_internal.url = req.rData_internal.url.replace(req.lastPattern, '') || reqUrlCopy
      }
    }
    init()

    queryparams(req, req.rData_internal.url, req.app.get('query parser fn')) // modified queryparams to use the same parser as express would normally use, so we don't do query processing twice.
    let match

    if (hasCache) {
      const reqCacheKey = req.method + req.path
      match = cache.get(reqCacheKey)
      if (!match) {
        match = router.find(req.method, req.path, req, res)
        match.routesLength = match.sRoutes.length // LRU cache is incapable of storing Array of objects or Array-like objects...
        match.routes = Object.assign({}, match.sRoutes) // But it is capable of storing Objects with numbered access without length property ;)
        // so we naturally store length property separately
        // this might be complicated and counter-intuitive approach, but using other cache will reduce performance
        cache.set(reqCacheKey, match)
      }
      match.routes.length = match.routesLength
      match.routes = Array.from(match.routes)
    } else {
      // route validation
      match = router.find(req.method, req.path, req, res)
      match.routes = match.sRoutes
    }

    if (match.handlers.length > 0) {
      const middlewares = [...match.handlers]
      const middlewaresArgsNum = [...match.handlersArgsNum]

      if (step !== undefined) {
        // router is being used as a nested router
        if (!config.mergeParams) {
          req.params = onChange.unsubscribe(req.params)
          makeReqParams(req)
        }
        let fn
        if (step && req.stepString && step.toString() !== req.stepString) {
          // req.paramsPrev.push(req.params)
          fn = function (err) {
            req.params = req.paramsPrev[req.paramsPrev.length - 2 ] || req.paramsPrev[req.paramsPrev.length - 1] || req.params
            
            try {
              return step(err)
            } catch (e) {
              return res.defaultErrHandler(err)
            }
          }
        } else {
          fn = (req, res, next) => {
            req.rData_internal.url = req.rData_internal.urlPrevious.pop()
            req.app = res.app = req.rData_internal.appPrev.pop()
            req.rData_internal.tree.pop()

            delete req.preRouterUrl
            // delete req.preRouterPath
            req.next = step
            return step()
          }
        }
        fn.finisher = true
        middlewares.push(fn)
      }

      req.routesToProcess = Array.from(match.routes)

      if (!req.params) {
        makeReqParams(req)
      }

      return next(middlewares, middlewaresArgsNum, req, res, 0, 0, routers, config.defaultRoute, config.errorHandler, null)
    } else {
      return config.defaultRoute(req, res)
    }
  }

  router.on = (method, pattern, ...handlers) => router.add(method, pattern, handlers)

  return router
}

function makeReqParams (req) {
  if (!req.paramsPrev) req.paramsPrev = []
  req.params = {}
  req.paramsUserDefined = []
  req.params = onChange(req.params, function (path, value, previousValue, name) {
    req.paramsUserDefined.push(path)
  }, {
    isShallow: true
  })
}
