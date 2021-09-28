'use strict'

// Forked from jkybernees's excellent 0http

const Trouter = require('./trouter')
const next = require('./next')
const LRU = require('mnemonist/lru-cache')
const pathToRegexp = require('path-to-regexp')
const onChange = require('on-change')

const fastDecode = require('fast-decode-uri-component')

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
  if (config.id === undefined) {
    config.id = (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase()
  }

  const routers = {}
  const cache = new LRU(config.cacheSize)

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
    let fn
    if (!step) {
      req.originalUrl = req.url // if there is no req.rData_internal, it means there is no req.originalUrl either
      req.rData_internal = {
        urlPrev: req.url,
        methodPrev: req.method,
        appPrev: [],
        urlPrevious: []
      }

      makeReqParams(req)

      const split = req.url.split('?')
      req.path = split[0]

      const queryparse = req.app.__settings.get('query parser fn')
      req.search = '?' + split[1]
      req.query = queryparse(split[1])

      res.locals = Object.create(null) // res.locals is rather convenient at times, so we leave it on even for API routes
      req.paramsCalled = {} // needed for app.param

      return carryOn()
    }

    const urlBackup = req.url
    req.url = req.url.replace(req.rData_internal.lastPattern, '').trim() || urlBackup
    req.rData_internal.urlPrev = req.url

    const split = req.url.split('?', 1) // this is NOT repetitive code as req.url value is now different here
    req.path = split[0]

    if (!config.mergeParams) {
      req.params = onChange.unsubscribe(req.params)
      makeReqParams(req)
    }

    fn = (req, res, next) => {
      req.url = req.rData_internal.urlPrevious.pop()
      req.rData_internal.urlPrev = req.url
      req.app = res.app = req.rData_internal.appPrev.pop()

      req.next = step
      return step()
    }
    if (step && req.stepString && step.toString() !== req.stepString) {
      fn = function (err) {
        req.params = req.rData_internal.paramsPrev[req.rData_internal.paramsPrev.length - 2] || req.rData_internal.paramsPrev[req.rData_internal.paramsPrev.length - 1] || req.params

        return step(err)
      }
    }
    return carryOn()

    function carryOn () {
      const reqCacheKey = req.method + req.path
      let match = cache.get(reqCacheKey)
      if (!match) {
        match = router.find(req.method, req.path, req, res)
        match.urlProperVerified = fastDecode(req.path)
        if (!req.app.__settings.get('etag')) match.noEtag = true
        cache.set(reqCacheKey, match)
      }

      req.rData_internal.noEtag = match.noEtag
      req.rData_internal.urlProperVerified = match.urlProperVerified
      /* we can cache this, because same route matches are gonna have the same result.
        if there is some bogus data in query part, query parser is gonna fail separately */

      const middlewares = [...match.handlers]
      if (fn) middlewares.push(fn)
      const middlewaresArgsNum = match.handlersArgsNum

      req.routesToProcess = match.routes

      return next(middlewares, middlewaresArgsNum, req, res, 0, 0, routers, config.defaultRoute, config.errorHandler, null)
    }
  }

  router.on = (method, pattern, ...handlers) => router.add(method, pattern, handlers)

  return router
}

function makeReqParams (req) {
  if (!req.rData_internal.paramsPrev) req.rData_internal.paramsPrev = []
  req.params = {}
  req.paramsUserDefined = []
  req.params = onChange(req.params, function (path, value, previousValue, name) {
    if (typeof req.params !== 'object') {
      req.params = req.rData_internal.paramsPrev[req.rData_internal.paramsPrev.length - 1 || 0] || {}
      return
    }
    req.paramsUserDefined.push(path)
  }, {
    isShallow: true
  })
}
