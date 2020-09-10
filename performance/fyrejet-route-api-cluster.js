'use strict'

var cluster = require('cluster')

if (cluster.isMaster) {
	const numCPUs = require('os').cpus().length;
	for (let i = 0; i < numCPUs; i++) {
		cluster.fork();
	}
}
else {

  var express = require('../index')

  var app = express()

  app.set('fyrejet mode', 'api')

  app.get('/hi', function (req, res) {
    res.send('')
  })

  app.listen(4002)

}