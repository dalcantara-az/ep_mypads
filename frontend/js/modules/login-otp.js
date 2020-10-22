/**
*  vim:set sw=2 ts=2 sts=2 ft=javascript expandtab:
*
*  # Login OTP module - contents created with help of passrecover.js 
*     and login.js as references
*
*  ## Description
*
*  This module contains the login otp page
*/

module.exports = (function () {
  // Global dependencies
  var m       = require('mithril');
  var ld      = require('lodash');
  var cookies = require('js-cookie');

  // Local dependencies
  var conf   = require('../configuration.js');
  var auth   = require('../auth.js');
  var form   = require('../helpers/form.js');
  var notif  = require('../widgets/notification.js');
  var layout = require('./layout.js');
  var user   = require('./user.js');
  var ready  = require('../helpers/ready.js');

  var login = {};

  /**
  * ## Controller
  *
  * Used for module state and actions.
  * And user submission.
  *
  */

  login.controller = function () {
    var c          = {};
    document.title = conf.SERVER.title;
    form.initFields(c, ['login', 'otp']);

    /**
    * `submit` internal calls the public API to login with given login and
    * password. It displays errors if needed or success and fixes local cached
    * data for the user. It also updates UI lang if needed.
    */

    c.submit = function (e) {
      e.preventDefault();
      var $otp = document.querySelector('input[name=otp]');
      c.data.otp($otp.value);
      c.data.login(localStorage.getItem('login'));
      c.data.token = localStorage.getItem('tempTokenKey');
      m.request({
        method: 'POST',
        url: conf.URLS.LOGIN_OTP,
        data: c.data
      }).then(login.getLogged,
      function (err) {
        notif.error({ body: ld.result(conf.LANG, err.error) });
      });
    };
    return c;
  };

  /**
  * ## Views
  *
  * Nothing special here, just simple `main` and `form` views.
  */

  var view = {};

  view.form = function (c) {

    if (conf.SERVER.authMethod !== 'cas') {
      return m('form.form-horizontal.col-sm-8.col-sm-offset-2.well', {
        id: 'login-form', onsubmit: c.submit }, [
        m('div', {
          id: 'hide-when-ready',
          config: ready.checkLoop
        }, conf.LANG.USER.PLEASE_WAIT),
        m('fieldset.show-when-ready.hidden', [
          m('legend', conf.LANG.USER.MYPADS_ACCOUNT),
          m('.form-group', [
            m('.col-sm-4', m('label', { for: 'otp' }, [ conf.LANG.USER.OTP ])),
            m('.col-sm-7', m('input.form-control', {
          name: 'otp'
        }))
          ]),
          m('input.btn.btn-success.pull-right', {
            form: 'login-form',
            type: 'submit',
            value: conf.LANG.USER.LOGIN
          })
        ])
      ]);
    }
  };

  view.main = function (c) {
    var children = [ m('span', conf.LANG.USER.FORM) ];
    var msgs     = conf.SERVER.loginMsg;
    var message;
    if (typeof(msgs) !== 'undefined') {
      if (typeof(msgs[conf.USERLANG]) !== 'undefined' && msgs[conf.USERLANG] !== '') {
        message = m('article', {class: 'alert bg-danger'}, m.trust(msgs[conf.USERLANG]));
      } else if (typeof(msgs.en) !== 'undefined' && msgs.en !== '') {
        // fallback to english
        message = m('article', {class: 'alert bg-danger'}, m.trust(msgs.en));
      }
    }
    if (conf.SERVER.openRegistration && conf.SERVER.authMethod === 'internal') {
      children.push(m('a.small',
        { href: '/subscribe', config: m.route },
        conf.LANG.USER.ORSUB)
      );
    }
    var opts = { class: 'user' };
    if (conf.SERVER.authMethod === 'cas' && typeof auth.userInfo() === 'undefined') {
      opts.config = login.casLogin;
    }
    var mainArray = [m('h2', children)];
    if (typeof(message) !== 'undefined') {
      mainArray.push(message);
    }
    mainArray.push(view.form(c));
    return m('section', opts, mainArray);
  };

  login.view = function (c) {
    return layout.view(view.main(c), user.view.aside.common(c));
  };

  login.casLogin = function (element, isInitialized) {
    if (isInitialized) { return; }

    var params = window.location.search.substring(1);
    var ticket = params.match(new RegExp('.*&ticket=([^&]*).*'));
    if (!ld.isNull(ticket)) {
      m.request({
        method: 'POST',
        url: conf.URLS.CASLOGIN,
        data: {ticket: ticket[1]}
      }).then(login.getLogged,
      function (err) {
        notif.error({ body: ld.result(conf.LANG, err.error) });
      });
    } else {
      var loc         = window.location;
      var service     = encodeURIComponent(loc.origin+loc.pathname+'?/login');
      window.location = conf.SERVER.authCasSettings.serverUrl+'/login?service='+service;
    }
  };

  login.getLogged = function (resp) {
    auth.userInfo(resp.user);
    
    localStorage.setItem('token', resp.token);
    localStorage.removeItem('tempTokenKey');
    

    /*
     * Fix pad authorship mixup
     * See https://framagit.org/framasoft/ep_mypads/issues/148
     */
    var myPadsAuthorCookie = resp.user.eplAuthorToken;
    if (myPadsAuthorCookie) {
      // 60 days
      cookies.set('token', myPadsAuthorCookie, { expires: 60 });
    } else {
      var browserAuthorCookie = cookies('token');
      if (browserAuthorCookie) {
        // 365 days
        cookies.set('token-' + resp.user.login, browserAuthorCookie, { expires: 365 });
      }
    }
    

    var lang = auth.userInfo().lang;
    if (lang !== conf.USERLANG) {
      conf.updateLang(lang);
    }
    document.title = ' - ' + conf.LANG.USER.AUTH.WELCOME + ' ' +
      resp.user.login + conf.SERVER.title;
    notif.success({ body: conf.LANG.USER.AUTH.SUCCESS });

    var unauthUrl = conf.unauthUrl();
    if (!ld.isEmpty(unauthUrl)) {
      window.location = unauthUrl;
    } else {
      m.route('/');
    }
    
  };
  return login;
}).call(this);
