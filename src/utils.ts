import { QueryParser } from "./routing/types"
import { CreateETagGeneratorOptions, EtagFn, FyrejetApp, NormalizeTypeOutput, TrustFn } from "./types"

import {Buffer as SBuffer} from 'safe-buffer'
import contentDisposition from 'content-disposition'
import contentType from 'content-type'
import depd from 'depd'
import {mime} from 'send'
import Etag from 'etag'
import proxyaddr from 'proxy-addr'
import qs from 'qs'
import querystring from 'querystring'


const deprecate = depd('fyrejet')

export const etagWeak = createETagGenerator({ weak: true })

export const etagStrong = createETagGenerator({ weak: false })

export class ExtendableError extends Error {
	[key: string]: any

	constructor(msg: string) {
		super(msg)
	}

}

export function forEachObject<Value=unknown> (obj: any, cb: (key: string, value: Value) => void) {
  const keys = Object.keys(obj)
  const length = keys.length

  for (let i = 0; i < length; i++) {
    cb(keys[i], obj[keys[i]])
  }
}

export function merge<T = unknown, T2 = T>(a: T, b: unknown) : T2 {
  const c = Object.assign(a, b) as unknown as T2
  return c
};

export function isAbsolute (path: string) : boolean {
  if (path[0] === '/') return true
  if (path[1] === ':' && (path[2] === '\\' || path[2] === '/')) return true // Windows device path
  if (path.substring(0, 2) === '\\\\') return true // Microsoft Azure absolute path
  return false
};

export function normalizeType (type: string) : NormalizeTypeOutput {
  const check = ~type.indexOf('/')
  if (check) {
	const parts = type.split(/ *; */)
	return { value: parts[0]}
  }
  return { value: mime.lookup(type)}
};

export function normalizeTypes (types: string[]) : NormalizeTypeOutput[] {
  const ret = []

  for (let i = 0; i < types.length; ++i) {
    ret.push(normalizeType(types[i]))
  }

  return ret
};

export function compileETag (val: boolean | 'strong' | 'weak' | EtagFn) {

  if (typeof val === 'function') {
    return val
  }

  let fn

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

export function compileQueryParser (val: QueryParser | boolean | 'extended' | 'simple' ) : QueryParser {

  if (typeof val === 'function') {
    return val
  }

  let fn

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

export function compileTrust (val: TrustFn | boolean | number | string) : TrustFn {
  if (typeof val === 'function') return val

  if (val) {
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
		const valSplit = val.split(/ *, */)
		return proxyaddr.compile(valSplit)
	}
  }

  return proxyaddr.compile([])
  
}

export function setCharset (type: string, charset: string) {
  if (!type || !charset) {
    return type
  }

  // parse type
  const parsed = contentType.parse(type)

  // set charset
  parsed.parameters.charset = charset

  // format type
  return contentType.format(parsed)
};

export function createETagGenerator (options: CreateETagGeneratorOptions) : EtagFn {
  return function generateETag (body, encoding) {
    const buf = !SBuffer.isBuffer(body) ? SBuffer.from(body, encoding) : body
    return Etag(buf as unknown as Buffer, options)
  }
}

export function parseExtendedQueryString (str: string) {
  return qs.parse(str, {
    allowPrototypes: true
  })
}

export function newObject () {
  return {}
}

export function logerror (this: FyrejetApp, err: ExtendableError) {
  /* istanbul ignore next */
  if (this.get('env') !== 'test') console.error(err.stack || err.toString())
}

export const toString = (str: unknown) : string => {
  return str + ''
}

export const toLowerCase = (str: unknown) : string => {
  return toString(str).toLowerCase()
}

export function flatten<T = unknown>(arr: any[], depth: number) : T[] {
	return arr.flat(depth || Infinity)
}

export const etag = etagStrong;
export const wetag = etagWeak;
