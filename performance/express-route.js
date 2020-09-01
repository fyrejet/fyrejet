var express = require('express')

var app = express()

app.get('/hi', function (req, res) {
  res.send('')
})

app.listen(3005)
