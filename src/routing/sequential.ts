'use strict'

// Forked from jkybernees's excellent 0http

import Trouter, { Match, MountedRouters } from './trouter';
import next from './next';
import LRU from 'mnemonist/lru-cache';
import onChange from 'on-change';
import fastDecode from 'fast-decode-uri-component';
import { ErrorHandler, FinalRoute, QueryParser, SequentialConfig } from './types';
import { FyrejetApp, FyrejetRequest, FyrejetResponse, Middleware, NextFunction } from '../types';
import errHandler from '../errHandler'

export const sequential = (config: SequentialConfig, fyrejetApp: FyrejetApp) => {
	config.mountpath = ''
	config.cacheSize = config.routerCacheSize || config.cacheSize || 2000
	config.defaultRoute = config.defaultRoute || ((req, res) => {
		errHandler(req, false) // 404 error
	})
	config.sensitive = config.sensitive || config.caseSensitive

	if (!config.errorHandler) {
		config.errorHandler = (err, req, res) => {
			res.statusCode = 500
			if (err instanceof Error) return res.end(err.message)
			return res.end(err)
		}
	}
	if (!config.id) {
		config.id = (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase()
	}

	const mountedRouters : MountedRouters = {}
	const cache = new LRU<string, Match>(config.cacheSize)

	const routerLookup = (req: FyrejetRequest, res: FyrejetResponse, step: NextFunction) => {
		let fn: Middleware
		if (!step) {
			req.originalUrl = req.url as string // if there is no req.rData_internal, it means there is no req.originalUrl either
			req.rData_internal = {
				urlPrev: req.url as string,
				methodPrev: req.method as string,
				appPrev: [],
				urlPrevious: [],
				paramsPrev: [],
			}

			makeReqParams(req)

			const split = (req.url as string).split('?')
			req.path = split[0]

			const queryparse = req.app.__settings.get('query parser fn') as QueryParser
			const query = split.slice(1).join('?')
			req.search = '?' + query
			req.query = queryparse(query)

			res.locals = Object.create(null) // res.locals is rather convenient at times, so we leave it on even for API routes
			req.paramsCalled = {} // needed for app.param

			return carryOn()
		}

		const urlBackup = req.url
		if (req.rData_internal.lastPattern) {
			req.url = (req.url as string).replace(req.rData_internal.lastPattern, '').trim() || urlBackup
		}
		req.rData_internal.urlPrev = (req.url as string)

		const split = (req.url as string).split('?', 1) // this is NOT repetitive code as req.url value is now different here
		req.path = split[0]

		if (!config.mergeParams) {
			req.params = onChange.unsubscribe(req.params)
			makeReqParams(req)
		}

		fn = (req, res, next) => {
			req.url = req.rData_internal.urlPrevious.pop()
			req.rData_internal.urlPrev = req.url as string
			req.app = res.app = req.rData_internal.appPrev.pop() || req.app

			req.next = step
			return step()
		}
		if (step && req.stepString && step.toString() !== req.stepString) {
			fn = function (err) {
				if (req.rData_internal.paramsPrev?.length) {
					req.params = req.rData_internal.paramsPrev[req.rData_internal.paramsPrev.length - 2] || req.rData_internal.paramsPrev[req.rData_internal.paramsPrev.length - 1]
				}
				return step(err)
			}
		}
		return carryOn()

		function carryOn() {
			const reqCacheKey = req.method + req.path
			let match = cache.get(reqCacheKey)
			if (!match) {
				match = router.find(req.method as string, req.path, req, res)
				match.urlProperVerified = fastDecode(req.path)
				if (!req.app.__settings.get('etag')) match.noEtag = true
				cache.set(reqCacheKey, match)
			}

			req.rData_internal.noEtag = match.noEtag
			req.rData_internal.urlProperVerified = match.urlProperVerified
			/* we can cache this, because same route matches are gonna have the same result.
			  if there is some bogus data in query part, query parser is gonna fail separately */

			const middlewares = [...match.handlers]
			if (fn) middlewares.push(fn)
			const middlewaresArgsNum = match.handlersArgsNum

			req.routesToProcess = match.routes

			return next(middlewares, middlewaresArgsNum, req, res, 0, 0, mountedRouters, config.defaultRoute as FinalRoute, config.errorHandler as ErrorHandler, null)
		}
	}

	const additionalRouterProperties = {
		id: config.id,
		changeSequentialConfig: (option: string, value: unknown) => {
			if (option && (value || value === null)) {
				config[option] = value
			}
		},
		getSequentialConfig: () => config,
		mountedRouters,
		lookup: routerLookup,
		fyrejetApp
	}

	const router = new Trouter(config, additionalRouterProperties)

	return router
}

export default sequential

function makeReqParams(req: FyrejetRequest) {
	req.params = {}
	req.paramsUserDefined = [] as string[]
	req.params = onChange(req.params, function (path, value, previousValue, name) {
		if (typeof req.params !== 'object') {
			if (!req.rData_internal.paramsPrev?.length) {
				req.params = {}
				return
			}
			req.params = req.rData_internal.paramsPrev[req.rData_internal.paramsPrev.length - 1]
			return
		}
		req.paramsUserDefined?.push(path)
	}, {
		isShallow: true
	})
}
