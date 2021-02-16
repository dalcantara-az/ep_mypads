/**
*  vim:set sw=2 ts=2 sts=2 ft=javascript expandtab:
*
*  # Admin Users Form edition module
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
*  This module, reserved to admins, allows to edit user profile.
*  It relies heavily on subscription module.
*/

module.exports = (function () {
  // Global dependencies
  var m  = require('mithril');
  var ld = require('lodash');

  // Local dependencies
  var conf      = require('../configuration.js');
  var auth      = require('../auth.js');
  var notif     = require('../widgets/notification.js');
  var layout    = require('./layout.js');
  var form      = require('../helpers/form.js');
  var subscribe = require('./subscribe.js');
  var cookies = require('js-cookie');

  var admin = {};

  /**
  * ## Controller
  *
  * Used to check authentication and state.
  */

  admin.controller = function () {
    if (!auth.isAdmin() || auth.isTokenExpired()) {
      if (auth.isTokenExpired()) {
        notif.error({ body: ld.result(conf.LANG, 'BACKEND.ERROR.AUTHENTICATION.SESSION_TIMEOUT') });
      }
      return m.route('/admin'); 
    }
    document.title = conf.LANG.ADMIN.FORM_USER_EDIT + ' - ' + conf.SERVER.title;

    var c = {
      adminView: m.prop(true),
      profileView: m.prop(false),
      user: m.prop(false)
    };

    var init = function () {
      c.fields = ['login', 'password', 'passwordConfirm', 'email', 'firstname',
        'lastname', 'organization', 'padNickname', 'lang', 'otpEnabled', 'color', 'hideHelp'];
      form.initFields(c, c.fields);
      var u = c.user();
      ld.forEach(c.fields, function (f) {
        if (!ld.startsWith(f, 'password')) {
          c.data[f] = m.prop(u[f]);
        }
      });
    };

    /**
    * #### submit
    *
    * This function :
    *
    * - uses the public API to check if given `passwordCurrent` is valid;
    * - then updates data as filled, taking care of password change with the
    *   help of the `passwordUpdate` function;
    * - notifies *errors* and *success*;
    * - updates the local cache of `auth.userInfo`.
    */

    var errfn = function (err) {
      if (!checkJwtErr(err)) {
        m.route('/admin/users');
      }
      return notif.error({ body: ld.result(conf.LANG, err.error) });
    };

    c.submit = {
      profileSave: function (e) {
        e.preventDefault();
        var pass = c.data.password();
        if (pass && (pass !== c.data.passwordConfirm())) {
          return notif.warning({ body: conf.LANG.USER.ERR.PASSWORD_MISMATCH });
        }
        m.request({
          method: 'PUT',
          url: conf.URLS.USER + '/' + c.data.login(),
          data: ld.assign(c.data, { auth_token: auth.admToken() })
        }).then(function (resp) {
          auth.userInfo(resp.value);
          notif.success({ body: conf.LANG.USER.AUTH.PROFILE_SUCCESS });
        }, errfn);
      },
      disable2fa : function (e) {
        e.preventDefault();
        var confirm = window.confirm(conf.LANG.USER.INFO.DISABLE_2FA_SURE);
        if (confirm) {
          m.request({
            method: 'PUT',
            url: conf.URLS.DISABLE_2FA,
            data: {login: c.data.login(), auth_token: auth.admToken()}
          }).then(function (resp) {
            c.data.otpEnabled(false);
            notif.success({ body: conf.LANG.USER.DISABLE_2FA_SUCCESS });
          }, errfn);
        }
      }
    };

    m.request({
      method: 'GET',
      url: conf.URLS.USER + '/' + m.route.param('login'),
      data: { auth_token: auth.admToken() }
    }).then(function (resp) {
      c.user(resp.value);
      init();
    }, errfn);

    return c;
  };

  /**
  * ## Views
  */

  var view = {};

  view.main = function (c) {
    var elements = [
      m('h2', conf.LANG.ADMIN.FORM_USER_EDIT + ' ' + c.user().login),
      subscribe.views.form(c)
    ];
    return m('section', { class: 'user' }, elements);
  };

  view.aside = function () {
    return m('section.user-aside', [
      m('h2', conf.LANG.ACTIONS.HELP),
      m('article.well', m.trust(conf.LANG.ADMIN.HELP_USER_EDIT))
    ]);
  };

  admin.view = function (c) {
    return layout.view(
      view.main(c),
      view.aside()
    );
  };
  
  /** 
  * ##checkJwtErr
  * For handling timeout error (check api.js for fn.checkJwt). 
  *
  * If error is confirmed to be incorrect token or session timeout (expired jwt),
  * this will send a logout api call (to do necessary server side processing) 
  * and handle response in the client side accordingly.
  *
  * Note: logout part copied (with minor modifications) from admin-logout.js
  *
  */

  var checkJwtErr = function (err) {
    if (err && (err.error === 'BACKEND.ERROR.AUTHENTICATION.SESSION_TIMEOUT' ||
         err.error === 'BACKEND.ERROR.AUTHENTICATION.TOKEN_INCORRECT')) {
      if (!auth.isAdmin()) {  
        m.route('/admin'); 
        return true;
      }
      m.request({
        method: 'GET',
        url: conf.URLS.AUTH + '/admin/logout',
        data: { auth_token: auth.admToken() }
      }).then(function () {
        document.title = conf.SERVER.title;
        localStorage.removeItem('admToken');
        localStorage.removeItem('exp');
        m.route('/admin');
      }, function(err) {
        notif.error({ body: ld.result(conf.LANG, err.error) });
      });
      return true;
    }
    return false;
  }

  return admin;

}).call(this);
