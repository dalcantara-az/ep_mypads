require('ep_mypads/static/js/jquery-ui');

module.exports = (function() {
  'use strict';
  
  var autocomplete = {};

  var lineToReplace;
  var atIndex;
  var length;
  var userList = [];
  var authToken;

  var $padOuter; 
  var $innerDocFrame;
  var $innerDocBody;
  var innerDocWindow;
  var $suggestionsMarker = $("<span id='suggestionsMarker' style='position:absolute;'></span>");
  var $inputField = $("<input id='inputField' type='hidden'>");

  var notifyModal = require('ep_mypads/static/js/notifyModal'); 

  autocomplete.postAceInit = function(hook, context) {
    authToken = getUrlVars()['auth_token'];
    var baseURL = window.location.href.slice(0, window.location.href.split('/', 3).join('/').length);
    $.ajax({
      url: baseURL +'/mypads/api/autocomplete',
      dataType: "json",
      data: {
        auth_token: authToken,
      },
      success: function(data) {
        Object.keys(data.users).forEach(function(key) {
          userList.push(key);
        })
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
      $line.children().last().text($line.children().last().text() + textToInsert + ' ');
    } else {
      var oldText = $container.text();
      var newText = oldText.substr(0, startIndex - count) + textToInsert + ' ' + oldText.substr(startIndex - count + length);
      $container.text(newText);
    }
    $inputField.autocomplete("close");
    drawNotifyModal(textToInsert);
  
  }

  function drawNotifyModal(recipient) {
    if ($padOuter.find('#notifyModal').length === 0) {
      var baseURL = window.location.href.slice(0, window.location.href.split('/', 3).join('/').length);
      var onNotify = function(loginOrEmails) {
        var copiedText = {
          url: window.location.href.slice(0, window.location.href.indexOf('?')) + '?lineNumber=' + (lineToReplace + 1),
          text: ""
        }
        $.ajax({
          method: 'POST',
          url: baseURL +'/mypads/api/notify-users',
          data: {
            auth_token: authToken,
            url: copiedText.url,
            text: copiedText.text,
            loginsOrEmails: loginOrEmails
          },
          success: function(data, textStatus, jqXHR) {
            if (data.success === true) {
              alert('The mentioned user was successfully notified.');
            } else {
              alert('Something went wrong.');
            }
          }
        });
      }
      notifyModal.init(onNotify, authToken);
    }
    notifyModal.toggle(recipient);
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