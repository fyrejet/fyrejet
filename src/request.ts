'use strict'

/*
 * Fyrejet
 * Copyright(c) 2021 Nicholas Schamberg
 * MIT Licensed
 */

import accepts from 'accepts';
import depd from 'depd';
import {isIP} from 'net';
import typeis from 'type-is';
import fresh from 'fresh';
import parseRange from 'range-parser';
import proxyaddr from 'proxy-addr';

import type { FyrejetRequest, Nullable, TrustFn } from './types';

const deprecate = depd('fyrejet')

module.exports = {
  build,
  req: build(Object.create({}))
}

export function build (req: FyrejetRequest) {
  req.activateExpress = function () {
    // stub function to break as few apps as possible
    return this
  }

  //@ts-expect-error: our types are more correct in this regard
  req.get = req.header = function header (name: string) {
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
        return this.headers.referrer || this.headers.referer
      default:
        return this.headers[lc]
    }
  }

  req.accepts = function(...args: string[]) : any {
	var accept = accepts(this);
	return accept.types.apply(accept, args);
  };

  req.acceptsEncodings = function (...args: string[]) : any {
    const accept = accepts(this)
    return accept.encodings.apply(accept, args)
  }

  req.acceptsCharsets = function (...args: string[]) : any {
    const accept = accepts(this)
    return accept.charsets.apply(accept, args)
  }

  req.acceptsLanguages = function (...args: string[]) : any {
    const accept = accepts(this)
    return accept.languages.apply(accept, args)
  }

  req.range = function range (size: number, options?: parseRange.Options) : parseRange.Result | parseRange.Ranges | undefined {
    const range = this.headers.range
    if (!range) return
    return parseRange(size, range, options)
  }

  req.param = function param<T = string> (name: string, defaultValue?: any) : T {
    const params = this.params || {}
    const body = this.body || {}
    const query = this.query || {}

    const args = !defaultValue ? 'name' : 'name, default'
    deprecate(
      'req.param(' + args + '): Use req.params, req.body, or req.query instead'
    )

    if (params[name] != null && params.hasOwnProperty(name)) { return params[name] as unknown as T }
    if (body[name] != null) return body[name] as T
    if (query[name] != null) return query[name] as T

    return defaultValue
  }

  req.is = function is (...types: string[]): string | false | null {

    return typeis(this, types)
  }

  req.protocol = function protocol () : string {
	// @ts-expect-error: encrypted exists, if https proto is used
	const {encrypted} = (this.connection)
    const proto = encrypted ? 'https' : 'http'

    const trust = this.app.__settings.get('trust proxy fn') as TrustFn

    if (!trust(this.connection.remoteAddress as string, 0)) {
      return proto
    }

    // Note: X-Forwarded-Proto is normally only ever a single value, but this is to be safe.
    const header = (this.headers['x-forwarded-proto'] as Nullable<string>) || proto
    const index = header.indexOf(',')
    return index !== -1 ? header.substring(0, index).trim() : header.trim()
  }

  req.secure = function secure () : boolean {
    return this.protocol() === 'https'
  }

  req.ip = function ip () : string {
    const trust = this.app.__settings.get('trust proxy fn') as TrustFn
    return proxyaddr(this, trust)
  }

  req.ips = function ips () : string[] {
    const trust = this.app.__settings.get('trust proxy fn') as TrustFn
    const addrs = proxyaddr.all(this, trust)

    // reverse the order (to farthest -> closest)
    // and remove socket address
    addrs.reverse().pop()

    return addrs
  }

  req.subdomains = function subdomains () : string[] {
    const hostname = this.hostname()

    if (!hostname) return []

    const offset = this.app.__settings.get('subdomain offset') as number
    const subdomains = !isIP(hostname)
      ? hostname.split('.').reverse()
      : [hostname]

    return subdomains.slice(offset)
  }

  req.setUrl = function setUrl (url: string) : FyrejetRequest {
    this.url = url
    this.rData_internal.urlPrev = url
    return this
  }

  req.setMethod = function setMethod (method: string) : FyrejetRequest {
    this.method = method
    this.rData_internal.methodPrev = method
    return this
  }

  req.hostname = function hostname () : Nullable<string> {
    const trust = this.app.__settings.get('trust proxy fn') as TrustFn
    let host = this.headers['x-forwarded-host'] as Nullable<string>

    if (!host || !trust(this.connection.remoteAddress as string, 0)) {
      host = this.headers.host
    } else if (host.indexOf(',') !== -1) {
      // Note: X-Forwarded-Host is normally only ever a
      //       single value, but this is to be safe.
      host = host.substring(0, host.indexOf(',')).trimRight()
    }

    if (!host) return

    // IPv6 literal support
    const offset = host[0] === '[' ? host.indexOf(']') + 1 : 0
    const index = host.indexOf(':', offset)

    return index !== -1 ? host.substring(0, index) : host
  }

  req.fresh = function reqFresh () : boolean {
    const method = this.method

    // GET or HEAD for weak freshness validation only
    if (method !== 'GET' && method !== 'HEAD') return false

    // 2xx or 304 as per rfc2616 14.26
    if (
      (this.res.statusCode >= 200 && this.res.statusCode < 300) ||
      this.res.statusCode === 304
    ) {
      return fresh(this.headers, {
        etag: this.res.getHeader('ETag'),
        'last-modified': this.res.getHeader('Last-Modified')
      })
    }

    return false
  }

  req.baseUrl = function baseUrl () : string {
    const baseUrl = this.originalUrl.replace(this.currentUrl(), '')
    return baseUrl
  }

  req.currentUrl = function currentUrl () : string {
    const route = this.route 
    if (route.middleware) {
      let url = (this.url as string).replace(route.pattern, '')
      url = url || '/'
      return url
    }
    return this.url as string
  }

  req.stale = function stale () : boolean {
    return !this.fresh()
  }

  req.xhr = function xhr () : boolean {
    const val = (this.headers['x-requested-with'] as Nullable<string>) || ''
    return val.toLowerCase() === 'xmlhttprequest'
  }

  return req
}

const req = build(Object.create({}));
export {req};

export default build;
