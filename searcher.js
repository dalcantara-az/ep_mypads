var ld = require('lodash');
var storage = require('./storage.js');
var padDB = require('./model/pad.js');

module.exports = (function () {
  'use strict';

  var searcher = {};

  searcher.searchPads = function (userId, searchQuery, callback) {
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
          WHERE ((store.value)::json ->> 'visibility' IS NULL AND 
            CONCAT('mypads:group:', (store.value)::json ->> 'group') IN (
              SELECT key
              FROM store, LATERAL (
                SELECT array_agg(value) AS ids
                FROM json_array_elements_text((store.value)::json->'admins') 
              ) as admins, LATERAL (
                SELECT array_agg(value) AS ids
                FROM json_array_elements_text((store.value)::json->'users') 
              ) as users
              WHERE key LIKE '${storage.DBPREFIX.GROUP}%' AND (
                value::json->>'visibility' = 'public' OR (
                  value::json->>'visibility' = 'restricted' AND 
                    ('${userId}' = ANY(admins.ids) OR '${userId}' = ANY(users.ids))
                )
              )
            )
          ) OR (store.value)::json ->> 'visibility' = 'public'
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
