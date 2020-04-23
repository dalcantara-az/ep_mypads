exports.postAceInit = function(hook, context) {

  var userId = getUrlVars()['findUser'];
  if (userId) {
    findAndScrollTo(containsText, '@' + userId.toLowerCase());
    return;
  }

  var lineNumber = getUrlVars()['lineNumber'];
  if (lineNUmber) {
    findAndScrollTo(isLine, lineNumber);
    return;
  }

};

function isLine(elem, count, param) {
  return count == param;
}

// make sure param is in lower case
function isWholeText(elem, count, param) {
  return $(elem).text().trim().toLowerCase() == param;
}

// make sure param is in lower case
function containsText(elem, count, param) {
  return $(elem).text().toLowerCase().includes(param);
}

function findAndScrollTo(condition, param) {
  var count = 1;
  $('iframe[name="ace_outer"]').contents().find('iframe').contents().find("#innerdocbody").contents().each(function() {
    if (condition(this, count, param)) {
      var newY = $(this).context.offsetTop + "px";
      var $outerdoc = $('iframe[name="ace_outer"]').contents().find("#outerdocbody");
      var $outerdocHTML = $('iframe[name="ace_outer"]').contents().find("#outerdocbody").parent();
      $outerdoc.animate({scrollTop: newY});
      $outerdocHTML.animate({scrollTop: newY});
      return false;
    }
    count++;
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

