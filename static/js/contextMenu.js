var selectedLineNumber;

exports.aceSelectionChanged = function(hook, context){
  console.log(context);
  var selStart = context.rep.selStart;
  var selEnd = context.rep.selEnd;
  if((selStart[0] !== selEnd[0]) || (selStart[1] !== selEnd[1])){
    // console.log("selection made, showing inline toolbar");
    iT.show(selStart, selEnd);
  }else{
    iT.hide();
  }
}

exports.postAceInit = function(hook, context) {
  lines = 0;
  $('iframe[name="ace_outer"]').contents().find('iframe').contents().find("#innerdocbody").contents().each(function() {
    lines++;
  });
  console.log(lines);

  var count = 0;
  var innerDocBody = $('iframe[name="ace_outer"]').contents().find('iframe').contents().find("#innerdocbody");
  var padOuter = $('iframe[name="ace_outer"]').contents().find("body");
  
  $(innerDocBody).children().each(function() {
    var currentLine = count;
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
  if((context.evt.key == "Enter"||context.evt.key == "Backspace") && context.rep.alines.length!= lines){
    console.log("lines changed")
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

function drawContextMenu(x, y){
  var padOuter = $('iframe[name="ace_outer"]').contents().find("body");
  var contextMenu = padOuter.find("#context_menu");
  var newX = (x + 60) + "px";
  var newY = (y + 20) + "px";
  var items = [
    {
      label: "Copy Link",
      onclick: function() {
        console.log('copied link')
      }
    },
    {
      label: "Notify",
      onclick: function() {
        console.log('notify')
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
    $(contextMenu).css("padding", "10px");
    $(contextMenu).css("-webkit-box-shadow", "10px 7px 13px -8px rgba(0,0,0,0.43)");
    $(contextMenu).css("-moz-box-shadow", "10px 7px 13px -8px rgba(0,0,0,0.43)");
    $(contextMenu).css("box-shadow", "10px 7px 13px -8px rgba(0,0,0,0.43)");
    $(contextMenu).css("font-size", "16px");
    $(contextMenu).append("<ul id='context_menu_items' style='list-style:none'></ul>");
    var menuItems = contextMenu.find('#context_menu_items');
    for (var i = 0; i < items.length; i++) {
      var $item = $("<li>", {"class": "context_menu_item"});
      $item.text(items[i].label);
      $item.on('click', {
        item: items[i]
      }, function(event){
        console.log(event.data.item);
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

