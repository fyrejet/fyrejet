'use strict'

/*!
 * Fyrejet
 * Copyright(c) 2020 Nicholas Schamberg
 * MIT Licensed
*/

// Based on Express /lib/application.js

const methods = require('./routing/methods')
const { v4: uuidv4 } = require('uuid')
const debug = require('debug')('fyrejet:application')
const View = require('./view')
const deprecate = require('depd')('fyrejet')
const compileETag = require('./utils').compileETag
const compileQueryParser = require('./utils').compileQueryParser
const compileTrust = require('./utils').compileTrust
const pathToRegexp = require('path-to-regexp')

const flatten = require('array-flatten')
const merge = require('./utils').merge
const resolve = require('path').resolve
const slice = Array.prototype.slice

const objectRegExp = /^\[object (\S+)\]$/

function createDataStorage () {
  let storage = {

  }

  return ({

    keys: function keys () {
      return Object.keys(storage)
    },

    has: function has (key) {
      return key in storage
    },

    remove: function remove (key) {
      return delete storage[key]
    },

    get: function get (key) {
      return storage[key]
    },

    getAll: function getAll () {
      return storage
    },

    set: function set (prop, val) {
      storage[prop] = val
      return this
    },

    setOnce: function setOnce (prop, val) {
      if (!storage[prop]) storage[prop] = val
      return this
    },

    reset: function reset (obj) {
      if (!obj || typeof obj !== 'object') return this
      storage = obj

      return this
    }
  })
}

const app = exports = module.exports = {

}

const trustProxyDefaultSymbol = '@@symbol:trust_proxy_default'

app.poweredBy = function (res) {
  this.poweredByFn(res)
}

app.init = function init (options) {
  this.cache = {}
  this.engines = {}
  this.__settings = createDataStorage()
  this.settings = new Proxy(this.__settings, {
    get: function (target, key) {
      return target.get(key)
    },
    set: function (target, key, value) {
      return target.set(key, value)
    },
    deleteProperty: function (target, key) {
      const forbiddenKeys = ['etag', 'query parser fn', 'query parser']
      if (forbiddenKeys.indexOf(key) !== -1) { return true }
      return target.remove(key)
    },
    enumerate: function (target) {
      return target.keys()
    },
    ownKeys: function (target) {
      return target.keys()
    },
    has: function (target, key) {
      return target.has(key)
    },
    defineProperty: function (target, key, desc) {
      if (desc && 'value' in desc) { target.set(key, desc.value) }
      return target
    },
    getOwnPropertyDescriptor: function (target, key) {
      const vValue = target.get(key)
      return vValue ? {
        value: vValue,
        writable: true,
        enumerable: true,
        configurable: true
      } : undefined
    }
  })

  this.defaultConfiguration()
}

app.defaultConfiguration = function defaultConfiguration (options) {
  const env = process.env.NODE_ENV || 'development'

  // default settings
  this.enable('x-powered-by')
  if (!this.settings.etag) {
    this.set('etag', 'weak')
  }
  this.set('env', env)

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

      const parentSettingsKeys = Object.keys(parent.settings)

      for (let i = 0; i < parentSettingsKeys.length; i++) {
        const key = parentSettingsKeys[i]
        if (!this.settings[key]) {
          this.settings[key] = parent.settings[key]
        }
      }
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
  const extension = ext[0] !== '.'
    ? '.' + ext
    : ext

  // store engine
  this.engines[extension] = fn

  return this
}

app.param = function param (name, fn) {
  const router = this.getRouter()
  if (Array.isArray(name)) {
    for (let i = 0, j = name.length; i < j; i++) {
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

app.set = function set (...args) {
  const [setting, val] = args
  if (args.length < 2) {
    return this.settings[setting]
  }

  debug('set "%s" to %o', setting, val)

  // set value
  this.settings[setting] = val

  // trigger matched settings
  switch (setting) {
    case 'x-powered-by':
      if (val === true) {
        this.poweredByFn = function (res) {
          res.setHeader('X-Powered-By', 'Fyrejet')
        }
        break
      }
      this.poweredByFn = function (res) {

      }
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
  const cache = this.cache
  let done = callback
  const engines = this.engines
  let opts = options
  const renderOptions = {}
  let view

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
    const View = this.get('view')
    view = new View(name, {
      defaultEngine: this.get('view engine'),
      root: this.get('views'),
      engines: engines
    })

    if (!view.path) {
      const dirs = Array.isArray(view.root) && view.root.length > 1
        ? 'directories "' + view.root.slice(0, -1).join('", "') + '" or "' + view.root[view.root.length - 1] + '"'
        : 'directory "' + view.root + '"'
      const err = new Error('Failed to lookup view "' + name + '" in views ' + dirs)
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
  let offset = 0
  let path = '*'
  // default path to '*'. It will later be transformed to "/" anyways
  // disambiguate app.use([fn])
  if (typeof fn !== 'function') {
    let arg = fn

    while (Array.isArray(arg) && arg.length !== 0) {
      arg = arg[0]
    }

    // first arg is the path
    if (typeof arg !== 'function') {
      offset = 1
      path = fn
    }
  }

  const fns = flatten(slice.call(arguments, offset))

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
  const router = this.getRouter()

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
          req.rData_internal.urlPrevious.push(req.rData_internal.url)
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
  const type = typeof obj

  if (type !== 'object') {
    return type
  }

  // inspect [[Class]] for objects
  return toString.call(obj)
    .replace(objectRegExp, '$1')
}
