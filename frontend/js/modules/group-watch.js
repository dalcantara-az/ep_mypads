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
  var cookies = require('js-cookie');

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
    var unwatch;
    if (ld.includes(user.watchlist.groups, gid)) {
      ld.pull(user.watchlist.groups, gid);
      unwatch = true;
    } else {
      user.watchlist.groups.push(gid);
      unwatch = false;
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
      if (unwatch === true) {
        notif.success({ body: conf.LANG.GROUP.UNWATCH_SUCCESS });
      } else {
        notif.success({ body: conf.LANG.GROUP.WATCH_SUCCESS });
      }
      if(c!=null){
        model.fetch(c.computeGroups);
      }
      if (successFn) { successFn(); }
    }, function (err) {
      checkJwtErr(err);
      return notif.error({ body: ld.result(conf.LANG, err.error) });
    });
  };
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

}).call(this);
  