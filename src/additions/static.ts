import serveStaticOriginal from 'serve-static'
import { FyrejetResponse, Middleware } from '../types'

export function serveStatic(root: string, options: serveStaticOriginal.ServeStaticOptions<FyrejetResponse>) {
  const originalMiddleware = serveStaticOriginal(root, options)
  const middleware : Middleware = (req, res, next) => {
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
