'use strict'

const request = require('../request')
const response = require('../response')

const init = function (router) {

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

    req.rData_internal.initDone = true

    return next()
  }
  initMiddleware.init = true

  return initMiddleware
}

module.exports = init
