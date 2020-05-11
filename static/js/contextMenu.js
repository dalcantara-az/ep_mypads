module.exports = (function() {
  'use strict';
  var selectedLineNumber;
  var lines = 0;

  var contextMenu = {};

  var notifyModal = require('ep_mypads/static/js/notifyModal'); 

  contextMenu.postAceInit = function(hook, context) {
    attachContextMenu();
    lines = 0;
    lines = $('iframe[name="ace_outer"]').contents().find('iframe').contents().find("#innerdocbody").contents().length;
  }
  
  function attachContextMenu() {
    var count = 0;
    var innerDocBody = $('iframe[name="ace_outer"]').contents().find('iframe').contents().find("#innerdocbody");
    
    innerDocBody.children().each(function() {
      var currentLine = count;
      var child = $(this);
      child.off('contextmenu');
      child.bind('contextmenu', function(e) {
        e.preventDefault();
        onRightClick(currentLine);
        drawContextMenu(e.clientX, e.clientY);
      })
      count++;
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
  
  contextMenu.aceSelectionChanged = function(hook, context){
    var selStart = context.rep.selStart;
    var selEnd = context.rep.selEnd;
    if((selStart[0] !== selEnd[0]) || (selStart[1] !== selEnd[1])){
      selectedLineNumber = selStart[0];
    }else{
      var padOuter = $('iframe[name="ace_outer"]').contents().find("body");
      var contextMenu = padOuter.find("#context_menu");
      selectedLineNumber = null;
      contextMenu.hide();
    }
  }
  
  contextMenu.aceKeyEvent = function(hook, context){
    if((context.evt.key == "Enter"||context.evt.key == "Backspace") && context.rep.alines.length != lines){
      lines = context.rep.alines.length;
      attachContextMenu();
    }
  }
  
  function onRightClick(lineNumber) {
    if (selectedLineNumber) {
      return;
    }
    var innerDocBody = $('iframe[name="ace_outer"]').contents().find('iframe').contents().find("#innerdocbody");
    innerDocBody.children().eq(lineNumber).selectText();
    selectedLineNumber = lineNumber;
  }
  
  
  function drawNotifyModal() {
    var padOuter = $('iframe[name="ace_outer"]').contents().find("body");
    if (padOuter.find('#notifyModal').length === 0) {
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
              console.log('notifying success!');
            } else {
              console.log('notifying failed');
            }
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
  
  function drawContextMenu(x, y){
    var padOuter = $('iframe[name="ace_outer"]').contents().find("body");
    var contextMenu = padOuter.find("#context_menu");
    var newX = (x + 60) + "px";
    var newY = (y + 20) + "px";
    var items = [
      {
        label: "Copy Link",
        onclick: function() {
          var padOuter = $('iframe[name="ace_outer"]').contents().find("body");
          var $textarea = $("<textarea>", {id: "text_to_copy"});
          var copiedText = getTextToCopy();
          $textarea.val(copiedText.text + '\n' + copiedText.url);
          padOuter.append($textarea);
          $textarea.copyText();
          $textarea.remove();
        }
      },
      {
        label: "Email selected text",
        onclick: function() {
          drawNotifyModal();
        }
      }
    ]
    if(contextMenu.length === 0){
      padOuter.append("<div id ='context_menu'></div>");
      contextMenu = padOuter.find("#context_menu");
      contextMenu.css("position", "absolute");
      contextMenu.css("width", "150px");
      contextMenu.css("left", newX);
      contextMenu.css("top", newY);
      contextMenu.css("border", "1px solid");
      contextMenu.css("border-color", "rgb(190, 190, 190)");
      contextMenu.css("background-color", "white");
      contextMenu.css("padding-top", "0px");
      contextMenu.css("padding-bottom", "0px");
      contextMenu.css("padding-right", "0px");
      contextMenu.css("padding-left", "0px");
      contextMenu.css("-webkit-box-shadow", "10px 7px 13px -8px rgba(0,0,0,0.43)");
      contextMenu.css("-moz-box-shadow", "10px 7px 13px -8px rgba(0,0,0,0.43)");
      contextMenu.css("box-shadow", "10px 7px 13px -8px rgba(0,0,0,0.43)");
      contextMenu.css("font-size", "14px");
      contextMenu.append("<ul id='context_menu_items' style='list-style:none; margin-left: 0px; padding-right: 0px;'></ul>");
      var menuItems = contextMenu.find('#context_menu_items');
      for (var i = 0; i < items.length; i++) {
        var $item = $("<li>", {"class": "context_menu_item"});
        $item.css("padding-left", "10px")
        $item.text(items[i].label);
        $item.hover(
          function(){
            $(this).css('background', '#E8E8E8');
          },function() {
            //mouse out
            $(this).css('background', '	#FFFFFF')
          }
        )
        $item.on('click', {
          item: items[i]
        }, function(event){
          event.data.item.onclick();
          contextMenu.hide();
        });
        menuItems.append($item);
      }
      menuItems.find('.context_menu_item').css("padding", "10px");
      menuItems.find('.context_menu_item').hover(function() {
        var item = $(this);
        item.css("background-color", "f8f8f8");
        item.css("cursor", "pointer");
      })
    }
    contextMenu.css("left", newX);
    contextMenu.css("top", newY);
    contextMenu.show();
  }
  
  return contextMenu;
}).call(this);

