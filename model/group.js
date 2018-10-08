/**
*  vim:set sw=2 ts=2 sts=2 ft=javascript expandtab:
*
*  # Group Model
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
  var ld             = require('lodash');
  var cuid           = require('cuid');
  var slugg          = require('slugg');
  var asyncMod       = require('async');
  var storage        = require('../storage.js');
  var common         = require('./common.js');
  var commonGroupPad = require ('./common-group-pad.js');
  var userCache      = require('./user-cache.js');
  var deletePad      = require('./pad.js').del;
  var GPREFIX        = storage.DBPREFIX.GROUP;
  var UPREFIX        = storage.DBPREFIX.USER;
  var PPREFIX        = storage.DBPREFIX.PAD;

  /**
  * ## Description
  *
  * Groups belongs to users. Each user can have multiple groups of pads.
  *
  * A group object can be represented like :
  *
  * var group = {
  *   _id: 'autoGeneratedUniqueString',
  *   name: 'group1',
  *   pads: [ 'padkey1', 'padkey2' ],
  *   admins: [ 'userkey1', 'userkey2' ],
  *   users: [ 'ukey1' ],
  *   visibility: 'restricted' || 'public' || 'private',
  *   password: 'secret',
  *   readonly: false,
  *   tags: ['important', 'domain1'],
  *   allowUsersToCreatePads: false,
  *   archived: false
  * };
  *
  */

  var group = {};

  /**
  * ## Public Functions
  *
  * ### get
  *
  *  Group reading
  *
  *  This function uses `common.getDel` with `del` to *false* and `GPREFIX`
  *  fixed. It will takes mandatory key string and callback function. See
  *  `common.getDel` for documentation.
  */

  group.get = ld.partial(common.getDel, false, GPREFIX);

  /**
  * ## getWithPads
  *
  * This function uses `group.get` to retrieve the group record, plus it
  * returns list of attached pads. As `group.get`, it takes `gid` group unique
  * identifier and a `callback` function. In case of success, it returns
  * *null*, the *group* object and an Object of *pads* (where keys are _ids).
  */

  group.getWithPads = function (gid, callback) {
    if (!ld.isString(gid)) {
      throw new TypeError('BACKEND.ERROR.TYPE.KEY_STR');
    }
    if (!ld.isFunction(callback)) {
      throw new TypeError('BACKEND.ERROR.TYPE.CALLBACK_FN');
    }
    group.get(gid, function (err, g) {
      if (err) { return callback(err); }
      if (g.pads.length === 0) {
        return callback(null, g, {});
      }
      var padsKeys = ld.map(g.pads, function (p) { return PPREFIX + p; });
      storage.fn.getKeys(padsKeys, function (err, pads) {
        if (err) { return callback(err); }
        pads = ld.reduce(pads, function (memo, val, key) {
          key       = key.substr(PPREFIX.length);
          memo[key] = val;
          return memo;
        }, {});
        return callback(null, g, pads);
      });
    });
  };

  /**
  * ### getByUser
  *
  * `getByUser` is an asynchronous function that returns all groups for a
  * defined user, using `storage.fn.getKeys`. It takes :
  *
  * - a `user` object
  * - a `withExtra` boolean, for gathering or not pads information alongside
  *   with groups, with the help of `getPadsAndUsersByGroups` private function
  * - a `callback` function, called with *error* if needed, *null* and the
  *   results, an object with keys and groups values, otherwise.
  *
  */

  group.getByUser = function (user, withExtra, callback) {
    if (!ld.isObject(user) || !ld.isArray(user.groups)) {
      throw new TypeError('BACKEND.ERROR.TYPE.USER_INVALID');
    }
    if (!ld.isBoolean(withExtra)) {
      throw new TypeError('BACKEND.ERROR.TYPE.WITHEXTRA_BOOL');
    }
    if (!ld.isFunction(callback)) {
      throw new TypeError('BACKEND.ERROR.TYPE.CALLBACK_FN');
    }
    storage.fn.getKeys(
      ld.map(user.groups, function (g) { return GPREFIX + g; }),
      function (err, groups) {
        if (err) { return callback(err); }
        groups = ld.reduce(groups, function (memo, val, key) {
          key       = key.substr(GPREFIX.length);
          memo[key] = val;
          return memo;
        }, {});
        if (withExtra) {
          group.fn.getPadsAndUsersByGroups(groups, callback);
        } else {
          callback(null, groups);
        }
      }
    );
  };

  /**
  * ### getBookmarkedGroupsByUser
  *
  * `getBookmarkedGroupsByUser` is an asynchronous function that returns all
  * bookmarked groups for a defined user, using `storage.fn.getKeys`. It takes :
  *
  * - a `user` object
  * - a `callback` function, called with *error* if needed, *null* and the
  *   results, an object with keys and groups values, otherwise.
  *
  */

  group.getBookmarkedGroupsByUser = function (user, callback) {
    if (!ld.isObject(user) || !ld.isArray(user.bookmarks.groups)) {
      throw new TypeError('BACKEND.ERROR.TYPE.USER_INVALID');
    }
    if (!ld.isFunction(callback)) {
      throw new TypeError('BACKEND.ERROR.TYPE.CALLBACK_FN');
    }
    storage.fn.getKeys(
      ld.map(user.bookmarks.groups, function (g) { return GPREFIX + g; }),
      function (err, groups) {
        if (err) { return callback(err); }
        groups = ld.reduce(groups, function (memo, val, key) {
          key       = key.substr(GPREFIX.length);
          memo[key] = val;
          return memo;
        }, {});
        callback(null, groups);
      }
    );
  };

  /**
  * ### set
  *
  * This function adds a new group or updates an existing one.
  * It checks the fields, throws error if needed, set defaults options. As
  * arguments, it takes mandatory :
  *
  * - `params` object, with
  *
  *   - a `name` string that can't be empty
  *   - an optional `description` string
  *   - an `admin` string, the unique key identifying the initial administrator
  *   of the group
  *   - `visibility`, a string defined as *restricted* by default to invited
  *   users. Can be set to *public*, letting non authenticated users access to
  *   all pads in the group with the URL, or *private*, protected by a password
  *   phrase chosen by the administrator
  *   - `readonly`, *false* on creation. If *true*, pads that will be linked to
  *   the group will be set on readonly mode
  *   - `password` string field, only usefull if visibility has been fixed to
  *   private, by default an empty string
  * - `users` and `admins` arrays, with ids of users invited to read and/or edit
  *   pads, for restricted visibility only; and group administrators
  *
  * - `callback` function returning *Error* if error, *null* otherwise and the
  *   group object.
  *
  * `set` creates an empty `pads` array in case of creation, otherwise it just
  * gets back old value. `pads` array contains ids of pads attached to the
  * group via `model.pad` creation or update. Also, `password` is repopulated
  * from old value if the group has already been set as *private* and no
  * `password` has been given.
  *
  *   Finally, in case of new group, it sets the unique identifier to the name
  *   slugged and suffixes by random id generator and uses a special ctime
  *   field for epoch time.
  */

  group.set = function (params, callback) {
    common.addSetInit(params, callback, ['name', 'admin']);
    var g     = group.fn.assignProps(params);
    var check = function () {
      commonGroupPad.handlePassword(g, function (err, password) {
        if (err) { return callback(err); }
        if (password) { g.password = password; }
        group.fn.checkSet(g, callback);
      });
    };
    if (params._id) {
      g._id = params._id;
      storage.db.get(GPREFIX + g._id, function (err, res) {
        if (err) { return callback(err); }
        if (!res) {
          return callback(new Error('BACKEND.ERROR.GROUP.INEXISTENT'));
        }
        g.pads = res.pads;
        if ((res.visibility === 'private') && !g.password) {
          g.password = res.password;
        }
        g.ctime = res.ctime;
        check();
      });
    } else {
      g._id   = (slugg(g.name) + '-' + cuid.slug());
      g.pads  = [];
      g.ctime = Date.now();
      check();
    }
  };


  /**
  * ### del
  *
  * Group removal
  *
  *  This function uses `common.getDel` with `del` to *true* and *GPREFIX*
  *  fixed. It will takes mandatory key string and callback function. See
  *  `common.getDel` for documentation.
  *
  *  It uses the `callback` function to handle secondary indexes for users and
  *  pads.
  */

  group.del = function (key, callback) {
    if (!ld.isFunction(callback)) {
      throw new TypeError('BACKEND.ERROR.TYPE.CALLBACK_FN');
    }
    common.getDel(false, GPREFIX, key, function (err, gr) {
      if (err) { return callback(err); }
      group.fn.cascadePads(gr, function(err) {
        if (err) { return callback(err); }
        common.getDel(true, GPREFIX, key, function (err, g) {
          if (err) { return callback(err); }
          var uids = ld.union(g.admins, g.users);
          group.fn.indexUsers(true, g._id, uids, callback);
        });
      });
    });
  };

  /**
  * ### resign
  *
  * `resign` os an asynchronous function that resigns current user from the
  * given group. It checks if the user is currently a user or administrator of
  * the group and accept resignation, except if the user is the unique
  * administrator. It takes care of internal index for the user.
  *
  * It takes :
  *
  * - `gid` group unique identifier;
  * - 'uid' user unique identifier;
  * - `callback` function calling with  *error* if error or *null* and the
  *   updated group otherwise.
  */

  group.resign = function (gid, uid, callback) {
    if (!ld.isString(gid) || !(ld.isString(uid))) {
      throw new TypeError('BACKEND.ERROR.TYPE.ID_STR');
    }
    if (!ld.isFunction(callback)) {
      throw new TypeError('BACKEND.ERROR.TYPE.CALLBACK_FN');
    }
    group.get(gid, function (err, g) {
      if (err) { return callback(err); }
      var users = ld.union(g.admins, g.users);
      if (!ld.includes(users, uid)) {
        return callback(new Error('BACKEND.ERROR.GROUP.NOT_USER'));
      }
      if ((ld.size(g.admins) === 1) && (ld.first(g.admins) === uid)) {
        return callback(new Error('BACKEND.ERROR.GROUP.RESIGN_UNIQUE_ADMIN'));
      }
      ld.pull(g.admins, uid);
      ld.pull(g.users, uid);
      storage.db.set(GPREFIX + g._id, g, function (err) {
        if (err) { return callback(err); }
        storage.db.get(UPREFIX + uid, function (err, u) {
          if (err) { return callback(err); }
          ld.pull(u.groups, gid);
          ld.pull(u.bookmarks.groups, gid);
          storage.db.set(UPREFIX + uid, u, function (err) {
            if (err) { return callback(err); }
            return callback(null, g);
          });
        });
      });
    });
  };

  /**
  * ### inviteOrShare
  *
  * `inviteOrShare` is an asynchronous function that check if given data, users
  * or admins logins, are correct and transforms it to expected values : unique
  * identifiers, before saving it to database.
  *
  * It takes :
  *
  * - `invite` boolean, *true* for user invitation, *false* for admin sharing;
  * - `gid` group unique identifier;
  * - array of users `loginsOrEmails`;
  * - `callback` function calling with  *error* if error or *null* and the
  *   updated group otherwise, plus accepted and refused invitations logins or
  *   emails.
  *
  * It takes care of exclusion of admins and users : admin status is a
  * escalation of user.
  *
  * As login list should be exhaustive, it also takes care or reindexing user
  * local groups.
  */

  group.inviteOrShare = function (invite, gid, loginsOrEmails, callback) {
    if (!ld.isBoolean(invite)) {
      throw new TypeError('BACKEND.ERROR.TYPE.INVITE_BOOL');
    }
    if (!ld.isString(gid)) {
      throw new TypeError('BACKEND.ERROR.TYPE.GID_STR');
    }
    if (!ld.isArray(loginsOrEmails)) {
      throw new TypeError('BACKEND.ERROR.TYPE.LOGINS_ARR');
    }
    if (!ld.isFunction(callback)) {
      throw new TypeError('BACKEND.ERROR.TYPE.CALLBACK_FN');
    }
    var users = userCache.fn.getIdsFromLoginsOrEmails(loginsOrEmails);
    group.get(gid, function (err, g) {
      if (err) { return callback(err); }
      var removed;
      if (invite) {
        // Remove users from admin before setting them as invited
        var toRemoveFromAdmins = ld.intersection(g.admins, users.uids);
        g.admins               = ld.filter(g.admins, function(n) {
          return (ld.indexOf(toRemoveFromAdmins, n) === -1);
        });
        if (ld.size(g.admins) === 0) {
          return callback(
            new Error('BACKEND.ERROR.GROUP.RESIGN_UNIQUE_ADMIN')
          );
        }

        // Setting users as invited
        removed = ld.difference(g.users, users.uids);
        g.users = ld.unique(ld.reject(users.uids,
          ld.partial(ld.includes, g.admins)));
      } else {
        // Remove users from invite before setting them as admins
        var toRemoveFromUsers = ld.intersection(g.users, users.uids);
        g.users               = ld.filter(g.users, function(n) {
          return (ld.indexOf(toRemoveFromUsers, n) === -1);
        });

        // Setting users as admins
        removed  = ld.difference(g.admins, users.uids);
        g.admins = ld.unique(ld.reject(users.uids,
          ld.partial(ld.includes, g.users)));
        if ((ld.size(g.admins)) === 0) {
          return callback(
            new Error('BACKEND.ERROR.GROUP.RESIGN_UNIQUE_ADMIN')
          );
        }
      }
      // indexUsers with deletion for full reindexation process
      group.fn.indexUsers(true, g._id, removed, function (err) {
        if (err) { return callback(err); }
        group.fn.set(g, function (err, g) {
          if (err) { return callback(err); }
          callback(null, g, ld.omit(users, 'uids'));
        });
      });
    });
  };

  /**
  *  ## Helper Functions
  *
  *  Helper here are public functions created to facilitate interaction with
  *  the API and improve performance, avoiding extra checking when not needed.
  *  TODO : may be written to improve API usage
  */

  group.helper = {};

  /**
  * ### linkPads
  *
  *  `linkPads` is a function to attach new pads to an existing group.
  *  It takes mandatory arguments :
  *
  *  - the pad `_id`entifier, a string
  *  - `add`, a string for only one addition, an array for multiple adds.
  */

  group.helper.linkPads    = ld.noop;

  group.helper.unlinkPads  = ld.noop;

  /**
  * ### inviteUsers
  * string or array
  */

  group.helper.inviteUsers = ld.noop;

  /**
  * ### setAdmins
  * string or array
  */

  group.helper.setAdmins   = ld.noop;

  /**
  * ### setPassword
  * string of false
  */

  group.helper.setPassword = ld.noop;

  /**
  * ### setPublic
  * boolean
  */

  group.helper.setPublic   = ld.noop;

  /**
  * ### archive
  * boolean
  */

  group.helper.archive     = ld.noop;

  /**
  *  ## Internal Functions
  *
  * These functions are not private like with closures, for testing purposes,
  * but they are expected be used only internally by other MyPads functions.
  * All of these are tested through public API.
  */

  group.fn = {};

  /**
  * ### assignProps
  *
  * `assignProps` takes params object and assign defaults if needed.
  * It creates :
  *
  * - an `admins` array, unioning admin key to optional others admins
  * - a `users` array, empty or with given keys
  * - a `pads` array, empty on creation, can't be fixed either
  * - a `visibility` string, defaults to *restricted*, with only two other
  *   possibilities : *private* or *public*
  * - a `password` string, *null* by default
  * - a `readonly` boolean, *false* by default
  *
  * It returns the group object.
  */

  group.fn.assignProps = function (params) {
    var p = params;
    var g = { name: p.name };

    g.description = (ld.isString(p.description) ? p.description                    : '');
    p.admins      = ld.isArray(p.admins)        ? ld.filter(p.admins, ld.isString) : [];
    g.admins      = ld.union([ p.admin ], p.admins);
    g.users       = ld.uniq(p.users);

    var v    = p.visibility;
    var vVal = ['restricted', 'private', 'public'];

    g.visibility             = (ld.isString(v) && ld.includes(vVal, v)) ? v                        : 'restricted';
    g.password               = ld.isString(p.password)                  ? p.password               : null;
    g.readonly               = ld.isBoolean(p.readonly)                 ? p.readonly               : false;
    g.allowUsersToCreatePads = ld.isBoolean(p.allowUsersToCreatePads)   ? p.allowUsersToCreatePads : false;
    g.archived               = ld.isBoolean(p.archived)                 ? p.archived               : false;
    g.tags                   = ld.isArray(p.tags)                       ? p.tags                   : [];
    return g;
  };

  /**
  * ### cascadePads
  *
  * `cascadePads` is an asynchronous function which handle cascade removals
  * after group removal. It takes :
  *
  * - the `group` object
  * - a `callback` function, returning *Error* or *null* if succeeded
  */

  group.fn.cascadePads = function (group, callback) {
    if (!ld.isEmpty(group.pads)) {
      asyncMod.map(group.pads, deletePad, function(err, res) {
        if (err) { return callback(err); }
        var e = new Error('BACKEND.ERROR.GROUP.CASCADE_REMOVAL_PROBLEM');
        if (!res) { return callback(e); }
        callback(null);
      });
    } else {
      callback(null);
    }
  };

  /**
  * ### indexUsers
  *
  * `indexUsers` is an asynchronous function which handles secondary indexes
  * for *users.groups* after group creation, update, removal. It takes :
  *
  * - a `del` boolean to know if we have to delete key from index or add it
  * - the group `gid` unique identifier
  * - `uids`, an array of user keys
  * - a `callback` function, returning *Error* or *null* if succeeded
  */

  group.fn.indexUsers = function (del, gid, uids, callback) {
    var usersKeys = ld.map(uids, function (u) { return UPREFIX + u; });
    storage.fn.getKeys(usersKeys, function (err, users) {
      if (err) { return callback(err); }
      ld.forIn(users, function (u, k) {
        // When deleting the user, storage.fn.getKeys(usersKeys)
        // returns undefined because the user record has already
        // been deleted
        if (typeof(u) !== 'undefined') {
          if (del) {
            ld.pull(u.groups, gid);
            ld.pull(u.bookmarks.groups, gid);
          } else if (!ld.includes(u.groups, gid)) {
            u.groups.push(gid);
          }
          users[k] = u;
        }
      });
      storage.fn.setKeys(users, function (err) {
        if (err) { return callback(err); }
        return callback(null);
      });
    });
  };

  /**
  * ### set
  *
  * `set` is internal function that set the user group into the database.
  * It takes care of secondary indexes for users and pads by calling
  * `indexUsers`.
  *
  * It takes, as arguments :
  *
  * - the `g` group object
  * - the `callback` function returning an *Error* or *null* and the `g`
  *   object.
  */

  group.fn.set = function (g, callback) {
    storage.db.set(GPREFIX + g._id, g, function (err) {
      if (err) { return callback(err); }
      var uids = ld.union(g.admins, g.users);
      group.fn.indexUsers(false, g._id, uids, function (err) {
        if (err) { return callback(err); }
        return callback(null, g);
      });
    });
  };

  /**
  * ### checkSet
  *
  * `checkSet` will ensure that all users and pads exist. If true, it calls
  * `fn.set`, else it will return an *Error*. `checkSet` takes :
  *
  * - a `g` group object
  * - a `callback` function returning an *Error* or *null* and the `g` object.
  */

  group.fn.checkSet = function (g, callback) {
    var pre     = ld.curry(function (pre, val) { return pre + val; });
    var admins  = ld.map(g.admins, pre(UPREFIX));
    var users   = ld.map(g.users, pre(UPREFIX));
    var pads    = ld.map(g.pads, pre(PPREFIX));
    var allKeys = ld.union(admins, users, pads);
    common.checkMultiExist(allKeys, function (err, res) {
      if (err) { return callback(err); }
      if (!res) {
        var e = new Error('BACKEND.ERROR.GROUP.ITEMS_NOT_FOUND');
        return callback(e);
      }
      group.fn.set(g, callback);
    });
  };

  /**
  * ### getPadsAndUsersByGroups
  *
  * `getPadsAndUsersByGroups` is an asynchronous private function which return
  * *pads* and *users* objects from an object of *group* objects (key: group).
  * It also takes a classic `callback` function.
  */

  group.fn.getPadsAndUsersByGroups = function (groups, callback) {
    var defs   = { pads: PPREFIX, users: UPREFIX };
    var addPfx = function (pfx, values) {
      return ld.map(values, function (v) { return pfx + v; });
    };
    var keys = ld.reduce(groups, function (memo, val) {
      memo.pads  = ld.union(memo.pads, addPfx(PPREFIX, val.pads));
      memo.users = ld.union(memo.users, addPfx(UPREFIX, val.users),
        addPfx(UPREFIX, val.admins));
      return memo;
    }, { pads: [], users: [] });
    storage.fn.getKeys(ld.flatten(ld.values(keys)), function (err, res) {
      if (err) { return callback(err); }
      res = ld.reduce(res, function (memo, val, key) {
        var field;
        ld.forIn(keys, function (vals, f) {
          if (ld.includes(vals, key)) { field = f; }
        });
        key              = key.substr(defs[field].length);
        memo[field][key] = val;
        return memo;
      }, { groups: groups, pads: {}, users: {} });
      callback(null, res);
    });
  };

  /**
   * ### count
   *
   * Returns the number of groups of the MyPads instance
   * As arguments, it takes mandatory :
   * - a `callback` function
   */

  group.count = function(callback) {
    storage.db.findKeys(GPREFIX + '*', null, function (err, res) {
      if (err) { return callback(err); }
      return callback(null, ld.size(res));
    });
  };

  return group;


}).call(this);
