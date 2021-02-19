'use strict'

/*!
 * Fyrejet
 * Copyright(c) 2020 Nicholas Schamberg
 * MIT Licensed
*/

var accepts = require('accepts')
var deprecate = require('depd')('fyrejet')
var { isIP } = require('net')
var typeis = require('type-is')
var http = require('http');
var fresh = require('fresh')
var parseRange = require('range-parser')
var proxyaddr = require('proxy-addr')

var proto = http.IncomingMessage.prototype

if (process.env.UWS_SERVER || process.env.UWS_SERVER_ENABLED_FOR_TEST) {
  var uwsCompat = require('./uwsCompat.js')
  proto = uwsCompat.uwsHttpRequest.prototype
}

var req = Object.create(proto)

module.exports = req

req.get =
req.header = function header (name) {
  if (!name) {
    throw new TypeError('name argument is required to req.get')
  }

  if (typeof name !== 'string') {
    throw new TypeError('name must be a string to req.get')
  }

  var lc = name.toLowerCase()

  switch (lc) {
    case 'referer':
    case 'referrer':
      return this.headers.referrer ||
        this.headers.referer
    default:
      return this.headers[lc]
  }
}

req.accepts = function () {
  var accept = accepts(this)
  return accept.types.apply(accept, arguments)
}

req.acceptsEncodings = function () {
  var accept = accepts(this)
  return accept.encodings.apply(accept, arguments)
}

req.acceptsEncoding = deprecate.function(req.acceptsEncodings,
  'req.acceptsEncoding: Use acceptsEncodings instead')

req.acceptsCharsets = function () {
  var accept = accepts(this)
  return accept.charsets.apply(accept, arguments)
}

req.acceptsCharset = deprecate.function(req.acceptsCharsets,
  'req.acceptsCharset: Use acceptsCharsets instead')

req.acceptsLanguages = function () {
  var accept = accepts(this)
  return accept.languages.apply(accept, arguments)
}

req.acceptsLanguage = deprecate.function(req.acceptsLanguages,
  'req.acceptsLanguage: Use acceptsLanguages instead')

req.range = function range (size, options) {
  var range = this.headers.range
  if (!range) return
  return parseRange(size, range, options)
}

req.param = function param (name, defaultValue) {
  var params = this.params || {}
  var body = this.body || {}
  var query = this.query || {}

  var args = arguments.length === 1
    ? 'name'
    : 'name, default'
  deprecate('req.param(' + args + '): Use req.params, req.body, or req.query instead')

  if (params[name] != null && params.hasOwnProperty(name)) return params[name]
  if (body[name] != null) return body[name]
  if (query[name] != null) return query[name]

  return defaultValue
}

req.is = function is (types) {
  var arr = types

  // support flattened arguments
  if (!Array.isArray(types)) {
    arr = new Array(arguments.length)
    for (var i = 0, j = arr.length; i < j; i++) {
      arr[i] = arguments[i]
    }
  }

  return typeis(this, arr)
}

defineGetter(req, 'protocol', function protocol () {
  var proto = this.connection.encrypted
    ? 'https'
    : 'http'

  var trust = this.app.get('trust proxy fn')

  if (!trust(this.connection.remoteAddress, 0)) {
    return proto
  }

  // Note: X-Forwarded-Proto is normally only ever a
  //       single value, but this is to be safe.
  var header = this.headers['x-forwarded-proto'] || proto
  var index = header.indexOf(',')
  return index !== -1
    ? header.substring(0, index).trim()
    : header.trim()
})

function secure () {
  return this.protocol === 'https'
}

defineGetter(req, 'secure', secure)

function ip () {
  var trust = this.app.get('trust proxy fn')
  return proxyaddr(this, trust)
}

defineGetter(req, 'ip', ip)

function ips () {
  var trust = this.app.get('trust proxy fn')
  var addrs = proxyaddr.all(this, trust)

  // reverse the order (to farthest -> closest)
  // and remove socket address
  addrs.reverse().pop()

  return addrs
}

defineGetter(req, 'ips', ips)

function subdomains () {
  var hostname = this.hostname
  
  if (!hostname) return []

  var offset = this.app.get('subdomain offset')
  var subdomains = !isIP(hostname)
    ? hostname.split('.').reverse()
    : [hostname]

  return subdomains.slice(offset)
}

defineGetter(req, 'subdomains', subdomains)

function currentUrl () {
  const route = this.route
  if (route.middleware) {
    let url = this.url.replace(route.pattern, '')
    url = url || '/'
    return url
  }
  return this.url
}

defineGetter(req, 'currentUrl', currentUrl)

function baseUrl () {
  const curRouterMountpath = this.rData_internal.tree[this.rData_internal.tree.length - 1]
  const baseUrl = curRouterMountpath && curRouterMountpath !== '/' ? this.originalUrl.replace(this.currentUrl, '') : ''
  return baseUrl
}

function baseUrlSetter () {
  return this
}

defineGetter(req, 'baseUrl', baseUrl, baseUrlSetter)


req.setUrl = function setUrl (url) {
  this.rData_internal.url = url
  return this
}

req.setMethod = function setMethod (method) {
  this.rData_internal.method = method
  return this
}

function hostname () {
  var trust = this.app.get('trust proxy fn')
  var host = this.headers['x-forwarded-host']

  if (!host || !trust(this.connection.remoteAddress, 0)) {
    host = this.headers.host
  } else if (host.indexOf(',') !== -1) {
    // Note: X-Forwarded-Host is normally only ever a
    //       single value, but this is to be safe.
    host = host.substring(0, host.indexOf(',')).trimRight()
  }

  if (!host) return

  // IPv6 literal support
  var offset = host[0] === '['
    ? host.indexOf(']') + 1
    : 0
  var index = host.indexOf(':', offset)

  return index !== -1
    ? host.substring(0, index)
    : host
}

defineGetter(req, 'hostname', hostname)

// TODO: change req.host to return host in next major

var host = deprecate.function(function host () {
  return this.hostname
}, 'req.host: Use req.hostname instead')

defineGetter(req, 'host', host)

function reqFresh () {
  var method = this.rData_internal.method
  var res = this.res
  var status = res.statusCode

  // GET or HEAD for weak freshness validation only
  if (method !== 'GET' && method !== 'HEAD') return false

  // 2xx or 304 as per rfc2616 14.26
  if ((status >= 200 && status < 300) || status === 304) {
    return fresh(this.headers, {
      etag: res.getHeader('ETag'),
      'last-modified': res.getHeader('Last-Modified')
    })
  }

  return false
}

defineGetter(req, 'fresh', reqFresh)

function stale () {
  return !this.fresh
}

defineGetter(req, 'stale', stale)

function xhr () {
  var val = this.headers['x-requested-with'] || ''
  return val.toLowerCase() === 'xmlhttprequest'
}

defineGetter(req, 'xhr', xhr)

function defineGetter(obj, name, getter, setter) {
  Object.defineProperty(obj, name, {
    configurable: true,
    enumerable: true,
    get: getter,
    set: setter
  });
}
