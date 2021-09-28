'use strict'

const fyrejet = require('../index')
const app = require('../index')({
  prioRequestsProcessing: false, // without this option set to 'false' uWS is going to be extremely sluggish
  server: fyrejet.uwsCompat(),
  serverType: 'uWebSockets'
})

app.set('etag', false)
app.set('x-powered-by', false)

app.get('/hi', (req, res) => {
  res.sendLite('')
})

app.start(3001, (socket) => {
  if (socket) {
    console.log('HTTP server running at http://localhost:3001')
  }
})
