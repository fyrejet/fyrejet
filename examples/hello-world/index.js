var express = require('../../');

var app = express();

app.get('/hi/', async (req, res, next) => {
  res.send({
    msg: 'Hello World!',
    query: req.query,
  })
})

/* istanbul ignore next */
if (!module.parent) {
  app.listen(3001)
  console.log('Express started on port 3001');
}
