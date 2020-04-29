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
    var model     = require('../model/group.js');
  
    var search = {};
  
    /**
    * ## Controller
    *
    * Used for module state and actions.
    */
  
    search.controller = function () {
      if (!auth.isAuthenticated()) {
        conf.unauthUrl(true);
        return m.route('/login');
      }
      document.title = conf.LANG.SEARCH.TITLE + ' - ' + conf.SERVER.title;
  
      var c = {};
  
      /**
      * ### computeSearchResults
      *
      * `computeSearchResults` is an internal function that gathers search groups
      * and pads.
      */
  
      c.computeSearchResults = function () {

        var items  = function (data) {
          return  ld(data)
            .values()
            // //.sortBy('name')
            .value();
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

      var x = {
        method: "GET",
        url: conf.URLS.PAD + "/search",
        params: {q: encodeURI(c.search())}
      }

      console.log(x);
      m.request({
        method: 'GET',
        url: conf.URLS.PAD + '/search?q=' + encodeURI(c.search()),
      }).then(function (resp) {     
        c.headlines = resp.results.headlines;
        c.results ={
          pads: resp.results.pads
        }
        model.fetch(c.computeSearchResults());
        
      }, function (err) {
        notif.error({ body: ld.result(conf.LANG, err.error) });
      });
       
    };
  
      // Bootstrapping
      if (ld.isEmpty(model.groups())) {
        model.fetch(c.computeSearchResults);
      } else {
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
  
    view.pads   = ld.partialRight(view._items, 'pads');
  
    view.aside = function () {
      return m('section.user-aside', [
        m('h2', conf.LANG.ACTIONS.HELP),
        m('article.well', m.trust(conf.LANG.SEARCH.HELP))
      ]);
    };
  
    view.main = function (c) {
      return m('section', [
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
          m('.panel-body', view.pads(c))
        ])
      ]);
    };
  
    search.view = function (c) {
      return layout.view(view.main(c), view.aside(c));
    };
  
    return search;
  
  }).call(this);
  