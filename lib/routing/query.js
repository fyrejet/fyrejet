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
  const [path, search] = url.split('?')
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
    if (!search) {
      req.search = '?'
      req.query = {}
      return
    }
    req.search = '?' + search
    const val = parseUrl(req).query
    req.query = queryparse(val)
    return
  }
  return
}
