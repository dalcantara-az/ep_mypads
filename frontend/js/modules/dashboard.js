module.exports = (function () {
  'use strict';
  // Global dependencies
  var m  = require('mithril');
  var ld = require('lodash');

  // Local dependencies
  var conf = require('../configuration.js');
  var auth = require('../auth.js');
  var u = auth.userInfo;
  var layout = require('./layout.js');
  var model = require('../model/group.js');
  var sortingPreferences = require('../helpers/sortingPreferences.js');
  var padWatch = require('./pad-watch.js');
  var padMark = require('./pad-mark.js');
  var notif   = require('../widgets/notification.js');
  var cookies = require('js-cookie');

  var dashboard = {};

  /**
  * ## Controller
  *
  * Used for module state and actions.
  */

  dashboard.controller = function () {
    if (!auth.isAuthenticated() || auth.isTokenExpired()) {
      conf.unauthUrl(true);
      localStorage.removeItem('token');
      localStorage.removeItem('exp');
      var errMsg ='BACKEND.ERROR.AUTHENTICATION.SESSION_TIMEOUT';
      notif.error({ body: ld.result(conf.LANG, errMsg) });
      return m.route('/login'); 
    }
    document.title = conf.LANG.DASHBOARD.TITLE + ' - ' + conf.SERVER.title;

    var c = {};

    /**
    * ### computePads
    *
    * `computePads` is an internal function that gathers user's pads.
    */

    c.computePads = function () {
      c.pads = [];
      m.request({
        method: 'GET',
        url: conf.URLS.PAD + '/getRelevantPads/' + auth.token() + '?auth_token=' + auth.token()
      }).then(function (resp) {  
      for(var i = 0; i < Object.keys(resp.value.pads).length; i++){
          c.pads.push(resp.value.pads[i]);
      }
      var len = Object.keys(c.pads).length;
      for(var i = 0; i < Object.keys(resp.value.watchlist.pads).length; i++){
        var exists = false;
        var index = 0;
        while(!exists && index < len){
          if(String(resp.value.watchlist.pads[i]._id).valueOf().trim() == String(c.pads[index]._id).valueOf().trim()){
            exists = true;
          }
          index++;
        } 
        if(!exists){
          c.pads.push(resp.value.watchlist.pads[i]);
        } 
        
      }
      var len = Object.keys(c.pads).length;
      for(var i = 0; i < Object.keys(resp.value.watchlist.padsFromGroups).length; i++){
        var exists = false;
        var index = 0;
       while(!exists && index < len){
         if(String(resp.value.watchlist.padsFromGroups[i]._id).valueOf().trim() == String(c.pads[index]._id).valueOf().trim()){
            exists = true;
          }
          index++;
        } 
        if(!exists){
          c.pads.push(resp.value.watchlist.padsFromGroups[i]);
        } 
        
      }
      for(var i = 0; i< Object.keys(c.pads).length; i++){
        var key = c.pads[i]._id;
        c.pads[i].lastEdited = resp.value.lastEdited[key].lastEdited;
      }

      }, function (err) {
        if (checkJwtErr(err)) { return; }
        notif.error({ body: ld.result(conf.LANG, err.error) });
      });
      
    };
    

    /**
    * ### computeSearchResults
    *
    * `computeSearchResults` is an internal function that gathers search groups
    * and pads.
    */

    c.computeSearchResults = function () {

      var items  = function (data) {
        return data;
      };
      if(c.results != null){
        c.searchResults = {
          pads: items(c.results.pads)
        };
      }
      else{
        c.searchResults = {
          pads: []
        };
      }
    };



  c.search       = m.prop('');
  c.filterSearch = function () {
    m.request({
      method: 'GET',
      url: conf.URLS.PAD + '/search?q=' + encodeURI(c.search()),
      data: {
        auth_token: auth.token(),
      }
    }).then(function (resp) {     
      c.headlines = resp.results.headlines;
      c.results ={
        pads: resp.results.pads
      }
      model.fetch(c.computeSearchResults());
      
    }, function (err) {
      checkJwtErr(err);
      notif.error({ body: ld.result(conf.LANG, err.error) });
    });
     
  };

   /**
  * ### sortBy
  *
  * `c.sortBy` function sort pads by the `field` argument.
  * If already sorted by the same field, it reverses order.
  */

 c.sortField = m.prop(sortingPreferences.lastEdited());
 c.sortAsc   = m.prop(sortingPreferences.padAsc());
 c.sortBy    = function (field, asc) {
   if (c.sortField() === field && typeof(asc) !== 'boolean') {
     c.sortAsc(!c.sortAsc());
   }
   c.sortField(field);
   var direction = c.sortAsc() ? 'asc' : 'desc';
   c.pads        = ld.sortByOrder(c.pads, field, direction);
   sortingPreferences.updateValues({
     padByField: c.sortField(),
     padAsc: c.sortAsc()
   });
 };

    // Bootstrapping
    if (ld.isEmpty(model.groups())) {
      model.fetch(c.computePads);
      model.fetch(c.computeSearchResults);
    } else {
      c.computePads();
      c.computeSearchResults();
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
        noneMsg = conf.LANG.GROUP.PAD.NONE;
    if (ld.size(c.pads) === 0) {
      return m('p', noneMsg);
    } else {
      
      return m('ul.list-unstyled', ld.map(c.pads, function (item) {
        var route;
        route = '/mypads/group/' + item.group + '/pad/view/' + item._id;
        return m('li', [
          m('a', { href: route, config: m.route }, item.name), 
          m('a', item.group),
        ]);
      }));
      
    }
  };

  view.pads   = ld.partialRight(view._items, 'pads');

  view._searchItems = function (c, type) {
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
  if (ld.size(c.searchResults[type]) === 0) {
    return m('p', noneMsg);
  } else {
    var keys = [];
    for(var i = 0; i< ld.size(c.searchResults[type]); i++){
      Object.keys(c.results.pads[i]).forEach(function(key) {
        keys[i]= key
      })
    }
    return m('ul.list-unstyled', ld.map(c.searchResults.pads, function (item) {
      var itemKey;
      Object.keys(item).forEach(function(key) {
          itemKey = key
      })
      var route;
      route = '/mypads/group/' + item[itemKey].group + '/pad/view/' + item[itemKey]._id;
      return m('li', [
        m('a', { href: route, config: m.route }, item[itemKey].name),
        m('p', { style: {fontSize: '12px'} }, m.trust(c.headlines[item[itemKey]._id])),
      ]);
    }));
    
  }
  };

  view.searchResults   = ld.partialRight(view._searchItems, 'pads');

  view.aside = function (c) {
    return m('section.user-aside', [
      m('section', [
        m('h2', conf.LANG.SEARCH.TITLE),
        m('.input-group', {class: "h2"}, [
          m('input.form-control', {
            type: 'search',
            placeholder: "Enter Text",
            minlength: 3,
            pattern: '.{3,}',
            value: c.search(),
            oninput: m.withAttr('value', c.search),
            onkeydown: function (e) {
              if (e.keyCode === 13) { // ENTER
                e.preventDefault();
                c.filterSearch();
              }
            }
          }),
          m('span.input-group-btn',
            m('button.btn.btn-default',
              { type: 'button', onclick: c.filterSearch  },
              conf.LANG.SEARCH.TITLE)
          ),
        ]),
        m('section.panel.panel-info', [
          m('.panel-heading',
            m('h3.panel-title', conf.LANG.GROUP.PAD.PADS)
          ),
          m('.panel-body', view.searchResults(c))
        ])
      ]),
      m('h2', conf.LANG.ACTIONS.HELP),
      m('article.well', m.trust(conf.LANG.DASHBOARD.HELP)),
    ]);
  };

  view.main = function (c) {
    
    return m('section', [
      m('h2', conf.LANG.DASHBOARD.TITLE),
      
      m('section.panel.panel-info', [
        m('.panel-heading',
          m('h3.panel-title', conf.LANG.GROUP.PAD.PADS)
        ),
        m('', view.pads(c))
      ])
    ]);
  };

  view.pads = function (c) {
   
    var GROUP   = conf.LANG.GROUP;
   
    var sortIcon = (function () {
      if (c.sortField()) {
        return (c.sortAsc() ? 'top' : 'bottom');
      } else {
        return 'arrow-combo';
      }
    })();
    var sortView = m('p.col-sm-6.text-right.small', [
      m('span', ' '+conf.LANG.GROUP.PAD.SORT_BY),
      m('button.btn.btn-default.btn-xs', {
        type: 'button',
        onclick: ld.partial(c.sortBy, 'ctime')
      }, [conf.LANG.GROUP.PAD.SORT_BY_CREATION+' ',
        m('i.small.glyphicon glyphicon-triangle-' + sortIcon)]
      ),
      m('button.btn.btn-default.btn-xs', {
        type: 'button',
        onclick: ld.partial(c.sortBy, 'name')
      }, [ conf.LANG.GROUP.PAD.SORT_BY_NAME+' ',
        m('i.small.glyphicon glyphicon-triangle-' + sortIcon)]),
        m('button.btn.btn-default.btn-xs', {
          type: 'button',
          onclick: ld.partial(c.sortBy, 'lastEdited')
        }, ["date modified"+' ',
          m('i.small.glyphicon glyphicon-triangle-' + sortIcon)]
        ),
        
    ]);
    var padView = (function () {
      if (ld.size(c.pads) === 0) {
        return m('p', conf.LANG.GROUP.PAD.NONE);
      } else {
        c.pads = ld.sortByOrder(c.pads, 'lastEdited', false);
        ld.partial(c.sortBy, 'lastEdited')
        return m('ul.list-group.col-sm-12', ld.map(c.pads, function (p) {
          if (typeof(p) === 'undefined') { return null; }

          var actions = [
          ];
          if (c.isAdmin) {
            actions.push(
              m('a.btn.btn-default.btn-xs', {
                href: route + '/pad/edit/' + p._id,
                config: m.route,
                title: conf.LANG.MENU.CONFIG
              }, [ m('i.glyphicon.glyphicon-wrench') ]),
              m('div.btn-group.dropdown', [
                m('button.btn.btn-default.btn-xs', {
                  'aria-haspopup': 'true',
                  'aria-expanded': 'false'
                }, [
                  m('i.glyphicon.glyphicon-trash.text-danger'),
                  m('span.caret')
                ]),
                m('ul.dropdown-content.dropdown-menu.dropdown-menu-right', [
                  m('li', [
                    m('a', {
                      href: route + '/pad/remove/chat/history/' + p._id,
                      config: m.route
                    }, [ conf.LANG.GROUP.REMOVE_CHAT_HISTORY ])
                  ]),
                  m('li.divider', { role: 'separator'}),
                  m('li', [
                    m('a', {
                      href: route + '/pad/remove/' + p._id,
                      config: m.route
                    }, [ conf.LANG.GROUP.REMOVE + ' ' + p.name ])
                  ]),
                ])
              ])
            );
          }
          var padName = p.name;
          return m('li.list-group-item.group-pad-item', {
              'data-padname': padName
            }, [
            (function () {
              if (!c.isGuest) {
                var isBookmarked = (auth.isAuthenticated()) ? (ld.includes(u().bookmarks.pads, p._id)) : false;
                if(u().watchlist!= null){
                  var isWatched = (auth.isAuthenticated()) ? (ld.includes(u().watchlist.pads, p._id)) : false;
                }
                else{
                  u().watchlist = {
                    groups: [],
                    pads: [],
                  };
                  var isWatched = false;
                }

                return m('button.btn.btn-link.btn-lg', {
                  title: (isBookmarked ? GROUP.UNMARK : GROUP.BOOKMARK),
                  onclick: function () { padMark(p); }
                }, [
                  m('i',
                    { class: 'glyphicon glyphicon-star' +
                      (isBookmarked ? '' : '-empty') })
                ]);
              }
            })(),
            (function () {
              if (!c.isGuest) {
                if(u().watchlist!= null){
                  var isWatched = ld.includes(u().watchlist.pads, p._id);
                }
                else{
                  u().watchlist = {
                    groups: [],
                    pads: [],
                  };
                }
                
                return m('button.btn.btn-link.btn-lg', {
                  title: (isWatched ? GROUP.UNWATCH : GROUP.WATCH),
                  onclick: function () { padWatch(p); }
                }, [
                  m('i',
                    { class: 'glyphicon glyphicon-heart' +
                      (isWatched ? '' : '-empty') })
                ]);
              }
            })(),
            (function (){
              var date = new Date(p.lastEdited);
              var month = date.getMonth() + 1;
              var day = date.getDate();
              var year = date.getFullYear();
              var hour = date.getHours();
              var minutes = date.getMinutes();
              if(minutes <= 9){
                minutes = "0"+ minutes;
              }

              return m('span.name', [
                m('a', {
                  href: '/mypads/group/'+ p.group + '/pad/view/' + p._id,
                  config: m.route,
                  title: conf.LANG.GROUP.VIEW
                }, padName),
                 m('span.pull-right', "Last Modified: "+ month + "/" + day + "/" + year + " - " + hour + ":" + minutes ),
                m('', "Folder " + p.group)
                ]);
            })()
          ]);
        }));
      }
    })();
    var padBlocks = [];
  
    padBlocks.push(padView);
    return m('section.panel-body', padBlocks);
  };


  dashboard.view = function (c) {
    return layout.view(view.main(c), view.aside(c));
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

  return dashboard;

}).call(this);
