'use strict'

/*!
 * Fyrejet
 * Copyright(c) 2020 Nicholas Schamberg
 * MIT Licensed
*/

var accepts = require('accepts')
var deprecate = require('depd')('fyrejet')
var isIP = require('net').isIP
var typeis = require('type-is')
var fresh = require('fresh')
var parseRange = require('range-parser')
var parse = require('parseurl')
var proxyaddr = require('proxy-addr')

var req = {}
req.propFn = {}

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
  var range = this.get('Range')
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

req.propFn.protocol = function protocol () {
  var proto = this.connection.encrypted
    ? 'https'
    : 'http'

  var trust = this.app.get('trust proxy fn')

  if (!trust(this.connection.remoteAddress, 0)) {
    return proto
  }

  // Note: X-Forwarded-Proto is normally only ever a
  //       single value, but this is to be safe.
  var header = this.get('X-Forwarded-Proto') || proto
  var index = header.indexOf(',')
  return index !== -1
    ? header.substring(0, index).trim()
    : header.trim()
}

req.propFn.secure = function secure () {
  const proto = typeof this.protocol !== 'function' ? this.protocol : this.protocol()
  return proto === 'https'
}

req.propFn.ip = function ip () {
  var trust = this.app.get('trust proxy fn')
  return proxyaddr(this, trust)
}

req.propFn.ips = function ips () {
  var trust = this.app.get('trust proxy fn')
  var addrs = proxyaddr.all(this, trust)

  // reverse the order (to farthest -> closest)
  // and remove socket address
  addrs.reverse().pop()

  return addrs
}

req.propFn.subdomains = function subdomains () {
  var hostname = typeof this.hostname !== 'function' ? this.hostname : this.hostname()

  if (!hostname) return []

  var offset = this.app.get('subdomain offset')
  var subdomains = !isIP(hostname)
    ? hostname.split('.').reverse()
    : [hostname]

  return subdomains.slice(offset)
}

req.propFn.path = function path () {
  return parse(this).pathname
}
req.propFn.path.essential = true

req.propFn.currentUrl = function currentUrl () {
  const route = this.route
  if (route.middleware) {
    let url = this.url.replace(route.pattern, '')
    url = url || '/'
    return url
  }
  return this.url
}
req.propFn.currentUrl.essential = true

req.propFn.baseUrl = function baseUrl () {
  const curRouterMountpath = this.rData_internal.tree[this.rData_internal.tree.length - 1]
  const baseUrl = curRouterMountpath && curRouterMountpath !== '/' ? this.originalUrl.replace(this.currentUrl, '') : ''
  return baseUrl
}
req.propFn.baseUrlSetter = function baseUrlSetter () {
  //stub
}
req.propFn.baseUrl.essential = true

req.propFn.url = function url () {
  return this.rData_internal.url
}
req.propFn.url.essential = true

req.propFn.urlSetter = function urlSetter (inp) {
  if (this.rData_internal.url !== inp) {
    this.rData_internal.reroute = true
    this.rData_internal.url = inp
  }
  return this.rData_internal.url
}

req.setUrl = function setUrl (url) {
  this.rData_internal.url = url
  return this
}

req.setMethod = function setMethod (method) {
  this.rData_internal.method = method
  return this
}

req.propFn.method = function method () {
  return this.rData_internal.method
}
req.propFn.method.essential = true

req.propFn.methodSetter = function methodSetter (inp) {
  if (this.rData_internal.method !== inp) {
    this.rData_internal.reroute = true
    this.rData_internal.method = inp
  }
  return this.rData_internal.method
}

req.propFn.hostname = function hostname () {
  var trust = this.app.get('trust proxy fn')
  var host = this.get('X-Forwarded-Host')

  if (!host || !trust(this.connection.remoteAddress, 0)) {
    host = this.get('Host')
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

// TODO: change req.host to return host in next major

req.propFn.host = deprecate.function(function host () {
  return this.hostname
}, 'req.host: Use req.hostname instead')

req.propFn.fresh = function () {
  var method = this.method
  var res = this.res
  var status = res.statusCode

  // GET or HEAD for weak freshness validation only
  if (method !== 'GET' && method !== 'HEAD') return false

  // 2xx or 304 as per rfc2616 14.26
  if ((status >= 200 && status < 300) || status === 304) {
    return fresh(this.headers, {
      etag: res.get('ETag'),
      'last-modified': res.get('Last-Modified')
    })
  }

  return false
}

req.propFn.stale = function stale () {
  const fresh = typeof this.fresh !== 'function' ? this.fresh : this.fresh()
  return !fresh
}

req.propFn.xhr = function xhr () {
  var val = this.get('X-Requested-With') || ''
  return val.toLowerCase() === 'xmlhttprequest'
}
