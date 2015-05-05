// Initial vars for Express app and server
var http = require('http');
var express = require('express');
var app = express();
var server = http.createServer(app);
var port = 8000;
// var output = {};

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
function home(req, res, output) {
    // output = 'THUG LYFE';
    console.log('hi');
    // console.log(res);
    var output = {};
    query_raw = 'sherlock holmes';
    query = encodeURIComponent(query_raw);
    output['query_raw'] = query_raw;
    output['query'] = query;
    console.log(output);
    url = get_wiki_search(req, res, output);
    // output += query + ': ' + url
    // res.send(output); //goes in callback!
    // res.send('no.html');
}

function entities(req, res, output) {
    alchemyapi.entities('url');
}

function to_output(req, res, output) {
    out_str = output['query_raw'] + ': ' + output['url'];
    console.log(out_str);
    res.send(out_str);
}

function get_wiki_url(req, res, output) {
    search_results = output['results'];
    urls = search_results[3];
    // console.log(urls);
    url = urls[0];
    console.log("Wikipedia URL: " + url);
    // return url;
    output['url'] = url;
    to_output(req, res, output);
}

function get_wiki_search(req, res, output) {
    query = output['query'];
    console.log('searching for ' + query);
    var options = {
        host: 'en.wikipedia.org',
        path: '/w/api.php?action=opensearch&format=json&search=' + query
    };
    var results_str = ''
    callback = function(res_search) {
        res_search.on('data', function(chunk) {
            results_str += chunk;
        });
        res_search.on('end', function() {
            console.log('done!');
            // console.log(results_str);
            results = JSON.parse(results_str);
            output['results'] = results;
            get_wiki_url(req, res, output);
        })
    };
    
    http.request(options, callback).end();
}