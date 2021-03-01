'use strict'

var serveStatic = require('serve-static')

module.exports = function (root, options) {
  var originalMiddleware = serveStatic(root, options)
  var middleware = (req, res, next) => {
    const oldNext = next
    const originalUrl = req.rData_internal.url
    req.rData_internal.url = req.currentUrl()
    next = function (err) {
      req.rData_internal.url = originalUrl
      oldNext(err)
    }
    return originalMiddleware(req, res, next)
  }
  return middleware
}
