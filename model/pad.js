/**
* # Pad Model
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
*/

module.exports = (function () {
  'use strict';

  // Dependencies
  var removePad;
  try {
    // Normal case : when installed as a plugin
    removePad = require('ep_etherpad-lite/node/db/PadManager').removePad;
  }
  catch (e) {
    // Testing case : noop function
    removePad = function () {};
  }
  var ld = require('lodash');
  var cuid = require('cuid');
  var slugg = require('slugg');
  var common = require('./common.js');
  var storage = require('../storage.js');
  var group = require('./group.js');
  var PPREFIX = storage.DBPREFIX.PAD;
  var UPREFIX = storage.DBPREFIX.USER;
  var GPREFIX = storage.DBPREFIX.GROUP;

  /**
  * ## Description
  *
  * The pad module contains business logic for private pads. These belong to
  * groups and can have their own visibility settings.
  *
  * A pad can be viewed as an object like :
  *
  * var pad = {
  *   _id: 'autoGeneratedUniqueString',
  *   name: 'title',
  *   group: 'idOfTheLinkedGroup',
  *   visibility: 'restricted',
  *   users: ['u1', 'u2'],
  *   password: null,
  *   readonly: true
  * };
  */

  var pad = {};

  /**
  * ## Internal functions
  *
  * These functions are not private like with closures, for testing purposes,
  * but they are expected be used only internally by other MyPads functions.
  * They are tested through public functions and API.
  */

  pad.fn = {};

  /**
  * ### assignProps
  *
  * `assignProps` takes params object and assign defaults if needed.
  * It creates :
  *
  * - a `users` array, empty if `visibility` is not 'restricted', with given
  *   keys otherwise
  * - a `visibility` string, *null* or with *restricted*, *private* or *public*
  * - a `password` string, *null* by default
  * - a `readonly` boolean, *null* by default
  *
  * *null* fields are intented to tell MyPads that group properties should be
  * applied here. `assignProps` returns the pad object.
  */

  pad.fn.assignProps = function (params) {
    var p = params;
    var u = { name: p.name, group: p.group };
    if (p.visibility === 'restricted' && ld.isArray(p.users)) {
      u.users = ld.filter(p.users, ld.isString);
    } else {
      u.users = [];
    }
    var vVal = ['restricted', 'private', 'public'];
    var v = p.visibility;
    u.visibility = (ld.isString(v) && ld.includes(vVal, v)) ? v : null;
    u.password = ld.isString(p.password) ? p.password : null;
    u.readonly = ld.isBoolean(p.readonly) ? p.readonly : null;
    return u;
  };

  /**
  * ### checkSet
  *
  * `checkSet` is an async function that ensures that all given users exist.
  * If true, it calls `fn.set`, else it will return an *Error*. It takes :
  *
  * - a `p` pad object
  * - a `callback` function returning an *Error* or *null* and the `p` object.
  */

  pad.fn.checkSet = function (p, callback) {
    var keys = ld.map(p.users, function (v) { return UPREFIX + v; });
    keys.push(GPREFIX + p.group);
    common.checkMultiExist(keys, function (err, res) {
      if (err) { return callback(err); }
      var e = new Error('BACKEND.ERROR.PAD.ITEMS_NOT_FOUND');
      if (!res) { return callback(e); }
      pad.fn.set(p, callback);
    });
  };

  /**
  * ### indexGroups
  *
  * `indexGroups` is an asynchronous function which handles secondary indexes
  * for *group.pads* and *user.bookmarks.pads* after pad creation, update,
  * removal. It takes :
  *
  * - a `del` boolean to know if we have to delete key from index or add it
  * - the `pad` object
  * - a `callback` function, returning *Error* or *null* if succeeded
  */

  pad.fn.indexGroups = function (del, pad, callback) {
    var removeFromBookmarks = function (g) {
      var uids = ld.union(g.admins, g.users);
      var ukeys = ld.map(uids, function (u) { return UPREFIX + u; });
      storage.fn.getKeys(ukeys, function (err, users) {
        if (err) { return callback(err); }
        users = ld.reduce(users, function (memo, u, k) {
          if (ld.includes(u.bookmarks.pads, pad._id)) {
            ld.pull(u.bookmarks.pads, pad._id);
            memo[k] = u;
          }
          return memo;
        }, {});
        storage.fn.setKeys(users, function (err) {
          if (err) { return callback(err); }
          _set(g);
        });
      });
    };
    var _set = function (g) {
      storage.db.set(GPREFIX + g._id, g, function (err) {
        if (err) { return callback(err); }
        callback(null);
      });
    };
    storage.db.get(GPREFIX + pad.group, function (err, g) {
      if (err) { return callback(err); }
      if (del) {
        ld.pull(g.pads, pad._id);
        removeFromBookmarks(g);
      } else {
        if (!ld.includes(g.pads, pad._id)) {
          g.pads.push(pad._id);
          _set(g);
        } else {
          callback(null);
        }
      }
    });
  };

  /**
  * ### set
  *
  * `set` is internal function that sets the pad into the database.
  *
  * It takes, as arguments :
  *
  * - the `p` pad object
  * - the `callback` function returning an *Error* or *null* and the `p`
  *   object.
  */

  pad.fn.set = function (p, callback) {
    storage.db.set(PPREFIX + p._id, p, function (err) {
      if (err) { return callback(err); }
      var indexFn = function (err) {
        if (err) { return callback(err); }
        pad.fn.indexGroups(false, p, function (err) {
          if (err) { return callback(err); }
          callback(null, p);
        });
      };
      if (p.moveGroup) {
        pad.fn.indexGroups(true, { _id: p._id, group: p.moveGroup }, indexFn);
      } else {
        indexFn(null);
      }
    });
  };

  /**
  * ## Public functions
  *
  * ### get
  *
  *  This function uses `common.getDel` with `del` to *false* and *PPREFIX*
  *  fixed. It will takes mandatory key string and callback function. See
  *  `common.getDel` for documentation.
  */

  pad.get = ld.partial(common.getDel, false, PPREFIX);

  /**
  * ### set
  *
  * This function adds a new pad or updates properties of an existing one.
  * It fixes a flag if the group has changed, to ensure correct local index
  * updates. It checks the fields, throws error if needed, sets defaults
  * options. As arguments, it takes mandatory :
  *
  * - `params` object, with
  *
  *   - a `name` string that can't be empty
  *   - an `group` string, the unique key identifying the linked required group
  *   - `visibility`, `password`, `readonly` the same strings as for
  *   `model.group`, but optional : it will takes the group value if not
  *   defined
  * - `users` array, with ids of users invited to read and/or edit the pad, for
  *   restricted visibility only
  * - `callback` function returning *Error* if error, *null* otherwise and the
  *   pad object;
  * - a special `edit` boolean, defaults to *false* for reusing the function for
  *   set (edit) an existing pad.
  */

  pad.set = function (params, callback) {
    common.addSetInit(params, callback, ['name', 'group']);
    var p = pad.fn.assignProps(params);
    var check = function () {
      group.fn.handlePassword(p, function (err, password) {
        if (err) { return callback(err); }
        if (password) { p.password = password; }
        pad.fn.checkSet(p, callback);
      });
    };
    if (params._id) {
      p._id = params._id;
      storage.db.get(PPREFIX + p._id, function(err, res) {
        if (err) { return callback(err); }
        if (!res) {
          return callback(new Error('BACKEND.ERROR.PAD.INEXISTENT'));
        }
        if (res.group !== p.group) { p.moveGroup = res.group; }
        if ((res.visibility === 'private') && !p.password) {
          p.password = res.password;
        }
        check();
      });
    } else {
      p._id = (slugg(p.name) + '-' + cuid.slug());
      check();
    }
  };

  /**
  * ### del
  *
  *  This function uses `common.getDel` with `del` to *false* and *PPREFIX*
  *  fixed.  It will take mandatory key string and callback function. See
  *  `common.getDel` for documentation.
  *
  * It also removes the pad from Etherpad instance, using the internal API.
  * It uses the `callback` function to handle secondary indexes for groups.
  */

  pad.del = function (key, callback) {
    if (!ld.isFunction(callback)) {
      throw new TypeError('BACKEND.ERROR.TYPE.CALLBACK_FN');
    }
    common.getDel(true, PPREFIX, key, function (err, p) {
      if (err) { return callback(err); }
      removePad(p._id);
      pad.fn.indexGroups(true, p, callback);
    });
  };

  /**
  * ## Helpers functions
  *
  *  TODO
  *  Helper here are public functions created to facilitate interaction with
  *  the API and improve performance avoiding extra checking.
  */

  return pad;

}).call(this);
