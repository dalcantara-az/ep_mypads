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
var userDB = require('./model/user.js');
var userCache = require('./model/user-cache.js');

var etherpadAPI = require('ep_etherpad-lite/node/db/API');
var schedule = require('node-schedule');

var GPREFIX = storage.DBPREFIX.GROUP;
var UPREFIX = storage.DBPREFIX.USER;
var PPREFIX = storage.DBPREFIX.PAD;

var DIGEST_DURATION = 3600000; //One hour
var DIGEST_SCHEDULE = "0 * * * *"; //Every hour

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

  watcher.fn.generateGroupDigestSubject = function(g) {
    return "Hourly digest for " + g.name;
  }

  watcher.fn.generateUserDigestSubject = function(u) {
    return "Your hourly digest";
  }
  
  watcher.fn.sendMailChanges = function(watcherList, emailSubject, actualChanges, callback) {
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
        var subject = emailSubject;
        var text = watcher.fn.generateDigestMessage(actualChanges, padNames);
        var data = watcher.fn.generateDigestFormattedMessage(actualChanges, padNames);
        var envelope = {
          to,
          subject,
          text,
          attachment: [{ data, alternative: true}]
        };
        mail.sendEnvelope(envelope, function (err) {
          if (err) {
            return callback(err);
          }
          callback(null, { envelope });
        });
      });
    });
  }

  var padChangeCache = {};

  watcher.fn.generatePadChanges = function (padId, startTime) {
    if (padChangeCache[padId]) {
      return new Promise((resolve, reject) => {
        return resolve(padChangeCache[padId]);
      });
    }
    return etherpadAPI.createDiffSince(padId, startTime).catch(err => {
      // Its possible padId no longer exists or diff cannot be generated
      // For our purposes, this is equivalent to having no diffs.
      return {padId, splices: [], authors: []}; 
    }).then(diffs => {
      padChangeCache[padId] = diffs;
      return diffs;
    });
  }

  watcher.fn.cacheAllPadChanges = function(startTime, callback) {
    padDB.getAllPadIds(function(err, padIds) {
      if (err) {
        return callback(err);
      }
      var diffPromises = Promise.all(padIds.map(p => watcher.fn.generatePadChanges(p, startTime)));
      diffPromises.then(diffs => {
        return callback(null, { diffs } );
      }).catch(callback);
    });
  }

  watcher.fn.clearCache = function() {
    //TODO determine if garbage collection based deletion is sufficient
    padChangeCache = {};
  }

  watcher.reportGroupChanges = function(groupId, startTime, callback) {
    // No need to cache all pad changes, because we only consider a subset of pads
    groupDB.get(groupId, function(err, g) {
      if (err) {
        return callback(err);
      }
      var watcherList = g.watchers;
      if (watcherList == null || watcherList.length == 0) {
        return callback(null, { watcherList: null });
      }

      var diffPromises = Promise.all(g.pads.map(p => watcher.fn.generatePadChanges(p, startTime)));
      diffPromises.then(diffs => {
        var actualChanges = diffs.filter(d => d.splices.length > 0);
        if (actualChanges.length == 0) {
          return callback(null, { actualChanges: null });
        }

        return watcher.fn.sendMailChanges(watcherList, watcher.fn.generateGroupDigestSubject(g), actualChanges, callback);
      }).catch(callback);
    });
  }

  watcher.reportUserChanges = function(userLogin, startTime, callback) {
    var padDiffs = Object.values(padChangeCache); 
    // Make sure all pad changes have been cached
    if (padDiffs.length == 0) {
      return watcher.fn.cacheAllPadChanges(startTime, (err) => {
        if (err) {
          return callback(err);
        }
        return watcher.reportUserChanges(userLogin, startTime, (err, result) => {
          // Created the caching, should be responsible to clear it
          watcher.fn.clearCache();
          callback(err, result);
        });
      });
    }

    userDB.get(userLogin, function(err, u) {
      if (err) {
        return callback(err);
      }
      var userTag = '@' + u.login + '@';
      var watchlist = u.watchlist ? u.watchlist.pads : [];
      var actualChanges = padDiffs.filter(d => {
        // No change to pad
        if (d.splices.length == 0) {
          return false;
        }
        // Pad is part of user's watchlist
        if (watchlist.includes(d.padId)) {
          return true;
        } 
        // User has been tagged in pad
        return d.splices.some(diffText => diffText[2].toLowerCase().includes(userTag));
      });

      if (actualChanges.length == 0) {
        return callback(null, { actualChanges: null });
      }

      var mailList = [u._id];

      return watcher.fn.sendMailChanges(mailList, watcher.fn.generateUserDigestSubject(u), actualChanges, callback);
    });
  }

  watcher.reportAllGroups = function(startTime) {
    return new Promise((outerResolve, outerReject) => {
      groupDB.getAllGroupIds(function(err, groupIds) {
        if (err) {
          return outerReject(err);
        }
        return outerResolve ( Promise.all(groupIds.map(gid => {
          return new Promise((resolve, reject) => {
            watcher.reportGroupChanges(gid, startTime, (err, result) => {
              if (err) {
                //FIXME determine proper error logging
                console.log(err);
                return reject(err);
              }
              return resolve(result);
            });
          })
        })));
      });
    });
  }

  watcher.reportAllUsers = function(startTime) {
    return Promise.all(Object.keys(userCache.logins).map(lid => {
      return new Promise((resolve, reject) => { 
        watcher.reportUserChanges(lid, startTime, (err, result) => {
          if (err) {
            //FIXME determine proper error logging
            console.log(err);
            return reject(err);
          }
          return resolve(result);
        });
      });
    }));
  }
  
  watcher.reportAll = function () {
    var startTime = Date.now() - DIGEST_DURATION;
    watcher.fn.cacheAllPadChanges(startTime, (err, result) => {
      if (err) {
        // FIXME determine proper logging
        console.log(err);
        return;
      }
      var changePromises = [watcher.reportAllGroups(startTime), watcher.reportAllUsers(startTime)];
      Promise.all(changePromises).finally(watcher.fn.clearCache);
    });
  }

  watcher.init = function () {
    schedule.scheduleJob(DIGEST_SCHEDULE, watcher.reportAll);
  };

  return watcher;

}).call(this);
