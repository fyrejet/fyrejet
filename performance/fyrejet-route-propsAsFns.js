'use strict'

var express = require('../index')

var app = express()

app.set('fyrejet mode', 'properties as functions')

app.get('/hi', function (req, res) {
  res.send('')
})

app.listen(3003)
