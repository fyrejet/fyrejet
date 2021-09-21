'use strict'

const { route } = require('../application')

const init = function (router, slave) {

  const normInit = (req, res, next) => { // this function actually enables all the express-like kinkiness ;)
    if (req.rData_internal.initDone) {
      if (req.app.id !== router.id) {
        req.rData_internal.appPrev.push(req.app)
        req.app = res.app = router
      }
      return next()
    }

    req.app.__routerMountPath = router.mountpath
    req.rData_internal.appPrev.push(req.app)

    Object.assign(req, req.app.request.__proto__, req.app.request)
    Object.assign(res, req.app.response.__proto__, req.app.response)

    function method (inp) {
      if (!inp) return this.rData_internal.method
      if (this.rData_internal.method !== inp) {
        this.rData_internal.reroute = true
        this.rData_internal.method = inp
      }
      return this.rData_internal.method
    }

    function url (inp) {
      if (!inp) return this.rData_internal.url
      if (this.rData_internal.url !== inp) {
        this.rData_internal.reroute = true
        this.rData_internal.url = inp
      }
      return this.rData_internal.url
    }

    Object.defineProperties(req, {
      method: {
        get: method,
        set: method,
        configurable: true,
        enumerable: true
      },
      url: {
        get: url,
        set: url,
        configurable: true,
        enumerable: true
      }
    })

    req.rData_internal.initDone = true

    return next()
  }
  normInit.init = true

  const slaveInit = (req, res, next) => {
    return next()
  }
  slaveInit.init = true

  if (!slave) return normInit
  return slaveInit
}

module.exports = init
