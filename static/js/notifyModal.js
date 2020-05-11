module.exports = (function() {
  'use strict';

  var loginOrEmails = [];
  var modal = {};
  
  modal.toggle = function() {
    var padOuter = $('iframe[name="ace_outer"]').contents().find("body");
    var notifyModal = padOuter.find('#notifyModal');
    notifyModal.find('#userList').empty();
    notifyModal.find('#emailField').val('');
    loginOrEmails = [];
    notifyModal.fadeToggle(250);
  }

  modal.init = function(onNotify) {
    var padOuter = $('iframe[name="ace_outer"]').contents().find("body");
    var modalHTML = 
      '<div id="notifyModal" class="modal">' +
        '<div id="notifyModalContent">' +
          '<div class="container" style="height:200px; display:inline-block;">' +
            '<span id="btnCloseModal" class="display-topright clickable">&times;</span>' +
            '<div style="font-size:large">Notify Users</div>' +
            
            '<div style="padding-top: 10px; padding-bottom: 10px">' +
              '<p style="padding-bottom: 5px; padding-top: 10px;">User Selection</p>' +
              '<input id="emailField" type="text" style="padding:5px;" placeholder="Email or Login">' +
              '<span style="margin-right:10px;"></span>' +
              '<button id="btnSelectUser" class="custom-button">ADD</button>' +
              '<div id="msgUserNotExist" style="font-size: 12px; color: red; padding-top: 5px;">User does not exist</div>' +
            '</div>' +
            '<p style="padding-bottom: 10px; padding-top: 10px;">Selected Users</p>' +
              
            '<div id="userList">' +
            '</div>' +

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
      var baseURL = window.location.href.slice(0, window.location.href.split('/', 3).join('/').length);
      var loginOrEmail = $emailField.val();
      if (loginOrEmails.includes(loginOrEmail)) {
        return;
      }
      $.ajax({
        method: 'GET',
        url: baseURL+'/mypads/api/user-exist/' + loginOrEmail,
        data: {
          auth_token: localStorage.getItem('token')
        },
        success: function(data, textStatus, jqXHR) {
          if (data.userExists === true) {
            $msgUserNotExist.hide();
            loginOrEmails.push(loginOrEmail);
            
            var $selectedUser = $("<span>" + loginOrEmail + "<span style='padding-left:5px; font-size: large' class = 'clickable'>&times;</span></span>");
            $selectedUser.css('border-radius', "5px");
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


    notifyModal.css({
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

    notifyModal.find('.display-topright').css({
      "color": "#C4C4C4",
      "position":"absolute",
      "right":"20px",
      "top":"10px",
      "font-size": "xx-large"
    });

    notifyModal.find('.display-bottomright').css({
      "position":"absolute",
      "right":"20px",
      "bottom": "20px"
    });

    notifyModal.find('#notifyModalContent').css({
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

    notifyModal.find('.selected-user').css({
      "display": "inline-block",
      "padding":"1%",
      "width": "fit-content"
    });

    notifyModal.find('.clickable').css("cursor", "pointer");

    notifyModal.find('.custom-button').css({
      "background-color": "Transparent",
      "background-repeat":"no-repeat",
      "color": "#1C96CF",
      "border": "none",
      "cursor":"pointer",
      "overflow": "hidden",
      "outline":"none",
    });
    
    notifyModal.fadeToggle(0);
  }
  return modal;
}).call(this);