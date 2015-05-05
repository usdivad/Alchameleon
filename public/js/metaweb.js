/**
 * metaweb.js: 
 *
 * This file implements a Metaweb.read() utility function using a <script>
 * tag to generate the HTTP request and the URL callback parameter to
 * route the response to a specified JavaScript function.
 **/
var Metaweb = {};                         // Define our namespace
Metaweb.HOST = "http://api.freebase.com"; // The Metaweb server
Metaweb.MQLREAD = "/api/service/mqlread"; // The mqlread service on that server

// This function submits one or more MQL queries to the mqlread service.
// When the results are available, it asynchronously passes them to 
// the specified callback functions.  The function expects an even number
// of arguments: each pair of arguments consists of a query and a 
// callback function.
Metaweb.read = function(/* q0, f0 [, q1, f1...] */) {
    // Figure out how many queries we've been passed
    if (arguments.length < 2 || arguments.length % 2 == 1)
        throw "Wrong number of arguments to Metaweb.read()";
    var nqueries = arguments.length / 2;

    // Place each query in a query envelope, and put each query envelope
    // in an outer envelope.  Also, store the callbacks in an array for
    // later use.
    var envelope = {}                          // The outer envelope
    var callbacks = new Array(nqueries);       // An array to hold callbacks
    for(var i = 0; i < nqueries; i++) {        // For each query/callback pair
        var inner = {"query": arguments[i*2]}; // Make inner query envelope
        var qname = "q" + i;                   // Property name for the query
        envelope[qname] = inner;               // Put inner envelope in outer
        callbacks[i] = arguments[i*2 + 1];     // Callback for the query
    }

    // Serialize and encode the envelope object.
    var serialized = JSON.stringify(envelope);    // http://json.org/json2.js
    var encoded = encodeURIComponent(serialized); // Core JavaScript function

    // Start building the URL
    var url = Metaweb.HOST + Metaweb.MQLREAD +  // Base mqlread URL
        "?queries=" + encoded;                  // Queries request parameter

    // Get a callback function name for this url
    var callbackName = Metaweb.makeCallbackName(url);

    // Add the callback parameter to the URL
    url += "&callback=Metaweb." + callbackName;

    // Create the script tag that will fetch the contents of the url
    var script = document.createElement("script");

    // Define the function that will be invoked by the script tag.
    // This function expects to be passed an outer response envelope.
    // It extracts query results and passes them to the corresponding callback.
    // The function throws exceptions on errors. Since it is invoked
    // asynchronously, those exceptions can't be caught, but they will
    // appear in the browser's JavaScript console as useful diagnostics.
    Metaweb[callbackName] = function(outer) {
        // Throw an exception if there was an invocation error.
        if (outer.code != "/api/status/ok") {  // Should never happen
            var error = outer.messages[0];
            throw outer.status + ": " + error.code + ": " + error.message;
        }

        var errors = [];  // An array of error messages to be thrown later

        // For each query, get the response envelope, test for success,
        // and pass query results to the corresponding callback function.
        // If any query (or callback) fails, save an error to throw later.
        for(var i = 0; i < nqueries; i++) {
            var qname = "q" + i;            // Query property name
            var inner = outer[qname];       // Extract inner envelope
            // Check for query success or failure
            if (inner.code == "/api/status/ok") {
                try {
                    callbacks[i](inner.result); // On success, call callback
                } catch(ex) {
                    // Remember any exceptions caused by the callback
                    errors.push("Exception from callback #" + i + ": " + ex);
                }
            }
            else {
                // If it failed, add all of its error messages to errors[].
                for(var j = 0; j < inner.messages.length; j++) {
                    var error = inner.messages[j];
                    var msg = "mqlread error in query #" + i +
                        ": " + error.code + ": " + error.message;
                    errors.push(msg);
                }
            }
        }

        // Now perform some cleanup
        document.body.removeChild(script);   // Remove the <script> tag
        delete Metaweb[callbackName];        // Delete this function

        // Finally, if there were any errors, raise an exception now so they
        // at least get reported in the JavaScript console.
        if (errors.length > 0) throw errors.join("\n");
    };

    // Now set the URL of the script tag and add that tag to the document.
    // This triggers the HTTP request and submits the query.
    script.src = url
    document.body.appendChild(script);
};

// This function returns a callback name that is not currently in use.
// Ideally, to support caching, the name ought to be based on the URL so the
// same URL always generates the same name.  For simplicity, however, we
// just increment a counter here.
Metaweb.makeCallbackName = function(url) {
    return "_" + Metaweb.makeCallbackName.counter++;                     
};
Metaweb.makeCallbackName.counter = 0; // Initialize the callback name counter.

Metaweb.SEARCH = "/api/service/search";  // URL path to the search service

// Invoke the Metaweb search service for the specified query.
// Asynchronously pass the array of results to the specified callback function.
// 
// The first argument can be a string for simple searches or an object
// for more complex searches.  If it is a string, it should take the form
//    [type:]text[*]
// That is: the text to be searched for, optionally prefixed by a type id
// and a colon and optionally suffixed with an asterisk.  Specifying a type 
// sets the type parameter for the search, and adding an asterisk makes it a 
// prefix search.
//
// If query argument is an object, then its properties are translated into 
// search parameters.  In this case, the object must include either 
// a property named query (for an exact match) or a property named prefix
// (for a prefix match).  Other legal properties are the same as the 
// allowed parameters for the search service: type, type_strict, domain, 
// limit, start, and so on.  To specify multiple types, set the 
// type property to an array of type ids.  To specify a single type, set
// the type property to a single id.
Metaweb.search = function(query, callback) {
    var q = {};  // The query object

    if (typeof query == "string") {
        // If the query argument is a string, we must convert it to an object.
        // First, see if there is a type prefix
        var colon = query.indexOf(':');
        if (colon != -1) {
            q.type = query.substring(0, colon);
            query = query.substring(colon + 1);
        }

        // Next see if there is an asterisk suffix
        if (query.charAt(query.length-1) == '*') // prefix match
            q.prefix = query.substring(0, query.length-1);
        else
            q.query = query;
    }
    else { 
        // Otherwise, assume the query argument is an object and 
        // copy its properties into the q object.
        for(var p in query) q[p] = query[p];
    }

    // With mqlread, we would JSON-encode the query object q.  For the search
    // service, we convert the properties of q to an array of URL parameters
    var parameters = [];
    for(var name in q) {
        var value = q[name];

        if (typeof value != "object") { // A single value for the parameter
            var param = name + "=" + encodeURIComponent(value.toString());
            parameters.push(param);
        }
        else { // Otherwise, there is an array of values: multiple types
            for(var index in value) {
                var elt = value[index];
                var param = name + "=" + encodeURIComponent(elt.toString());
                parameters.push(param);
            }
        }
    }

    // Now convert the array of parameters into a URL 
    var url = Metaweb.HOST + Metaweb.SEARCH + "?" + parameters.join('&');

    // Generate a name for the function that will receive the results
    var cb = Metaweb.makeCallbackName(url);

    // Add the JSONP callback parameter to the url
    url += "&callback=Metaweb." + cb;

    // Create the script tag that will fetch that URL
    var script = document.createElement("script");

    // Define the function that handles the results from that URL
    Metaweb[cb] = function(envelope) {
        // Clean up by erasing this function and deleting the script tag
        document.body.removeChild(script);
        delete Metaweb[cb];

        // If the query was successful, pass results to the callback
        // Otherwise, throw an error message
        if (envelope.code == "/api/status/ok")
            callback(envelope.result);
        else {
            throw "Metaweb.search: " + envelope.messages[0].code +
                ": " + envelope.messages[0].message;
        }
    }

    // Now set the URL of the script tag and add that tag to the document.
    // This triggers the HTTP request and submits the search query.
    script.src = url
    document.body.appendChild(script);
};