'use strict'

const express = require('express')

const app = express()

app.set('etag', false)

app.get('/hi', function (req, res) {
  res.send('')
})

app.listen(3005)
