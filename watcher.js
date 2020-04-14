/**
*  vim:set sw=2 ts=2 sts=2 ft=javascript expandtab:
*
*  # Watcher Module
*
*  ## Description
*
*  This module contains all functions about watching and notification
*  about recent changes of pads within a group.
*/

var mail = require('./mail.js');
var storage = require('./storage.js');
var groupDB = require('./model/group.js');
var etherpadAPI = require('ep_etherpad-lite/node/db/API');

var GPREFIX = storage.DBPREFIX.GROUP;
var UPREFIX = storage.DBPREFIX.USER;
var PPREFIX = storage.DBPREFIX.PAD;

module.exports = (function () {
  'use strict';

  var watcher = {};

  watcher.fn = {};

  var _bulkRetrieve = function(list, prefix, attribute, callback) {
    var keys = list.map(id => prefix + id);
    storage.fn.getKeys(keys, function(err, retrieved) {
      if (err) { 
        return callback(err); 
      }
      var mappedResult = retrieved.map(record => record[attribute]);
      return callback(null, mappedResult);
    });
  }

  watcher.fn.getEmails = function(watcherList, callback) {
    return _bulkRetrieve(UPREFIX, watcherList, "email", callback);
  }

  watcher.fn.getPadNames = function(padList, callback) {
    return _bulkRetrieve(PPREFIX, padList, "name", callback);
  }

  watcher.fn.generateDigestMessage = function(actualChanges, padNames) {
    return actualChanges.map(padChange => {
      var subResult = padNames[padChange.padId] + "\n";
      subResult+= "Authors: " + padChange.authors.join(" ") + "\n";
      padChange.splices.map(s => s[2]).filter((s) => s).join("\n");
      return subResult; 
    }).join("\n");
  }

  watcher.fn.generateDigestSubject = function(g) {
    return "Daily digest for " + g.name;
  } 

  watcher.reportGroupChanges = function(groupId, startTime, callback) {
    groupDB.get(groupId, function(err, g) {
      if (err) {
        return callback(err);
      }
      var watcherList = g.watcher;
      if (watcherList == null || watcherList.length == 0) {
        return callback(null, { watcherList: null });
      }

      var diffs = await Promise.all(g.pads.map((p) => {return etherpadAPI.createDiffSince(p, startTime); }));
      var actualChanges = diffs.filter((d) => d.splices.length > 0);
      if (actualChanges.length == 0) {
        return callback(null, {actualChanges: null });
      }

      watcher.fn.getEmails(g.watcher, function(err, emailList){
        if (err) {
          return callback(err);
        }
        var changedPadIds = actualChanges.map(p => p.padId);
        watcher.fn.getPadNames(changedPadIds, function(err, padNames) {
          if (err) {
            return callback(err);
          }
          var body = watcher.fn.generateDigestMessage(actualChanges, padNames);
          var subject = watcher.fn.generateDigestSubject(g);
          var to = emailList.join(", ");
          mail.send(to, subject, message, function (err) {
            if (err) {
              return callback(err);
            }
            callback(null, { to, subject, message });
          });
        });
      });
    });
  }

  return watcher;

}).call(this);