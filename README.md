 

# Fyrejet 3

<img src="./fyre.png" alt="logo" height="150" width="150" />

## What is Fyrejet?

Fyrejet is a web-framework that is designed for speed and ease-of-use. After working with numerous frameworks, you never fail to appreciate the ease of development with Express. In fact, it is so easy that it is appropriate for novice developers to learn how to code. 

Unfortunately, that comes at a cost. While Express brings the speed of development, its performance is just okay-ish. Other frameworks either provide different APIs, are incompatible with Express middlewares or provide less functionality. For instance, Restana, a great API-oriented framework by jkybernees provides incredible performance, but only a subset of Express APIs, making it not suitable as an Express replacement. Moreover, Express relies on `Object.setPrototypeOf` in request handling, which is inherently slow (see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/setPrototypeOf) and whose performance has drastically decreased after Node.js 12.16.0.

Fyrejet does not strive to be the fastest framework. However, Fyrejet seeks to be faster than Express, while providing very Express-like API. In fact, Fyrejet uses slightly modified<sup>[1](#footnote1)</sup> Express automated unit tests to verify the codebase. Moreover, Fyrejet offers you the ability to use Express APIs with uWebSockets.js (not production ready yet).

Starting with Fyrejet 2.2.x, Fyrejet is only compatible with Node.js 12 and higher.



<a name="footnote1">[1]</a>: 

* `50` tests removed, because they are arguably irrelevant (`test/Route.js` and `test/Router.js`)
* `~6` tests modified to test a replacement API instead (`req.currentUrl`)
* Some tests have been removed in 3.x (some `res.send`,  `res.json` and `res.jsonp` tests, because they test removed functionality, that has long been deprecated in Express - namely, ability to set status through these methods)
* `req.acceptsEncoding()`, `req.acceptsCharset()` and `req.acceptsLanguage()` and `req.hose()` tests are fully removed, since they have been long deprecated.
* All `req` tests that test additional `req` properties have been fixed to test for methods with the same names.
* `1` test removed, because deprecated functionality was too much time to implement. 



## What Fyrejet is not?

Unfortunately, Fyrejet is not a solution to all problems. For instance, Fyrejet is not a way around writing proper code. Additionally, greater framework performance does not necessarily translate into faster web-service. If your web-service works slow due to: 

* Problems in your own code;

* Slow Database queries
* Poor networking setup
* etc.

, then there is little Fyrejet can do for you. 

However, if you do not suffer from these problems, Fyrejet can in many cases improve your performance. Despite this, YOU are responsible for your own benchmarks and choosing the best solution for your use case.



## License

Fyrejet is shared with the community under MIT License.



## Breaking changes from `2.x` to `3.x`

* For general performance reasons, special modes have been removed from this major version (except route-wide no etag option)
* Fyrejet no longer implements any `req` properties from Express. The properties are now reimplemented as methods. So, for instance, to get protocol, you should use `req.protocol()` instead of `req.protocol`. While this breaks compatibility, this helps to raise performance.
  * `req.method` and `req.url` are not affected since they are native to node.js's `http` module
* `res.send` ability to set HTTP status code is removed for performance reasons (deprecated functionality from Express).
* `req.host()` is removed, since `req.hostname()` is available.
* `req.acceptsEncoding`, `req.acceptsCharset` and `req.acceptsLanguage`  are removed in favour of `req.acceptsEncodings`, `req.acceptsCharsets` and `req.acceptsLanguages`.



## Installation

In order to install and test Fyrejet, you can issue the following commands:

```bash
npm install fyrejet
npm run test
```



## API

Fyrejet API is very similar to Express API. In general, you are advised to use the current Express documentation. Having said that, there are a few important differences between these projects, that are summarized in the table below:

| Capability                |   Type of difference   | Express                                                      | Fyrejet                                                      |
| ------------------------- | :--------------------: | :----------------------------------------------------------- | ------------------------------------------------------------ |
| Routing, general          | Difference in behavior | Express goes through each route in the stack, verifying, whether it is appropriate for the request. When a request is made again, the same operation has to start all over again. | Fyrejet routing and base is basically a fork of Restana and its dependencies, 0http and Trouter. When an initial request is made, like ```GET /hi HTTP/1.1``` Fyrejet finds which routes are appropriate for the request and then caches those routes. This way, Fyrejet will be able to load only the required routes upon a similar request in the future. |
| Routing, details          | Difference in behavior | Changing req.url or req.method only affects the routes that have not been checked yet. | Changing ```req.url``` or ```req.method``` to a different value makes Fyrejet restart the routing process for your request within Fyrejet instance. All the changes made to data (such as ```res.locals``` or ```req.params```) during routing persist. If you try to change value to the same value (e.g., if ```req.method === "POST"; req.method = "POST"```), nothing occurs. However, if you want to avoid the rerouting in other cases, you can use ```req.setUrl(url)``` and ```req.setMethod(method)```. For more information, see [Rerouting](#Rerouting). |
| `req.url`                 | Difference in behavior | req.url is modified to reflect the relative url in relation to the middleware route. | req.url does not operate this way in Fyrejet and is heavily used in in internal routing. As a replacement, you can use ```req.currentUrl()```. |
| `res.send`                | Non-breaking additions | Provided                                                     | Provided, with very slight modifications (does not affect API compatibility). Also, Fyrejet provides alternative `res.sendLite`, which is unmodified `res.send` from Restana project. It is supposed to be faster and more lightweight, but with different functionality (no ETags, for example, but it is capable of sending objects faster and setting headers directly). See Restana's [documentation on `res.send`](https://github.com/jkyberneees/restana#the-ressend-method) for information on `res.sendLite` behavior. |
| Route-wide no etag option | Non-breaking additions | N/A                                                          | Fyrejet allows you to switch off etag for a specific route.  |



## General usage

... is very similar to Express:

```js
'use strict'

var cb = function() {console.log('listening')}
var express = require('../index')

var options = {} 
/* optional options object. Used to define 
certain settings that cannot be redefined through app.set.
See initialization-time settings below this example
*/
var app = express(options)

app.set('x-powered-by', false) // without this will be set to Fyrejet by default

app.use(someMiddleware) // someMiddleware is not defined, but you get the idea ;)

app.get('/hi', function (req, res) {
  res.send(req.method)
})

app.post('/hi', function (req, res) {
  res.send(req.method)
})

app.listen(3003) 
/* or app.start(3003). You can also provide a callback, 
but it will not receive any arguments, unless you
use uWebSockets
*/

```



#### Initialization-time settings

Fyrejet uses four Initialization-time settings inherited from Restana<sup>[2](#footnote2)</sup>. These are:

| Setting                          | Default value   | Type               | Description                                                  |
| -------------------------------- | --------------- | ------------------ | ------------------------------------------------------------ |
| `cacheSize` or `routerCacheSize` | `1000`          | `Number` (integer) | How many different requests can be cached for future use. Request in this case means a combination of `req.method + req.url` |
| `defaultRoute`                   | See source code | `Function`         | Best not to change, unless you know what you are doing. Check restana documentation. |
| `prioRequestsProcessing`         | `true`          | `Boolean`          | If `true`, HTTP requests processing/handling is prioritized using `setImmediate`. Usually does not need to be changed and you are advised not to change it, unless you know what you are doing. uWebSockets is a known exception to this rule. |
| `errorHandler`                   | See description | `Function`         | Optional global error handler function. Default value: `(err, req, res) => { res.statusCode = 500; res.end(err.message) ` |



<a name="footnote2">[2]</a>: Default values are not always inherited from Restana, however



## Rerouting

Consider this app:

```js
'use strict'

var express = require('fyrejet')
// var express = require('express')
// if we were to use 'real' express

var app = express()

app.post('/hi', (req, res, next) => {
  return res.send('hi, sweetheart!')
})

app.get('/hi', (req, res, next) => {
  req.method = "POST"
  return next()
})

app.listen(3003)

```

Let's test what happens using curl using the following command: `curl -v http://localhost:3003/hi`



###### Fyrejet

```
*   Trying ::1...
* TCP_NODELAY set
* Connected to localhost (::1) port 3003 (#0)
> GET /hi HTTP/1.1
> Host: localhost:3003
> User-Agent: curl/7.64.1
> Accept: */*
> 
< HTTP/1.1 200 OK
< X-Powered-By: Fyrejet
< Content-Type: text/html; charset=utf-8
< ETag: W/"f-TDXfWsVBD6FKBYpgrRzrsvr7dXs"
< Date: Tue, 01 Sep 2020 16:06:01 GMT
< Connection: keep-alive
< Content-Length: 15
< 
* Connection #0 to host localhost left intact
hi, sweetheart!* Closing connection 0
```



###### Express

```
*   Trying ::1...
* TCP_NODELAY set
* Connected to localhost (::1) port 3003 (#0)
> GET /hi HTTP/1.1
> Host: localhost:3003
> User-Agent: curl/7.64.1
> Accept: */*
> 
< HTTP/1.1 404 Not Found
< X-Powered-By: Express
< Content-Security-Policy: default-src 'none'
< X-Content-Type-Options: nosniff
< Content-Type: text/html; charset=utf-8
< Content-Length: 142
< Date: Tue, 01 Sep 2020 16:07:54 GMT
< Connection: keep-alive
< 
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error</title>
</head>
<body>
<pre>Cannot POST /hi</pre>
</body>
</html>
* Connection #0 to host localhost left intact
* Closing connection 0
```



##### What happens under the hood?

| Step | Express                                                      | Fyrejet                                                      |
| ---- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| 0    | Go through request handler function. Success                 | Go through request handler function. Success                 |
| 1    | Get the whole stack of routes                                | Get the stack of ***appropriate*** routes and cache them for future use |
| 2    | Transfer control to `next()` function                        | Transfer control to `next()` function                        |
| 3    | Go through init middleware. Transfer control to `next()` function | Go through init middleware. Transfer control to next() function |
| 3    | Check if route ```app.post('/hi', (req,res,next) => {...})``` is appropriate. Fail. | Go through route ```app.get('/hi', (req,res,next) => {...})``` Execute function. |
| 4    | Check if route ```app.get('/hi', (req,res,next) => {...})``` is appropriate. Execute function. Transfer control to `next()` function | Transfer control to `next()` function. `req.method` changed. Go through steps 0-2 again. Do *partial* (and very limited) init middleware re-run. |
| 5    | Go to default route, since no other user-defined routes are available. Respond to request with `404` error | Since ```app.post('/hi', (req,res,next) => {...})``` is now *the* appropriate route, Fyrejet goes through it and executes function. Then, it responds to request with `200`, because of `return res.send('hi, sweetheart!')` |

#####  How to avoid rerouting?

Sometimes, rerouting is not acceptable. In these cases, you can change the method or url with these helper functions:

```req.setUrl(url)``` and ```req.setMethod(method)```. Both return `req` object, so they are chainable with other `req` methods.



## No ETag Routes

In addition to Express's ability to redefine ETag function or disable it altogether, Fyrejet enables you to disable ETag for specific route only.

#### How to use

```js
app.get('/hi', (req, res, next) => {
  return res.send('There won't be ETag')
}, 'noEtag')
```

#### Caveats

No known caveats yet.



## uWebSockets

Fyrejet includes support for uWebSockets.

Versions 17.5.0 and 18.5.0 have been tested and do seem to work. Despite this, minor incompatibilities are expected. Please refer to Known problems section.



### How to use

```js
'use strict'

// preliminary testing done with uWS 17.5.0, but it is NOT covered with tests yet
const low = require('../index').uwsCompat

const app = require('../index')({
  prioRequestsProcessing: false, // without this option set to 'false' uWS is going to be extremely sluggish. However, this will reduce speed for node's native http, in case you switch back
  server: low(), // You can pass options to low(), check low-http-server documentation
  serverType: 'uWebSockets' // also required, or there will always be errors
})

app.get('/hi', (req, res) => {
  res.send('uWS works')
})

app.start(3001, (socket) => {
  if (socket) {
    console.log('HTTP server running at http://localhost:3001')
  }
}) // in Fyrejet 1.x, you needed to provide a callback for this to work. This is no longer the case.

setTimeout(() => {server.close()}, 10000) // closes server in approximately 10 seconds

```

### Known problems

At this time, there are problems with uWebSockets.js implementation used in Fyrejet.

* uWebSockets.js is unable to pass tests, but seems to be able to work in the wild. This means that Fyrejet on uWebSockets.js works, but there are no guarantees, as it is otherwise not production-ready.

## Benchmarks

It is a pseudo-scientific benchmark, but whatevs :)



![benchmark](./benchmark.png)

1. `./performance/fyrejet-route-uWS.js` on port `3001` (Fyrejet on top of uWS, with full Express API)
4. `./performance/fyrejet-route.js` on port `3004` (Fyrejet in default Express mode)
5. `./performance/express-route.js` on port `3005` (Express)

Each app exposes the `/hi` route, using the `GET` method

Hardware used: `MacBook Pro (16-inch, 2019)` || `Intel(R) Core(TM) i9-9980HK CPU @ 2.40GHz`  || `64 GB 2667 MHz DDR4`

OS used: `macOS Catalina 10.15.6`

uname -a output: `Darwin Nikolays-MacBook-Pro.local 20.3.0 Darwin Kernel Version 20.3.0: Thu Jan 21 00:07:06 PST 2021; root:xnu-7195.81.3~1/RELEASE_X86_64 x86_64`

Testing is done with `wrk` using this command: `wrk -t8 -c64 -d5s 'http://localhost:3001/hi'`, where `3001` is changed to required port.

Second-best result out of a series of 5 is used. 

Results:

1. 26626.78 req/s (89.9% faster than express)
2. 14021.54 req/s (baseline)

The CPU package temperature was ensured to be 45-47 degrees Celsium at the start of each round.

### Clustering

Be aware that `uWebSockets.js` generally doesn't perform on MacOS and FreeBSD as well as on Linux. It also does not clusterize on non-Linux platforms, [as it depends on certain kernel features](https://github.com/uNetworking/uWebSockets.js/issues/214#issuecomment-547589050). This only affects `uWebSockets.js` (and, by extenstion, `fyrejet.uwsCompat`). However, Fyrejet itself has no problems with Node.js clustering, as demonstrated by the table before.

```sh
# in terminal 1 or whatever pleases your soul <3

node ./performance/fyrejet-route-cluster.js 2 
# 2 is the number of worker processes to use
# you can also use express-route-cluster.js, which will run on port 4005

# in terminal 2

wrk -t8 -c64 -d5s 'http://localhost:4004/hi'
```

#### Overall results with clustering

| № of workers | Express, req/s | Fyrejet, req/s | % difference in favor of Fyrejet |
| ------------ | -------------- | -------------- | -------------------------------- |
| 1            | 13893.07       | 22563.44       | 62.4                             |
| 2            | 25067.27       | 40751.20       | 62.5                             |
| 3            | 33958.38       | 56950.06       | 67.7                             |
| 4            | 44578.20       | 72082.12       | 61.7                             |



## Run tests

```
npm install
npm run test
npm run test-uWS
```



## Donations

Are welcome.

Currently, you can use PayPal:

https://paypal.me/schamberg97



## Support

In order to get support, you can file an issue in this repository. If you need commercial support, please write on schamberg.nicholas@gmail.com