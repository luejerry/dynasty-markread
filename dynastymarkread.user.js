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
// @version     1.4
// @grant       none
// ==/UserScript==

(function() {
  console.log("Running Dynasty-IsRead user script.");

  const listHref = "https://dynasty-scans.com/lists";

  // Promisify XMLHttpRequest
  const httpGet = function(url) {
    return new Promise((resolve, reject) => {
      const xhttp = new XMLHttpRequest();
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

  // Defines how Read links are styled
  const formatIsRead = function(element) {
    element.classList.add("muted");
  };

  // Main

  httpGet(listHref).then(responseHtml => {
    // GET the user's Read list (the url is different for each user)
    const listLinks = responseHtml.getElementsByClassName("table-link");
    const isReadHref = Array.from(listLinks).find(a => a.innerText === "Read").href;
    return httpGet(isReadHref);
  }).then(responseHtml => {
    // Store all the user's Read chapters in a lookup map
    const isReadList = responseHtml.getElementsByTagName("dd");
    const isReadMap = Array.from(isReadList)
      .map(dd => dd.getElementsByClassName("name")[0])
      .filter(a => typeof a !== "undefined")
      .reduce((acc, a) => { acc[a.href] = true; return acc; }, {});

    // Mark chapters on page that are Read
    const entryList = document.getElementsByTagName("dd");
    const entryLinks = Array.from(entryList)
      .map(dd => dd.getElementsByClassName("name")[0])
      .filter(a => typeof a !== "undefined");
    entryLinks
      .filter(a => isReadMap[a.href])
      .forEach(formatIsRead);
  });

})();