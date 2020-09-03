'use strict'

const req = require('../request')
const { route } = require('../application')

const exts = {
  request: {},
  response: require('./restana-response-extensions')
}

var init = function (options, reqProperties, reqPropertiesEssential, router, slave) {
  const reqAdditionsPropsAsFns = Object.assign({}, req)
  delete reqAdditionsPropsAsFns.propFn

  Object.keys(reqProperties).forEach(item => {
    if (!reqPropertiesEssential[item.replace('Setter', '')]) {
      reqAdditionsPropsAsFns[item] = req.propFn[item]
    }
  })

  function defErrHandlerBuilder (deh, res, req) {
    return function (err) {
      if (req.method !== 'OPTIONS') {
        return deh(err)
      }
      let options
      if (router) options = router.getRouter().availableMethodsForRoute[req.url] || req.app.getRouter().availableMethodsForRoute[req.url]
      else options = req.app.getRouter().availableMethodsForRoute[req.url]
      if (!options) {
        return deh(err || false)
      }
      const optionsString = options.join(',')
      this.setHeader('Allow', optionsString)
      return this.status(200).send(optionsString)
    }
  }

  async function tryNext (req, res, next) {
    try {
      req.rData_internal.initDone = true
      await next()
    } catch (err) {
      console.log(err)
      return options.errorHandler(err, req, res)
    }
  }
  var init = async (req, res, next) => { // this function actually enables all the express-like kinkiness ;)
    const deh = res.defaultErrHandler
    res.defaultErrHandler = defErrHandlerBuilder(deh, res, req)
    function expressServe () {
      Object.keys(req.app.response).forEach(key => {
        res[key] = req.app.response[key]
      })
      Object.keys(req.app.request).forEach(key => {
        req[key] = req.app.request[key]
      })
      // Object.assign is supposed to be faster, BUT Google's V8 begs to differ, with forEach usually being at least 5% faster
      // Object.assign(req, req.app.request)
      // Object.assign(res, req.app.response)
      Object.defineProperties(req, reqProperties)

      req.next = next
      return tryNext(req, res, next)
    }

    res.sendLite = exts.response.send(options, req, res) // we still leave the user with restana's res.send implementation, if API mode is on for the route

    req.rData_internal.appPrev.push(req.app)
    req.app = res.app = router

    if (router.mountpath) req.rData_internal.tree.push(router.mountpath)
    if (req.rData_internal.initDone === true) {
      req.next = next
      return tryNext(req, res, next)
    }

    const specialMode = req.rData_internal.specialType

    if (!specialMode) { // check that the route is not marked as API-only, with disabled Express req & res additions.
      return expressServe()
    }

    if (specialMode === 'properties as functions') {
      Object.keys(reqAdditionsPropsAsFns).forEach(key => {
        req[key] = reqAdditionsPropsAsFns[key]
      })
      Object.keys(req.app.response).forEach(key => {
        res[key] = req.app.response[key]
      }) // no change here, express response additions are non-problematic
      req.next = next
    }
    // if we are here, it means we got into special route mode ;)
    if (!res.send) res.send = res.sendLite

    Object.defineProperties(req, reqPropertiesEssential) // enabling bare essentials ;)
    return tryNext(req, res, next)
  }
  init.init = true

  var slaveInit = async (req, res, next) => {
    if (route.mountpath) req.rData_internal.tree.push(router.mountpath)
    const deh = res.defaultErrHandler
    res.defaultErrHandler = defErrHandlerBuilder(deh)
    req.next = next
    return tryNext(req, res, next)
  }
  slaveInit.init = true

  if (!slave) return init
  return slaveInit
}

module.exports = init
