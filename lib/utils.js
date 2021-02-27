var Buffer = require('safe-buffer').Buffer
var contentDisposition = require('content-disposition')
var contentType = require('content-type')
var deprecate = require('depd')('fyrejet')
var flatten = require('array-flatten')
var mime = require('send').mime
var etag = require('etag')
var proxyaddr = require('proxy-addr')
var qs = require('qs')
var querystring = require('querystring')

var etagWeak = createETagGenerator({ weak: true })

var etagStrong = createETagGenerator({ weak: false })

function forEachObject (obj, cb) {
  const keys = Object.keys(obj)
  const length = keys.length

  for (let i = 0; i < length; i++) {
    cb(obj[keys[i]], keys[i])
  }
}

function merge (a, b) {
  a = Object.assign(a, b)
  return a
};

function isAbsolute (path) {
  if (path[0] === '/') return true
  if (path[1] === ':' && (path[2] === '\\' || path[2] === '/')) return true // Windows device path
  if (path.substring(0, 2) === '\\\\') return true // Microsoft Azure absolute path
};

function normalizeType (type) {
  return ~type.indexOf('/')
    ? acceptParams(type)
    : { value: mime.lookup(type), params: {} }
};

function normalizeTypes (types) {
  var ret = []

  for (var i = 0; i < types.length; ++i) {
    ret.push(normalizeType(types[i]))
  }

  return ret
};

function acceptParams (str, index) {
  var parts = str.split(/ *; */)
  var ret = { value: parts[0], quality: 1, params: {}, originalIndex: index }

  for (var i = 1; i < parts.length; ++i) {
    var pms = parts[i].split(/ *= */)
    if (pms[0] === 'q') {
      ret.quality = parseFloat(pms[1])
    } else {
      ret.params[pms[0]] = pms[1]
    }
  }

  return ret
}

function compileETag (val) {
  var fn

  if (typeof val === 'function') {
    return val
  }

  switch (val) {
    case true:
      fn = etagWeak
      break
    case false:
      fn = null
      break
    case 'strong':
      fn = etagStrong
      break
    case 'weak':
      fn = etagWeak
      break
    default:
      throw new TypeError('unknown value for etag function: ' + val)
  }
  return fn
}

function compileQueryParser (val) {
  var fn

  if (typeof val === 'function') {
    return val
  }

  switch (val) {
    case true:
      fn = querystring.parse
      break
    case false:
      fn = newObject
      break
    case 'extended':
      fn = parseExtendedQueryString
      break
    case 'simple':
      fn = querystring.parse
      break
    default:
      throw new TypeError('unknown value for query parser function: ' + val)
  }

  return fn
}

function compileTrust (val) {
  if (typeof val === 'function') return val

  if (val === true) {
    // Support plain true/false
    return function () { return true }
  }

  if (typeof val === 'number') {
    // Support trusting hop count
    return function (a, i) { return i < val }
  }

  if (typeof val === 'string') {
    // Support comma-separated values
    val = val.split(/ *, */)
  }

  return proxyaddr.compile(val || [])
}

function setCharset (type, charset) {
  if (!type || !charset) {
    return type
  }

  // parse type
  var parsed = contentType.parse(type)

  // set charset
  parsed.parameters.charset = charset

  // format type
  return contentType.format(parsed)
};

function createETagGenerator (options) {
  return function generateETag (body, encoding) {
    var buf = !Buffer.isBuffer(body) ? Buffer.from(body, encoding) : body
    return etag(buf, options)
  }
}

function parseExtendedQueryString (str) {
  return qs.parse(str, {
    allowPrototypes: true
  })
}

function newObject () {
  return {}
}

function logerror (err) {
  /* istanbul ignore next */
  if (this.get('env') !== 'test') console.error(err.stack || err.toString())
}

const toString = (str) => {
  return str + ''
}

const toLowerCase = (str) => {
  return toString(str).toLowerCase()
}

module.exports = {
  forEachObject,
  merge,
  etag: etagStrong,
  wetag: etagWeak,
  isAbsolute,
  flatten: deprecate.function(flatten, 'utils.flatten: use array-flatten npm module instead'),
  normalizeType,
  normalizeTypes,
  contentDisposition: deprecate.function(contentDisposition, 'utils.contentDisposition: use content-disposition npm module instead'),
  compileETag,
  compileQueryParser,
  compileTrust,
  setCharset,
  logerror,
  toString,
  toLowerCase
}
