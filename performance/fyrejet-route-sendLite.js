'use strict'

const express = require('../index')

const app = express()

app.set('etag', false)
app.set('x-powered-by', false)

app.get('/hi', function (req, res) {
  return res.sendLite('')
})

app.listen(3004)
