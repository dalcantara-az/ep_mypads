module.exports = (function() {
  'use strict';

  var selectedLineNumber;

  var toolbarAlert = {};

  var notifyModal = require('ep_mypads/static/js/notifyModal'); 
  
  var $padOuter;
  
  toolbarAlert.aceEditorCSS = function(hook, context) {
    return ["/ep_mypads/static/css/toolbarAlert.css"]
  }

  toolbarAlert.postAceInit = function(hook, context) {
    $padOuter =  $('iframe[name="ace_outer"]').contents().find("body");
    $padOuter.append($("<textarea>", {id: "text_to_copy"}));
    $padOuter.find("#text_to_copy").hide();
    selectedLineNumber = 0;
    drawToolbarAlert();
    attachLineOnclick();
  }

  toolbarAlert.aceSelectionChanged = function(hook, context) {
    selectedLineNumber = context.rep.selStart[0];
  }

  function attachLineOnclick() {
    var $sidedivinner = $padOuter.contents().find("#sidedivinner");
    $sidedivinner.on('click', function(e){
      var innerDocBody = $('iframe[name="ace_outer"]').contents().find('iframe').contents().find("#innerdocbody");
      var line = e.target;
      var lineNumber = $(line).text();
      innerDocBody.children().eq(lineNumber - 1).selectText();
    });
  }

  jQuery.fn.selectText = function() {
    var obj = this[0];
    var selection = obj.ownerDocument.defaultView.getSelection();
    var range = obj.ownerDocument.createRange();
    range.selectNodeContents(obj);
    selection.removeAllRanges();
    selection.addRange(range);
    return this;
  }
  
  jQuery.fn.copyText = function() {
    var obj = this[0];
    var ownerDocument = obj.ownerDocument;
    var textarea = ownerDocument.querySelector('#text_to_copy');
    textarea.focus({preventScroll: true});
    textarea.select();
    ownerDocument.execCommand('copy');
  }
  
  function drawNotifyModal() {
    if ($padOuter.find('#notifyModal').length === 0) {
      var baseURL = window.location.href.slice(0, window.location.href.split('/', 3).join('/').length);
      var onNotify = function(loginOrEmails) {
        var copiedText = getTextToCopy();
        $.ajax({
          method: 'POST',
          url: baseURL +'/mypads/api/notify-users',
          data: {
            auth_token: localStorage.getItem('token'),
            url: copiedText.url,
            text: copiedText.text,
            loginsOrEmails: loginOrEmails
          },
          success: function(data, textStatus, jqXHR) {
            if (data.success === true) {
              alert('Successfully notified selected users.');
            } else {
              alert('Something went wrong.');
            }
          },
          error: function(jqXHR, textStatus, errorThrown) {
            console.log(errorThrown);
            alert('Something went wrong.');
          }
        });
      }
      notifyModal.init(onNotify);
    }
    notifyModal.toggle();
  }
  
  function getTextToCopy() {
    var innerDocWindow = $('iframe[name="ace_outer"]').contents().find('iframe')[0].contentWindow;
    return {
      url: window.location.href.slice(0, window.location.href.indexOf('?')) + '?lineNumber=' + (selectedLineNumber + 1),
      text: innerDocWindow.getSelection().toString()
    }
  }
  
  function drawToolbarAlert(){
    var $toolbar = $('.menu_left');
    $toolbar.append('<li class="separator"></li>');
    $toolbar.append(
      '<li id="btnCopyLink" data-type="button">' +
        '<a class="" title="Copy Link" aria-label="Copy Link">' +
          '<button class="buttonicon buttonicon-copylink" title="Copy Link" aria-label="Copy Link"></button>' +
        '</a>' +
      '</li>'
    );
    $toolbar.append(
      '<li id="btnEmailText" data-type="button">' +
        '<a class="" title="Email Selected Text" aria-label="Email Selected Text">' +
          '<button class="buttonicon buttonicon-emailtext" title="Email Selected Text" aria-label="Email Selected Text"></button>' +
        '</a>' +
      '</li>'
    );
    
    $toolbar.find('#btnCopyLink').on('click', function(e) {
      var $textarea = $padOuter.find('#text_to_copy');
      $textarea.show();
      var copiedText = getTextToCopy();
      $textarea.val(copiedText.text + '\n' + copiedText.url);
      $textarea.copyText();
      $textarea.hide();
    });
    
    $toolbar.find('#btnEmailText').on('click', function(e) {
      drawNotifyModal();
    });
    
    $toolbar.find('.buttonicon-copylink').text('\ud83d\udccb');
    $toolbar.find('.buttonicon-emailtext').text('\u2709');
  }

  return toolbarAlert;
  
}).call(this);