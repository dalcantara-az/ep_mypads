var selectedLineNumber;
var lines = 0;
var loginOrEmails = [];

exports.aceSelectionChanged = function(hook, context){
  var selStart = context.rep.selStart;
  var selEnd = context.rep.selEnd;
  if((selStart[0] !== selEnd[0]) || (selStart[1] !== selEnd[1])){
    iT.show(selStart, selEnd);
  }else{
    iT.hide();
  }
}

exports.postAceInit = function(hook, context) {
  
  attachContextMenu();
  lines = 0;
  $('iframe[name="ace_outer"]').contents().find('iframe').contents().find("#innerdocbody").contents().each(function() {
    lines++;
  });
}

function attachContextMenu() {
  var count = 0;
  var innerDocBody = $('iframe[name="ace_outer"]').contents().find('iframe').contents().find("#innerdocbody");
  
  $(innerDocBody).children().each(function() {
    var currentLine = count;
    $(this).off('contextmenu');
    $(this).bind('contextmenu', function(e) {
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

exports.aceSelectionChanged = function(hook, context){
  var selStart = context.rep.selStart;
  var selEnd = context.rep.selEnd;
  if((selStart[0] !== selEnd[0]) || (selStart[1] !== selEnd[1])){
    selectedLineNumber = selStart[0];
  }else{
    var padOuter = $('iframe[name="ace_outer"]').contents().find("body");
    var contextMenu = $(padOuter).find("#context_menu");
    selectedLineNumber = null;
    contextMenu.hide();
  }
}

exports.aceKeyEvent = function(hook, context){
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
  $(innerDocBody).children().eq(lineNumber).selectText();
  selectedLineNumber = lineNumber;
}


function drawNotifyModal() {
  var padOuter = $('iframe[name="ace_outer"]').contents().find("body");
  var notifyModal = $(padOuter).find('#notifyModal');
  if (notifyModal.length === 0) {
    var baseURL = window.location.href.slice(0, window.location.href.split('/', 3).join('/').length);
    padOuter.append('<div id="notifyModal" class="modal"></div>');
    notifyModal = $(padOuter).find('#notifyModal');
    var $modalContent = $("<div>", {id: "notifyModalContent"});
    var $container = $("<div>", {"class": "container"});
    var $btnCloseModal = $('<span class="clickable display-topright">&times;</span>');
    $btnCloseModal.on('click', function(e) {
      $(notifyModal).fadeToggle(200);
    })
    $container.append($btnCloseModal);
    $container.append('<div style="font-size:large">Notify Users</div>');
    
    var $formUserSelect = $('<div style="padding-top: 10px; padding-bottom: 10px"></div>');
    $formUserSelect.append('<p style="padding-bottom: 5px; padding-top: 10px;">User Selection</p>');
    var $emailField = $('<input>', {id: 'emailField', 'type': 'text', 'placeholder': 'Email or Login'});
    $emailField.css("padding", "5px");
    $formUserSelect.append($emailField);
    $formUserSelect.append('<span style="margin-right:10px;"></span>')
    var $btnSelectUser = $('<button>', {'class': 'custom-button'});
    $btnSelectUser.text('ADD');
    $formUserSelect.append($btnSelectUser);
    var $msgUserNotExist = $('<div style="font-size: 12px; color: red; padding-top: 5px;">User does not exist</div>');
    $formUserSelect.append($msgUserNotExist);
    $msgUserNotExist.hide();
    $container.append($formUserSelect);

    $container.append('<p style="padding-bottom: 10px; padding-top: 10px;">Selected Users</p>');
    
    var $userList = $('<div>', {id: 'userList'});
    $container.append($userList);

    var $modalControls = $('<div>', {'class': 'display-bottomright'});
    var $btnCancel = $('<button>', {'class': 'custom-button'});
    $btnCancel.on('click', function(e) {
      $(notifyModal).fadeToggle(200);
    })
    $btnCancel.text('CANCEL')
    var $btnNotify = $('<button>', {'class': 'custom-button'});
    $btnNotify.on('click', function(e) {
      $.ajax({
        method: 'POST',
        url: baseURL +'/mypads/api/notify-users',
        data: {
          copiedText: getTextToCopy(),
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
      $(notifyModal).fadeToggle(200);
    })
    $btnNotify.text('SEND')
    $modalControls.append($btnCancel);
    $modalControls.append('<span style="margin-right:15px;"></span>')
    $modalControls.append($btnNotify);
    $container.append($modalControls);

    $modalContent.append($container);
    $(notifyModal).append($modalContent);
    $(notifyModal).on('click', function(e) {
      $(this).fadeToggle(200);
    });
    $modalContent.on('click', function(e) {
      return false;
    })
    $btnSelectUser.on('click', function(e) {
      var loginOrEmail = $emailField.val();
      if (loginOrEmails.includes(loginOrEmail)) {
        return;
      }
      
      console.log(baseURL);
      console.log(loginOrEmail);
      console.log('sending ajax request');
      $.ajax({
        method: 'GET',
        url: baseURL+'/mypads/api/user-exist/' + loginOrEmail,
        success: function(data, textStatus, jqXHR) {
          console.log('response: ');
          console.log(data);
          if (data.userExists === true) {
            $msgUserNotExist.hide();
            loginOrEmails.push(loginOrEmail);
            
            var $selectedUser = $("<span>" + loginOrEmail + "<span style='padding-left:5px; font-size: large' class = 'clickable'>&times;</span></span>");
            $selectedUser.css('background-color', "darkgray");
            $selectedUser.css('padding', "5px");
            $selectedUser.find('.clickable').css('cursor', 'pointer');
            $selectedUser.find('.clickable').on('click', function(e) {
              var index = loginOrEmails.indexOf(loginOrEmail);
              if (index > -1) {
                loginOrEmails.splice(index, 1);
              }
              $selectedUser.remove();
            });
            $userList.append($selectedUser);
          } else {
            $msgUserNotExist.show();
          }
        }
      });
    })

    $(notifyModal).css({
      "position": "absolute",
      "left": "0px",
      "top": "0px",
      "z-index":"3",
      "padding-top":"100px",
      "position":"fixed",
      "left":"0px",
      "top":"0px",
      "width":"100%",
      "height":"100%",
      "overflow":"auto",
      "background-color":"rgb(0,0,0)",
      "background-color":"rgba(0,0,0,0.4)"
    });

    $(notifyModal).find('.display-topright').css({
      "color": "#C4C4C4",
      "position":"absolute",
      "right":"20px",
      "top":"10px",
      "font-size": "xx-large"
    });

    $(notifyModal).find('.display-bottomright').css({
      "position":"absolute",
      "right":"20px",
      "bottom": "20px"
    });

    $(notifyModal).find('#notifyModalContent').css({
      "font-size": "14px",
      "cursor": "default",
      "margin":"auto",
      "background-color":"#fff",
      "position": "absolute",
      "padding": "20px",
      "left": "0px",
      "right": "0px",
      "outline":"0px",
      "width":"300px",
      "border-radius": "10px",
      "-webkit-box-shadow": "10px 7px 13px -8px rgba(0,0,0,0.43)",
      "-moz-box-shadow": "10px 7px 13px -8px rgba(0,0,0,0.43)",
      "box-shadow": "10px 7px 13px -8px rgba(0,0,0,0.43)",
    });

    $(notifyModal).find('.selected-user').css({
      "display": "inline-block",
      "padding":"1%",
      "width": "fit-content"
    });

    $(notifyModal).find('.clickable').css("cursor", "pointer");

    $(notifyModal).find('.custom-button').css({
      "background-color": "Transparent",
      "background-repeat":"no-repeat",
      "color": "#1C96CF",
      "border": "none",
      "cursor":"pointer",
      "overflow": "hidden",
      "outline":"none",
    });
  }
  $(notifyModal).find('#userList').empty();
  $(notifyModal).find('#emailField').val('');
  loginOrEmails = [];
  $(notifyModal).fadeToggle(250);

}

function getTextToCopy() {
  var innerDocWindow = $('iframe[name="ace_outer"]').contents().find('iframe')[0].contentWindow;
  return innerDocWindow.getSelection().toString() + '\n' + window.parent.parent.location.href + '?lineNumber=' + (selectedLineNumber + 1)
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
        $textarea.val(getTextToCopy());
        padOuter.append($textarea);
        $textarea.copyText();
        $textarea.remove();
      }
    },
    {
      label: "Notify",
      onclick: function() {
        drawNotifyModal();
      }
    }
  ]
  if(contextMenu.length === 0){
    padOuter.append("<div id ='context_menu'></div>");
    contextMenu = padOuter.find("#context_menu");
    $(contextMenu).css("position", "absolute");
    $(contextMenu).css("width", "150px");
    $(contextMenu).css("left", newX);
    $(contextMenu).css("top", newY);
    $(contextMenu).css("border", "1px solid");
    $(contextMenu).css("border-color", "rgb(190, 190, 190)");
    $(contextMenu).css("background-color", "white");
    $(contextMenu).css("border-radius", "10px");
    $(contextMenu).css("padding-top", "10px");
    $(contextMenu).css("padding-bottom", "10px");
    $(contextMenu).css("padding-right", "10px");
    $(contextMenu).css("-webkit-box-shadow", "10px 7px 13px -8px rgba(0,0,0,0.43)");
    $(contextMenu).css("-moz-box-shadow", "10px 7px 13px -8px rgba(0,0,0,0.43)");
    $(contextMenu).css("box-shadow", "10px 7px 13px -8px rgba(0,0,0,0.43)");
    $(contextMenu).css("font-size", "16px");
    $(contextMenu).append("<ul id='context_menu_items' style='list-style:none'></ul>");
    var menuItems = contextMenu.find('#context_menu_items');
    $(menuItems).css("padding-right", "10px");
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
        $(contextMenu).hide();
      });
      $(menuItems).append($item);
    }
    $(menuItems).find('.context_menu_item').css("padding-top", "10px");
    $(menuItems).find('.context_menu_item').css("padding-bottom", "10px");
    $(menuItems).find('.context_menu_item').hover(function() {
      $(this).css("background-color", "f8f8f8");
      $(this).css("cursor", "pointer");
    })
  }
  $(contextMenu).css("left", newX);
  $(contextMenu).css("top", newY);
  $(contextMenu).show();
}

