'use strict'

var cluster = require('cluster')

if (cluster.isMaster) {
  var numCPUs = require('os').cpus().length
  if (!isNaN(parseInt(process.argv[process.argv.length - 1]) ) ) {
    numCPUs = parseInt(process.argv[process.argv.length - 1])
  }
  console.log('using processes: ' + numCPUs)
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork()
  }
} else {
  var express = require('../index')

  var app = express()

  app.set('fyrejet mode', 'properties as functions')

  app.get('/hi', function (req, res) {
    res.send('')
  })

  app.listen(4003)
}
