'use strict'

const init = function (router) {

  const request = Object.assign({}, router.request, router.request.__proto__)
  const response = Object.assign({}, router.response, router.response.__proto__)

  const initMiddleware = (req, res, next) => { // this function actually enables all the express-like kinkiness ;)
    if (req.rData_internal.initDone) {
      if (req.app.id !== router.id) {
        req.rData_internal.appPrev.push(req.app)
        req.app = res.app = router
      }
      return next()
    }

    req.rData_internal.appPrev.push(req.app)

    Object.assign(req, request)
    Object.assign(res, response)

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
        configurable: false,
        enumerable: true
      },
      url: {
        get: url,
        set: url,
        configurable: false,
        enumerable: true
      }
    })

    req.rData_internal.initDone = true

    return next()
  }
  initMiddleware.init = true

  return initMiddleware
}

module.exports = init
