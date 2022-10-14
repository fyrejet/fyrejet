import onChange from 'on-change'
import fastDecode from 'fast-decode-uri-component'
import { FyrejetRequest, FyrejetResponse, Middleware } from '../types'
import { ErrorHandler, FinalRoute } from './types'

export function next (middlewares: Middleware[], middlewaresArgsNum: number[], req: FyrejetRequest, res: FyrejetResponse, index: number, routeIndex: number, routers = {}, defaultRoute: FinalRoute, errorHandler: ErrorHandler, error?: Error | null) {

  function paramOrNot (cb) {
    if (!req.rData_internal.currentRouteMiddlewareNum) {
      req.rData_internal.currentRouteMiddlewareNum = 0
      if (req.route.keys.length) { // we don't want to extract params at EVERY middleware and at routes with no keys
        if (!req.rData_internal.urlProperVerified) {
          res.statusCode = 400
          res.statusMessage = 'Bad Request'
          return res.end()
        }
        getParams(req.route)
      }
    }
    ++req.rData_internal.currentRouteMiddlewareNum

    if ((req.route.handlers.length) === req.rData_internal.currentRouteMiddlewareNum) {
      routeIndex++
      delete req.rData_internal.currentRouteMiddlewareNum
    }
    return cb()
  }

  function getParams (route) {
    let matches
    const params = {}

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
        onChange.target(req.params)['0'] = '/' + fastDecode(params['0'])
        return
      }
      let prevParams = req.rData_internal.paramsPrev[req.rData_internal.paramsPrev.length - 1 || 0] || {}
      prevParams = JSON.stringify(prevParams)

      if (prevParams !== JSON.stringify(params)) req.rData_internal.paramsPrev.push(Object.assign({}, params))
      Object.keys(params).forEach(key => {
        if (!req.paramsUserDefined.includes(key)) {
          onChange.target(req.params)[key] = params[key] !== undefined ? fastDecode(params[key]) : undefined
        }
      })
    }
  }

  function step (err: any) {
    let errMiddlewareIndex // together with runErrLoop this is used for error handling
    function runErrLoop () {
      for (let n = index, o = middlewaresArgsNum.length; n < o; n++) {
        const argsNum = middlewaresArgsNum[n]
        if (argsNum >= 4) {
          errMiddlewareIndex = n
          break
        }
      }
    }
    if (!(req.params === Object(req.params))) req.params = req.rData_internal.paramsPrev?.[req.rData_internal.paramsPrev.length - 1] || {}
    if (req.routesToProcess[routeIndex]) req.rData_internal.lastPattern = req.routesToProcess[routeIndex].pattern

    switch (err) {
      case null:
      case undefined:
        return stepNormally()
      case 'route':
        if (req.rData_internal.currentRouteMiddlewareNum) {
          const middlewaresPassed = req.rData_internal.currentRouteMiddlewareNum
          const middlewaresTotal = req.routesToProcess[routeIndex].handlers.length
          const middlewaresToSkip = middlewaresTotal - middlewaresPassed
          index = index + middlewaresToSkip + 1
          req.paramsCalled = {}
          routeIndex++
          delete req.rData_internal.currentRouteMiddlewareNum
          return next(middlewares, middlewaresArgsNum, req, res, index, routeIndex, routers, defaultRoute, errorHandler)
        }
        return stepNormally()
      case 'router':
        if (req.rData_internal.currentRouteMiddlewareNum) {
          delete req.rData_internal.currentRouteMiddlewareNum
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
      if (req.rData_internal.methodPrev !== req.method || req.rData_internal.urlPrev !== req.url) {
        req.rData_internal.methodPrev = req.method as string
        req.rData_internal.urlPrev = req.url as string
        return req.app.getRouter().lookup(req, res, step)
      }
      let newIndex
      for (let n = index + 1, o = middlewares.length; n < o; n++) {
        const argsNum = middlewaresArgsNum[n]
        if (argsNum < 4) {
          newIndex = n
          break
        }
        newIndex = n
      }

      for (; routeIndex < req.routesToProcess.length; routeIndex++) {
        if (req.routesToProcess[routeIndex].handlers.includes(middlewares[newIndex])) {
          index = newIndex
          return next(middlewares, middlewaresArgsNum, req, res, index, routeIndex, routers, defaultRoute, errorHandler, error)
        }
      }

      routeIndex = req.routesToProcess.length - 1
      index = newIndex

      return next(middlewares, middlewaresArgsNum, req, res, index, routeIndex, routers, defaultRoute, errorHandler, error)
    }
  }

  function finishStage () {
    try {
      if (middlewares[index].id) {
        const pattern = routers[middlewares[index].id]
        if (pattern) {
          req.rData_internal.urlPrevious.push(req.url)

          const mountpath = middlewares[index].getRouter().getSequentialConfig().mountpath || pattern
          req.url = (req.url as string).replace(mountpath, '')

          delete req.rData_internal.lastPattern
        }

        return middlewares[index].lookup(req, res, step)
      }

      if (middlewareArgsNum > 3) {
        if (!error && req.method !== 'OPTIONS') {
          return defaultRoute(req, res)
        }
        return middlewares[index](error, req, res, step)
      }
      return middlewares[index](req, res, step)
    } catch (err) {
      return errorHandler(err, req, res)
    }
  }

  if (index === 0) {
    req.stepString = step.toString()
    req.route = req.routesToProcess[0]
    return paramOrNot(() => middlewares[0](req, res, step))
  }
  const middlewareArgsNum = middlewaresArgsNum[index]

  if (!middlewares[index]) return defaultRoute(req, res)

  req.route = req.routesToProcess[routeIndex]
  req.next = step
  if (!req.route) return res.defaultErrHandler()

  return paramOrNot(finishStage)
}

export default next