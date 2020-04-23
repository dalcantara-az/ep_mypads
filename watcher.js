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

var conf = require('./configuration.js');
var mail = require('./mail.js');
var storage = require('./storage.js');
var groupDB = require('./model/group.js');
var padDB = require('./model/pad.js');
var etherpadAPI = require('ep_etherpad-lite/node/db/API');
var schedule = require('node-schedule');

var GPREFIX = storage.DBPREFIX.GROUP;
var UPREFIX = storage.DBPREFIX.USER;
var PPREFIX = storage.DBPREFIX.PAD;

// var DIGEST_DURATION = 3600000; //One hour
var DIGEST_DURATION = 60000; //One minute
var DIGEST_SCHEDULE  = "*/1 * * * *";
// var DIGEST_SCHEDULE = "0 * * * *"; //Every hour

module.exports = (function () {
  'use strict';

  var watcher = {};

  watcher.fn = {};

  var _bulkRetrieve = function(prefix, list, callback) {
    var keys = list.map(id => prefix + id);
    storage.fn.getKeys(keys, callback);
  }

  watcher.fn.getEmails = function(watcherList, callback) {
    _bulkRetrieve(UPREFIX, watcherList, function(err, retrieved) {
      if (err) {
        return callback(err);
      }
      var emailList = watcherList.map(id => retrieved[UPREFIX + id]["email"]);
      return callback(null, emailList);
    });
  }

  watcher.fn.getPadNames = function(padList, callback) {
    _bulkRetrieve(PPREFIX, padList, function(err, retrieved) {
      if (err) {
        return callback(err);
      }
      var padNameMap = {};
      padList.forEach(padId => {
        padNameMap[padId] = retrieved[PPREFIX + padId]["name"];
      });
      return callback(null, padNameMap);
    });
  }

  var _getPadUrl = function(padId) {
    return conf.get("rootUrl") + "/p/" + padId;
  }

  watcher.fn.generateDigestMessage = function(actualChanges, padNames) {
    return actualChanges.map(padChange => {
      var subResult = `${padNames[padChange.padId]}(${_getPadUrl(padChange.padId)})\n`;
      subResult+= "Authors: " + padChange.authors.join(" ") + "\n\n";
      subResult+= padChange.splices.map(s => s[2]).filter(s => s).join("\n");
      subResult+="\n";
      return subResult;
    }).join("\n");
  }

  watcher.fn.generateDigestFormattedMessage = function(actualChanges, padNames) {
    return actualChanges.map(padChange => {
      var subResult = `<h1><a href="${_getPadUrl(padChange.padId)}">${padNames[padChange.padId]}</a></h1><br>`;
      subResult+= `<h2>Authors: ${padChange.authors.join(" ")}</h2><br>`;
      subResult+= padChange.splices.filter(s => s[2]).map(s => `<pre>${s[2]}</pre>`).join("<br>");
      subResult+="<br>";
      return subResult;
    }).join("<br>");
  }

  watcher.fn.generateDigestSubject = function(g) {
    return "Hourly digest for " + g.name;
  }

  watcher.reportGroupChanges = function(groupId, startTime, callback) {
    groupDB.get(groupId, function(err, g) {
      if (err) {
        return callback(err);
      }
      var watcherList = g.watchers;
      if (watcherList == null || watcherList.length == 0) {
        return callback(null, { watcherList: null });
      }
      console.log('gonna promise');
      var diffPromises = Promise.all(g.pads.map(p => {return etherpadAPI.createDiffSince(p, startTime); }));
      diffPromises.then(diffs => {
        console.log('done promise');
        var actualChanges = diffs.filter(d => d.splices.length > 0);
        if (actualChanges.length == 0) {
          return callback(null, {actualChanges: null });
        }

        watcher.fn.getEmails(watcherList, function(err, emailList){
          if (err) {
            return callback(err);
          }
          var changedPadIds = actualChanges.map(p => p.padId);
          watcher.fn.getPadNames(changedPadIds, function(err, padNames) {
            if (err) {
              return callback(err);
            }
            var to = emailList.join(", ");
            var subject = watcher.fn.generateDigestSubject(p);
            var text = watcher.fn.generateDigestMessage(actualChanges, padNames);
            var data = watcher.fn.generateDigestFormattedMessage(actualChanges, padNames);
            console.log('to: ' + to);
            console.log('subject: ' + subject);
            console.log('text: ' + text);
            console.log('data: ' + data);
            // var to = emailList.join(", ");
            // var subject = watcher.fn.generateDigestSubject(g);
            // var text = watcher.fn.generateDigestMessage(actualChanges, padNames);
            // var data = watcher.fn.generateDigestFormattedMessage(actualChanges, padNames);
            // var envelope = {
            //   to,
            //   subject,
            //   text,
            //   attachment: [{ data, alternative: true}]
            // };
            // mail.sendEnvelope(envelope, function (err) {
            //   if (err) {
            //     return callback(err);
            //   }
            //   callback(null, { envelope });
            // });
          });
        });
      });
    });
  }

  watcher.reportPadChanges = function(padId, startTime, callback) {
    padDB.get(padId, function(err, p) {
      if (err) {
        return callback(err);
      }
      var watcherList = p.watchers;
      if (watcherList == null || watcherList.length == 0) {
        return callback(null, { watcherList: null });
      }

      var diffPromises = Promise.all(p.pads.map(p => {return etherpadAPI.createDiffSince(p, startTime); }));
      diffPromises.then(diffs => {
        var actualChanges = diffs.filter(d => d.splices.length > 0);
        if (actualChanges.length == 0) {
          return callback(null, {actualChanges: null });
        }

        watcher.fn.getEmails(watcherList, function(err, emailList){
          if (err) {
            return callback(err);
          }
          var changedPadIds = actualChanges.map(p => p.padId);
          watcher.fn.getPadNames(changedPadIds, function(err, padNames) {
            if (err) {
              return callback(err);
            }
            var to = emailList.join(", ");
            var subject = watcher.fn.generateDigestSubject(p);
            var text = watcher.fn.generateDigestMessage(actualChanges, padNames);
            var data = watcher.fn.generateDigestFormattedMessage(actualChanges, padNames);
            console.log('to: ' + to);
            console.log('subject: ' + subject);
            console.log('text: ' + text);
            console.log('data: ' + data);
            // var envelope = {
            //   to,
            //   subject,
            //   text,
            //   attachment: [{ data, alternative: true}]
            // };
            // mail.sendEnvelope(envelope, function (err) {
            //   if (err) {
            //     return callback(err);
            //   }
            //   callback(null, { envelope });
            // });
          });
        });
      });
    });
  }

  var _quietCallback = function(err) {
    //FIXME determine better logging
    if (err) {
      console.log(err);
    }
  };

  watcher.reportAllGroups = function() {
    console.log('reporting...');
    var startTime = Date.now() - DIGEST_DURATION;

    groupDB.getAllGroupIds(function(err, groupIds) {
      if (err) {
        _quietCallback(err);
      }
      groupIds.forEach(gid => {
        watcher.reportGroupChanges(gid, startTime, _quietCallback);
      });
    });
  }

  watcher.init = function () {
    console.log('initialized');
    schedule.scheduleJob(DIGEST_SCHEDULE, watcher.reportAllGroups);
  };

  return watcher;

}).call(this);
