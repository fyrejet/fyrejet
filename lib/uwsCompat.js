module.exports = (config) => {
	try {
		require('worker_threads');
	}
	catch (e) {
		throw new Error('You need at least node 12 to use uWebSockets.js with fyrejet OR use --experimental-worker flag')
	}
	return require('low-http-server')(config)
}