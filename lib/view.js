'use strict'

/*!
 * Fyrejet
 * Copyright(c) 2020 Nicholas Schamberg
 * MIT Licensed
*/

const debug = require('debug')('fyrejet:view')
const path = require('path')
const fs = require('fs')

const dirname = path.dirname
const basename = path.basename
const extname = path.extname
const join = path.join
const resolve = path.resolve

module.exports = View

function View (name, options) {
  const opts = options || {}

  this.defaultEngine = opts.defaultEngine
  this.ext = extname(name)
  this.name = name
  this.root = opts.root

  if (!this.ext && !this.defaultEngine) {
    throw new Error('No default engine was specified and no extension was provided.')
  }

  let fileName = name

  if (!this.ext) {
    // get extension from default engine name
    this.ext = this.defaultEngine[0] !== '.'
      ? '.' + this.defaultEngine
      : this.defaultEngine

    fileName += this.ext
  }
  if (!opts.engines[this.ext]) {
    // load engine
    const mod = this.ext.substr(1)
    debug('require "%s"', mod)

    // default engine export
    const fn = require(mod).__express

    if (typeof fn !== 'function') {
      throw new Error('Module "' + mod + '" does not provide a view engine.')
    }

    opts.engines[this.ext] = fn
  }

  // store loaded engine
  this.engine = opts.engines[this.ext]

  // lookup path
  this.path = this.lookup(fileName)
}

View.prototype.lookup = function lookup (name) {
  let path
  const roots = [].concat(this.root)

  debug('lookup "%s"', name)

  for (let i = 0; i < roots.length && !path; i++) {
    const root = roots[i]

    // resolve the path
    const loc = resolve(root, name)
    const dir = dirname(loc)
    const file = basename(loc)

    // resolve the file
    path = this.resolve(dir, file)
  }

  return path
}

View.prototype.render = function render (options, callback) {
  debug('render "%s"', this.path)
  this.engine(this.path, options, callback)
}

View.prototype.resolve = function resolve (dir, file) {
  const ext = this.ext

  // <path>.<ext>
  let path = join(dir, file)
  let stat = tryStat(path)

  if (stat && stat.isFile()) {
    return path
  }

  // <path>/index.<ext>
  path = join(dir, basename(file, ext), 'index' + ext)
  stat = tryStat(path)

  if (stat && stat.isFile()) {
    return path
  }
}

function tryStat (path) {
  debug('stat "%s"', path)

  try {
    return fs.statSync(path)
  } catch (e) {
    return undefined
  }
}
