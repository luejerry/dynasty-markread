// ==UserScript==
// @name        Dynasty Mark IsRead
// @author      cyricc
// @description Mark chapters that you have already read in Dynasty Scans chapter lists.
// @namespace   https://dynasty-scans.com
// @include     https://dynasty-scans.com/chapters/added*
// @include     https://dynasty-scans.com/tags/*
// @include     https://dynasty-scans.com/issues/*
// @include     https://dynasty-scans.com/doujins/*
// @include     https://dynasty-scans.com/anthologies/*
// @include     https://dynasty-scans.com/series/*
// @include     https://dynasty-scans.com/authors/*
// @include     https://dynasty-scans.com/pairings/*
// @include     https://dynasty-scans.com/search*
// @version     1.3
// @grant       none
// ==/UserScript==

(function() {
  console.log("Running Dynasty-IsRead user script.");

  var listHref = "https://dynasty-scans.com/lists";
  var httpGet = function(url) {
    return new Promise((resolve, reject) => {
      var xhttp = new XMLHttpRequest();
      xhttp.onload = () => {
        if (xhttp.status == 200) {
          resolve(xhttp.responseXML);
        } else {
          reject(Error(xhttp.statusText));
        }
      };
      xhttp.open("GET", url);
      xhttp.responseType = "document";
      xhttp.send();
    });

  };

  var formatRead = function(element) {
    element.classList.add("muted");
  };

  httpGet(listHref).then(responseHtml => {
    var listLinks = responseHtml.getElementsByClassName("table-link");
    var readHref = Array.from(listLinks).find(a => a.innerText === "Read").href;
    return httpGet(readHref);
  }).then(responseHtml => {
    var chapterList = responseHtml.getElementsByTagName("dd");
    var readMap = Array.from(chapterList)
      .map(dd => dd.getElementsByClassName("name")[0])
      .filter(a => typeof a !== "undefined")
      .map(a => a.href)
      .reduce((acc, href) => {
        acc[href] = true;
        return acc;
      }, {});
    var entryList = document.getElementsByTagName("dd");
    var entryLinks = Array.from(entryList)
      .map(dd => dd.getElementsByClassName("name")[0])
      .filter(a => typeof a !== "undefined");
    entryLinks.forEach(a => {
      if (readMap[a.href]) {
        formatRead(a);
      }
    });
  });

})();