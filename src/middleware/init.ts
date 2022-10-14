'use strict'

import { FyrejetApp, FyrejetResponse, NextFunction } from "../types"
import { FyrejetRequest } from "../types/request"

import {build as requestExtend} from '../request'
const { build: responseExtend } = require('../response')

const init = function (router: FyrejetApp) {
  const initMiddleware = (req: FyrejetRequest, res: FyrejetResponse, next: NextFunction) => { // this function actually enables all the express-like kinkiness ;)
    if (req.rData_internal.initDone) {
      if (req.app.id !== router.id) {
        req.rData_internal.appPrev.push(req.app)
        req.app = res.app = router
      }
      return next()
    }

    res = responseExtend(res)
    req = requestExtend(req)

    req.rData_internal.initDone = true

    return next()
  }
  initMiddleware.init = true

  return initMiddleware
}

module.exports = init
