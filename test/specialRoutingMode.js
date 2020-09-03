var express = require('../')
var request = require('supertest')
var assert = require('assert')
const next = require('../lib/routing/next')

describe('Special Routing Mode', function () {
  	describe('API Mode', function () {
		describe('Global API Mode', function () {
    		it('should work', function (done) {
			  var app = express()
			  app.set('fyrejet mode', 'api')

    		  app.get('/', function (req, res) {
				let resJsonType = typeof res.json
				res.send(resJsonType)
    		  })

    		  request(app)
    		    .get('/')
    		    .expect('undefined', done)
			})
			it('should also work in nested router', function (done) {
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
				  .expect('undefined', done)
			})
			it('should also work in mounted full instance of fyrejet', function (done) {
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
				  .expect('undefined', done)
			})
		})
		describe('Route-only API Mode', function () {
			it('should work', function (done) {
				var app = express()
  
				app.get('/', function (req, res) {
				  let resJsonType = typeof res.json
				  res.send(resJsonType)
				}, 'api')
  
				request(app)
				  .get('/')
				  .expect('undefined', done)
			})
			it('should also work in nested router', function (done) {
				var app = express()
				var app2 = express.Router()
  
				app2.get('/', function (req, res) {
				  let resJsonType = typeof res.json
				  res.send(resJsonType)
				})

				app.use('/nested', app2, 'api')
  
				request(app)
				  .get('/nested/')
				  .expect('undefined', done)
			})

			it('should also work in mounted full instance of fyrejet', function (done) {
				var app = express()
				var app2 = express()
  
				app2.get('/', function (req, res) {
				  let resJsonType = typeof res.json
				  res.send(resJsonType)
				})

				app.use('/mounted', app2, 'api')
  
				request(app)
				  .get('/mounted/')
				  .expect('undefined', done)
			})

		})
	})
	describe('Properties as Functions Mode', function () {
		describe('Global Properties as Function Mode', function () {
    		it('should work', function (done) {
			  var app = express()
			  app.set('fyrejet mode', 'properties as functions')

    		  app.get('/', function (req, res) {
				res.end(req.hostname())
    		  })

    		  request(app)
				.get('/')
				.set('Host', 'example.com')
        		.expect('example.com', done)
			})
			it('should also work in nested router', function (done) {
				var app = express()
				app.set('fyrejet mode', 'properties as functions')
				var app2 = express.Router()

				app2.get('/', function (req, res) {
					res.end(req.hostname())
				})

				app.use('/nested', app2)
  
				request(app)
					.get('/nested/')
					.set('Host', 'example.com')
        			.expect('example.com', done)
			})
			it('should also work in mounted full instance of fyrejet', function (done) {
				var app = express()
				var app2 = express()
				app.set('fyrejet mode', 'properties as functions')
  
				app2.get('/', function (req, res) {
					res.end(req.hostname())
				})

				app.use('/mounted', app2)
  
				request(app)
				  .get('/mounted/')
				  .set('Host', 'example.com')
        		  .expect('example.com', done)
			})
		})
		describe('Route-only API Mode', function () {
			it('should work', function (done) {
				var app = express()
  
				app.get('/', function (req, res) {
					res.end(req.hostname())
				}, 'propsAsFns')
  
				request(app)
				  .get('/')
				  .set('Host', 'example.com')
        		  .expect('example.com', done)
			})
			it('should also work in nested router', function (done) {
				var app = express()
				var app2 = express.Router()
  
				app2.get('/', function (req, res) {
					res.end(req.hostname())
				})

				app.use('/nested', app2, 'propsAsFns')
  
				request(app)
				  .get('/nested/')
				  .set('Host', 'example.com')
        		  .expect('example.com', done)
			})

			it('should also work in mounted full instance of fyrejet', function (done) {
				var app = express()
				var app2 = express()
  
				app2.get('/', function (req, res) {
					res.end(req.hostname())
				})

				app.use('/mounted', app2, 'propsAsFns')
  
				request(app)
				  .get('/mounted/')
				  .set('Host', 'example.com')
        		  .expect('example.com', done)
			})

		})
	})
})
