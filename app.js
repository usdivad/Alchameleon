// Initial vars for Express app and server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var port = 8000;

// AlchemyAPI
var AlchemyAPI = require('./alchemyapi');
var alchemyapi = new AlchemyAPI();
// app.set('port', process.env.PORT || 8000);

// Server
server.listen(port, function() {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Express server listening at http://%s:%s', host, port);
});

// Homepage
app.use(express.static('public'));
app.get('/', function(req, res) {
    // res.send('THUG LYFE');
    res.send('index.html');
});