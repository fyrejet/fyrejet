'use strict'

var express = require('../index')

var app = express()

app.set('fyrejet mode', 'api')

app.get('/hi', function (req, res) {
  res.send('')
})

app.listen(3002)
