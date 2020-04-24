/**
*  # Group watching module
*
*  ## Description
*
*  Short module for group watch and unwatch
*/

module.exports = (function () {
    'use strict';
    // Dependencies
    var m     = require('mithril');
    var ld    = require('lodash');
    var auth  = require('../auth.js');
    var conf  = require('../configuration.js');
    var notif = require('../widgets/notification.js');
    var model = require('../model/group.js');
  
    /**
    * ## Main function
    *
    * Takes a group object and adds or removes it from the bookmarks of the
    * current user. An optional `successFn` can be given, called with no
    * argument after successfull operation.
    */
  
    return function (group, successFn) {
      var gid  = group._id;
      var user = auth.userInfo();
      // if (user.hasOwnProperty("watchlist")) {
      //   user.watchlist = {
      //     groups: [],
      //     pads: [],
      //   };
      // }
      if (ld.includes(user.watchlist.groups, gid)) {
        ld.pull(user.watchlist.groups, gid);
      } else {
        user.watchlist.groups.push(gid);
      }
      if (typeof(model.watchlist().groups[gid]) !== 'undefined') {
        delete model.watchlist().groups[gid];
      } else {
        model.watchlist().groups[gid] = group;
      }
      m.request({
        url: conf.URLS.USERWATCH,
        method: 'POST',
        data: {
          type: 'groups',
          key: gid,
          auth_token: auth.token(),
        }
      }).then(function () {
        notif.success({ body: conf.LANG.GROUP.WATCH_SUCCESS });
        if(c!=null){
          model.fetch(c.computeGroups);
        }
        if (successFn) { successFn(); }
      }, function (err) {
        return notif.error({ body: ld.result(conf.LANG, err.error) });
      });
    };
  
  }).call(this);
  