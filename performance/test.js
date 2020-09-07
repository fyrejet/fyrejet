var express = require('../')

const low = require('../').uwsCompat // you will need Rolando Santamaria Maso's (jkyberneees) excellent 0http
var app = express({
	prioRequestsProcessing: false, // without this option set to 'false' uWS is going to be extremely sluggish
	server: low(),
	serverType: 'uWebSocket'
})

app.use(express.json())

app.use(function (err, req, res, next) {
  res.status(err.status || 500)
  res.send(String(err[req.headers['x-error-property'] || 'message']))
})
app.post('/', function (req, res) {
  res.json(req.body)
})

app.start(3004, ()=>{
	console.log('running')
})
