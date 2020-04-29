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

  searcher.searchPads = function (searchQuery, callback) {
    if (storage.db && (storage.db.type === 'postgres' || storage.db.type === 'postgrespool')) {
      var mypadStartIndex = storage.DBPREFIX.PAD.length + 1;
      var padStartIndex = storage.DBPREFIX.PAD.length - storage.DBPREFIX.GLOBAL.length + 1;
      var query = 
          `SELECT subquery.key AS key, store.value AS value, subquery.headline AS headline
          FROM (
              SELECT ts_rank_cd(
                  to_tsvector(value::json -> 'atext' ->> 'text'),
                  plainto_tsquery('${searchQuery}'))
              AS score, SUBSTRING(key, ${padStartIndex}) AS key, ts_headline(
                  'english',
                  value::json -> 'atext' ->> 'text',
                  plainto_tsquery('${searchQuery}'))
              AS headline
              FROM store
              WHERE to_tsvector(value::json -> 'atext' ->> 'text') @@ plainto_tsquery('${searchQuery}')
          ) AS subquery
          INNER JOIN store
          ON subquery.key = SUBSTRING(store.key, ${mypadStartIndex})
          WHERE ((store.value)::json ->> 'visibility' IS NULL AND subquery.key IN (
              SELECT json_array_elements_text((store.value)::json->'pads')  
              FROM store
              WHERE key LIKE '${storage.DBPREFIX.GROUP}%' AND value::json->>'visibility' != 'private'
          )) OR (store.value)::json ->> 'visibility' = 'public'
          ORDER BY subquery.score DESC`;
      storage.db.db.wrappedDB.db.query(query, [], function (err, queryResult) {
        if (err) { 
          console.log(err) 
        }
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
