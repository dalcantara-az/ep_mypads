/**
*  vim:set sw=2 ts=2 sts=2 ft=javascript expandtab:
*
*  # Bookmark List module
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
*  This module regroups all bookmarks from a logged users : groups, pads and,
*  _soon_, other users.
*/

module.exports = (function () {
  'use strict';
  // Global dependencies
  var m  = require('mithril');
  var ld = require('lodash');

  // Local dependencies
  var conf      = require('../configuration.js');
  var auth      = require('../auth.js');
  var u         = auth.userInfo;
  var layout    = require('./layout.js');
  var groupWatch= require('./group-watch.js');
  var padWatch  = require('./pad-watch.js');
  var model     = require('../model/group.js');

  var watchlist = {};

  /**
  * ## Controller
  *
  * Used for module state and actions.
  */

  watchlist.controller = function () {
    if (!auth.isAuthenticated()) {
      conf.unauthUrl(true);
      return m.route('/login');
    }
    document.title = conf.LANG.WATCHLIST.TITLE + ' - ' + conf.SERVER.title;

    var c = {};

    /**
    * ### computeWatchlist
    *
    * `computeWatchlist` is an internal function that gathers watchlisted groups
    * and pads.
    */

    c.computeWatchlist = function () {
      if(u().watchlist == null){
        u().watchlist = {
          groups:[],
          pads:[]
        }
      }
      var uWatched = u().watchlist;
      var items  = function (data, watched) {
        return  ld(data)
          .values()
          .filter(function (v) { return ld.includes(watched, v._id); })
          .sortBy('name')
          .value();
      };
      c.watchlist = {
        // groups: uWatched.groups,
        groups: items(model.watchlist().groups, uWatched.groups),
        // pads: items(uWatched.pads, uWatched.pads)
        pads: items(model.watchlist().pads, uWatched.pads)
      };
    };

    /**
    * ### unwatch
    *
    * `unwatch` function redirects to unwatching according to the type of the
    * bookmark.
    */

    c.unwatch = function (item, type) {
      var action = (type === 'groups') ? groupWatch : padWatch;
      action(item, c.computeWatchlist);
    };

    // Bootstrapping
    if (ld.isEmpty(model.groups())) {
      model.fetch(c.computeWatchlist);
    } else {
      c.computeWatchlist();
    }

    return c;
  };

  /**
  * ## Views
  *
  */

  var view = {};

  /**
  * ### groups and pads
  */

  view._items = function (c, type) {
    var noneMsg = '';
    // Using a switch just in case of more possible types in the future (userlists for ex)
    switch (type) {
      case 'groups':
        noneMsg = conf.LANG.GROUP.NONE;
        break;
      case 'pads':
        noneMsg = conf.LANG.GROUP.PAD.NONE;
        break;
    }
    if (ld.size(c.watchlist[type]) === 0) {
      return m('p', noneMsg);
    } else {
      return m('ul.list-unstyled', ld.map(c.watchlist[type], function (item) {
        var route;
        if (type === 'groups') {
          route = '/mypads/group/' + item._id + '/view';
        } else {
          route = '/mypads/group/' + item.group + '/pad/view/' + item._id;
        }
        return m('li', [
          m('button.btn.btn-link.btn-lg', {
            title: conf.LANG.GROUP.UNWATCH,
            onclick: ld.partial(c.unwatch, item, type)
          }, [ m('i.glyphicon glyphicon-heart') ]),
          m('a', { href: route, config: m.route }, item.name)
        ]);
      }));
    }
  };

  view.groups = ld.partialRight(view._items, 'groups');
  view.pads   = ld.partialRight(view._items, 'pads');

  view.aside = function () {
    return m('section.user-aside', [
      m('h2', conf.LANG.ACTIONS.HELP),
      m('article.well', m.trust(conf.LANG.WATCHLIST.HELP))
    ]);
  };

  view.main = function (c) {
    return m('section', [
      m('h2', conf.LANG.WATCHLIST.TITLE),
      m('section.panel.panel-primary', [
        m('.panel-heading',
          m('h3.panel-title', conf.LANG.GROUP.GROUPS)
        ),
        m('.panel-body', view.groups(c))
      ]),
      m('section.panel.panel-info', [
        m('.panel-heading',
          m('h3.panel-title', conf.LANG.GROUP.PAD.PADS)
        ),
        m('.panel-body', view.pads(c))
      ])
    ]);
  };

  watchlist.view = function (c) {
    return layout.view(view.main(c), view.aside(c));
  };

  return watchlist;

}).call(this);
  