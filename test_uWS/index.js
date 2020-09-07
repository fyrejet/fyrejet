var express = require('..')
const low = require('0http/lib/server/low')

module.exports = function(...params) {
	return express({
		prioRequestsProcessing: false, // without this option set to 'false' uWS is going to be extremely sluggish
		server: low(),
		serverType: 'uWebSocket'
	})
}
Object.keys(express).forEach(key => {
	module.exports[key] = express[key]
})

console.log(module.exports)