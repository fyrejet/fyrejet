'use strict'

/*!
 * Fyrejet
 * Copyright(c) 2020 Nicholas Schamberg
 * MIT Licensed
*/

// Based on Express /lib/application.js

var methods = require('./routing/methods')
const { v4: uuidv4 } = require('uuid')
var debug = require('debug')('fyrejet:application')
var View = require('./view')
var deprecate = require('depd')('fyrejet')
var compileETag = require('./utils').compileETag
var compileQueryParser = require('./utils').compileQueryParser
var compileTrust = require('./utils').compileTrust
const pathToRegexp = require('path-to-regexp')

var flatten = require('array-flatten')
var merge = require('./utils').merge
var resolve = require('path').resolve
var slice = Array.prototype.slice

var objectRegExp = /^\[object (\S+)\]$/

var app = exports = module.exports = {

}

var trustProxyDefaultSymbol = '@@symbol:trust_proxy_default'

app.init = function init (options) {
  this.cache = {}
  this.engines = {}
  this.settings = options

  this.defaultConfiguration()
}

app.defaultConfiguration = function defaultConfiguration (options) {
  var env = process.env.NODE_ENV || 'development'

  // default settings
  this.enable('x-powered-by')
  if (!this.settings.etag) {
    this.set('etag', 'weak')
  }
  this.set('env', env)

  if (!this.settings['fyrejet mode']) this.set('fyrejet mode', false)

  if (!this.settings['query parser']) this.set('query parser', 'extended')
  else this.set('query parser', this.settings['query parser'])

  if (!this.settings['subdomain offset']) this.set('subdomain offset', 2)

  if (!this.settings['trust proxy']) this.set('trust proxy', false)
  else this.set('trust proxy', this.settings['trust proxy'])
  if (!this.settings['case sensitive routing'] && !this.settings.caseSensitive) {
    this.settings.caseSensitive = false
    this.getRouter().modifySetting('sensitive', false)
  } else {
    this.settings.caseSensitive = true
    this.getRouter().modifySetting('sensitive', true)
  }
  // trust proxy inherit back-compat
  Object.defineProperty(this.settings, trustProxyDefaultSymbol, {
    configurable: true,
    value: true
  })

  debug('booting in %s mode', env)

  this.on('mount', function onmount (parent) {
    // inherit trust proxy
    if (this.settings[trustProxyDefaultSymbol] === true &&
      typeof parent.settings['trust proxy fn'] === 'function') {
      delete this.settings['trust proxy']
      delete this.settings['trust proxy fn']
    }
    this.mounted = true
    Object.setPrototypeOf(this.engines, parent.engines)
    Object.setPrototypeOf(this.settings, parent.settings)
    const useOpts = {
      end: false,
      strict: false,
      sensitive: this.settings.caseSensitive
    }
    const keys = []
    const sequentialRegex = pathToRegexp(this.mountpath, keys, useOpts)
    if (this.mountpath !== '/') {
      this.getRouter().changeSequentialConfig('mountpath', sequentialRegex)
    }
    this.disable('x-powered-by')
  })

  // setup locals
  this.locals = Object.create(null)

  // top-most app is mounted at /
  if (!this.mountpath) this.mountpath = '/'

  // default locals
  this.locals.settings = this.settings

  // default configuration
  this.set('view', View)
  this.set('views', resolve('views'))
  this.set('jsonp callback name', 'callback')

  if (env === 'production') {
    this.enable('view cache')
  }

  Object.defineProperty(this, 'router', {
    get: function () {
      throw new Error('\'app.router\' is deprecated!\nPlease see the 3.x to 4.x migration guide for details on how to update your app.')
    }
  })
}

app.route = function route (path) {
  const routeFormer = {
    app: this,
    path
  }

  methods.forEach((method) => {
    routeFormer[method] = function (fn) {
      this.app[method](this.path, fn)
      return this
    }
  })

  return routeFormer
}

app.engine = function engine (ext, fn) {
  if (typeof fn !== 'function') {
    throw new Error('callback function required')
  }

  // get file extension
  var extension = ext[0] !== '.'
    ? '.' + ext
    : ext

  // store engine
  this.engines[extension] = fn

  return this
}

app.param = function param (name, fn) {
  const router = this.getRouter()
  if (Array.isArray(name)) {
    for (var i = 0, j = name.length; i < j; i++) {
      this.param(name[i], fn)
    }

    return this
  }
  if (typeof name === 'function') {
    this.param('FYREJET_GLOBAL_PARAM', name)
    deprecate('router.param(fn): Refactor to use path params')
    return this
  }
  if (typeof fn !== 'function') {
    throw new Error('invalid param() call for ' + name + ', got ' + fn)
  }
  if (!router.paramHandlers[name]) {
    router.paramHandlers[name] = []
  }
  const guid = uuidv4()
  const newFn = function (req, res, next) { // compatibility wrapper. Express param functions often have a fourth argument, which is not compatible with restana base that we use
    try {
      // req.params[name] = decodeURI(req.params[name])
      const arg4 = req.params[name]
      if (req.paramsCalled[guid] && req.paramsCalled[guid][name]) {
        if (req.paramsCalled[guid][name].includes(arg4)) return next()
        req.paramsCalled[guid][name].push(arg4)
        return fn(req, res, next, arg4)
      }
      if (!req.paramsCalled[guid] || !req.paramsCalled[guid][name]) {
        req.paramsCalled[guid] = {}
        req.paramsCalled[guid][name] = [arg4]
        return fn(req, res, next, arg4)
      }
    } catch (e) {
      return next(e)
    }
  }
  router.paramHandlers[name].push(newFn)
  return this
}

app.set = function set (setting, val) {
  if (arguments.length === 1) {
    // app.get(setting)
    return this.settings[setting]
  }

  debug('set "%s" to %o', setting, val)

  // set value
  this.settings[setting] = val

  // trigger matched settings
  switch (setting) {
    case 'fyrejet mode':
      this.settings['fyrejet mode'] = val
      if (val !== 'api' && val !== 'properties as functions') break
      this.getRouter().changeSequentialConfig('specialMode', val)
      break
    case 'strict routing':
      this.settings.strict = val
      this.getRouter().modifySetting('strict', val)
      break
    case 'case sensitive routing':
      this.settings.caseSensitive = val
      this.getRouter().modifySetting('sensitive', val)
      break
    case 'etag':
      this.set('etag fn', compileETag(val))
      break
    case 'query parser':
      this.set('query parser fn', compileQueryParser(val))
      break
    case 'trust proxy':
      this.set('trust proxy fn', compileTrust(val))

      // trust proxy inherit back-compat
      Object.defineProperty(this.settings, trustProxyDefaultSymbol, {
        configurable: true,
        value: false
      })

      break
  }

  return this
}

app.path = function path () {
  return this.parent
    ? this.parent.path() + this.mountpath
    : ''
}

app.enabled = function enabled (setting) {
  return Boolean(this.set(setting))
}

app.disabled = function disabled (setting) {
  return !this.set(setting)
}

app.enable = function enable (setting) {
  return this.set(setting, true)
}

app.disable = function disable (setting) {
  return this.set(setting, false)
}

app.render = function render (name, options, callback) {
  var cache = this.cache
  var done = callback
  var engines = this.engines
  var opts = options
  var renderOptions = {}
  var view

  // support callback function as second arg
  if (typeof options === 'function') {
    done = options
    opts = {}
  }

  // merge app.locals
  merge(renderOptions, this.locals)

  // merge options._locals
  if (opts._locals) {
    merge(renderOptions, opts._locals)
  }

  // merge options
  merge(renderOptions, opts)

  // set .cache unless explicitly provided
  if (renderOptions.cache == null) {
    renderOptions.cache = this.enabled('view cache')
  }

  // primed cache
  if (renderOptions.cache) {
    view = cache[name]
  }

  // view
  if (!view) {
    var View = this.get('view')
    view = new View(name, {
      defaultEngine: this.get('view engine'),
      root: this.get('views'),
      engines: engines
    })

    if (!view.path) {
      var dirs = Array.isArray(view.root) && view.root.length > 1
        ? 'directories "' + view.root.slice(0, -1).join('", "') + '" or "' + view.root[view.root.length - 1] + '"'
        : 'directory "' + view.root + '"'
      var err = new Error('Failed to lookup view "' + name + '" in views ' + dirs)
      err.view = view
      return done(err)
    }

    // prime the cache
    if (renderOptions.cache) {
      cache[name] = view
    }
  }

  // render
  tryRender(view, renderOptions, done)
}

app.use = function (fn) {
  var offset = 0
  var path = '*'
  // default path to '*'. It will later be transformed to "/" anyways
  // disambiguate app.use([fn])
  if (typeof fn !== 'function') {
    var arg = fn

    while (Array.isArray(arg) && arg.length !== 0) {
      arg = arg[0]
    }

    // first arg is the path
    if (typeof arg !== 'function') {
      offset = 1
      path = fn
    }
  }

  var fns = flatten(slice.call(arguments, offset))

  if (fns.length === 0) {
    throw new TypeError('app.use() requires a middleware function')
  }
  fns.forEach(item => {
    if (item === 'api' || item === 'propsAsFns' || item === 'noEtag') return
    const whatItIs = getType(item)
    if (whatItIs !== 'function') {
      throw new Error(`app.use() requires a middleware function but got a ${whatItIs}`)
    }
  })

  // setup router
  var router = this.getRouter()

  fns.forEach(function (fn, index) {
    if (fn === 'api' || fn === 'propsAsFns' || fn === 'noEtag') return
    // non-fyrejet app
    let altFn
    if (!fn.fyrejetApp) {
      if (path === '*') path = '/'
      if (require('express').request.isPrototypeOf(fn.request)) {
        fn.mountpath = path
        fn.parent = this
        fn.mounted = true
        fn.use((req, res, next) => {
          req.rData_internal.url = req.rData_internal.urlPrevious.pop()
          req.app = res.app = req.rData_internal.appPrev.pop()
          Object.keys(req.app.response).forEach(key => {
            res[key] = req.app.response[key]
          })
          Object.keys(req.app.request).forEach(key => {
            req[key] = req.app.request[key]
          })
          Object.defineProperties(req, req.rData_internal.reqProperties)
          return req.next()
        })
        altFn = function mountedApp (req, res, next) {
          req.rData_internal.appPrev.push(req.app)
          if (!req.rData_internal.urlPrevious) req.rData_internal.urlPrevious = []
          req.rData_internal.urlPrevious.push(req.url)
          req.rData_internal.url = req.url.replace(path, '')
          if (req.rData_internal.url[0] !== '/') req.rData_internal.url = '/' + req.rData_internal.url
          // var orig = req.app;
          fn.handle(req, res, function (err) {
            // Object.setPrototypeOf(req, orig.request)
            // Object.setPrototypeOf(res, orig.response)
            next(err)
          })
        }
      }
      if (index < fns.length - 1 && typeof fns[fns.length - 1] === 'string') {
        router.useMiddleware(path, altFn || fn, fns[fns.length - 1])
        return
      }
      return router.useMiddleware(path, altFn || fn)
    }

    // fyrejet app

    if (path === '*') path = '/'

    debug('.use app under %s', path)

    fn.mountpath = path
    fn.parent = this
    fn.mounted = true
    if (index < fns.length - 1 && typeof fns[fns.length - 1] === 'string') {
      router.useMiddleware(path, fn, fns[fns.length - 1])
      return
    }
    router.useMiddleware(path, fn)

    // mounted an app
    fn.emit('mount', this)
  }, this)

  return this
}

function tryRender (view, options, callback) {
  try {
    view.render(options, callback)
  } catch (err) {
    callback(err)
  }
}

function getType (obj) {
  var type = typeof obj

  if (type !== 'object') {
    return type
  }

  // inspect [[Class]] for objects
  return toString.call(obj)
    .replace(objectRegExp, '$1')
}
