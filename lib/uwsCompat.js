module.exports = (config) => {
  try {
    require('worker_threads') // this is just a dirty and stupid check to see if worker_threads are available, as low-http-server requires them
  } catch (e) {
    throw new Error('You need at least node 12 to use uWebSockets.js with fyrejet OR use --experimental-worker flag')
  }

  return require('low-http-server')(config)
}
