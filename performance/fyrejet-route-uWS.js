'use strict'

// preliminary testing done with uWS 17.5.0, but it is NOT covered with tests yet
const low = require('0http/lib/server/low') // you will need Rolando Santamaria Maso's (jkyberneees) excellent 0http
const app = require('../index')({
  prioRequestsProcessing: false, // without this option set to 'false' uWS is going to be extremely sluggish
  server: low(),
  serverType: 'uWebSocket'
})

app.get('/hi', (req, res) => {
  res.send('')
})

app.start(3001, (socket) => {
  if (socket) {
    console.log('HTTP server running at http://localhost:3001')
  }
})
