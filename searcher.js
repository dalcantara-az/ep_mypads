var ld = require('lodash');
var storage = require('./storage.js');
var padDB = require('./model/pad.js');

module.exports = (function () {
    'use strict';

    var _bulkRetrieve = function(prefix, list, callback) {
        var keys = list.map(id => prefix + id);
        storage.fn.getKeys(keys, callback);
    }

    var searcher = {};

    searcher.fn = {};

    searcher.fn.searchPads = function (searchQuery, callback) {
        console.log("searched for: " + searchQuery);
        if (storage.db && (storage.db.type === 'postgres' || storage.db.type === 'postgrespool')) {
            var query = 'SELECT ts_rank_cd(to_tsvector(value::json -> \'atext\' ->> \'text\'), plainto_tsquery($1)) AS score, key, ts_headline(\'english\', value::json -> \'atext\' ->> \'text\', plainto_tsquery($2)) AS headline  FROM store WHERE to_tsvector(value::json -> \'atext\' ->> \'text\') @@ plainto_tsquery($3) ORDER BY score DESC';
            storage.db.db.wrappedDB.db.query(query, [searchQuery, searchQuery, searchQuery], function (err, queryResult) {
                if (err) { console.log(err) }
                
                var rows = queryResult.rows;
                var results = {
                    groups: {},
                    pads: {},
                    headlines: {},
                };
                storage.fn.getKeysUncached(rows.map(function (row) {
                    results.headlines[row.key.substr(4)] = row.headline.replace(/(\r\n+|\n+|\r+)/gm, " ");
                    return 'mypads:' + row.key;
                }), function(err, newResults) {
                    
                    if (err) { console.log(err) }

                    console.log(newResults);
                    Object.keys(newResults).forEach(function(key) {
                        results.pads[key.substr(storage.DBPREFIX.PAD.length)] = newResults[key];
                    })
                    return callback(null, results);
                })
                
            });
        }
    };
    
    return searcher;
}).call(this);
