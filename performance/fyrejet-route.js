'use strict'

const express = require('../index')

const app = express()

app.set('etag', false)
app.set('x-powered-by', false)

//app.get('/hi', function (req, res, next) {
//  return next()
//})

app.get('/hi', function (req, res) {
  return res.send('')
  
  //throw new Error('boom')
})

app.listen(3004)
