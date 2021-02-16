/**
*  vim:set sw=2 ts=2 sts=2 ft=javascript expandtab:
*
*  # Setup 2FA module - contents created with help of passrecover.js 
*     and login.js as references
*
*  ## Description
*
*  This module contains the setup 2FA page
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
  var speakeasy = require('speakeasy');
  var qrcode = require('qrcode');

  var setup2fa = {};
  var secret, dataUrl, userLogin, setupFromLogin;

  /**
  * ## Controller
  *
  * Used for module state and actions.
  * And user submission.
  *
  */

  setup2fa.controller = function () {
    var c          = {};
    document.title = conf.LANG.USER.PROFILE + ' - ' + conf.SERVER.title;
    if (!auth.isAuthenticated() && !(localStorage.getItem('tempToken') && localStorage.getItem('tempLogin'))) {
      conf.unauthUrl(true);
      return m.route('/login');
    }
    if (!auth.userInfo()) {
      setupFromLogin = true;
    }
    if (auth.userInfo() && auth.userInfo().otpEnabled) {
      return m.route('/');
    }
    form.initFields(c, ['login', 'otp']);

    userLogin = auth.userInfo() ? auth.userInfo().login : localStorage.getItem('tempLogin');
    var authLabel = 'Etherpad-' + userLogin;
    var secret = speakeasy.generateSecret({
      name: authLabel
    });
    var secretOtpauthUrl = secret.otpauth_url;
    qrcode.toDataURL(secretOtpauthUrl, function(err,data) {
      dataUrl = data;      
    });    

    /**
    * `submit` internal calls the public API to login with given login and
    * password. It displays errors if needed or success and fixes local cached
    * data for the user. It also updates UI lang if needed.
    */

    c.submit = function (e) {
      e.preventDefault();
      var otp = document.querySelector('input[name=otp]').value;
      var verified = speakeasy.totp.verify({ secret: secret.ascii,
                                         encoding: 'ascii',
                                         token: otp });      
      if (!verified) {
        notif.error({ body: conf.LANG.BACKEND.ERROR.AUTHENTICATION.INVALID_OTP });
        return;
      }
      m.request({
        method: 'PUT',
        url: conf.URLS.SETUP_2FA,
        data: { login: userLogin, otpSecret: secret.base32 }
      }).then(setup2fa.setupSuccess,
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
    return m('form.form-horizontal.col-sm-8.col-sm-offset-2.well', {
      id: 'login-form', onsubmit: c.submit }, [
      m('div', {
        id: 'hide-when-ready',
        config: ready.checkLoop
      }, conf.LANG.USER.PLEASE_WAIT),
      m('fieldset.show-when-ready.hidden', [
        m('legend', conf.LANG.USER.SETUP_2FA),
        m('.form-group', [
          m('ol', [
              m('li', [ m('div.li-2fa', conf.LANG.USER.SETUP_2FA_STEP1),
                        m('img', {src:dataUrl})
                      ]
              ),
              m('li', [ m('div.li-2fa', conf.LANG.USER.SETUP_2FA_STEP2),
                        m('.col-sm-7', m('input.form-control', { name: 'otp' })),
                        m('input.btn.btn-success', {
                                    form: 'login-form',
                                    type: 'submit',
                                    value: conf.LANG.USER.VERIFY_CODE
                                  }
                        )
                      ]
                )
            ]),
          m('div.note-2fa', conf.LANG.USER.SETUP_2FA_NOTE)
          ])
        ])
      ]
    );
  };

  view.main = function (c) {
    var msgs     = conf.SERVER.loginMsg;
    var elements = [view.form(c)];
    var message;
    if (typeof(msgs) !== 'undefined') {
      if (typeof(msgs[conf.USERLANG]) !== 'undefined' && msgs[conf.USERLANG] !== '') {
        message = m('article', {class: 'alert bg-danger'}, m.trust(msgs[conf.USERLANG]));
        elements.unshift(message);
      } else if (typeof(msgs.en) !== 'undefined' && msgs.en !== '') {
        message = m('article', {class: 'alert bg-danger'}, m.trust(msgs.en));
        elements.unshift(message);
      }
    }
    elements.splice(0, 0, m('h2',
      conf.LANG.USER.PROFILE + ' : ' + userLogin));
    return m('section', { class: 'user' }, elements);
  };

  setup2fa.view = function (c) {
    return layout.view(view.main(c), user.view.aside.common(c));
  };

  setup2fa.setupSuccess = function (resp) {
    localStorage.removeItem('tempToken');
    localStorage.removeItem('tempLogin');
    localStorage.removeItem('tempTokenKey');
    if (setupFromLogin) {
      setup2fa.goBackToLogin();
    } else {
      setup2fa.continueLogin(resp);
    }
  };

  setup2fa.continueLogin = function (resp) {
    auth.userInfo(resp.user);
    notif.success({ body: 'Successfully enabled 2FA.' });
    m.route('/myprofile');
  };

  setup2fa.goBackToLogin = function () {
    localStorage.removeItem('login');
    notif.success({ body: 'Successfully enabled 2FA. Please re-login to proceed.' });
    m.route('/login');
  };

  return setup2fa;
}).call(this);
