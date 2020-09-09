'use strict'

// preliminary testing done with uWS 17.5.0, but it is NOT covered with tests yet
var fyrejet = require('../')
const low = fyrejet.uwsCompat // you will need Rolando Santamaria Maso's (jkyberneees) excellent 0http
const app = fyrejet({
  prioRequestsProcessing: false, // without this option set to 'false' uWS is going to be extremely sluggish
  server: low(),
  serverType: 'uWebSockets'
})

app.use(fyrejet.json())

app.all('/', (req, res) => {
  res.send(req.body)
})

var server = app.start(9999, (socket) => {
  if (socket) {
    console.log('HTTP server running at http://localhost:9999')
  }
})