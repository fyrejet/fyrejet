'use strict'

// we don't use this file, but provide it nonetheless

/**
 * Module dependencies.
 */

var merge = require('utils-merge')
var parseUrl = require('parseurl')
var qs = require('qs')

/**
 * @param {Object} options
 * @return {Function}
 * @api public
 */

module.exports = function query (options) {
  var opts = merge({}, options)
  var queryparse = qs.parse

  if (typeof options === 'function') {
    queryparse = options
    opts = undefined
  }

  if (opts !== undefined && opts.allowPrototypes === undefined) {
    // back-compat for qs module
    opts.allowPrototypes = true
  }

  return function query (req, res, next) {
    if (!req.query) {
      var val = parseUrl(req).query
      req.query = queryparse(val, opts)
    }

    next()
  }
}
