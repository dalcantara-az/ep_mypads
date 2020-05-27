require('ep_mypads/static/js/jquery-ui');

module.exports = (function() {
  'use strict';
  
  var autocomplete = {};

  var lineToReplace;
  var atIndex;
  var length;
  var userList = [];
  var userList = ['@folder', '@admins', '@invited', '@all'];
  var admins = [];
  var invited = [];
  var users = [];

  var authToken;

  var $padOuter; 
  var $innerDocFrame;
  var $innerDocBody;
  var innerDocWindow;
  var $suggestionsMarker = $("<span id='suggestionsMarker' style='position:absolute;'></span>");
  var $inputField = $("<input id='inputField' type='hidden'>");

  var notifyModal = require('ep_mypads/static/js/notifyModal'); 

  autocomplete.postAceInit = function(hook, context) {
    var padId = context.pad.getPadId();
    authToken = getUrlVars()['auth_token'];
    var baseURL = window.location.href.slice(0, window.location.href.split('/', 3).join('/').length);
    $.ajax({
      url: baseURL +'/mypads/api/user-suggestions',
      dataType: "json",
      data: {
        auth_token: authToken,
        pad_id: padId
      },
      success: function(data) {
        Object.keys(data.users).forEach(function(key) {
          userList.push(key);
          users.push(key);
        })
        admins = data.admins;
        invited = data.invited;
      }
    });
    $padOuter = $('iframe[name="ace_outer"]').contents().find("body");
    $innerDocFrame = $padOuter.find('iframe');
    $innerDocBody = $innerDocFrame.contents().find("#innerdocbody");
    
    innerDocWindow = $padOuter.find('iframe')[0].contentWindow;
    $padOuter.find('iframe').contents().find("body").on('keydown', function(e) {
      var $autocompleteMenu;
      if (e.key === "ArrowDown") {
        $autocompleteMenu = $padOuter.find('.ui-autocomplete');
        if ($autocompleteMenu.length === 0 || !$autocompleteMenu.is(':visible')) {
          return;
        }
        e.preventDefault();
        var $focusedItem = $autocompleteMenu.find('.ui-menu-item.ui-state-focus');
        $focusedItem.removeClass('ui-state-focus');
        var $nextItem = $focusedItem.next();
        if ($nextItem.length === 0) {
          $autocompleteMenu.children().first().addClass('ui-state-focus');
        } else {
          $nextItem.addClass('ui-state-focus');
        }
      } else if (e.key === "ArrowUp") {
        $autocompleteMenu = $padOuter.find('.ui-autocomplete');
        if ($autocompleteMenu.length === 0 || !$autocompleteMenu.is(':visible')) {
          return;
        }
        e.preventDefault();
        var $focusedItem = $autocompleteMenu.find('.ui-menu-item.ui-state-focus');
        $focusedItem.removeClass('ui-state-focus');
        var $nextItem = $focusedItem.prev();
        if ($nextItem.length === 0) {
          $autocompleteMenu.children().last().addClass('ui-state-focus');
        } else {
          $nextItem.addClass('ui-state-focus');
        }
      } else if (e.key === "Enter") {
        $autocompleteMenu = $padOuter.find('.ui-autocomplete');
        if ($autocompleteMenu.length === 0 || !$autocompleteMenu.is(':visible')) {
          return;
        }
        e.preventDefault();
        var $focusedItem = $autocompleteMenu.find('.ui-menu-item.ui-state-focus');
        var textToInsert = $focusedItem.text();
        replaceText(lineToReplace, atIndex + 1, length, textToInsert);
      }
    })
    $padOuter.append($suggestionsMarker);
    $padOuter.append($inputField);
  }

  autocomplete.aceEditorCSS = function(hook, context) {
    return [];
  }

  autocomplete.aceSelectionChanged = function(hook, context) {
    if (!$inputField.autocomplete) {
      return;
    }
    var query = getQuery(context);
    if (query !== null) {
      drawSuggestions(query);
    } else if ($inputField.autocomplete("instance") !== undefined) {
      $inputField.autocomplete("close");
    }
  }

  autocomplete.aceKeyEvent = function(hook, context) {
    var rect = innerDocWindow.getSelection().getRangeAt(0).getBoundingClientRect();
    var innerDocPadding = {
      left: parseInt($innerDocFrame.css('padding-left'), 10),
      top: parseInt($innerDocFrame.css('padding-top'), 10)
    };
    var outerDocPadding = {
      left: parseInt($padOuter.css('padding-left'), 10),
      top: parseInt($padOuter.css('padding-top'), 10)
    };
    $suggestionsMarker.css('left', (rect.left + innerDocPadding.left + outerDocPadding.left) + 'px');
    $suggestionsMarker.css('top', (rect.bottom + innerDocPadding.top + outerDocPadding.top) + 'px');
  }

  function getQuery(context) {
    var text = context.rep.alltext.split("\n");
    var line = context.rep.selStart[0];
    var column = context.rep.selStart[1] - 1;
    var query = "";
    for (var i = column; i >= 0; i--) {
      var char = text[line].charAt(i);
      if (char === ' ') {
        return null;
      }
      if (char === '@') {
        if (i - 1 < 0 || text[line].charAt(i - 1) == ' ') {
          lineToReplace = line;
          atIndex = i;
          length = column - i;
          return query;
        } else {
          return null;
        }
      } 
      query = char + query;
    }
    
    return null;
  }

  function drawSuggestions(query) {
    $inputField.autocomplete({
      source: userList,
      minLength: 0,
      position: {
        my: "left top",
        at: "left top",
        of: $suggestionsMarker
      },
      autoFocus: true,
      select: function(event, ui) {
        event.preventDefault();
        replaceText(lineToReplace, atIndex + 1, length, ui.item.label);
      }
    });
    $inputField.autocomplete("search", query);
  }

  function replaceText(line, startIndex, length, textToInsert) {
    var substrInd = 0;
    if (textToInsert.startsWith('@')) {
      substrInd = 1;
    }
    var $line = $innerDocBody.children().eq(line);
    var count = 0;
    var $container;
    for (var i = 0; i < $line.children().length; i++) {
      var text = $line.children().eq(i).text();
      if (count + text.length > startIndex) {
        $container = $line.children().eq(i);
        break;
      }
      count += text.length;
    }
    if ($container === undefined && length === 0) {
      $line.children().last().text($line.children().last().text() + textToInsert.substr(substrInd) + ' ');
    } else {
      var oldText = $container.text();
      var newText = oldText.substr(0, startIndex - count) + textToInsert.substr(substrInd) + ' ' + oldText.substr(startIndex - count + length);
      $container.text(newText);
    }
    $inputField.autocomplete("close");
    drawNotifyModal(textToInsert);
  
  }

  function drawNotifyModal(text) {
    var recipients = [];
    if (text.startsWith('@')) {
      var group = text.substr(1);
      if (group === 'all') {
        recipients = users;
      } else if (group === 'folder') {
        recipients = admins.concat(invited);
      } else if (group === 'admins') {
        recipients = admins;
      } else if (group === 'invited') {
        recipients = invited;
      }
    } else {
      recipients.push(text);
    }
    notifyModal.show({
      text: text,
      recipients: recipients,
    }, {
      url: window.location.href.slice(0, window.location.href.indexOf('?')) + '?lineNumber=' + (lineToReplace + 1),
      text: ""
    });
  }
  
  function getUrlVars() {
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++) {
      hash = hashes[i].split('=');
      vars.push(hash[0]);
      vars[hash[0]] = hash[1];
    }
    var hashes = window.location.href.slice(window.location.href.indexOf('#') + 1).split('&');
    for(var i = 0; i < hashes.length; i++) {
      hash = hashes[i].split('=');
      vars.push(hash[0]);
      vars[hash[0]] = hash[1];
    }
    return vars;
  }

  return autocomplete;

}).call(this);