'use strict'

const {build: requestExtend} = require('../request')
const {build: responseExtend} = require('../response')

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

    res = responseExtend(res)
    req = requestExtend(req)

    req.rData_internal.initDone = true

    return next()
  }
  initMiddleware.init = true

  return initMiddleware
}

module.exports = init
