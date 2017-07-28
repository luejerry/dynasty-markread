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
// @version     1
// @grant       none
// ==/UserScript==

(function() {
  console.log("Running Dynasty-IsRead user script.");

  var httpGet = function(url, documentConsumer) {
    var xhttp = new XMLHttpRequest();
    xhttp.onload = () => {
      if (xhttp.status == 200) {
  //       console.log("Successful response from " + url);
        documentConsumer(xhttp.responseXML);
      }
    };
    xhttp.open("GET", url);
    xhttp.responseType = "document";
    xhttp.send();
  //   console.log("GET: " + url)
  };

  var scrapeIsRead = function(htmlDocument) {
    var dropList = htmlDocument.getElementById("lists-dropdown").children;
    var readElements = Array.from(dropList)
      .map(e => e.children[0])
      .filter(a => a.getAttribute("data-type") === "read")
      .filter(a => a.getElementsByClassName("icon-remove").length > 0);
    return readElements.length > 0;
  };

  var formatRead = function(element) {
    element.classList.add("muted");
  };

  var entryList = document.getElementsByTagName("dd");
  var entryMap = Array.from(entryList).map(e => {
    var linkElement = e.getElementsByClassName("name")[0];
    return {
      link: linkElement.href,
      element: linkElement
    };
  });

  entryMap.forEach(e => {
    httpGet(e.link, (resp) => {
      if (scrapeIsRead(resp)) {
  //       console.log("IsRead: " + e.link);
        formatRead(e.element);
      } else {
  //       console.log("NotRead: " + e.link);
      }
    });
  });
})();