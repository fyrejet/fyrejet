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
  function getPath (req, url) {
    req.path = path
  }
  const [path, search] = url.split('?')
  if (!req.path) {
    try {
      getPath(req, url)
    } catch (e) {
      delete req.path
      getPath(req, url)
    }
  }
  if (!req.query) {
    var queryparse = fn
    if (!queryparse) {
      queryparse = function (str) {
        return qs.parse(str, {
          allowPrototypes: true
        })
      }
    }

    
    switch (search) {
      case undefined:
      case '': {
        req.search = '?'
        req.query = {}
        break
      }
      default: {
        req.search = '?' + search
        const val = parseUrl(req).query
        req.query = queryparse(val)
      }
    }
    
  }
}
