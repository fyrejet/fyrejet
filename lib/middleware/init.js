'use strict'

const { route } = require('../application')
var setPrototypeOf = require('setprototypeof')

const exts = {
  request: {},
  response: require('./restana-response-extensions')
}

function defineGetter(obj, name, getter, setter) {
  Object.defineProperty(obj, name, {
    configurable: true,
    enumerable: true,
    get: getter,
    set: setter
  });
}


var init = function (options, router, slave) {
  //const reqAdditionsPropsAsFns = Object.assign({}, req)
  //delete reqAdditionsPropsAsFns.propFn
//
  //Object.keys(reqProperties).forEach(item => {
  //  if (!reqPropertiesEssential[item.replace('Setter', '')]) {
  //    reqAdditionsPropsAsFns[item] = req.propFn[item]
  //  }
  //})

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

  const normInit = async (req, res, next) => { // this function actually enables all the express-like kinkiness ;)
    //console.log(args)
    const deh = res.defaultErrHandler // backup of defaultErrHandler
    res.defaultErrHandler = defErrHandlerBuilder(deh, res, req)
    req.activateExpress = function () {
      // stub function to break as few apps as possible
      return this
    }

    res.sendLite = exts.response.send(options, req, res) // we still leave the user with restana's res.send implementation, if API mode is on for the route

    req.rData_internal.appPrev.push(req.app)
    req.app = res.app = router

    req.rData_internal.tree.push(router.mountpath)

    if (req.rData_internal.initDone) {
      if (next) return next()
      return
      
    }

    req.rData_internal.initDone = true

    setPrototypeOf(req, req.app.request)
    setPrototypeOf(res, req.app.response)

    delete req.method // this doesn't really work in prototype. Hopefully next release will remove reliance on req.rData_internal.method, so this hack is unnecessary

    function method () {
      return this.rData_internal.method
    }
    
    function methodSetter (inp) {
      if (this.rData_internal.method !== inp) {
        this.rData_internal.reroute = true
        this.rData_internal.method = inp
      }
      return this.rData_internal.method
    }
    
    defineGetter(req, 'method', method, methodSetter)


    delete req.url // this doesn't really work in prototype. Hopefully next release will remove reliance on req.rData_internal.url, so this hack is unnecessary
    function urlGetter () {
      return this.rData_internal.url
    }

    function urlSetter (inp) {
      if (this.rData_internal.url !== inp) {
        this.rData_internal.reroute = true
        this.rData_internal.url = inp
      }
      return this.rData_internal.url
    }

    defineGetter(req, 'url', urlGetter, urlSetter)

    if (next) return next()
    return
  }
  normInit.init = true

  const slaveInit = async (req, res, next) => {
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
