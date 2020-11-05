'use strict'

/*!
 * Fyrejet
 * Copyright(c) 2020 Nicholas Schamberg
 * MIT Licensed
*/

/**
 * Module dependencies.
 */

var parseUrl = require('parseurl')
var qs = require('qs')

module.exports = function query (req, url, fn) {
  const path = url.split('?')[0]
  req.path = path

  if (!req.query) {
    var queryparse = fn
    if (!queryparse) {
      queryparse = function (str) {
        return qs.parse(str, {
          allowPrototypes: true
        })
      }
    }
    const val = parseUrl(req).query || ''
    req.search = '?' + val
    req.query = queryparse(val)
    return
  }
  return
}
