'use strict'

var express = require('../index')

var app = express()
app.set('etag', false)

app.get('/hi', function (req, res) {
  res.send('')
})

app.listen(3004)
