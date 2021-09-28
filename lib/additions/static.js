'use strict'

const serveStatic = require('serve-static')

module.exports = function (root, options) {
  const originalMiddleware = serveStatic(root, options)
  const middleware = (req, res, next) => {
    const oldNext = next
    const originalUrl = req.url
    req.url = req.currentUrl()
    next = function (err) {
      req.url = originalUrl
      oldNext(err)
    }
    return originalMiddleware(req, res, next)
  }
  return middleware
}
