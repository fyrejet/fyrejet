'use strict'

/*!
 * Fyrejet
 * Copyright(c) 2020 Nicholas Schamberg
 * MIT Licensed
*/

const requestRouter = require('./request-router')
const fyrejetMain = require('../../index')
var proto = require('../application')
var EventEmitter = require('events').EventEmitter

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

  
  
  const initMiddleware = fyrejetMain.initMiddleware(options, router)
  initMiddleware.init = true
  router.slave = true
  router.init(options)
  router.use(initMiddleware)
  router.fyrejetApp = true

  return router
}

module.exports = init
