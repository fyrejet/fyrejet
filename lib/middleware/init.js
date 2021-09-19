'use strict'

const { route } = require('../application')

const init = function (router, slave) {

  const normInit = (req, res, next) => { // this function actually enables all the express-like kinkiness ;)
    if (req.rData_internal.initDone) {
      if (req.app.id !== router.id) {
        req.rData_internal.appPrev.push(req.app)
        req.app = res.app = router

        req.rData_internal.tree.push(router.mountpath)
      }
      return next()
    }

    req.rData_internal.appPrev.push(req.app)
    req.rData_internal.tree.push(router.mountpath)

    req.rData_internal.initDone = true

    Object.assign(req, req.app.request.__proto__, req.app.request)
    Object.assign(res, req.app.response.__proto__, req.app.response)

    function methodGetter () {
      return this.rData_internal.method
    }

    function methodSetter (inp) {
      if (this.rData_internal.method !== inp) {
        this.rData_internal.reroute = true
        this.rData_internal.method = inp
      }
      return this.rData_internal.method
    }

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

    Object.defineProperties(req, {
      method: {
        get: methodGetter,
        set: methodSetter,
        configurable: true,
        enumerable: true
      },
      url: {
        get: urlGetter,
        set: urlSetter,
        configurable: true,
        enumerable: true
      }
    })

    return next()
  }
  normInit.init = true

  const slaveInit = (req, res, next) => {
    if (route.mountpath) req.rData_internal.tree.push(router.mountpath)
    return next()
  }
  slaveInit.init = true

  if (!slave) return normInit
  return slaveInit
}

module.exports = init
