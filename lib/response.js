'use strict'

/*
 * Fyrejet
 * Copyright(c) 2021 Nicholas Schamberg
 * MIT Licensed
 */

const Buffer = require('safe-buffer').Buffer
const contentDisposition = require('content-disposition')
const deprecate = require('depd')('fyrejet')
const encodeUrl = require('encodeurl')
const escapeHtml = require('escape-html')
const { isAbsolute } = require('./utils')
const onFinished = require('on-finished')
const path = require('path')
const statuses = require('statuses')
const { merge } = require('./utils')
const { sign } = require('cookie-signature')
const { normalizeType } = require('./utils')
const { normalizeTypes } = require('./utils')
const { setCharset, forEachObject } = require('./utils')
const cookie = require('cookie')
const send = require('send')
const extname = path.extname
const mime = send.mime
const resolve = path.resolve
const vary = require('vary')

module.exports = {
  build,
  res: build(Object.create({}))
}

const charsetRegExp = /;\s*charset\s*=/

const CONTENT_TYPE_HEADER = 'Content-Type'
const CONTENT_LENGTH_HEADER = 'Content-Length'
const X_CONTENT_TYPE_OPTIONS = 'X-Content-Type-Options'
const NOSNIFF = 'nosniff'
const TYPE_JSON = 'application/json; charset=utf-8'
const TYPE_PLAIN = 'text/plain; charset=utf-8'
const TYPE_HTML = 'text/html; charset=utf-8'
const TYPE_OCTET = 'application/octet-stream'
const LOCATION = 'Location'

const NOOP = () => {}

function build (res) {
  const parseErr = (error) => {
    const errorCode = error.status || error.code || error.statusCode
    const statusCode = typeof errorCode === 'number' ? errorCode : 500

    return {
      statusCode,
      data: JSON.stringify({
        code: statusCode,
        message: error.message,
        data: error.data
      })
    }
  }

  res.status = function status (code) {
    this.statusCode = code
    return this
  }

  res.links = function (links) {
    let link = this.getHeader('Link') || ''
    if (link) link += ', '
    return this.setHeader(
      'Link',
      link +
        Object.keys(links)
          .map(function (rel) {
            return '<' + links[rel] + '>; rel="' + rel + '"'
          })
          .join(', ')
    )
  }

  res.send = function send (body, ...args) {
    if (args.length) {
      body = [body, ...args]
      return resJson(this, body)
    }

    switch (typeof body) {
      // string defaulting to html
      case 'string':
        if (!this.getHeader(CONTENT_TYPE_HEADER)) {
          this.req.rData_internal.encodingSet = true
          this.setHeader(CONTENT_TYPE_HEADER, TYPE_HTML)
          return resSend(this, body)
        }
        return resSend(this, body)
      case 'boolean':
      case 'number':
        this.req.rData_internal.encodingSet = true
        this.setHeader(CONTENT_TYPE_HEADER, TYPE_JSON)
        body = body.toString()
        return resSend(this, body)
      case 'object':
        if (body === null) {
          body = ''
          return resSend(this, body)
        } else if (Buffer.isBuffer(body)) {
          this.req.rData_internal.encodingSet = true // encoding is not set, but setting encoding in content-type is meaningless in this case
          if (!this.getHeader(CONTENT_TYPE_HEADER)) {
            this.setHeader(CONTENT_TYPE_HEADER, TYPE_OCTET)
          }
          return resSend(this, body)
        }
        return resJson(this, body) // no need to go through checks for deprecated functionality
    }
    return resSend(this, body)
  }

  function resSend (res, body) {
    // split to avoid deprecation checks when returning from resJson or res.json
    const req = res.req

    // settings
    const app = res.app

    // write strings in utf-8
    if (!req.rData_internal.encodingSet) {
      // reflect this in content-type
      let type
      if (typeof (type = res.getHeader(CONTENT_TYPE_HEADER)) === 'string') {
        res.setHeader(CONTENT_TYPE_HEADER, setCharset(type, 'utf-8'))
      }
    }

    if (
      body !== undefined &&
      !req.rData_internal.noEtag &&
      !res.getHeader('ETag')
    ) {
      let etag
      // determine if ETag should be generated
      const etagFn = app.__settings.get('etag fn')

      // populate ETag
      if (etagFn && (etag = etagFn(body))) {
        // unlike express, we don't need to check if there is len, because we know it for certain, since we placed this if block in a different place
        res.setHeader('ETag', etag)
      }
    }

    // freshness
    const fresh = req.fresh()

    // strip irrelevant headers
    if (
      (fresh && (res.statusCode = 304)) ||
      res.statusCode === 204 ||
      res.statusCode === 304
    ) {
      res.removeHeader(CONTENT_TYPE_HEADER)
      res.removeHeader(CONTENT_LENGTH_HEADER)
      res.removeHeader('Transfer-Encoding')
      body = ''
    }

    res.end(req.method === 'HEAD' ? null : body)
    return res
  }

  res.json = function json (obj, ...args) {
    let val = obj

    if (args.length) {
      val = [val, ...args]
    }
    return resJson(this, val)
  }

  function resJson (res, val) {
    // this is split, so we can avoid checks for deprecated functionality
    // settings
    const app = res.app
    const escape = app.__settings.get('json escape')
    const replacer = app.__settings.get('json replacer')
    const spaces = app.__settings.get('json spaces')
    const body = stringify(val, replacer, spaces, escape)

    // content-type
    if (!res.getHeader(CONTENT_TYPE_HEADER)) {
      res.req.rData_internal.encodingSet = true
      res.setHeader(CONTENT_TYPE_HEADER, TYPE_JSON)
    }
    return resSend(res, body)
  }

  res.jsonp = function jsonp (obj, ...args) {
    let val = obj

    if (args.length) {
      val = [val, ...args]
    }

    // settings
    const app = this.app
    const escape = app.__settings.get('query parser fn')
    const replacer = app.__settings.get('json replacer')
    const spaces = app.__settings.get('json spaces')
    let body = stringify(val, replacer, spaces, escape)
    let callback = this.req.query[app.__settings.get('jsonp callback name')]

    // content-type
    if (!this.getHeader(CONTENT_TYPE_HEADER)) {
      this.setHeader(X_CONTENT_TYPE_OPTIONS, NOSNIFF)
      this.req.rData_internal.encodingSet = true
      this.setHeader(CONTENT_TYPE_HEADER, TYPE_JSON)
    }

    // fixup callback
    if (Array.isArray(callback)) {
      callback = callback[0]
    }

    // jsonp
    if (typeof callback === 'string' && callback.length !== 0) {
      this.setHeader(X_CONTENT_TYPE_OPTIONS, NOSNIFF)
      this.set(CONTENT_TYPE_HEADER, 'text/javascript')

      // restrict callback charset
      callback = callback.replace(/[^\[\]\w$.]/g, '')

      // replace chars not allowed in JavaScript that are in JSON
      body = body.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')

      // the /**/ is a specific security mitigation for "Rosetta Flash JSONP abuse"
      // the typeof check is just to reduce client error noise
      body =
        '/**/ typeof ' +
        callback +
        " === 'function' && " +
        callback +
        '(' +
        body +
        ');'
    }

    return resSend(this, body)
  }

  res.sendStatus = function sendStatus (statusCode) {
    const body = statuses[statusCode] || String(statusCode)

    this.statusCode = statusCode
    return this.type('txt').send(body)
  }

  res.sendFile = function sendFile (path, options, callback) {
    let done = callback
    const req = this.req
    const res = this
    const next = req.next
    let opts = options || {}

    if (!path) {
      throw new TypeError('path argument is required to res.sendFile')
    }

    if (typeof path !== 'string') {
      throw new TypeError('path must be a string to res.sendFile')
    }

    // support function as second arg
    if (typeof options === 'function') {
      done = options
      opts = {}
    }

    if (!opts.root && !isAbsolute(path)) {
      throw new TypeError(
        'path must be absolute or specify root to res.sendFile'
      )
    }

    // create file stream
    const pathname = encodeURI(path)
    const file = send(req, pathname, opts)

    // transfer
    sendfile(res, file, opts, function (err) {
      if (done) return done(err)
      if (err && err.code === 'EISDIR') return next()

      // next() all but write errors
      if (err && err.code !== 'ECONNABORTED' && err.syscall !== 'write') {
        next(err)
      }
    })
  }

  res.download = function download (path, filename, options, callback) {
    let done = callback
    let name = filename
    let opts = options || null

    // support function as second or third arg
    if (typeof filename === 'function') {
      done = filename
      name = null
      opts = null
    } else if (typeof options === 'function') {
      done = options
      opts = null
    }

    // set Content-Disposition when file is sent
    const headers = {
      'Content-Disposition': contentDisposition(name || path)
    }

    // merge user-provided headers
    if (opts && opts.headers) {
      const keys = Object.keys(opts.headers)
      for (let i = 0, j = keys.length; i < j; i++) {
        const key = keys[i]
        if (key.toLowerCase() !== 'content-disposition') {
          headers[key] = opts.headers[key]
        }
      }
    }

    // merge user-provided options
    opts = Object.create(opts)
    opts.headers = headers

    // Resolve the full path for sendFile
    const fullPath = resolve(path)

    // send file
    return this.sendFile(fullPath, opts, done)
  }

  res.contentType = res.type = function contentType (type) {
    const ct = type.indexOf('/') === -1 ? mime.lookup(type) : type
    return this.set(CONTENT_TYPE_HEADER, ct)
  }

  res.format = function (obj) {
    const req = this.req
    const next = req.next

    const fn = obj.default
    if (fn) delete obj.default
    const keys = Object.keys(obj)

    const key = keys.length > 0 ? req.accepts(keys) : false

    this.vary('Accept')

    if (key) {
      this.set(CONTENT_TYPE_HEADER, normalizeType(key).value)
      obj[key](req, this, next)
      return this
    }
    if (fn) {
      fn()
      return this
    }

    const err = new Error('Not Acceptable')
    err.status = err.statusCode = 406
    err.types = normalizeTypes(keys).map(function (o) {
      return o.value
    })
    next(err)

    return this
  }

  res.attachment = function attachment (filename) {
    if (filename) {
      this.type(extname(filename))
    }

    this.setHeader('Content-Disposition', contentDisposition(filename))

    return this
  }

  res.append = function append (field, val) {
    const prev = this.getHeader(field)
    let value = val

    if (prev) {
      // concat the new and prev vals
      value = Array.isArray(prev)
        ? prev.concat(val)
        : Array.isArray(val)
          ? [prev].concat(val)
          : [prev, val]
    }

    return this.set(field, value)
  }

  res.set = res.header = function header (field, val) {
    if (val) {
      let value = Array.isArray(val) ? val.map(String) : String(val)

      // add charset to content-type
      if (field.toLowerCase() === 'content-type') {
        if (Array.isArray(value)) {
          throw new TypeError('Content-Type cannot be set to an Array')
        }
        if (!charsetRegExp.test(value)) {
          const charset = mime.charsets.lookup(value.split(';')[0])
          if (charset) value += '; charset=' + charset.toLowerCase()
        }
      }

      this.setHeader(field, value)
      return this
    }

    for (const key in field) {
      this.set(key, field[key])
    }

    return this
  }

  res.get = function (field) {
    return this.getHeader(field)
  }

  res.clearCookie = function clearCookie (name, options) {
    const opts = merge({ expires: new Date(1), path: '/' }, options)

    return this.cookie(name, '', opts)
  }

  res.cookie = function (name, value, options) {
    const opts = merge({}, options)
    const secret = this.req.secret
    const signed = opts.signed

    if (signed && !secret) {
      throw new Error('cookieParser("secret") required for signed cookies')
    }

    let val =
      typeof value === 'object' ? 'j:' + JSON.stringify(value) : String(value)

    if (signed) {
      val = 's:' + sign(val, secret)
    }

    if ('maxAge' in opts) {
      opts.expires = new Date(Date.now() + opts.maxAge)
      opts.maxAge /= 1000
    }

    if (opts.path == null) {
      opts.path = '/'
    }

    this.append('Set-Cookie', cookie.serialize(name, String(val), opts))

    return this
  }

  res.location = function location (url) {
    let loc = url

    // "back" is an alias for the referrer
    if (url === 'back') {
      loc = this.req.get('Referrer') || '/'
    }

    // set location
    return this.set(LOCATION, encodeUrl(loc))
  }

  res.redirect = function redirect (url, arg2) {
    let address = url
    let body
    let status = 302

    // allow status / url
    if (arg2) {
      if (typeof url === 'number') {
        status = url
        address = arg2
      } else {
        deprecate(
          'res.redirect(url, status): Use res.redirect(status, url) instead'
        )
        status = arg2
      }
    }

    // Set location header
    address = this.location(address).get(LOCATION)

    // Support text/{plain,html} by default
    this.format({
      text: function () {
        body = statuses[status] + '. Redirecting to ' + address
      },

      html: function () {
        const u = escapeHtml(address)
        body =
          '<p>' +
          statuses[status] +
          '. Redirecting to <a href="' +
          u +
          '">' +
          u +
          '</a></p>'
      },

      default: function () {
        body = ''
      }
    })

    // Respond
    this.statusCode = status
    this.setHeader(CONTENT_LENGTH_HEADER, Buffer.byteLength(body))

    if (this.req.method === 'HEAD') {
      this.end()
      return this
    }

    this.end(body)
    return this
  }

  res.vary = function (field) {
    // checks for back-compat
    if (!field || (Array.isArray(field) && !field.length)) {
      deprecate('res.vary(): Provide a field name')
      return this
    }

    vary(this, field)

    return this
  }

  res.render = function render (view, options, callback) {
    const app = this.app
    let done = callback
    let opts = options || {}
    const req = this.req
    const self = this

    // support callback function as second arg
    if (typeof options === 'function') {
      done = options
      opts = {}
    }

    // merge res.locals
    opts._locals = self.locals

    // default callback to respond
    done =
      done ||
      function (err, str) {
        if (err) return req.next(err)
        self.send(str)
      }

    // render
    app.render(view, opts, done)
  }

  res.sendLite = function (data, code, headers, cb) {
    const res = this

    code = code || res.statusCode
    headers = headers || null
    cb = cb || NOOP

    if (!data && typeof data !== 'string') data = res.statusCode

    let contentType

    if (data instanceof Error) {
      const err = parseErr(data)
      contentType = TYPE_JSON
      code = err.statusCode
      data = err.data
    } else {
      if (headers && typeof headers === 'object') {
        forEachObject(headers, (value, key) => {
          res.setHeader(key.toLowerCase(), value)
        })
      }

      // NOTE: only retrieve content-type after setting custom headers
      contentType = res.getHeader(CONTENT_TYPE_HEADER)

      if (typeof data === 'number') {
        code = data
        data = res.body
      }

      if (data) {
        if (typeof data === 'string') {
          if (!contentType) contentType = TYPE_PLAIN
        } else if (typeof data === 'object') {
          if (data instanceof Buffer) {
            if (!contentType) contentType = TYPE_OCTET
          } else if (typeof data.pipe === 'function') {
            if (!contentType) contentType = TYPE_OCTET
            // NOTE: we exceptionally handle the response termination for streams
            if (contentType) {
              res.setHeader(CONTENT_TYPE_HEADER, contentType)
            }
            res.statusCode = code

            data.pipe(res)
            data.on('end', cb)

            return
          } else if (Promise.resolve(data) === data) {
            // http://www.ecma-international.org/ecma-262/6.0/#sec-promise.resolve
            headers = null
            return data
              .then((resolved) => res.sendLite(resolved, code, headers, cb))
              .catch((err) => res.sendLite(err, code, headers, cb))
          } else {
            if (!contentType) contentType = TYPE_JSON
            data = JSON.stringify(data)
          }
        }
      }
    }

    if (contentType) {
      res.setHeader(CONTENT_TYPE_HEADER, contentType)
    }
    res.statusCode = code
    res.end(data, cb)
  }

  // pipe the send file stream
  function sendfile (res, file, options, callback) {
    let done = false
    let streaming

    // request aborted
    function onaborted () {
      if (done) return
      done = true

      const err = new Error('Request aborted')
      err.code = 'ECONNABORTED'
      callback(err)
    }

    // directory
    function ondirectory () {
      if (done) return
      done = true

      const err = new Error('EISDIR, read')
      err.code = 'EISDIR'
      callback(err)
    }

    // errors
    function onerror (err) {
      if (done) return
      done = true
      callback(err)
    }

    // ended
    function onend () {
      if (done) return
      done = true
      callback()
    }

    // file
    function onfile () {
      streaming = false
    }

    // finished
    function onfinish (err) {
      if (err && err.code === 'ECONNRESET') return onaborted()
      if (err) return onerror(err)
      if (done) return

      setImmediate(function () {
        if (streaming !== false && !done) {
          onaborted()
          return
        }

        if (done) return
        done = true
        callback()
      })
    }

    // streaming
    function onstream () {
      streaming = true
    }

    file.on('directory', ondirectory)
    file.on('end', onend)
    file.on('error', onerror)
    file.on('file', onfile)
    file.on('stream', onstream)
    onFinished(res, onfinish)

    if (options.headers) {
      // set headers on successful transfer
      file.on('headers', function headers (res) {
        const obj = options.headers
        const keys = Object.keys(obj)

        for (let i = 0, j = keys.length; i < j; i++) {
          const k = keys[i]
          res.setHeader(k, obj[k])
        }
      })
    }

    // pipe
    file.pipe(res)
  }

  function stringify (value, replacer, spaces, escape) {
    // v8 checks arguments.length for optimizing simple call
    // https://bugs.chromium.org/p/v8/issues/detail?id=4730
    let json =
      replacer || spaces
        ? JSON.stringify(value, replacer, spaces)
        : JSON.stringify(value)

    if (escape) {
      json = json.replace(/[<>&]/g, function (c) {
        switch (c.charCodeAt(0)) {
          case 0x3c:
            return '\\u003c'
          case 0x3e:
            return '\\u003e'
          case 0x26:
            return '\\u0026'
          /* istanbul ignore next: unreachable default */
          default:
            return c
        }
      })
    }

    return json
  }

  return res
}
