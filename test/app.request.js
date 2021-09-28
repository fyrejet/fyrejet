var express = require("../");
var request = require("supertest");

describe("app", function () {
  //describe('.request', function () {
  //  it('should extend the request prototype', function (done) {
  //    var app = express()
  //
  //    app.request.querystring = function () {
  //      return require('url').parse(this.url).query
  //    }
  //
  //    app.use(function (req, res) {
  //      res.end(req.querystring())
  //    })
  //
  //    request(app)
  //      .get('/foo?name=tobi')
  //      .expect('name=tobi', done)
  //  })
  //})

  // This test is removed, because extending prototypes is a bad idea + it decreases performance
});
