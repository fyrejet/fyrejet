var http = require('http')

http.createServer(function (req, res) {
  if (req.url === '/hi/') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    return res.end('', 'utf-8')
  }
  res.writeHead(404, { 'Content-Type': 'text/html' })
  return res.end('Not Found', 'utf-8')
}).listen(3000)
