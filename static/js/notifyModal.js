require('ep_mypads/static/js/jquery-ui');

module.exports = (function() {
  'use strict';

  var baseURL; 
  var authToken;
  var loginOrEmails = [];
  var userList = [];

  var $notifyModal;
  var $btnNotify;
  var $loader;

  var modal = {};

  modal.postAceInit = function(hook, context) {
    baseURL = window.location.href.slice(0, window.location.href.split('/', 3).join('/').length);
    authToken = getUrlVars()['auth_token']; 
    $.ajax({
      url: baseURL +'/mypads/api/user-suggestions',
      dataType: "json",
      data: {
        auth_token: getUrlVars()['auth_token'],
        pad_id: context.pad.getPadId()
      },
      success: function(data) {
        Object.keys(data.users).forEach(function(key) {
          userList.push(key);
          userList.push(data.users[key].email);
        })
      }
    });
    var $padOuter = $('iframe[name="ace_outer"]').contents().find("body");
    var modalHTML = 
      '<div id="notifyModal" class="modal backdrop">' +
        '<div id="notifyModalContent">' +
          '<div class="container" style="height:200px; display:inline-block; white-space: pre-wrap;">' +
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

            '<div class="toggle-single" style="font-size:large; margin-right:30px;"></div>' + 
            '<div class = "display-bottomright">' +
              '<button id="btnCancel" class="custom-button">CANCEL</button>' +
              '<span style="margin-right:15px;"></span>' +
              '<button id="btnNotify" class="custom-button">SEND</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    $padOuter.append(modalHTML);
    $loader = $('<div class="backdrop"><div class="loader"></div></div>');
    $padOuter.append($loader);
    $loader.hide();
    $notifyModal = $padOuter.find("#notifyModal");
    var $msgUserNotExist = $notifyModal.find("#msgUserNotExist");
    var $btnCloseModal = $notifyModal.find("#btnCloseModal");
    var $btnCancel = $notifyModal.find("#btnCancel");
    $btnNotify = $notifyModal.find("#btnNotify");
    var $btnSelectUser = $notifyModal.find("#btnSelectUser");
    var $modalContent = $notifyModal.find("#notifyModalContent");
    var $emailField = $notifyModal.find("#emailField");
    var $userList = $notifyModal.find("#userList");
      
    $emailField.autocomplete({
      source: userList,
      select: function(event, ui) {
        $emailField.val(ui.item.label);
        $btnSelectUser.click();
      },
    });
    
    $msgUserNotExist.hide();
    $btnCloseModal.on('click', function(e) {
      $notifyModal.fadeToggle(200);
    })
    $btnCancel.on('click', function(e) {
      $notifyModal.fadeToggle(200);
    })
    $notifyModal.on('click', function(e) {
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
    $notifyModal.fadeToggle(0);
  }

  modal.aceEditorCSS = function(hook, context) {
    return [
      "/ep_mypads/static/css/notifyModal.css",
      "/ep_mypads/static/css/jquery-ui.css",
    ];
  }

  modal.show = function(autocomplete, copiedText) {
    $btnNotify.off('click');
    $btnNotify.on('click', function() {
      $notifyModal.fadeToggle(0, function() {
        $loader.fadeToggle(0, function() {
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
              $loader.fadeToggle(200, function() {
                if (data.success === true) {
                  alert('The mentioned user was successfully notified.');
                } else {
                  alert('Something went wrong.');
                }
              });
            },
            error: function(xhr, status, error) {
              $loader.fadeToggle(200, function() {
                alert('Something went wrong.');
              });
            }
          });
        });
      })
    });
    if (autocomplete) {
      $notifyModal.find('#notifyModalContent').css('height', '50px');
      $notifyModal.find('.toggle-multiple').hide();
      var str = autocomplete.text;
      if (str.startsWith('@')) {
        var group = str.substr(1);
        if (group === 'all') {
          str = 'every member of AzPad';
        } else if (group === 'folder') {
          str = 'all members of this folder';
        } else if (group === 'admins') {
          str = 'the admins of this folder';
        } else if (group === 'invited') {
          str = 'the invited members of this folder';
        }
      } 
      $notifyModal.find('.toggle-single').text('Send notification to ' + str + '?');
      $notifyModal.find('.toggle-single').show();
      loginOrEmails = autocomplete.recipients;
      $notifyModal.fadeToggle(250)
    } else {
      $notifyModal.find('#notifyModalContent').css('height', '200px');
      $notifyModal.find('.toggle-multiple').show();
      $notifyModal.find('.toggle-single').hide();
      $notifyModal.find('#userList').empty();
      $notifyModal.find('#emailField').val('');
      $notifyModal.find('#msgUserNotExist').hide();
      loginOrEmails = [];
      $notifyModal.fadeToggle(250);
    }
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

  return modal;
}).call(this);