'use strict'

const onChange = require('on-change')

function next (middlewares, middlewaresArgsNum, req, res, index, routeIndex, routers = {}, defaultRoute, errorHandler, error) {
  function nextRunErrLoop (errMiddlewareIndex) { // used for error handling
    for (let n = index, o = middlewares.length; n < o; n++) {
      const argsNum = middlewaresArgsNum[n]
      if (argsNum >= 4) {
        errMiddlewareIndex = n
        return errMiddlewareIndex
      }
    }
  }

  if (!req.stepString) { req.stepString = step.toString() }
  const middleware = middlewares[index]
  const middlewareArgsNum = middlewaresArgsNum[index]
  if (!middleware) {
    return defaultRoute(req, res)
  }

  function paramOrNot () {
    if (routeIndex < req.routesToProcess.length) {
      req.currentRouteMiddlewareNum = req.currentRouteMiddlewareNum ? ++req.currentRouteMiddlewareNum : 1
      const curRoute = req.route = req.routesToProcess[routeIndex]
      if (curRoute.keys.length && curRoute.handlers[0] === middleware) { // we don't want to extract params at EVERY middleware and at routes with no keys
        try {
          decodeURIComponent(req.url)
        } catch (e) {
          res.statusCode = 400
          res.statusMessage = 'Bad Request'
          return res.end()
        }
        return getParams(curRoute)
      }
      if (curRoute.handlers[curRoute.handlers.length - 1] === middleware) {
        routeIndex++
        delete req.currentRouteMiddlewareNum
      }
    }
  }

  function getParams (route) {
    let matches
    const params = {}
    if (!route.keys) {
      matches = route.pattern.exec(req.path)
      if (matches === null) return
      if (matches.groups !== undefined) for (const k in matches.groups) params[k] = matches.groups[k]
      return furtherGetParams()
    }
    if (route.keys.length) {
      if (Array.isArray(route.keys)) {
        matches = route.pattern.exec(req.path)
        if (matches === null) return
        for (let j = 0; j < route.keys.length;) params[route.keys[j]] = matches[++j]
        return furtherGetParams()
      }

      matches = route.pattern.exec(req.path)
      if (matches === null) return
      // params.length = route.keys.length
      let j = 0
      let finishMatchLoop = false
      while (!finishMatchLoop) {
        if (matches[j]) {
          params[j] = matches[j]
          j++
        } else {
          finishMatchLoop = true
          params.length = j
        }
      }

      Array.prototype.splice.call(params, 0, 1)
      Object.keys(params).forEach(key => {
        if (!params[key]) {
          delete params[key]
        }
      })
      delete params.length

      return furtherGetParams()
    }
    function furtherGetParams () {
      if (req.params['0']) {
        let n = 0
        let nEmptyNotReached = true
        while (nEmptyNotReached) {
          if (req.params[n]) {
            n++
            if (req.params[n] === 'undefined' || req.params[n] === 'null') delete onChange.target(req.params)[n]
          } else {
            nEmptyNotReached = false
            for (let x = 0, y = route.keys.length; x < y; ++x) {
              if (params[x]) {
                onChange.target(req.params)[n] = params[x]
              }
              n++
            }
            break
          }
        }
        if (req.app.mounted) return
      }

      if (route.starCatchAll) { // the http://example.com/* route ;)
        onChange.target(req.params)['0'] = '/' + decodeURIComponent(params['0'])
        return
      }
      let prevParams = req.rData_internal.paramsPrev[req.rData_internal.paramsPrev.length - 1 || 0] || {}
      prevParams = JSON.stringify(prevParams)

      if (prevParams !== JSON.stringify(params)) req.rData_internal.paramsPrev.push(Object.assign({}, params))
      Object.keys(params).forEach(key => {
        if (!req.paramsUserDefined.includes(key)) {
          onChange.target(req.params)[key] = params[key] !== undefined ? decodeURIComponent(params[key]) : undefined
        }
      })
    }
  }

  function step (err) {
    let errMiddlewareIndex // together with runErrLoop this is used for error handling
    function runErrLoop () {
      for (let n = index, o = middlewares.length; n < o; n++) {
        const argsNum = middlewaresArgsNum[n]
        if (argsNum >= 4) {
          errMiddlewareIndex = n
          break
        }
      }
    }

    if (typeof req.params !== 'object') req.params = req.rData_internal.paramsPrev[req.rData_internal.paramsPrev.length - 1] || {}
    if (req.routesToProcess[routeIndex]) {
      req.rData_internal.lastPattern = req.routesToProcess[routeIndex].pattern
    }
    if (!err) return stepNormally()
    switch (err) {
      case 'route':
        if (req.currentRouteMiddlewareNum) {
          const middlewaresPassed = req.currentRouteMiddlewareNum
          const middlewaresTotal = req.routesToProcess[routeIndex].handlers.length
          const middlewaresToSkip = middlewaresTotal - middlewaresPassed
          index = index + middlewaresToSkip + 1
          req.paramsCalled = {}
          routeIndex++
          delete req.currentRouteMiddlewareNum
          return next(middlewares, middlewaresArgsNum, req, res, index, routeIndex, routers, defaultRoute, errorHandler)
        }
        return stepNormally()
      case 'router':
        if (req.currentRouteMiddlewareNum) {
          delete req.currentRouteMiddlewareNum
        }
        req.paramsCalled = {}
        return next(middlewares, middlewaresArgsNum, req, res, middlewares.length - 1, routeIndex, routers, defaultRoute, errorHandler)
      default:
        runErrLoop()
        if (errMiddlewareIndex === index) {
          errMiddlewareIndex = null
          ++index
          runErrLoop()
        }
        if (errMiddlewareIndex) return next(middlewares, middlewaresArgsNum, req, res, errMiddlewareIndex, routeIndex, routers, defaultRoute, errorHandler, err)
        return errorHandler(err, req, res)
    }

    function stepNormally () {
      if (req.rData_internal.reroute) {
        delete req.rData_internal.reroute
        return req.app.getRouter().lookup(req, res, step)
      }
      let newIndex
      let gotAppropriateFn = false
      for (let n = index + 1, o = middlewares.length; n < o; n++) {
        const argsNum = middlewaresArgsNum[n]
        if (argsNum < 4) {
          newIndex = n
          gotAppropriateFn = true
          break
        }
        newIndex = n
      }
      if (gotAppropriateFn) {
        while (req.routesToProcess.length > routeIndex) {
          if (req.routesToProcess[routeIndex].handlers.includes(middlewares[newIndex])) {
            index = newIndex
            return next(middlewares, middlewaresArgsNum, req, res, index, routeIndex, routers, defaultRoute, errorHandler, error)
          }
          routeIndex++
        }
        routeIndex++
      }
      routeIndex = req.routesToProcess.length - 1
      index = newIndex

      return next(middlewares, middlewaresArgsNum, req, res, index, routeIndex, routers, defaultRoute, errorHandler, error)
    }
  }

  try {
    paramOrNot()
    req.curMiddleware = middleware
    if (middleware.id) {
      const pattern = routers[middleware.id]
      if (pattern) {
        req.rData_internal.urlPrevious.push(req.url)
        req.preRouterUrl = req.url

        const mountpath = middleware.getRouter().getSequentialConfig().mountpath || pattern
        req.rData_internal.url = req.rData_internal.url.replace(mountpath, '')

        delete req.rData_internal.lastPattern
      }

      return middleware.lookup(req, res, step)
    }

    if (middlewareArgsNum > 3) {
      if (!error && req.method !== 'OPTIONS') {
        return defaultRoute(req, res)
      }
      return middleware(error, req, res, step)
    }
    return middleware(req, res, step)
  } catch (err) {
    let errMiddlewareIndex
    ++index
    nextRunErrLoop(errMiddlewareIndex)
    if (errMiddlewareIndex) {
      return middlewares[errMiddlewareIndex](err, req, res, step)
    }
    return errorHandler(err, req, res)
  }
}

module.exports = next
