'use strict'

/*!
 * Fyrejet
 * Copyright(c) 2020 Nicholas Schamberg
 * MIT Licensed
*/

const EventEmitter = require('events').EventEmitter
const proto = require('./lib/application')
const req = require('./lib/request')
const res = require('./lib/response')
const bodyParser = require('body-parser')
const finalhandler = require('finalhandler')

const requestRouter = require('./lib/routing/request-router')

const initMiddleware = require('./lib/middleware/init')
const { logerror } = require('./lib/utils')

const appCore = function (options, server, app) {
  const startFn = (...args) => {
    if (!args || !args.length) args = [3000]
    if (options.serverType === 'uWebSockets') {
      const __address = {}
      server.__address = __address
      server.serverType = options.serverType
      if (typeof args[args.length - 1] !== 'function') {
        args.push((socket) => {
          // stub function
        })
      }
      let ipFamily = app.get('ipFamily')
      if (ipFamily !== 'IPv6' && ipFamily !== 'IPv4') ipFamily = 'IPv6'

      switch (args.length >= 3) {
        case true:
          server.__address.address = args[0]
          server.__address.port = args[1]
          server.__address.family = ipFamily
          break
        case false:
          server.__address.port = args[0]
          server.__address.family = ipFamily
          if (ipFamily === 'IPv6') server.__address.address = '::'
          else server.__address.address = '127.0.0.1'
          break
      }
      server.address = () => {
        return __address
      }
    }
    server.listen(...args)
    return server
  }
  const core = {
    errorHandler: options.errorHandler,
    fyrejetApp: true,
    newRouter () {
      return requestRouter(options)
    },

    getServer () {
      return server
    },

    getConfigOptions () {
      return options
    },

    getRouter () {
      return this.getRouter()
    },
    uWebSockets: function () {
      if (server.keepAliveTimeout) return false
      return true
    },
    logerror: logerror.bind(app),
    handle: function handle (req, res, step) {
      res.__serverType = options.serverType
      res.defaultErrHandler = function (err) {
        if (this.writableEnded) return console.log(err)

        const fh = finalhandler(req, res, {
          env: app.get('env'),
          onerror: app.logerror
        })

        if (req.rData_internal.method !== 'OPTIONS') {
          return fh(err)
        }

        const options = req.app.getRouter().availableMethodsForRoute[req.url]
        if (!options) {
          return fh(err || false)
        }
        const optionsString = options.join(',')
        res.setHeader('Allow', optionsString)
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.statusCode = 200
        return this.end(optionsString)
      }

      this.poweredBy(res)

      req.app = this
      res.app = req.app
      req.res = res
      res.req = req

      return this.getRouter().lookup(req, res, step)
    },

    start: startFn,
    listen: startFn,
    address: function () {
      if (server.address && typeof server.address === 'function') {
        return server.address()
      }
      return server.__address
    },
    close: (cb) => {
      return server.close(cb)
    }
  }

  return core
}

exports = module.exports = createApplication

const defaultErrorHandler = (err, req, res) => {
  return res.defaultErrHandler(err)
}

function createApplication (options = {}) {
  options.errorHandler = options.errorHandler || defaultErrorHandler
  if (options.serverType === 'uWebSocket' || options.serverType === 'uWebSockets' || process.env.UWS_SERVER_ENABLED_FOR_TEST === 'TRUE' || process.env.UWS_SERVER === 'TRUE') { // legacy or tests
    options.serverType = 'uWebSockets'
    options.prioRequestsProcessing = false
    options.server = require('./lib/uwsCompat').uwsCompat(options)
    process.env.UWS_SERVER = 'true'
  }

  let server = options.server || require('http').createServer()

  if (!server) {
    if (options.key && options.cert) {
      server = require('https').createServer({ key: options.key, cert: options.cert })
    } else {
      server = require('http').createServer()
    }
  }
  const prp = undefined === options.prioRequestsProcessing ? true : options.prioRequestsProcessing
  if (prp) {
    server.on('request', (req, res) => {
      setImmediate(() => app.handle(req, res))
    })
    // this may be counterintuitive to you, but this is faster, since it allows to skip some phases in the event pool. This is prioritized.
  } else {
    server.on('request', (req, res) => {
      app.handle(req, res)
    })
  }

  const app = function (req, res, next) {
    app.handle(req, res, next)
  }

  Object.assign(app, proto)
  Object.assign(app, appCore(options, server, app))
  Object.assign(app, EventEmitter.prototype)

  //app.request = Object.create(req, {
  //  app: { configurable: true, enumerable: true, writable: true, value: app }
  //})
//
  //// expose the prototype that will get set on responses
  //app.response = Object.create(res, {
  //  app: { configurable: true, enumerable: true, writable: true, value: app }
  //})

  app.handler = app.handle
  app.callback = () => app.handle

  // apply router capabilities
  requestRouter(options, app)

  // Init the express-like app abilities
  app.init(options)

  app.use(initMiddleware(app))

  return app
}

exports.initMiddleware = initMiddleware
exports.defaultErrorHandler = defaultErrorHandler // expose defaultErrorHandler for router

/**
 * Expose middleware
*/

exports.json = bodyParser.json
exports.raw = bodyParser.raw
exports.static = require('./lib/additions/static.js')
exports.text = bodyParser.text
exports.urlencoded = bodyParser.urlencoded

/**
 * Expose the prototypes.
 */
exports.appCore = appCore
exports.application = proto
exports.request = req
exports.response = res

/**
 * Expose constructors.
 */

// exports.Route = Route;
exports.Router = createApplication

exports.uwsCompat = require('./lib/uwsCompat').uwsCompat

/**
 * Replace Express removed middleware with an appropriate error message. We are not express, but we will imitate it precisely
 */

const removedMiddlewares = [
  'bodyParser',
  'compress',
  'cookieSession',
  'session',
  'logger',
  'cookieParser',
  'favicon',
  'responseTime',
  'errorHandler',
  'timeout',
  'methodOverride',
  'vhost',
  'csrf',
  'directory',
  'limit',
  'multipart',
  'staticCache'
]

removedMiddlewares.forEach(function (name) {
  Object.defineProperty(exports, name, {
    get: function () {
      throw new Error('Most middleware (like ' + name + ') is no longer bundled with Express (and thus Fyrejet) and must be installed separately. Please see https://github.com/senchalabs/connect#middleware.')
    },
    configurable: true
  })
})
