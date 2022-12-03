'use strict'

/*!
 * Fyrejet
 * Copyright(c) 2020 Nicholas Schamberg
 * MIT Licensed
*/

// Based on Express /lib/application.js

import methods from './routing/methods';
import { v4 as uuidv4 } from 'uuid';
import debugModule from 'debug';
import deprecateModule from 'depd';
import View from './view';
import { compileETag, compileQueryParser, compileTrust, merge, flatten } from './utils'
import pathToRegexp, { Key } from './pathToRegexp'

import { resolve } from 'path'
import type { AppStorage, FyrejetApp, FyrejetAppProto, KeyType, FyrejetDataStorage, FyrejetResponse, HttpMethod, Middleware, ParamFn, PoweredByFn, RenderCallback, RenderFunction, RenderInnerOptions, RenderSuppliedOptions, RouteFormer } from './types';

const slice = Array.prototype.slice

const objectRegExp = /^\[object (\S+)\]$/

function getType(obj: unknown) {
	const type = typeof obj

	if (type !== 'object') {
		return type
	}

	// inspect [[Class]] for objects
	return toString.call(obj)
		.replace(objectRegExp, '$1')
}


const debug = debugModule('fyrejet:application')
const deprecate = deprecateModule('fyrejet')

const trustProxyDefaultSymbol = '@@symbol:trust_proxy_default'

function createDataStorage<T>(): AppStorage<T> {
	let storage: FyrejetDataStorage<T> = {

	}

	return ({

		keys: function keys() {
			return Object.keys(storage)
		},

		has: function has(key: KeyType) {
			return key in storage
		},

		remove: function remove(key: KeyType) {
			return delete storage[key]
		},

		get: function get(key: KeyType) {
			return storage[key]
		},

		getAll: function getAll() {
			return storage
		},

		set: function set(prop: KeyType, val: T) {
			storage[prop] = val
			return this
		},

		setOnce: function setOnce(prop: KeyType, val: T) {
			if (!storage[prop]) storage[prop] = val
			return this
		},

		reset: function reset() {
			storage = {}

			return this
		}
	})

}

export const app: FyrejetAppProto = {
	mounted: false,
	poweredBy: function (res: FyrejetResponse): void {
		this.poweredByFn?.(res);
	},
	poweredByFn: function (res: FyrejetResponse): void {
		// will be overwritten during init
	},
	init: function init() {
		const appStorage = createDataStorage<unknown>()
		const app = (this as unknown as FyrejetApp)
		app.cache = {};
		app.engines = {};
		app.__settings = appStorage
		app.settings = new Proxy(appStorage, {
			get: function (target: AppStorage<unknown>, key: KeyType) {
				return target.get(key);
			},
			set: function (target: AppStorage<unknown>, key: KeyType, value: unknown) {
				target.set(key, value)
				return true;
			},
			deleteProperty: function (target: AppStorage<unknown>, key: KeyType) {
				const forbiddenKeys = ['etag', 'query parser fn', 'query parser']
				if (forbiddenKeys.indexOf(key as KeyType) !== -1) { return true }
				return target.remove(key as KeyType)
			},
			ownKeys: function (target: AppStorage<unknown>) {
				return target.keys()
			},
			has: function (target: AppStorage<unknown>, key: KeyType) {
				return target.has(key)
			},
			defineProperty: function (target: AppStorage<unknown>, key: KeyType, desc: any) {
				if (desc && 'value' in desc) { target.set(key, desc.value) }
				return true
			},
			getOwnPropertyDescriptor: function (target: AppStorage<unknown>, key: KeyType) {
				const vValue = target.get(key)
				return vValue
					? {
						value: vValue,
						writable: true,
						enumerable: true,
						configurable: true
					}
					: undefined
			}
		}) as unknown as FyrejetDataStorage<unknown>
		// setup locals
		app.locals = Object.create(null)
		app.defaultConfiguration()
	},
	defaultConfiguration: function defaultConfiguration() {
		const env = process.env.NODE_ENV || 'development'
		const app = (this as unknown as FyrejetApp)
		// default settings
		app.enable('x-powered-by')
		if (!app.settings.etag) {
			app.set('etag', 'weak')
		}
		app.set('env', env)
		if (!app.settings['query parser']) app.set('query parser', 'extended')
		else app.set('query parser', app.settings['query parser'])
		if (!app.settings['subdomain offset']) app.set('subdomain offset', 2)
		if (!app.settings['trust proxy']) app.set('trust proxy', false)
		else app.set('trust proxy', app.settings['trust proxy'])
		if (!app.settings['case sensitive routing'] && !app.settings.caseSensitive) {
			app.settings.caseSensitive = false;
			app.getRouter().modifySetting('sensitive', false)
		} else {
			app.settings.caseSensitive = true;
			app.getRouter().modifySetting('sensitive', true)
		}
		// trust proxy inherit back-compat
		Object.defineProperty(app.settings, trustProxyDefaultSymbol, {
			configurable: true,
			value: true
		})
		debug('booting in %s mode', env);
		app.on('mount', (parent: FyrejetApp) => {
			// inherit trust proxy
			if (app.settings[trustProxyDefaultSymbol] === true &&
				typeof parent.settings['trust proxy fn'] === 'function') {
				delete app.settings['trust proxy']
				delete app.settings['trust proxy fn']
				const parentSettingsKeys = Object.keys(parent.settings)
				for (let i = 0; i < parentSettingsKeys.length; i++) {
					const key = parentSettingsKeys[i]
					if (!app.settings[key]) {
						app.settings[key] = parent.settings[key]
					}
				}
			}
			app.mounted = true
			Object.setPrototypeOf(app.engines, parent.engines)
			Object.setPrototypeOf(app.settings, parent.settings)
			const useOpts = {
				end: false,
				strict: false,
				sensitive: !!app.settings.caseSensitive
			}
			const keys: Key[] = []
			const sequentialRegex = pathToRegexp(app.mountpath as string, keys, useOpts)
			if (app.mountpath !== '/') {
				app.getRouter().changeSequentialConfig('mountpath', sequentialRegex)
			}
			app.disable('x-powered-by')
		})
		// top-most app is mounted at /
		if (!app.mountpath) app.mountpath = '/'
		// default locals
		app.locals.settings = app.settings
		// default configuration
		app.set('view', View)
		app.set('views', resolve('views'))
		app.set('jsonp callback name', 'callback')
		if (env === 'production') {
			app.enable('view cache')
		}
		Object.defineProperty(app, 'router', {
			get: function () {
				throw new Error('\'app.router\' is deprecated!\nPlease see the 3.x to 4.x migration guide for details on how to update your app.')
			}
		})
	},
	route: function route(path: string): RouteFormer {
		const app = this as FyrejetApp
		const routeFormer: RouteFormer = {}

		methods.forEach((method) => {
			routeFormer[method] = function (fn) {
				app[method](path, fn)
				return routeFormer
			}
		})

		return routeFormer
	},
	engine: function engine(ext: string, fn: RenderFunction): FyrejetApp {
		const app = this as FyrejetApp
		if (typeof fn !== 'function') {
			throw new Error('callback function required')
		}

		// get file extension
		const extension = ext[0] !== '.'
			? '.' + ext
			: ext

		// store engine
		app.engines[extension] = fn

		return app
	},
	enable: function enable(setting: string): FyrejetApp {
		this.set(setting, true)
		return this as FyrejetApp
	},
	disable: function disable(setting: string): FyrejetApp {
		this.set(setting, false)
		return this as FyrejetApp
	},
	param: function param(name: string, fn: ParamFn): FyrejetApp {
		const app = this as FyrejetApp
		const router = (this as FyrejetApp).getRouter()
		if (Array.isArray(name)) {
			for (let i = 0, j = name.length; i < j; i++) {
				app.param(name[i], fn)
			}

			return app
		}
		if (typeof name === 'function') {
			app.param('FYREJET_GLOBAL_PARAM', name)
			deprecate('router.param(fn): Refactor to use path params')
			return app
		}
		if (typeof fn !== 'function') {
			throw new Error('invalid param() call for ' + name + ', got ' + fn)
		}
		if (!router.paramHandlers[name]) {
			router.paramHandlers[name] = []
		}
		const guid = uuidv4()
		const newFn: Middleware = function (req, res, next) { // compatibility wrapper. Express param functions often have a fourth argument, which is not compatible with restana base that we use
			try {
				// req.params[name] = decodeURI(req.params[name])
				const arg4 = req.params[name]
				if (req.paramsCalled[guid] && req.paramsCalled[guid][name]) {
					if (req.paramsCalled[guid][name].includes(arg4)) return next()
					req.paramsCalled[guid][name].push(arg4)
					return fn(req, res, next, arg4)
				}
				if (!req.paramsCalled?.[guid] || !req.paramsCalled[guid][name]) {
					req.paramsCalled[guid] = {}
					req.paramsCalled[guid][name] = [arg4]
					return fn(req, res, next, arg4)
				}
			} catch (e) {
				return next(e)
			}
		}
		router.paramHandlers[name].push(newFn)
		return app
	},
	path: function path(): string {
		return this.parent
			? this.parent.path() + this.mountpath
			: ''
	},
	enabled: function enabled(settingA: string): boolean {
		return Boolean(this.set(settingA))
	},
	disabled: function disabled(setting: string): boolean {
		return !this.enabled(setting)
	},
	set: function set(setting: string, val?: unknown): any {
		const app = this as FyrejetApp
		if (arguments.length < 2) {
			return app.settings[setting]
		}

		debug('set "%s" to %o', setting, val)

		// set value
		app.settings[setting] = val

		// trigger matched settings
		switch (setting) {
			case 'x-powered-by':
				if (val === true) {
					app.poweredByFn = function (res: FyrejetResponse) {
						res.setHeader('X-Powered-By', 'Fyrejet')
					}
					break
				}
				if (typeof val === 'function') {
					app.poweredByFn = (val as PoweredByFn)
				}
				app.poweredByFn = function (res: FyrejetResponse) { }
				break

			case 'strict routing':
				app.settings.strict = val;
				(app as FyrejetApp).getRouter().modifySetting('strict', val)
				break
			case 'case sensitive routing':
				app.settings.caseSensitive = val;
				(app as FyrejetApp).getRouter().modifySetting('sensitive', val)
				break
			case 'etag':
				app.set('etag fn', compileETag(val))
				break
			case 'query parser':
				app.set('query parser fn', compileQueryParser(val))
				break
			case 'trust proxy':
				app.set('trust proxy fn', compileTrust(val))

				// trust proxy inherit back-compat
				Object.defineProperty(app.settings, trustProxyDefaultSymbol, {
					configurable: true,
					value: false
				})

				break
		}

		return app
	},
	render: function render(name: string, options?: RenderSuppliedOptions | RenderCallback, callback?: RenderCallback): any {
		const app = this as FyrejetApp
		const cache = app.cache
		let done: any = callback
		const engines = app.engines
		let opts = options as unknown as RenderSuppliedOptions
		const renderOptions: RenderInnerOptions = {}
		let view

		// support callback function as second arg
		if (typeof options === 'function') {
			done = options
			opts = {}
		}

		// merge app.locals
		merge(renderOptions, app.locals)


		// merge options._locals
		if (opts._locals) {
			merge(renderOptions, opts._locals)
		}

		// merge options
		merge(renderOptions, opts)

		// set .cache unless explicitly provided
		if (renderOptions.cache == null) {
			renderOptions.cache = this.enabled('view cache')
		}

		// primed cache
		if (renderOptions.cache) {
			view = cache[name]
		}

		// view
		if (!view) {
			const View = (this as FyrejetApp).get('view')
			view = new View(name, {
				defaultEngine: (this as FyrejetApp).get('view engine'),
				root: (this as FyrejetApp).get('views'),
				engines: engines
			})

			if (!view.path) {
				const dirs = Array.isArray(view.root) && view.root.length > 1
					? 'directories "' + view.root.slice(0, -1).join('", "') + '" or "' + view.root[view.root.length - 1] + '"'
					: 'directory "' + view.root + '"'
				const err = new Error('Failed to lookup view "' + name + '" in views ' + dirs)
				// @ts-expect-error
				err.view = view
				return done(err)
			}

			// prime the cache
			if (renderOptions.cache) {
				cache[name] = view
			}
		}

		// render
		tryRender(view, renderOptions, done)

	},
	use: function (fn: unknown): FyrejetApp {
		const app = this as FyrejetApp
		let offset = 0
		let path = '*'
		// default path to '*'. It will later be transformed to "/" anyways
		// disambiguate app.use([fn])
		if (typeof fn !== 'function') {
			let arg = fn

			while (Array.isArray(arg) && arg.length !== 0) {
				arg = arg[0]
			}

			// first arg is the path
			if (typeof arg !== 'function') {
				offset = 1
				path = fn
			}
		}

		const fns = flatten(slice.call(arguments, offset))

		if (fns.length === 0) {
			throw new TypeError('app.use() requires a middleware function')
		}
		fns.forEach(item => {
			if (item === 'api' || item === 'propsAsFns' || item === 'noEtag') return
			const whatItIs = getType(item)
			if (whatItIs !== 'function') {
				throw new Error(`app.use() requires a middleware function but got a ${whatItIs}`)
			}
		})

		// setup router
		const router = app.getRouter()

		fns.forEach(function (fn, index) {
			if (fn === 'api' || fn === 'propsAsFns' || fn === 'noEtag') return
			// non-fyrejet app
			let altFn
			if (!fn.fyrejetApp) {
				if (path === '*') path = '/'
				if (require('express').request.isPrototypeOf(fn.request)) {
					fn.mountpath = path
					fn.parent = this
					fn.mounted = true
					fn.use((req, res, next) => {
						req.url = req.rData_internal.urlPrevious.pop()
						req.app = res.app = req.rData_internal.appPrev.pop()
						Object.keys(req.app.response).forEach(key => {
							res[key] = req.app.response[key]
						})
						Object.keys(req.app.request).forEach(key => {
							req[key] = req.app.request[key]
						})
						Object.defineProperties(req, req.rData_internal.reqProperties)
						return req.next()
					})
					altFn = function mountedApp(req, res, next) {
						req.rData_internal.appPrev.push(req.app)
						if (!req.rData_internal.urlPrevious) req.rData_internal.urlPrevious = []
						req.rData_internal.urlPrevious.push(req.url)
						req.url = req.url.replace(path, '')
						if (req.url[0] !== '/') req.url = '/' + req.url
						// var orig = req.app;
						fn.handle(req, res, function (err) {
							// Object.setPrototypeOf(req, orig.request)
							// Object.setPrototypeOf(res, orig.response)
							next(err)
						})
					}
				}
				if (index < fns.length - 1 && typeof fns[fns.length - 1] === 'string') {
					router.useMiddleware(path, altFn || fn, fns[fns.length - 1])
					return
				}
				return router.useMiddleware(path, altFn || fn)
			}

			// fyrejet app

			if (path === '*') path = '/'

			debug('.use app under %s', path)

			fn.mountpath = path
			fn.parent = app
			fn.mounted = true
			if (index < fns.length - 1 && typeof fns[fns.length - 1] === 'string') {
				router.useMiddleware(path, fn, fns[fns.length - 1])
				return
			}
			router.useMiddleware(path, fn)

			// mounted an app
			fn.emit('mount', app)
		}, this)

		return app
	}
}

function tryRender(view, options, callback) {
	try {
		view.render(options, callback)
	} catch (err) {
		callback(err)
	}
}


export default app;