/**
*  # Group watching module
*
*  ## License
*
*  Licensed to the Apache Software Foundation (ASF) under one
*  or more contributor license agreements.  See the NOTICE file
*  distributed with this work for additional information
*  regarding copyright ownership.  The ASF licenses this file
*  to you under the Apache License, Version 2.0 (the
*  "License"); you may not use this file except in compliance
*  with the License.  You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
*  Unless required by applicable law or agreed to in writing,
*  software distributed under the License is distributed on an
*  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
*  KIND, either express or implied.  See the License for the
*  specific language governing permissions and limitations
*  under the License.
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
  
    return function (pad, successFn) {
      var pid  = pad._id;
      var user = auth.userInfo();
      if (ld.includes(user.watchlist.pads, pid)) {
        ld.pull(user.watchlist.pads, pid);
      } else {
        user.watchlist.pads.push(pid);
      }
      if (typeof(model.watchlist().pads[pid]) !== 'undefined') {
        delete model.watchlist().pads[pid];
      } else {
        model.watchlist().pads[pid] = pad;
      }
      m.request({
        url: conf.URLS.USERWATCH,
        method: 'POST',
        data: {
          type: 'pads',
          key: pid,
          auth_token: auth.token(),
        }
      }).then(function () {
        notif.success({ body: conf.LANG.GROUP.WATCH_SUCCESS });
        if(c!=null){
            model.fetch(c.computeGroups);
          }
        //model.fetch(c.computeGroups);
        console.log(model.watchlist());
        if (successFn) { successFn(); }
      }, function (err) {
        return notif.error({ body: ld.result(conf.LANG, err.error) });
      });
    };
  
  }).call(this);
  