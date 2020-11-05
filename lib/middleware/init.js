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

  function defErrHandlerBuilder (defaultErrHandler, res, req) {
    return function (err) {
      if (req.method !== 'OPTIONS') {
        return defaultErrHandler(err)
      }
      let options
      if (router) options = router.getRouter().availableMethodsForRoute[req.url]
      if (!options) options = req.app.getRouter().availableMethodsForRoute[req.url]
      if (!options) {
        return defaultErrHandler(err || false)
      }
      const optionsString = options.join(',')
      this.setHeader('Allow', optionsString)
      return this.status(200).send(optionsString)
    }
  }

  let normInit = async (req, res, next) => { // this function actually enables all the express-like kinkiness ;)
    const deh = res.defaultErrHandler // backup of defaultErrHandler
    res.defaultErrHandler = defErrHandlerBuilder(deh, res, req)
    req.activateExpress = function() {
      let req = this
      let res = this.res

      Object.assign(req, req.app.request)
      Object.assign(res, req.app.response)

      /* 
        this previously had a ' Object.keys(req.app.response).forEach(key => { ' implementation that sucked and an erroneous claim that it was faster
        due to erroneous benchmarks. I am sorry, my dudes
      */
      
      Object.defineProperties(req, reqProperties)
      return req
    }

    res.sendLite = exts.response.send(options, req, res) // we still leave the user with restana's res.send implementation, if API mode is on for the route

    req.rData_internal.appPrev.push(req.app)
    req.app = res.app = router

    req.rData_internal.tree.push(router.mountpath)
    
    if (req.rData_internal.initDone) {
      req.next = next
      return next()
    }

    const specialMode = req.rData_internal.specialMode

    req.next = next
    req.rData_internal.initDone = true

    if (!specialMode) { // check that the route is not marked as API-only, with disabled Express req & res additions.
      req.activateExpress()
      return next()
    }
    if (specialMode === 'properties as functions') {
      Object.keys(reqAdditionsPropsAsFns).forEach(key => {
        req[key] = reqAdditionsPropsAsFns[key]
      })
      req.propFn = req.app.request.propFn
      Object.keys(req.app.response).forEach(key => {
        res[key] = req.app.response[key]
      }) // no change here, express response additions are non-problematic
    }
    // if we are here, it means we got into special route mode ;)

    if (!res.send) res.send = res.sendLite

    Object.defineProperties(req, reqPropertiesEssential) // enabling bare essentials ;)
    return next()
  }
  normInit.init = true

  let slaveInit = async (req, res, next) => {
    if (route.mountpath) req.rData_internal.tree.push(router.mountpath)
    const deh = res.defaultErrHandler
    res.defaultErrHandler = defErrHandlerBuilder(deh)
    req.next = next
    return next()
  }
  slaveInit.init = true

  if (!slave) return normInit
  return slaveInit
}

module.exports = init
