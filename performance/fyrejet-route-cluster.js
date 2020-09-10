'use strict'

var cluster = require('cluster')

if (cluster.isMaster) {
  //const numCPUs = require('os').cpus().length;
  const numCPUs = 8;
	for (let i = 0; i < numCPUs; i++) {
		cluster.fork();
	}
}
else {

  var express = require('../index')

  var app = express()

  app.get('/hi', function (req, res) {
    res.send('')
  })

  app.listen(4004)

}
