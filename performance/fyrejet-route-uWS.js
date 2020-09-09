'use strict'

const fyrejet = require('../index')
const uwsCompat = fyrejet.uwsCompat // you will need Rolando Santamaria Maso's (jkyberneees) excellent 0http
const app = require('../index')({
  prioRequestsProcessing: false, // without this option set to 'false' uWS is going to be extremely sluggish
  server: uwsCompat(),
  serverType: 'uWebSockets'
})

app.get('/hi', (req, res) => {
  res.send('')
})

app.start(3001, (socket) => {
  if (socket) {
    console.log('HTTP server running at http://localhost:3001')
  }
})
