'use strict'

/*!
 * Fyrejet
 * Copyright(c) 2020 Nicholas Schamberg
 * MIT Licensed
*/

var EventEmitter = require('events').EventEmitter
var proto = require('./lib/application')
var req = require('./lib/request')
var res = require('./lib/response')
var bodyParser = require('body-parser')
var finalhandler = require('finalhandler')
var mixin = require('merge-descriptors')

const requestRouter = require('./lib/routing/request-router')

var initMiddleware = require('./lib/middleware/init')
const { logerror } = require('./lib/utils')

var appCore = function (options, server, mounted) {
  if (options.serverType === 'uWebSocket') {
    req.listeners = function () {
      return []
    }
    req.resume = function () {}
    res.serverType = 'uWebSocket'
  }

  const startFn = (...args) => {
    if (!args || !args.length) args = [3000]
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

    handle: function handle (req, res, step) {
      res.defaultErrHandler = finalhandler(req, res, {
        env: this.get('env'),
        onerror: logerror.bind(this)
      })
      if (!this.mounted && !req.rData_internal) {
        if (this.enabled('x-powered-by')) res.setHeader('X-Powered-By', 'Fyrejet')

        req.app = this
        res.app = req.app
        req.res = res
        res.req = req
      }
      try {
        this.getRouter().lookup(req, res, step)
      } catch (e) {
        return res.defaultErrHandler(e)
      }
    },

    start: startFn,
    listen: startFn,
    address: function () {
      const addr = server.address()
      return addr
    },
    close: () => new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err)
        resolve()
      })
    })
  }
  return core
}

exports = module.exports = createApplication

var defaultErrorHandler = (err, req, res) => {
  return res.defaultErrHandler(err)
}

function createApplication (options = {}) {
  options.errorHandler = options.errorHandler || defaultErrorHandler

  var server = options.server || require('http').createServer()

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
  } else {
    server.on('request', (req, res) => {
      app.handle(req, res)
    })
  }

  var app = function (req, res, next) {
    app.handle(req, res, next)
  }

  mixin(app, appCore(options, server))
  mixin(app, EventEmitter.prototype)
  mixin(app, proto)

  app.request = Object.assign({}, req)

  const reqProperties = {}
  app.reqPropertiesEssential = reqProperties
  const reqPropertiesEssential = {}
  app.reqPropertiesEssential = reqPropertiesEssential
  Object.keys(app.request.propFn).forEach(name => {
    if (name.includes('Setter')) return
    let set
    if (app.request.propFn[name + 'Setter']) set = app.request.propFn[name + 'Setter']
    reqProperties[name] = {
      configurable: true,
      enumerable: true,
      get: app.request.propFn[name],
      set: set
    }
    if (app.request.propFn[name].essential) {
      reqPropertiesEssential[name] = {
        configurable: true,
        enumerable: true,
        get: app.request.propFn[name],
        set: set
      }
    }
  })

  // expose the prototype that will get set on responses
  app.response = Object.assign({}, res)

  app.handler = app.handle
  app.callback = () => app.handle

  // apply router capabilities
  requestRouter(options, app)

  // Init the express-like app abilities
  app.init(options)

  app.use(initMiddleware(options, reqProperties, reqPropertiesEssential, app))

  return app
}

exports.initMiddleware = initMiddleware
exports.defaultErrorHandler = defaultErrorHandler // expose defaultErrorHandler for router

exports.application = proto
exports.request = req
exports.response = res

/**
 * Expose middleware
*/

exports.json = bodyParser.json
exports.query = require('./lib/routing/query')
exports.raw = bodyParser.raw
exports.static = require('./lib/additions/static.js')
exports.text = bodyParser.text
exports.urlencoded = bodyParser.urlencoded

/**
 * Helper function for creating a getter on an object.
 *
 * @param {Object} obj
 * @param {String} name
 * @param {Function} getter
 * @private
 */

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
exports.Router = require('./lib/routing/request-router-constructor')

/**
 * Replace Express removed middleware with an appropriate error message. We are not express, but we will imitate it precisely
 */

var removedMiddlewares = [
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
      throw new Error('Most middleware (like ' + name + ') is no longer bundled with Express and must be installed separately. Please see https://github.com/senchalabs/connect#middleware.')
    },
    configurable: true
  })
})
