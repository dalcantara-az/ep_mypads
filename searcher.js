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
            var query = 
                "SELECT SUBSTRING(store.key, 12) AS key, store.value AS value, subquery.headline AS headline " +
                "FROM (" + 
                    "SELECT ts_rank_cd(" + 
                        "to_tsvector(value::json -> 'atext' ->> 'text'), " + 
                        "plainto_tsquery($1)) " + 
                    "AS score, key, ts_headline( " + 
                        "'english', " + 
                        "value::json -> 'atext' ->> 'text', " + 
                        "plainto_tsquery($2)) " + 
                    "AS headline " + 
                    "FROM store " + 
                    "WHERE to_tsvector(value::json -> 'atext' ->> 'text') @@ plainto_tsquery($3)" + 
                ") AS subquery " + 
                "INNER JOIN store " + 
                "ON SUBSTRING(subquery.key, 5) = SUBSTRING(store.key, 12) " + 
                "WHERE (store.value)::json ->> 'visibility' IS NULL OR (store.value)::json ->> 'visibility' = 'public' " + 
                "ORDER BY subquery.score DESC";
            console.log(query);
            storage.db.db.wrappedDB.db.query(query, [searchQuery, searchQuery, searchQuery], function (err, queryResult) {
                if (err) { console.log(err) }
                
                var rows = queryResult.rows;
                var results = {
                    groups: [],
                    pads: [],
                    headlines: {},
                };
                rows.forEach(function(row) {
                    var pad = {};
                    pad[row.key] = JSON.parse(row.value);
                    results.pads.push(pad);
                    results.headlines[row.key] = row.headline;
                });
                return callback(null, results);
            });
        }
    };
    
    return searcher;
}).call(this);
