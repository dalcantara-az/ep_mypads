/**
*  vim:set sw=2 ts=2 sts=2 ft=javascript expandtab:
*
*  # Pad remove chat history module
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
*  Short module for pad chat history removal
*/

module.exports = (function () {
  'use strict';
  // Dependencies
  var m     = require('mithril');
  var ld    = require('lodash');
  var auth  = require('../auth.js');
  var conf  = require('../configuration.js');
  var notif = require('../widgets/notification.js');
  var cookies = require('js-cookie');

  var remove = {};

  /**
  * ## Controller
  *
  * Used for authentication enforcement and confirmation before removal. In all
  * cases, redirection to parent group view.
  */

  remove.controller = function () {
    if (!auth.isAuthenticated()) {
      conf.unauthUrl(true);
      return m.route('/login');
    }
    var key  = m.route.param('pad');
    var gkey = m.route.param('group');
    if (window.confirm(conf.LANG.GROUP.INFO.CHAT_HISTORY_REMOVE_SURE)) {
      m.request({
        method: 'DELETE',
        url: conf.URLS.PAD + '/chathistory/' + key,
        data: { auth_token: auth.token() }
      }).then(function (resp) {
        console.log(resp);
        notif.success({ body: conf.LANG.GROUP.INFO.CHAT_HISTORY_REMOVE_SUCCESS });
        m.route('/mypads/group/' + gkey + '/view');
      }, function (err) {
        checkJwtErr(err);
        notif.error({ body: ld.result(conf.LANG, err.error) });
      });
    } else {
      m.route('/mypads/group/' + gkey + '/view');
    }
  };

  remove.view = function () {};

  /** 
  * ##checkJwtErr
  * For handling timeout error (check api.js for fn.checkJwt). 
  *
  * If error is confirmed to be incorrect token or session timeout (expired jwt),
  * this will send a logout api call (to do necessary server side processing) 
  * and handle response in the client side accordingly.
  *
  * Note: logout part copied (with minor modifications) from logout.js 
  *
  */

  var checkJwtErr = function (err) {
    if (err && (err.error === 'BACKEND.ERROR.AUTHENTICATION.SESSION_TIMEOUT' ||
         err.error === 'BACKEND.ERROR.AUTHENTICATION.TOKEN_INCORRECT')) {      
      if (!auth.isAuthenticated()) { return m.route('/login'); }
      m.request({
        method: 'GET',
        url: conf.URLS.LOGOUT,
        config: auth.fn.xhrConfig
      }).then(function () {
        /*
         * Fix pad authorship mixup
         * See https://framagit.org/framasoft/ep_mypads/issues/148
         */
        if (cookies.get('token')) {
          cookies.set('token-' + auth.userInfo().login, cookies.get('token'), { expires: 365 });
          cookies.remove('token');
        }
        auth.userInfo(null);
        localStorage.removeItem('token');
        localStorage.removeItem('exp');
        m.route('/login');
      }, function(err) {
        notif.error({ body: ld.result(conf.LANG, err.error) });
      });
      return true;
    }
    return false;
  }

  return remove;
}).call(this);
