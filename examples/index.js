var express = require("../index.js");

var app = express();

var router = express.Router();
router.get('/users', function(req, res){});
app.use(function (req, res, next) {
  res.writeHead(200);
  next();
});
app.use(router);
app.use(function (err, req, res, next) {
  res.end();
});

app.listen(3000)
