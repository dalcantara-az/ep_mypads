module.exports = (function() {
  'use strict';

  var loginOrEmails = [];
  var userList = [];
  var modal = {};

  modal.aceEditorCSS = function(hook, context) {
    return [
      "/ep_mypads/static/css/notifyModal.css",
      "/ep_mypads/static/css/jquery-ui.css",
    ];
  }

  modal.toggle = function(recipient) {
    var padOuter = $('iframe[name="ace_outer"]').contents().find("body");
    var notifyModal = padOuter.find('#notifyModal');
    if (recipient) {
      notifyModal.find('#notifyModalContent').css('height', '50px');
      notifyModal.find('.toggle-multiple').hide();
      notifyModal.find('.toggle-single').text('Send notification to ' + recipient + '?');
      notifyModal.find('.toggle-single').show();
      loginOrEmails = [recipient];
      notifyModal.fadeToggle(250)
    } else {
      notifyModal.find('#notifyModalContent').css('height', '200px');
      notifyModal.find('.toggle-multiple').show();
      notifyModal.find('.toggle-single').hide();
      notifyModal.find('#userList').empty();
      notifyModal.find('#emailField').val('');
      notifyModal.find('#msgUserNotExist').hide();
      loginOrEmails = [];
      notifyModal.fadeToggle(250);
    }
  }

  modal.init = function(onNotify) {
    var baseURL = window.location.href.slice(0, window.location.href.split('/', 3).join('/').length);
    $.ajax({
      url: baseURL +'/mypads/api/autocomplete',
      dataType: "json",
      data: {
        auth_token: localStorage.getItem('token'),
      },
      success: function(data) {
        Object.keys(data.users).forEach(function(key) {
          userList.push(key);
          userList.push(data.users[key].email);
        })
      }
    });
    var padOuter = $('iframe[name="ace_outer"]').contents().find("body");
    var modalHTML = 
      '<div id="notifyModal" class="modal">' +
        '<div id="notifyModalContent">' +
          '<div class="container" style="height:200px; display:inline-block;">' +
            '<span id="btnCloseModal" class="display-topright clickable">&times;</span>' +
            '<div class="toggle-multiple" style="font-size:large">Notify Users</div>' +
            
            '<div class="toggle-multiple" style="padding-top: 10px; padding-bottom: 10px">' +
              '<p style="padding-bottom: 5px; padding-top: 10px;">User Selection</p>' +
              '<input id="emailField" type="text" style="padding:5px; width:200px;" placeholder="Email or Login">' +
              '<span style="margin-right:10px;"></span>' +
              '<button id="btnSelectUser" class="custom-button">ADD</button>' +
              '<div id="msgUserNotExist" style="font-size: 12px; color: red; padding-top: 5px;">User does not exist</div>' +
            '</div>' +
            '<p class="toggle-multiple" style="padding-bottom: 10px; padding-top: 10px;">Selected Users</p>' +
              
            '<div class="toggle-multiple" id="userList">' +
            '</div>' +

            '<div class="toggle-single" style="font-size:large"></div>' + 
            '<div class = "display-bottomright">' +
              '<button id="btnCancel" class="custom-button">CANCEL</button>' +
              '<span style="margin-right:15px;"></span>' +
              '<button id="btnNotify" class="custom-button">SEND</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    padOuter.append(modalHTML);
    
    var notifyModal = padOuter.find("#notifyModal");
    var $msgUserNotExist = notifyModal.find("#msgUserNotExist");
    var $btnCloseModal = notifyModal.find("#btnCloseModal");
    var $btnCancel = notifyModal.find("#btnCancel");
    var $btnNotify = notifyModal.find("#btnNotify");
    var $btnSelectUser = notifyModal.find("#btnSelectUser");
    var $modalContent = notifyModal.find("#notifyModalContent");
    var $emailField = notifyModal.find("#emailField");
    var $userList = notifyModal.find("#userList");
    var baseURL = window.location.href.slice(0, window.location.href.split('/', 3).join('/').length);
      
    $emailField.autocomplete({
      source: userList,
      select: function(event, ui) {
        $emailField.val(ui.item.label);
        $btnSelectUser.click();
      },
    });
    
    $msgUserNotExist.hide();
    $btnCloseModal.on('click', function(e) {
      notifyModal.fadeToggle(200);
    })
    $btnCancel.on('click', function(e) {
      notifyModal.fadeToggle(200);
    })
    notifyModal.on('click', function(e) {
      $(this).fadeToggle(200);
    });
    $modalContent.on('click', function(e) {
      return false;
    })
    $btnNotify.on('click', function(e) {
      onNotify(loginOrEmails);
      notifyModal.fadeToggle(200);
    })

    $btnSelectUser.on('click', function(e) {
      var loginOrEmail = $emailField.val();
      if (loginOrEmails.includes(loginOrEmail)) {
        return;
      }
      if (userList.includes(loginOrEmail)) {
        $msgUserNotExist.hide();
        loginOrEmails.push(loginOrEmail);
        
        var $selectedUser = $("<span class='selected-user'>" + loginOrEmail + "<span style='padding-left:5px; font-size: large' class = 'clickable'>&times;</span></span>");
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
      $emailField.val('');
        
    })
    notifyModal.fadeToggle(0);
  }
  return modal;
}).call(this);