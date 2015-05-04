// Initial vars for Express app and server
var http = require('http');
var express = require('express');
var app = express();
var server = http.createServer(app);
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
app.get('/', home);


// Functions
function home(req, res) {
    res.send('THUG LYFE');
    console.log('hi');
    get_wiki_search('hollywood');
    // res.send('no.html');
}

function entities(req, res, output) {
    alchemyapi.entities('url')
}

function get_wiki_url(search_results) {
    urls = search_results[3];
    console.log(urls);
}
function get_wiki_search(query) {
    console.log('searching for ' + query);
    var options = {
        host: 'en.wikipedia.org',
        path: '/w/api.php?action=opensearch&format=json&search=' + query
    };
    var results_str = ''
    callback = function(res) {
        res.on('data', function(chunk) {
            results_str += chunk;
        });
        res.on('end', function() {
            console.log('done!');
            // console.log(results_str);
            results = JSON.parse(results_str);
            get_wiki_url(results);
        })
    };
    
    http.request(options, callback).end();
}