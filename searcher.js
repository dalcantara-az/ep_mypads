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
        padDB.getAllPadIds(function(err, padIds) {
            if (err) {
                console.log(err);
            }
            if (storage.db && (storage.db.type === 'postgres' || storage.db.type === 'postgrespool')) {
                var query = 'SELECT ts_rank_cd(to_tsvector(value::json -> \'atext\' ->> \'text\'), plainto_tsquery($1)) AS score, key, value FROM store WHERE to_tsvector(value::json -> \'atext\' ->> \'text\') @@ plainto_tsquery($2) ORDER BY score DESC';
                storage.db.db.wrappedDB.db.query(query, [searchQuery, searchQuery], function (err, queryResult) {
                    if (err) { console.log(err) }
            
                    var rows = queryResult.rows;
                    console.log(rows);
                    var results = {
                        groups: {},
                        pads: {},
                    };
                    rows.forEach(function (row) {
                        try {
                            if (!ld.isNull(row)) {
                                results.pads[row.key] = JSON.parse(row.value);
                            }
                        } catch (e) {
                            console.log(e.message);
                            console.error('JSON-PROBLEM:' + row.value);
                        }
                    });
                    return callback(null, results);
                });
            }
            // storage.fn.getKeysUncached(padIds, function(err, results) {
            //     var pads = {};
            //     if (err) {
            //         console.log(err);
            //     }
            //     console.log('results:');
            //     console.log(results);
            //     Object.keys(results).forEach(function(key){
            //         pads[key] = results[key];
            //     });
            //     return callback(null, pads);
            // })
        });
    };
    
    return searcher;
}).call(this);
