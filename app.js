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
// var request = require('request');
var path = require('path');

// app.use()s
app.use(express.static('public'));
app.use('/public', express.static('/public'));
// app.use('/img', express.static('/public/img/'));
app.get('/img/*', function(req, res) {
    console.log('image');
    console.log(req.url);
    res.sendFile(req.url);

});

// app.use('/public', express.static(__dirname + '/public'));
// app.use('/public', express.static(__dirname + '/public'));
// app.use('/img', express.static(path.join(__dirname, 'public/img')));
// app.use('/js', express.static(path.join(__dirname, 'public/js')));

// app.get('/img/*', function(req, res){
//     // var root_path = 'localhost:' + port;
//     // var imgpth = req.url, img = root_path + imgpth;
//     // res.sendFile(img);

//     console.log('img');
//     console.log(req);

//     res.sendFile('localhost:8000');
// });

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
// app.get('game.html', home);
app.post('/collect', collect);
// app.get('/public/img/*', function(req, res) {
//     res.send('public/img/')
// })

/*
 * Chained functions for main method
 */

function collect(req, res, output) {
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
        // output['entities'] = stringify(res_entities, null, 4);
        output['protagonist'] = res_entities['entities'].shift(); //NOTE: this assumes that the 'entities' arr is sorted by descending relevance!
        output['entities'] = res_entities['entities'];
        output['people'] = extract_by_values(output['entities'], 'type', ['Person', 'Company', 'Organization']); //corporations are people too
        output['places'] = extract_by_values(output['entities'], 'type', ['City', 'StateOrCounty', 'Country']);
        // output['organizations'] = extract_by_values(output['entities'], 'type', ['Company', 'Organization']);
        // console.log(output['entities']);
        // console.log(output['places']);

        console.log('Getting relations...');
        relations(req, res, output);
    });
}

function relations(req, res, output) {
    alchemyapi.relations('url', url, {'keywords': 1, 'entities': 1}, function(res_relations) {
        output['relations'] = res_relations['relations'];
        
        console.log('Getting protagonist actions and available actions for people...');
        output['actions'] = to_protagonist_actions(output['relations'], output['protagonist'], output['people']);
        // console.log(output['protagonist']);
        // console.log(output['people']);

        // Logging actions
        console.log('My actions:');
        console.log(output['protagonist']['actions']);
        var other_people = output['people'];
        for (var i=0; i<other_people.length; i++) {
            other_person = other_people[i];
            if ('available_actions' in other_person) {
                console.log(other_person['text'] + '\'s available actions:');
                console.log(other_person['available_actions']);
            }
            else {
                console.log(other_person['text'] + ' has no available actions');
            }
        }

        console.log('Saving images...');
        get_images(req, res, output);
    });
}

function get_images(req, res, output) {
    // Image saving
    var other_people = output['people'];
    var max_images = 10;

    save_image(encodeURIComponent(output['protagonist']['text']), output['protagonist']);
    for (var i=0; i<max_images; i++) {
        var person_name = other_people[i]['text'];
        save_image(encodeURIComponent(person_name), other_people[i]);
    }

    console.log('Printing output...');
    to_output(req, res, output);
}

function to_output(req, res, output) {
    var out_str = 'OUTPUT:<br>';
    out_str += output['query_raw'] + ': ' + output['url'] +'<br>';
    out_str += JSON.stringify(output['entities'], null, 4);
    res.send(out_str);

    // console.log('POSTing to game.html');
    // request.post(
    //     'game.html',
    //     {form: {'data': JSON.stringify(output)}},
    //     function(out_err, out_resp, out_body) {
    //         if (!out_err && out_resp.statusCode == 200) {
    //             console.log('Successful POST to game.html');
    //         }
    //     }
    // );
    
    console.log('Writing to JSON file...');
    fs.writeFile('public/gamedata.json', JSON.stringify(output), function(err) {
        if (err) {
            console.log('Error:' + err);
        }
        else{
            console.log('Successful write');
        }
    })


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
            if (key in item && item[key] == value) {
                out_list.push(item);
                break;
            }
        }
    }
    return out_list;
}

// Google image search and save to img folder
function save_image(query, object) {
    //Check if file exists (how to get extension?)
    //TODO: move away from deprecated existsSync()
    if (fs.existsSync('public/img/'+query+'.jpg')) {
        console.log(query + '.jpg already exists');
        object['image_link'] = 'public/img/'+query+'.jpg';
        return;
    }
    else if (fs.existsSync('public/img/'+query+'.png')) {
        console.log(query + '.png already exists');
        object['image_link'] = 'public/img/'+query+'.png';
        return;
    }

    // Google image search query and construction
    gi.search(query, function(err, images) {
        // console.log(object);
        if (images.length > 0) {
            var image = images[0];
            // console.log(image);
            var extension = file_extension(image['url']);
            var dir = 'public/img/';
            var path = dir + query + '.' + extension;

            image.writeTo(path, function() {
                // console.log(object);
                console.log('Wrote to %s from %s', path, image['url']);
                object['image_link'] = path;
                console.log(object);
            });
        }
    });
}

function file_extension(path) {
    return path.split('.').pop();
}

// Create actions/objectives from relations
// TODO: split protagonist and people
function to_protagonist_actions(relations_arr, protagonist, people) {
    var actions = [];
    protagonist['actions'] = [];
    for (var relations_idx=0; relations_idx<relations_arr.length; relations_idx++) {
        var relation = relations_arr[relations_idx];
        // console.log(relation);
        // Ensure protagonist is subject of relation
        if ('subject' in relation && 'entities' in relation['subject']) {
            // console.log('yes subject entities');
            var subject = relation['subject'];
            var subject_entities = subject['entities'];
            for (var entities_idx=0; entities_idx<subject_entities.length; entities_idx++) {
                var subject_entity = subject_entities[entities_idx]; //subject_entity
                if ('action' in relation) {
                    var verb = relation['action']['lemmatized'];
                    verb = upper_first_char(verb);
                    // console.log(verb);
                    // console.log('%s vs. %s', subject_entity['text'], protagonist['text']);
                    if (subject_entity['text'] == protagonist['text']) { //(which is better; 'text' or 'name'?)
                        // console.log('subject entity matches protagonist');
                        if ('object' in relation) {
                            // console.log('yes object');
                            var object = relation['object'];
                            
                            // Create protagonist actions from keywords
                            if ('keywords' in object) {
                                // console.log('yes keywords');
                                var object_keywords = object['keywords'];

                                // // Many per relation
                                // for (var k=0; k<object_keywords.length; k++) {
                                //     var keyword = object_keywords[k]['text'];
                                //     protagonist['actions'].push(verb + ' ' + keyword);
                                // }

                                // Just one per relation
                                var keyword = object_keywords[0]['text'];
                                // console.log(verb + ' ' + keyword);
                                protagonist['actions'].push(verb + ' ' + keyword);
                                // console.log(protagonist['actions']);
                            }

                            // Create possible actions for people if available
                            if ('entities' in object) {
                                var object_entities = object['entities'];
                                for (var obj_idx=0; obj_idx<object_entities.length; obj_idx++) {
                                    var object_entity = object_entities[obj_idx];
                                    for (var people_idx=0; people_idx < people.length; people_idx++) {
                                        var person = people[people_idx];
                                        if (object_entity['text'] == person['text']) {
                                            // console.log(verb);
                                            if ('available_actions' in person) {
                                                person['available_actions'].push(verb);
                                            }
                                            else {
                                                person['available_actions'] = [verb];
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }   
                }
            }
            

        }
    }
}

function upper_first_char(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

            // See if entities subject match; then add to the entity's 'available_actions' field


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