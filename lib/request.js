'use strict'

/*!
 * Fyrejet
 * Copyright(c) 2020 Nicholas Schamberg
 * MIT Licensed
*/

const accepts = require('accepts')
const deprecate = require('depd')('fyrejet')
const { isIP } = require('net')
const typeis = require('type-is')
const http = require('http')
const fresh = require('fresh')
const parseRange = require('range-parser')
const proxyaddr = require('proxy-addr')

let proto = http.IncomingMessage.prototype

if (process.env.UWS_SERVER || process.env.UWS_SERVER_ENABLED_FOR_TEST) {
  const uwsCompat = require('./uwsCompat/index.js')
  proto = uwsCompat.uwsHttpRequest.prototype
}

const req = Object.create(proto)

module.exports = req

req.activateExpress = function () {
  // stub function to break as few apps as possible
  return this
}

req.get =
req.header = function header (name) {
  if (typeof name !== 'string') {
    if (!name) {
      throw new TypeError('name argument is required to req.get')
    }
    throw new TypeError('name must be a string to req.get')
  }

  const lc = name.toLowerCase()

  switch (lc) {
    case 'referer':
    case 'referrer':
      return this.headers.referrer ||
        this.headers.referer
    default:
      return this.headers[lc]
  }
}

req.accepts = function reqAccepts (...args) {
  const accept = accepts(this)
  return accept.types.apply(accept, args)
}

req.acceptsEncodings = function (...args) {
  const accept = accepts(this)
  return accept.encodings.apply(accept, args)
}

req.acceptsCharsets = function (...args) {
  const accept = accepts(this)
  return accept.charsets.apply(accept, args)
}

req.acceptsLanguages = function (...args) {
  const accept = accepts(this)
  return accept.languages.apply(accept, args)
}

req.range = function range (size, options) {
  const range = this.headers.range
  if (!range) return
  return parseRange(size, range, options)
}

req.param = function param (name, defaultValue) {
  const params = this.params || {}
  const body = this.body || {}
  const query = this.query || {}

  const args = !defaultValue
    ? 'name'
    : 'name, default'
  deprecate('req.param(' + args + '): Use req.params, req.body, or req.query instead')

  if (params[name] != null && params.hasOwnProperty(name)) return params[name]
  if (body[name] != null) return body[name]
  if (query[name] != null) return query[name]

  return defaultValue
}

req.is = function is (types) {
  let arr = types

  // support flattened arguments
  if (!Array.isArray(types)) {
    arr = new Array(arguments.length)
    for (let i = 0, j = arr.length; i < j; i++) {
      arr[i] = arguments[i]
    }
  }

  return typeis(this, arr)
}

req.protocol = function protocol () {
  const proto = this.connection.encrypted
    ? 'https'
    : 'http'

  const trust = this.app.__settings.get('trust proxy fn')

  if (!trust(this.connection.remoteAddress, 0)) {
    return proto
  }

  // Note: X-Forwarded-Proto is normally only ever a
  //       single value, but this is to be safe.
  const header = this.headers['x-forwarded-proto'] || proto
  const index = header.indexOf(',')
  return index !== -1
    ? header.substring(0, index).trim()
    : header.trim()
}

req.secure = function secure () {
  return this.protocol() === 'https'
}

req.ip = function ip () {
  const trust = this.app.__settings.get('trust proxy fn')
  return proxyaddr(this, trust)
}

req.ips = function ips () {
  const trust = this.app.__settings.get('trust proxy fn')
  const addrs = proxyaddr.all(this, trust)

  // reverse the order (to farthest -> closest)
  // and remove socket address
  addrs.reverse().pop()

  return addrs
}

req.subdomains = function subdomains () {
  const hostname = this.hostname()

  if (!hostname) return []

  const offset = this.app.__settings.get('subdomain offset')
  const subdomains = !isIP(hostname)
    ? hostname.split('.').reverse()
    : [hostname]

  return subdomains.slice(offset)
}

req.setUrl = function setUrl (url) {
  this.rData_internal.url = url
  return this
}

req.setMethod = function setMethod (method) {
  this.rData_internal.method = method
  return this
}

req.hostname = function hostname () {
  const trust = this.app.__settings.get('trust proxy fn')
  let host = this.headers['x-forwarded-host']

  if (!host || !trust(this.connection.remoteAddress, 0)) {
    host = this.headers.host
  } else if (host.indexOf(',') !== -1) {
    // Note: X-Forwarded-Host is normally only ever a
    //       single value, but this is to be safe.
    host = host.substring(0, host.indexOf(',')).trimRight()
  }

  if (!host) return

  // IPv6 literal support
  const offset = host[0] === '['
    ? host.indexOf(']') + 1
    : 0
  const index = host.indexOf(':', offset)

  return index !== -1
    ? host.substring(0, index)
    : host
}

req.fresh = function reqFresh () {
  const method = this.rData_internal.method

  // GET or HEAD for weak freshness validation only
  if (method !== 'GET' && method !== 'HEAD') return false

  // 2xx or 304 as per rfc2616 14.26
  if ((this.res.statusCode >= 200 && this.res.statusCode < 300) || this.res.statusCode === 304) {
    return fresh(this.headers, {
      etag: this.res.getHeader('ETag'),
      'last-modified': this.res.getHeader('Last-Modified')
    })
  }

  return false
}

req.baseUrl = function baseUrl () {
  const baseUrl = this.originalUrl.replace(this.currentUrl(), '')
  return baseUrl
}

req.currentUrl = function currentUrl () {
  const route = this.route
  if (route.middleware) {
    let url = this.rData_internal.url.replace(route.pattern, '')
    url = url || '/'
    return url
  }
  return this.rData_internal.url
}

req.stale = function stale () {
  return !this.fresh()
}

req.xhr = function xhr () {
  const val = this.headers['x-requested-with'] || ''
  return val.toLowerCase() === 'xmlhttprequest'
}
