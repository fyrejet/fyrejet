 

# Fyrejet 2

<img src="./fyre.png" alt="logo" height="150" width="150" />

## What is Fyrejet?

Fyrejet is a web-framework that is designed for speed and ease-of-use. After working with numerous frameworks, you never fail to appreciate the ease of development with Express. In fact, it is so easy that it is appropriate for novice developers to learn how to code. 

Unfortunately, that comes at a cost. While Express brings the speed of development, its performance is just okay-ish. Other frameworks either provide different APIs, are incompatible with Express middlewares or provide less functionality. For instance, Restana, a great API-oriented framework by jkybernees provides incredible performance, but only a subset of Express APIs, making it not suitable as an Express replacement.

Fyrejet does not strive to be the fastest framework. However, Fyrejet seeks to be faster than Express, while providing most of the original Express API. In fact, Fyrejet uses slightly modified<sup>[1](#footnote1)</sup> Express automated unit tests to verify the codebase. Moreover, Fyrejet offers you to use Express APIs with uWebSockets.js, enabling even greater performance at the cost of minor incompatibilities.

Finally, Fyrejet is flexible enough to offer you additional abilities to increase your route performance, such as disabling Express API for certain routes or for the whole project. You choose.



<a name="footnote1">[1]</a>: 

* `50` tests removed, because they are arguably irrelevant (`test/Route.js` and `test/Router.js`)
* `~6` tests modified to test a replacement API instead (`req.currentUrl`)
* `1` test removed, because deprecated functionality was too much time to implement. 
* `1091` out of `1147` Express tests are used, including aforementioned modified tests. Total number of tests used by Fyrejet: `1114`
* Tests passed by uWebSockets.js implementation: `1113` out of `1114` (minor inconvenience at best)



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



## Breaking changes from `1.x` to `2.0`

* `uWebSockets.js` compatibility implementation has been rewritten from scratch and it no longer relies on 0http's `low` library, at least until it has the same improvements as we do have. Moreover, the tests are now shared between `Fyrejet` and `Fyrejet + uWebSockets.js`. As such, certain dirty hacks are no longer used, which means that projects using `Fyrejet 1.x` and uWebSockets can be slightly incompatible with `Fyrejet 2`. Thus, according to Semantic Versioning, it has to versioned as `Fyrejet 2`.
* When using `uWebSockets.js`, `serverType` has to be `uWebSockets` and not `uWebSocket`, as the former is a more correct project name. `uWebSocket` will be silently changed into `uWebSockets`. Next release will show deprecation messages.
* That's it :)



## Installation

In order to install and test Fyrejet, you can issue the following commands:

```bash
npm install fyrejet
npm run test
```



## API

Fyrejet API is very similar to Express API. In general, you are advised to use the current Express documentation. Having said that, there are a few important differences between these projects, that are summarized in the table below:

| Capability            |   Type of difference   | Express                                                      | Fyrejet                                                      |
| --------------------- | :--------------------: | :----------------------------------------------------------- | ------------------------------------------------------------ |
| Routing, general      | Difference in behavior | Express goes through each route in the stack, verifying, whether it is appropriate for the request. When a request is made again, the same operation has to start all over again. | Fyrejet routing and base is basically a fork of Restana and its dependencies, 0http and Trouter. When an initial request is made, like ```GET /hi HTTP/1.1``` Fyrejet finds which routes are appropriate for the request and then caches those routes. This way, Fyrejet will be able to load only the required routes upon a similar request in the future. |
| Routing, details      | Difference in behavior | Changing req.url or req.method only affects the routes that have not been checked yet. | Changing ```req.url``` or ```req.method``` to a different value makes Fyrejet restart the routing process for your request within Fyrejet instance. All the changes made to data (such as ```res.locals``` or ```req.params```) during routing persist. If you try to change value to the same value (e.g., if ```req.method === "POST"; req.method = "POST"```), nothing occurs. However, if you want to avoid the rerouting in other cases, you can use ```req.setUrl(url)``` and ```req.setMethod(method)```. For more information, see [Rerouting](#Rerouting). |
| `req.url`             | Difference in behavior | req.url is modified to reflect the relative url in relation to the middleware route. | req.url does not operate this way in Fyrejet and is heavily used in in internal routing. As a replacement, you can use ```req.currentUrl```. |
| `res.send`            | Non-breaking additions | Provided                                                     | Provided, with very slight modifications (does not affect API compatibility). Also, Fyrejet provides alternative `res.sendLite`, which is unmodified `res.send` from Restana project. It is supposed to be faster and more lightweight, but with different functionality (no ETags, for example, but it is capable of sending objects faster and setting headers directly). See Restana's [documentation on `res.send`](https://github.com/jkyberneees/restana#the-ressend-method) for information on `res.sendLite` behavior. |
| Special routing modes | Non-breaking additions | N/A                                                          | Fyrejet has several special routing modes. Unlike Express, you can enable API-only mode (both system- and route-wide), turn most of Express `req` properties into functions (both system- and route-wide) for increased performance, as well as disable ETags for individual routes. See [Special routing modes](#srm). |



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

```req.setUrl(url)``` and ```req.setMethod(method)```. Both return req object, so they are chainable.



## Special Routing Modes <p name='srm'></p>

Fyrejet supports several additional route modes. Both offer increased performance at the cost of some sacrifices. For specific performance results, please check the [Benchmarks](#Benchmarks). This feature is considered stable, but some additional testing in 'the wild' would be appreciated.

### API mode

Sometimes, your app will have certain routes, where you barely use any Express functionality. In these cases, you could use Fyrejet's API mode in order to achieve better performance for these routes. In API mode, Fyrejet provides a very limited number of additional `req` properties. These are:

- `req.path`
- `req.currentUrl`
- `req.baseUrl`

Additionally, one `res` function is added, namely `res.send` (also available as `res.sendLite`).

#### How to use

To enable this mode, you can use two ways. The first one is to enable API mode globally for your Fyrejet instance. This can be accomplished by using `app.set('fyrejet mode', 'api')` before your routes, 

Alternatively, you could enable API mode for specific routes. To do this, you could declare the route the following way:

```js
app.get('/hi', (req, res, next) => {
  return res.send('This is an API route')
}, 'api')
```



#### Using Express functions in API mode

API mode does not fully disable Express functions and properties, they are still stored and can be made available yet again. This may be useful, if you do not know yet at the start of routing, whether you will need Express's functionality.

Each request's `req` and `res` is extended with a copy of the Fyrejet function, available as `req.app` and `res.app` respectively. This function also has many attached objects and other functions, such as `app.request` and `app.response`.

Starting with v2.1.0, you can do the following:

```js
app.get('/hi', (req, res, next) => {
  req.activateExpress()
  return res.send(req.hostname)
}, 'api')
```



This will, however, lead to the same performance penalties the normal routing mode leads to, albeit at a later stage, when you are certain you need Express functionality.



Alternatively, in order to call an Express function you'd need to follow this example (**NOT FULLY TESTED**): 

```js
app.get('/hi', (req, res, next) => {
  
  Object.keys(req.app.response).forEach(key => {
     res[key] = req.app.response[key]
  }) // at this point all res functions are available. Doesn't mean they work properly ;)
  Object.keys(req.app.request).forEach(key => {
    req[key] = req.app.request[key]
  }) // at this point all res FUNCTIONS are available. Doesn't mean they work properly ;)
  
  req.propFn = req.app.request.propFn // this is NOT just for convenience at this point.
  
  // to access, say, req.hostname, we would then do the following:
  
  let hostname = req.propFn.hostname.apply(req)
  
  return res.send(hostname) // localhost. This is express's res.send here
  
  // if you need to use API mode's default res.send (from Restana), you can:
  // res.send = res.sendLite
  
}, 'api')
```



This is *somewhat* like the Properties as Functions mode. However, this is **NOT FULLY** tested, **NOR OFFICIALLY SUPPORTED**.



#### Caveats

There are two caveats that have to be noted:

- There must be no 'appropriate' routes that use Express functionality before your API routes, if you use the second way to enable API mode, or you will run into troubles.
- Since the init process of nested routers and mounted Fyrejet apps depend on the parent app, global Fyrejet API mode will affect 'child' instances.

### Properties-as-functions mode

Properties as functions mode exists as a compromise between API mode's speed and Express compatibility. It allows you to use most of Express's `req` additions as Functions instead of properties. Some additional Express properties will be unaffected, because they are needed internally, however:

* `req.path`
* `req.currentUrl`
* `req.baseUrl`

#### How to use

Option 1) `app.set('fyrejet mode', 'properties as functions')`

Option 2) 

```
app.get('/hi', (req, res, next) => {
	console.log( req.xhr() ) // false or true 
  return res.send('This is a properties-as-functions route')
}, 'propsAsFns')
```

#### Caveats

Similar to those of API mode.

### No ETag Routes

In addition to Express's ability to redefine ETag function or disable it altogether, Fyrejet enables you to disable ETag for specific route only.

#### How to use

```
app.get('/hi', (req, res, next) => {
  return res.send('There won't be ETag')
}, 'noEtag')
```

#### Caveats

No known caveats yet.



## uWebSockets

Fyrejet includes BETA support for uWebSockets.

Versions 17.5.0 and 18.5.0 have been tested and do seem to work. Despite this, minor incompatibilities are expected. Please refer to Known problems section.

Despite, uWebSockets offers promising performance dividends for existing Express apps. For specific performance results, please check the [Benchmarks](#Benchmarks).

### How to use

```js
'use strict'

// preliminary testing done with uWS 17.5.0, but it is NOT covered with tests yet
const low = require('../index').uwsCompat
/* Based on low library from Rolando Santamaria Maso's (jkyberneees) excellent 0http. 
  However, many aspects of the library had to be reworked to make it more compatible with native node.js HTTP module. It is likely that the uwsCompat module could be made more efficient.
*/
const app = require('../index')({
  prioRequestsProcessing: false, // without this option set to 'false' uWS is going to be extremely sluggish
  server: low(),
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

At this time, there are 2 known problems with uWebSockets.js implementation used in Fyrejet.

* uWebSockets.js is unable to pass `test/app.listen.js`, because `server.close()` works a bit differently. **SEVERITY:** Low
* uWebSockets.js passes the last test (see `test/acceptance/web-service.js`), but ends up with segmentation failure upon attempt to close server. **SEVERITY:** Low-Medium?

## Benchmarks

It is a pseudo-scientific benchmark, but whatevs :)



![benchmark](./benchmark.png)

1. `./performance/fyrejet-route-uWS.js` on port `3001` (Fyrejet on top of uWS, with full Express API)
2. `./performance/fyrejet-route-api.js` on port `3002` (Fyrejet in API mode)
3. `./performance/fyrejet-route-propsAsFns.js` on port `3003` (Fyrejet in Properties as Functions mode)
4. `./performance/fyrejet-route.js` on port `3004` (Fyrejet in default Express mode)
5. `./performance/express-route.js` on port `3005` (Express)

Each app exposes the `/hi` route, using the `GET` method

Hardware used: `MacBook Pro (16-inch, 2019)` || `Intel(R) Core(TM) i9-9980HK CPU @ 2.40GHz`  || `64 GB 2667 MHz DDR4`

OS used: `macOS Catalina 10.15.6`

uname -a output: `Darwin device.local 19.6.0 Darwin Kernel Version 19.6.0: Thu Jun 18 20:49:00 PDT 2020; root:xnu-6153.141.1~1/RELEASE_X86_64 x86_64`

Testing is done with `wrk` using this command: `wrk -t8 -c64 -d5s 'http://localhost:3001/hi'`, where `3001` is changed to required port.

Second-best result out of a series of 5 is used. 

Results:

1) 26626.78 req/s (89.9% faster than express)

2) 35585.70 req/s (153.5% faster than express)

3) 25247.30 req/s (80.0% faster than express)

4) 23573.40 req/s (68.1% faster than express)

5) 14021.54 req/s (baseline)

The CPU package temperature was ensured to be 45-47 degrees Celsium at the start of each round.

### Clustering

Be aware that `uWebSockets.js` generally doesn't perform on MacOS and FreeBSD as well as on Linux. It also does not clusterize on non-Linux platforms, [as it depends on certain kernel features](https://github.com/uNetworking/uWebSockets.js/issues/214#issuecomment-547589050). This only affects `uWebSockets.js` (and, by extenstion, `fyrejet.uwsCompat`). However, Fyrejet itself has no problems with Node.JS clustering, as demonstrated by the table before.

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