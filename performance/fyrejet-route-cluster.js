'use strict'

const cluster = require('cluster')

if (cluster.isMaster) {
  let numCPUs = require('os').cpus().length
  if (!isNaN(parseInt(process.argv[process.argv.length - 1]))) {
    numCPUs = parseInt(process.argv[process.argv.length - 1])
  }
  console.log('using processes: ' + numCPUs)
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork()
  }
} else {
  const express = require('../index')

  const app = express()

  app.set('etag', false)
  app.set('x-powered-by', false)

  app.get('/hi', function (req, res) {
    res.send('')
  })

  app.listen(4004)
}
