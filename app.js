/*
 * Setup
 */

// Initial vars for Express app and server
var http = require('http');
var express = require('express');
var app = express();
var server = http.createServer(app);
var port = 8000;
// var output = {};
var fs = require('fs');
var bodyParser = require('body-parser');
var gi = require('google-images');

// app.use()s
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.json());
app.use(express.urlencoded());

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
// app.get('/', home);
app.get('game.html', home);
app.post('/game', home);


/*
 * Chained functions for main method
 */

function home(req, res, output) {
    console.log('hi');
    // console.log(res);
    var output = {};
    var query_raw = 'sherlock holmes';
    query_raw = req.body.who;
    // console.log(req);
    console.log(query_raw);
    var query = encodeURIComponent(query_raw);
    output['query_raw'] = query_raw;
    output['query'] = query;
    // console.log(output);

    console.log('Searching Wikipedia for ' + query_raw + '...');
    get_wiki_search(req, res, output);
}

function get_wiki_search(req, res, output) {
    query = output['query'];
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
            // console.log('Done searching');
            // console.log(results_str);
            results = JSON.parse(results_str);
            output['results'] = results;
            
            console.log('Getting Wikipedia URL...');
            get_wiki_url(req, res, output);
        })
    };
    
    http.request(options, callback).end();
}

function get_wiki_url(req, res, output) {
    search_results = output['results'];
    urls = search_results[3];
    // console.log(urls);
    url = urls[0];
    console.log("Wikipedia URL: " + url);
    // return url;
    output['url'] = url;

    console.log('Getting entities from AlchemyAPI...');
    entities(req, res, output);
}

function entities(req, res, output) {
    url = output['url'];
    alchemyapi.entities('url', url, {}, function(res_entities) {
        // output['entities'] = JSON.stringify(res_entities, null, 4);
        output['protagonist'] = res_entities['entities'].shift(); //NOTE: this assumes that the 'entities' arr is sorted by descending relevance!
        output['entities'] = res_entities['entities'];
        output['people'] = extract_by_values(output['entities'], 'type', ['Person']);
        output['places'] = extract_by_values(output['entities'], 'type', ['City', 'StateOrCounty', 'Country']);
        output['organizations'] = extract_by_values(output['entities'], 'type', ['Company', 'Organization']);
        // console.log(output['entities']);

        console.log(output['places']);

        console.log('Printing output...')
        to_output(req, res, output);
    });
}

function to_output(req, res, output) {
    out_str = 'OUTPUT:<br>';
    out_str += output['query_raw'] + ': ' + output['url'] +'<br>';
    out_str += JSON.stringify(output['entities'], null, 4);
    res.send(out_str);

    save_image(output['query']);

    console.log('Done!');
}

function get_quotes(req, res, output) {

}


/*
 * Utility functions
 */

// Extract objects from a list by possible values for key
function extract_by_values(list, key, values) {
    out_list = [];
    for (var i=0; i<list.length; i++) {
        item = list[i];
        for (var j=0; j<values.length; j++) {
            value = values[j];
            if (item[key] && item[key] == value) {
                out_list.push(item);
                break;
            }
        }
    }
    return out_list;
}

// Google image search and save to img folder
function save_image(query) {
    gi.search(query, function(err, images) {
        if (images.length > 0) {
            var image = images[0];
            // console.log(image);
            var extension = file_extension(image['url']);
            var dir = 'public/img/';
            var path = dir + query + '.' + extension;

            image.writeTo(path, function() {
                console.log('Wrote to %s from %s', path, image['url']);
            });
        }
    });
}

function file_extension(path) {
    return path.split('.').pop();
}

// Save image: own recursive implementation
// function save_image(images) {
//     if (images.length < 1) {
//         console.log('No more images!');
//         return;
//     }
//     else {
//         var image = images.pop();
//         var image_url = image['url'];
//         var image_dir = '/img/'
//         var image_name = img_dir + image['name'];
//         var image_data = '';
//         callback = function(res_image) {
//             res_image.on('data', function(chunk) {
//                 image_data += chunk;
//             });

//             res_image.on('end', function() {
//                 fs.writeFile(image_name, image_data, callback = function() {
//                     console.log('Image written to %s from %s', image_name, image_url);
//                 });
//                 // Recursively call for next image
//                 save_image(images);
//             })
//         }
//     }
// }