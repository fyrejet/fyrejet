
var express = require('../')

describe('app.listen()', function () {
  it('should wrap with an HTTP server', function (done) {
    if (process.env.UWS_SERVER_ENABLED_FOR_TEST === 'TRUE') {
      console.log('\x1b[31m%s\x1b[0m', 'TFyrejet possibly doesn\'t conform to Express API here')
      done()
    }
    var app = express()
    app.del('/tobi', function (req, res) {
      res.end('deleted tobi!')
    })

    var server = app.listen(9999, function () {
      server.close()
      done()
    })
  })
})
