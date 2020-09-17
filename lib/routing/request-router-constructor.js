'use strict'

/*!
 * Fyrejet
 * Copyright(c) 2020 Nicholas Schamberg
 * MIT Licensed
*/

const requestRouter = require('./request-router')
const fyrejetMain = require('../../index')
var mixin = require('merge-descriptors')
var proto = require('../application')
var EventEmitter = require('events').EventEmitter
var req = require('../request')
var res = require('../response')

function init (options = {}) {
  options.slave = true
  options.cacheSize = 300
  var router = function (req, res, next) {
    return fyrejetMain.appCore(options).handle.apply(router, [req, res, next])
  }
  router.handle = function (req, res, next) {
    return fyrejetMain.appCore(options).handle.apply(router, [req, res, next])
  }

  Object.assign(router, proto)
  Object.assign(router, EventEmitter.prototype)
  requestRouter(options, router)

  router.response = Object.assign({}, res)
  router.request = Object.assign({}, req)
  const reqProperties = {}
  const reqPropertiesEssential = {}
  router.reqProperties = reqProperties
  router.reqPropertiesEssential = reqPropertiesEssential
  Object.keys(router.request.propFn).forEach(name => {
    if (name.includes('Setter')) return
    let set
    if (router.request.propFn[name + 'Setter']) set = router.request.propFn[name + 'Setter']
    reqProperties[name] = {
      configurable: true,
      enumerable: true,
      get: router.request.propFn[name],
      set: set
    }
    if (router.request.propFn[name].essential) {
      reqPropertiesEssential[name] = {
        configurable: true,
        enumerable: true,
        get: router.request.propFn[name],
        set: set
      }
    }
  })
  const initMiddleware = fyrejetMain.initMiddleware(options, reqProperties, reqPropertiesEssential, router)
  initMiddleware.init = true
  router.slave = true
  router.init(options)
  router.use(initMiddleware)
  router.fyrejetApp = true

  return router
}

module.exports = init
