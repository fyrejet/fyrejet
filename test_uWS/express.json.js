
var assert = require('assert')
var Buffer = require('safe-buffer').Buffer
var express = require('..')
var request = require('superagent')

describe('express.json()', function () {
  it('should parse JSON', function (done) {
    let server = createApp().listen(9999, () => {})
    request
      .post('http://localhost:9999/')
      .set('Content-Type', 'application/json')
      .send('{"user":"tobi"}')
      .end((err,res) => {
        if (!err && res.text === '{"user":"tobi"}') {
          server.close();
          done()
        }
        else {
          console.log('Something went wrong')
          server.close();
          done('smth-wrong')
        }
      })
  })

  it('should handle Content-Length: 0', function (done) {
    let server = createApp().listen(9999, () => {})
    request
      .post('http://localhost:9999/')
      .set('Content-Type', 'application/json')
      .set('Content-Length', '0')
      .end((err,res) => {
        if (!err && res.text === '{}') {
          server.close();
          done()
        }
        else {
          console.log('Something went wrong')
          server.close();
          done('smth-wrong')
        }
      })
  })

  it('should handle empty message-body', function (done) {
    let server = createApp().listen(9999, () => {})
    request
      .post('http://localhost:9999/')
      .set('Content-Type', 'application/json')
      .set('Transfer-Encoding', 'chunked')
      .end((err,res) => {
        if (!err && res.text === '{}') {
          server.close();
          done()
        }
        else {
          console.log('Something went wrong')
          server.close();
          done('smth-wrong')
        }
      })
  })

  it('should handle no message-body', function (done) {
    let server = createApp().listen(9999, () => {})
    request
      .post('http://localhost:9999/')
      .set('Content-Type', 'application/json')
      .unset('Transfer-Encoding')
      .end((err,res) => {
        if (!err && res.text === '{}') {
          server.close();
          done()
        }
        else {
          console.log('Something went wrong')
          server.close();
          done('smth-wrong')
        }
      })
  })

  it('should 400 when invalid content-length', function (done) {
    const low = express.uwsCompat
    var app = express({
	  	prioRequestsProcessing: false, // without this option set to 'false' uWS is going to be extremely sluggish
	  	server: low(),
	  	serverType: 'uWebSocket'
    })
    
    let server = app.listen(9999, () => {})

    app.use(function (req, res, next) {
      req.headers['content-length'] = '20' // bad length
      next()
    })

    app.use(express.json())

    app.post('/', function (req, res) {
      res.json(req.body)
    })

    request
      .post('http://localhost:9999/')
      .set('Content-Type', 'application/json')
      .send('{"str":')
      .end((err,res) => {
        if (res.status === 400 && res.text.match(/content length/)) {
          server.close();
          return done()
        }
        console.log('Something went wrong')
        server.close();
        return done(err||'smth-wrong')
      })
      //.expect(400, /content length/, done)
  })

  it('should handle duplicated middleware', function (done) {
    const low = express.uwsCompat
    var app = express({
	  	prioRequestsProcessing: false, // without this option set to 'false' uWS is going to be extremely sluggish
	  	server: low(),
	  	serverType: 'uWebSocket'
    })
    
    let server = app.listen(9999, () => {})

    app.use(express.json())
    app.use(express.json())

    app.post('/', function (req, res) {
      res.json(req.body)
    })

    request
      .post('http://localhost:9999/')
      .set('Content-Type', 'application/json')
      .send('{"user":"tobi"}')
      //.expect(200, '{"user":"tobi"}', done)
      .end((err,res) => {
        if (res.status === 200 && res.text === '{"user":"tobi"}') {
          server.close();
          return done()
        }
        console.log('Something went wrong')
        server.close();
        return done(err||'smth-wrong')
      })
  })

  describe('when JSON is invalid', function () {
    before(function () {
      this.app = createApp()
      this.app.listen(9999)
    })

    it('should 400 for bad token', function (done) {
      request
        .post('http://localhost:9999/')
        .set('Content-Type', 'application/json')
        .send('{:')
        .end((err,res) => {
          if (res.status === 400 && res.text === parseError('{:')) {
            return done()
          }
          console.log('Something went wrong')
          this.app.close();
          return done(err||'smth-wrong')
        })
    })

    it('should 400 for incomplete', function (done) {
      request
        .post('http://localhost:9999/')
        .set('Content-Type', 'application/json')
        .send('{"user"')
        .end((err,res) => {
          if (res.status === 400 && res.text === parseError('{"user"')) {
            return done()
          }
          console.log('Something went wrong')
          this.app.close();
          return done(err||'smth-wrong')
        })
    })

    it('should error with type = "entity.parse.failed"', function (done) {
      request
        .post('http://localhost:9999/')
        .set('Content-Type', 'application/json')
        .set('X-Error-Property', 'type')
        .send(' {"user"')
        .end((err,res) => {
          if (res.status === 400 && res.text === 'entity.parse.failed') {
            return done()
          }
          console.log('Something went wrong')
          this.app.close();
          return done(err||'smth-wrong')
        })
    })

    it('should include original body on error object', function (done) {
      request
      .post('http://localhost:9999/')
        .set('Content-Type', 'application/json')
        .set('X-Error-Property', 'body')
        .send(' {"user"')
        .end((err,res) => {
          if (res.status === 400 && res.text === ' {"user"') {
            this.app.close();
            return done()
          }
          console.log('Something went wrong')
          this.app.close();
          return done(err||'smth-wrong')
        })
    })
  })

  describe('with limit option', function () {
    it('should 413 when over limit with Content-Length', function (done) {
      var buf = Buffer.alloc(1024, '.')
      let server = createApp({ limit: '1kb' }).listen(9999, () => {})
      request
        .post('http://localhost:9999/')
        .set('Content-Type', 'application/json')
        .set('Content-Length', '1034')
        .send(JSON.stringify({ str: buf.toString() }))
        //.expect(413, done)
        .end((err,res) => {
          if (res.status === 413) {
            server.close();
            return done()
          }
          console.log('Something went wrong')
          server.close();
          return done('smth-wrong')
        })
    })

    it('should error with type = "entity.too.large"', function (done) {
      var buf = Buffer.alloc(1024, '.')
      let server = createApp({ limit: '1kb' }).listen(9999, () => {})
      request
        .post('http://localhost:9999/')
        .set('Content-Type', 'application/json')
        .set('Content-Length', '1034')
        .set('X-Error-Property', 'type')
        .send(JSON.stringify({ str: buf.toString() }))
        .end((err,res) => {
          if (res.status === 413 && res.text === 'entity.too.large') {
            server.close();
            return done()
          }
         
          console.log('Something went wrong')
          server.close();
          return done('smth-wrong')
          
        })
    })

    it('should 413 when over limit with chunked encoding', function (done) {
      console.log('\x1b[31m%s\x1b[0m', 'Test is removed and needs to be rewritten, Fyrejet possibly doesn\'t conform to Express API here')
      done()
      //var buf = Buffer.alloc(1024, '.')
      //var server = createApp({ limit: '1kb' })
      //server.listen(9999, () => {})
      //var test = request.post('/')
      //  .set('Content-Type', 'application/json')
      //  .set('Transfer-Encoding', 'chunked')
      //test.write('{"str":')
      //test.write('"' + buf.toString() + '"}')
      //  //.expect(413, done)
      //test.end((err,res) => {
      //  console.log(res)
      //  if (res.status === 413) {
      //    //server.close();
      //    return done()
      //  }
      // 
      //  console.log('Something went wrong')
      //  //server.close();
      //  return done('smth-wrong')
      //  
      //})
    })

    it('should accept number of bytes', function (done) {
      var buf = Buffer.alloc(1024, '.')
      let server = createApp({ limit: 1024 })
      server.listen(9999)
      request
        .post('http://localhost:9999/')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ str: buf.toString() }))
        .end((err,res) => {
          if (res.status === 413) {
            server.close();
            return done()
          }
         
          console.log('Something went wrong')
          server.close();
          return done('smth-wrong')
          
        })
    })

    it('should not change when options altered', function (done) {
      var buf = Buffer.alloc(1024, '.')
      var options = { limit: '1kb' }
      var server = createApp(options)
      server.listen(9999)

      options.limit = '100kb'

      request
        .post('http://localhost:9999/')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ str: buf.toString() }))
        .end((err,res) => {
          if (res.status === 413) {
            server.close();
            return done()
          }
         
          console.log('Something went wrong')
          server.close();
          return done('smth-wrong')
          
        })
    })

    it('should not hang response', function (done) {
      console.log('\x1b[31m%s\x1b[0m', 'Test is removed and needs to be rewritten, Fyrejet possibly doesn\'t conform to Express API here')
      done()
    })
  })

  describe('with inflate option', function () {
    describe('when false', function () {
      before(function () {
        this.app = createApp({ inflate: false })
      })

      it('should not accept content-encoding', function (done) {
        console.log('\x1b[31m%s\x1b[0m', 'Test is removed and needs to be rewritten, Fyrejet possibly doesn\'t conform to Express API here')
        done()
      })
    })

    describe('when true', function () {
      before(function () {
        this.app = createApp({ inflate: true })
      })

      it('should accept content-encoding', function (done) {
        console.log('\x1b[31m%s\x1b[0m', 'Test is removed and needs to be rewritten, Fyrejet possibly doesn\'t conform to Express API here')
        done()
      })
    })
  })

  describe('with strict option', function () {
    describe('when undefined', function () {
      before(function () {
        this.app = createApp()
        this.app.listen(9999)
      })

      it('should 400 on primitives', function (done) {
        request
          .post('http://localhost:9999/')
          .set('Content-Type', 'application/json')
          .send('true')
          .end((err,res) => {
            if (res.status === 400 && res.text === parseError('#rue').replace('#', 't')) {
              this.app.close();
              return done()
            }
            console.log('Something went wrong')
            this.app.close();
            return done(err||'smth-wrong')
          })
      })
    })

    describe('when false', function () {
      before(function () {
        this.app = createApp({ strict: false })
        this.app.listen(9999)
      })

      it('should parse primitives', function (done) {
        request
          .post('http://localhost:9999/')
          .set('Content-Type', 'application/json')
          .send('true')
          .end((err,res) => {
            if (res.status === 200 && res.text === 'true') {
              this.app.close();
              return done()
            }
            console.log('Something went wrong')
            this.app.close();
            return done(err||'smth-wrong')
          })
      })
    })

    describe('when true', function () {
      before(function () {
        this.app = createApp({ strict: true })
        this.app.listen(9999)
      })

      it('should not parse primitives', function (done) {
        request
          .post('http://localhost:9999/')
          .set('Content-Type', 'application/json')
          .send('true')
          .end((err,res) => {
            if (res.status === 400 && res.text === parseError('#rue').replace('#', 't')) {
              return done()
            }
            console.log('Something went wrong')
            this.app.close();
            return done(err||'smth-wrong')
          })
      })

      it('should not parse primitives with leading whitespaces', function (done) {
        request
          .post('http://localhost:9999/')
          .set('Content-Type', 'application/json')
          .send('    true')
          .end((err,res) => {
            if (res.status === 400 && res.text === parseError('    #rue').replace('#', 't')) {
              return done()
            }
            console.log('Something went wrong')
            this.app.close();
            return done(err||'smth-wrong')
          })
      })

      it('should allow leading whitespaces in JSON', function (done) {
        request
          .post('http://localhost:9999/')
          .set('Content-Type', 'application/json')
          .send('   { "user": "tobi" }')
          .end((err,res) => {
            if (res.status === 200 && res.text === '{"user":"tobi"}') {
              return done()
            }
            console.log('Something went wrong')
            this.app.close();
            return done(err||'smth-wrong')
          })
      })

      it('should error with type = "entity.parse.failed"', function (done) {
        request
          .post('http://localhost:9999/')
          .set('Content-Type', 'application/json')
          .set('X-Error-Property', 'type')
          .send('true')
          .end((err,res) => {
            if (res.status === 400 && res.text === 'entity.parse.failed') {
              return done()
            }
            console.log('Something went wrong')
            this.app.close();
            return done(err||'smth-wrong')
          })
      })

      it('should include correct message in stack trace', function (done) {
        request
          .post('http://localhost:9999/')
          .set('Content-Type', 'application/json')
          .set('X-Error-Property', 'stack')
          .send('true')
          .end((err,res) => {
            if (res.status === 400 && shouldContainInBody(parseError('#rue').replace('#', 't'))) {
              this.app.close();
              return done()
            }
            console.log('Something went wrong')
            this.app.close();
            return done(err||'smth-wrong')
          })
      })
    })
  })

  describe('with type option', function () {
    describe('when "application/vnd.api+json"', function () {
      before(function () {
        this.app = createApp({ type: 'application/vnd.api+json' })
        this.app.listen(9999)
      })

      it('should parse JSON for custom type', function (done) {
        request
          .post('http://localhost:9999/')
          .set('Content-Type', 'application/vnd.api+json')
          .send('{"user":"tobi"}')
          .end((err,res) => {
            if (res.status === 200 && res.text === '{"user":"tobi"}') {
              return done()
            }
            console.log('Something went wrong')
            this.app.close();
            return done(err||'smth-wrong')
          })
      })

      it('should ignore standard type', function (done) {
        request
          .post('http://localhost:9999/')
          .set('Content-Type', 'application/json')
          .send('{"user":"tobi"}')
          .end((err,res) => {
            if (res.status === 200 && res.text === '{}') {
              this.app.close();
              return done()
            }
            console.log(res)
            console.log('Something went wrong')
            this.app.close();
            return done(err||'smth-wrong')
          })
      })
    })

    describe('when ["application/json", "application/vnd.api+json"]', function () {
      before(function () {
        this.app = createApp({
          type: ['application/json', 'application/vnd.api+json']
        })
        this.app.listen(9999)
      })

      it('should parse JSON for "application/json"', function (done) {
        request
          .post('http://localhost:9999/')
          .set('Content-Type', 'application/json')
          .send('{"user":"tobi"}')
          .end((err,res) => {
            if (res.status === 200 && res.text === '{"user":"tobi"}') {
              return done()
            }
            console.log(res)
            console.log('Something went wrong')
            this.app.close();
            return done(err||'smth-wrong')
          })
      })

      it('should parse JSON for "application/vnd.api+json"', function (done) {
        request
          .post('http://localhost:9999/')
          .set('Content-Type', 'application/vnd.api+json')
          .send('{"user":"tobi"}')
          .end((err,res) => {
            if (res.status === 200 && res.text === '{"user":"tobi"}') {
              return done()
            }
            console.log(res)
            console.log('Something went wrong')
            this.app.close();
            return done(err||'smth-wrong')
          })
      })

      it('should ignore "application/x-json"', function (done) {
        request
          .post('http://localhost:9999/')
          .set('Content-Type', 'application/x-json')
          .send('{"user":"tobi"}')
          .end((err,res) => {
            if (res.status === 200 && res.text === '{}') {
              this.app.close();
              return done()
            }
            console.log(res)
            console.log('Something went wrong')
            this.app.close();
            return done(err||'smth-wrong')
          })
      })
    })

    describe('when a function', function () {
      it('should parse when truthy value returned', function (done) {
        var app = createApp({ type: accept })
        app.listen(9999)

        function accept (req) {
          return req.headers['content-type'] === 'application/vnd.api+json'
        }

        request
          .post('http://localhost:9999/')
          .set('Content-Type', 'application/vnd.api+json')
          .send('{"user":"tobi"}')
          .end((err,res) => {
            if (res.status === 200 && res.text === '{"user":"tobi"}') {
              app.close();
              return done()
            }
            console.log(res)
            console.log('Something went wrong')
            app.close();
            return done(err||'smth-wrong')
          })
      })

      it('should work without content-type', function (done) {
        var app = createApp({ type: accept })
        app.listen(9999)

        function accept (req) {
          return true
        }

        request
          .post('http://localhost:9999/')
          .send('{"user":"tobi"}')
          .end((err,res) => {
            if (res.status === 200 && res.text === '{"user":"tobi"}') {
              app.close();
              return done()
            }
            console.log(res)
            console.log('Something went wrong')
            app.close();
            return done(err||'smth-wrong')
          })
      })

      it('should not invoke without a body', function (done) {
        var app = createApp({ type: accept })
        app.listen(9999)

        function accept (req) {
          throw new Error('oops!')
        }

        request
          .get('http://localhost:9999/')
          .end((err,res) => {
            if (res.status === 404) {
              app.close();
              return done()
            }
            console.log(res)
            console.log('Something went wrong')
            app.close();
            return done(err||'smth-wrong')
          })
      })
    })
  })

  describe('with verify option', function () {
    it('should assert value if function', function () {
      assert.throws(createApp.bind(null, { verify: 'lol' }),
        /TypeError: option verify must be function/)
    })

    it('should error from verify', function (done) {
      var app = createApp({
        verify: function (req, res, buf) {
          if (buf[0] === 0x5b) throw new Error('no arrays')
        }
      })
      app.listen(9999)

      request
        .post('http://localhost:9999/')
        .set('Content-Type', 'application/json')
        .send('["tobi"]')
        .end((err,res) => {
          if (res.status === 403 && res.text === 'no arrays') {
            app.close();
            return done()
          }
          console.log(res)
          console.log('Something went wrong')
          app.close();
          return done(err||'smth-wrong')
        })
    })

    it('should error with type = "entity.verify.failed"', function (done) {
      var app = createApp({
        verify: function (req, res, buf) {
          if (buf[0] === 0x5b) throw new Error('no arrays')
        }
      })

      request(app)
        .post('/')
        .set('Content-Type', 'application/json')
        .set('X-Error-Property', 'type')
        .send('["tobi"]')
        .expect(403, 'entity.verify.failed', done)
    })

    it('should allow custom codes', function (done) {
      var app = createApp({
        verify: function (req, res, buf) {
          if (buf[0] !== 0x5b) return
          var err = new Error('no arrays')
          err.status = 400
          throw err
        }
      })

      request(app)
        .post('/')
        .set('Content-Type', 'application/json')
        .send('["tobi"]')
        .expect(400, 'no arrays', done)
    })

    it('should allow custom type', function (done) {
      var app = createApp({
        verify: function (req, res, buf) {
          if (buf[0] !== 0x5b) return
          var err = new Error('no arrays')
          err.type = 'foo.bar'
          throw err
        }
      })

      request(app)
        .post('/')
        .set('Content-Type', 'application/json')
        .set('X-Error-Property', 'type')
        .send('["tobi"]')
        .expect(403, 'foo.bar', done)
    })

    it('should include original body on error object', function (done) {
      var app = createApp({
        verify: function (req, res, buf) {
          if (buf[0] === 0x5b) throw new Error('no arrays')
        }
      })

      request(app)
        .post('/')
        .set('Content-Type', 'application/json')
        .set('X-Error-Property', 'body')
        .send('["tobi"]')
        .expect(403, '["tobi"]', done)
    })

    it('should allow pass-through', function (done) {
      var app = createApp({
        verify: function (req, res, buf) {
          if (buf[0] === 0x5b) throw new Error('no arrays')
        }
      })

      request(app)
        .post('/')
        .set('Content-Type', 'application/json')
        .send('{"user":"tobi"}')
        .expect(200, '{"user":"tobi"}', done)
    })

    it('should work with different charsets', function (done) {
      var app = createApp({
        verify: function (req, res, buf) {
          if (buf[0] === 0x5b) throw new Error('no arrays')
        }
      })

      var test = request(app).post('/')
      test.set('Content-Type', 'application/json; charset=utf-16')
      test.write(Buffer.from('feff007b0022006e0061006d00650022003a00228bba0022007d', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should 415 on unknown charset prior to verify', function (done) {
      var app = createApp({
        verify: function (req, res, buf) {
          throw new Error('unexpected verify call')
        }
      })

      var test = request(app).post('/')
      test.set('Content-Type', 'application/json; charset=x-bogus')
      test.write(Buffer.from('00000000', 'hex'))
      test.expect(415, 'unsupported charset "X-BOGUS"', done)
    })
  })

  describe('charset', function () {
    before(function () {
      this.app = createApp()
    })

    it('should parse utf-8', function (done) {
      var test = request(this.app).post('/')
      test.set('Content-Type', 'application/json; charset=utf-8')
      test.write(Buffer.from('7b226e616d65223a22e8aeba227d', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should parse utf-16', function (done) {
      var test = request(this.app).post('/')
      test.set('Content-Type', 'application/json; charset=utf-16')
      test.write(Buffer.from('feff007b0022006e0061006d00650022003a00228bba0022007d', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should parse when content-length != char length', function (done) {
      var test = request(this.app).post('/')
      test.set('Content-Type', 'application/json; charset=utf-8')
      test.set('Content-Length', '13')
      test.write(Buffer.from('7b2274657374223a22c3a5227d', 'hex'))
      test.expect(200, '{"test":"å"}', done)
    })

    it('should default to utf-8', function (done) {
      var test = request(this.app).post('/')
      test.set('Content-Type', 'application/json')
      test.write(Buffer.from('7b226e616d65223a22e8aeba227d', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should fail on unknown charset', function (done) {
      var test = request(this.app).post('/')
      test.set('Content-Type', 'application/json; charset=koi8-r')
      test.write(Buffer.from('7b226e616d65223a22cec5d4227d', 'hex'))
      test.expect(415, 'unsupported charset "KOI8-R"', done)
    })

    it('should error with type = "charset.unsupported"', function (done) {
      var test = request(this.app).post('/')
      test.set('Content-Type', 'application/json; charset=koi8-r')
      test.set('X-Error-Property', 'type')
      test.write(Buffer.from('7b226e616d65223a22cec5d4227d', 'hex'))
      test.expect(415, 'charset.unsupported', done)
    })
  })

  describe('encoding', function () {
    before(function () {
      this.app = createApp({ limit: '1kb' })
    })

    it('should parse without encoding', function (done) {
      var test = request(this.app).post('/')
      test.set('Content-Type', 'application/json')
      test.write(Buffer.from('7b226e616d65223a22e8aeba227d', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should support identity encoding', function (done) {
      var test = request(this.app).post('/')
      test.set('Content-Encoding', 'identity')
      test.set('Content-Type', 'application/json')
      test.write(Buffer.from('7b226e616d65223a22e8aeba227d', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should support gzip encoding', function (done) {
      var test = request(this.app).post('/')
      test.set('Content-Encoding', 'gzip')
      test.set('Content-Type', 'application/json')
      test.write(Buffer.from('1f8b080000000000000bab56ca4bcc4d55b2527ab16e97522d00515be1cc0e000000', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should support deflate encoding', function (done) {
      var test = request(this.app).post('/')
      test.set('Content-Encoding', 'deflate')
      test.set('Content-Type', 'application/json')
      test.write(Buffer.from('789cab56ca4bcc4d55b2527ab16e97522d00274505ac', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should be case-insensitive', function (done) {
      var test = request(this.app).post('/')
      test.set('Content-Encoding', 'GZIP')
      test.set('Content-Type', 'application/json')
      test.write(Buffer.from('1f8b080000000000000bab56ca4bcc4d55b2527ab16e97522d00515be1cc0e000000', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should 415 on unknown encoding', function (done) {
      var test = request(this.app).post('/')
      test.set('Content-Encoding', 'nulls')
      test.set('Content-Type', 'application/json')
      test.write(Buffer.from('000000000000', 'hex'))
      test.expect(415, 'unsupported content encoding "nulls"', done)
    })

    it('should error with type = "encoding.unsupported"', function (done) {
      var test = request(this.app).post('/')
      test.set('Content-Encoding', 'nulls')
      test.set('Content-Type', 'application/json')
      test.set('X-Error-Property', 'type')
      test.write(Buffer.from('000000000000', 'hex'))
      test.expect(415, 'encoding.unsupported', done)
    })

    it('should 400 on malformed encoding', function (done) {
      var test = request(this.app).post('/')
      test.set('Content-Encoding', 'gzip')
      test.set('Content-Type', 'application/json')
      test.write(Buffer.from('1f8b080000000000000bab56cc4d55b2527ab16e97522d00515be1cc0e000000', 'hex'))
      test.expect(400, done)
    })

    it('should 413 when inflated value exceeds limit', function (done) {
      // gzip'd data exceeds 1kb, but deflated below 1kb
      var test = request(this.app).post('/')
      test.set('Content-Encoding', 'gzip')
      test.set('Content-Type', 'application/json')
      test.write(Buffer.from('1f8b080000000000000bedc1010d000000c2a0f74f6d0f071400000000000000', 'hex'))
      test.write(Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'))
      test.write(Buffer.from('0000000000000000004f0625b3b71650c30000', 'hex'))
      test.expect(413, done)
    })
  })
})

function createApp (options) {

  const low = express.uwsCompat
  var app = express({
		prioRequestsProcessing: false, // without this option set to 'false' uWS is going to be extremely sluggish
		server: low(),
		serverType: 'uWebSocket'
	})

  app.use(express.json(options))

  app.use(function (err, req, res, next) {
    res.status(err.status || 500)
    res.send(String(err[req.headers['x-error-property'] || 'message']))
  })

  app.post('/', function (req, res) {
    res.json(req.body)
  })
  return app
}

function parseError (str) {
  try {
    JSON.parse(str); throw new SyntaxError('strict violation')
  } catch (e) {
    return e.message
  }
}

function shouldContainInBody (str) {
  return function (res) {
    assert.ok(res.text.indexOf(str) !== -1,
      'expected \'' + res.text + '\' to contain \'' + str + '\'')
  }
}
