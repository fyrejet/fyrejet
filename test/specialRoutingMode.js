var express = require('..')
var request = require('supertest')
var assert = require('assert')

describe('Special Routing Mode', function () {
  	describe('API Mode (back compat with 2.x)', function () {
		describe('Global API Mode (back compat with 2.x)', function () {
    		it('should not cause errors', function (done) {
			  var app = express()
			  app.set('fyrejet mode', 'api')

    		  app.get('/', function (req, res) {
				let resJsonType = typeof res.json
				res.send(resJsonType)
    		  })

    		  request(app)
    		    .get('/')
    		    .expect('function', done)
			})
			it('stub function in place of req.activateExpress() should not cause errors', function (done) {
				var app = express()
			  	app.set('fyrejet mode', 'api')
				  
				app.get('/express/', function(req,res) {
					req.activateExpress()
					let resJsonType = typeof res.json
					res.send(resJsonType)
				})
				
			  request(app)
    		    .get('/express')
    		    .expect('function', done)
			})
			it('should not cause errors in nested router', function (done) {
				var app = express()
				var app2 = express.Router()
				app.set('fyrejet mode', 'api')
				
				app.get('*', (req,res, next) => {
					next()
				})

				app2.get('/', function (req, res) {
					let resJsonType = typeof res.json
					res.send(resJsonType)
				})

				app.use('/nested', app2)
  
				request(app)
				  .get('/nested/')
				  .expect('function', done)
			})
			it('stub function in place of req.activateExpress() should not cause errors in nested router', function (done) {
				var app = express()
				var app2 = express.Router()
				app.set('fyrejet mode', 'api')
				  
				app.get('*', (req,res, next) => {
					next()
				})
				  
				app2.get('/', function(req,res) {
					req.activateExpress()
					let resJsonType = typeof res.json
					res.send(resJsonType)
				})

				app.use('/nested', app2)
				
			  	request(app)
    		    	.get('/nested')
    		    	.expect('function', done)
			})
			it('should not cause errors in mounted full instance of fyrejet', function (done) {
				var app = express()
				var app2 = express()
				app.set('fyrejet mode', 'api')
  
				app2.get('/', function (req, res) {
				  let resJsonType = typeof res.json
				  res.send(resJsonType)
				})

				app.use('/mounted', app2)
  
				request(app)
				  .get('/mounted/')
				  .expect('function', done)
			})

			it('stub function in place of req.activateExpress() should not cause errors in mounted full instance of fyrejet', function (done) {
				var app = express()
				var app2 = express()
				app.set('fyrejet mode', 'api')
				  
				app2.get('/', function(req,res) {
					req.activateExpress()
					let resJsonType = typeof res.json
					res.send(resJsonType)
				})

				app.use('/mounted', app2)
				
			  	request(app)
    		    	.get('/mounted/')
					.expect('function', done)
					
			})
		})
		describe('Route-only API Mode (back compat with 2.x)', function () {
			it('should not cause errors', function (done) {
				var app = express()
  
				app.get('/', function (req, res) {
				  let resJsonType = typeof res.json
				  res.send(resJsonType)
				}, 'api')
  
				request(app)
				  .get('/')
				  .expect('function', done)
			})
			it('should also not cause errors in nested router', function (done) {
				var app = express()
				var app2 = express.Router()
  
				app2.get('/', function (req, res) {
				  let resJsonType = typeof res.json
				  res.send(resJsonType)
				})

				app.use('/nested', app2, 'api')
  
				request(app)
				  .get('/nested/')
				  .expect('function', done)
			})

			it('should also not cause errors in mounted full instance of fyrejet', function (done) {
				var app = express()
				var app2 = express()
  
				app2.get('/', function (req, res) {
				  let resJsonType = typeof res.json
				  res.send(resJsonType)
				})

				app.use('/mounted', app2, 'api')
  
				request(app)
				  .get('/mounted/')
				  .expect('function', done)
			})

		})
	})

	describe('No ETag Mode', function () {
		it('should work', function (done) {
			var app = express()

			app.get('/', function (req, res) {
				res.send('I do not have ETag')
			}, 'noEtag')

			request(app)
			  .get('/')
			  .expect(200)
			  .end(function(err, res) {
				assert(!res.headers['etag'])
				done()
			  })
		})
	})
})
