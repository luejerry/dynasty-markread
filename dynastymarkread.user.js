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
// @include     https://dynasty-scans.com/scanlators/*
// @include     https://dynasty-scans.com/search*
// @include     https://dynasty-scans.com/
// @version     1.6
// @grant       none
// ==/UserScript==

(function () {
  console.log("Running Dynasty-IsRead user script.");

  const listHref = "https://dynasty-scans.com/lists";
  const entryThreshold = 30;

  // Promisify XMLHttpRequest
  const httpGet = function (url) {
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

  // Check if an individual chapter is Read
  const scrapeIsRead = function (htmlDocument) {
    var dropList = htmlDocument.getElementById("lists-dropdown").children;
    var readElements = Array.from(dropList)
      .map(e => e.children[0])
      .filter(a => a.getAttribute("data-type") === "read")
      .filter(a => a.getElementsByClassName("icon-remove").length > 0);
    return readElements.length > 0;
  };

  // Defines how Read links are styled
  const formatIsRead = function (element) {
    element.style.color = "#999999";
  };

  // Check and mark an individual chapter if Read
  const markLinkIsRead = function (a) {
    httpGet(a.href).then(responseHtml => {
      if (scrapeIsRead(responseHtml)) {
        formatIsRead(a);
      }
    });
  };

  // Check and mark an individual chapter thumbnail if Read
  const markThumbnailIsRead = function (a) {
    httpGet(a.href).then(responseHtml => {
      if (scrapeIsRead(responseHtml)) {
        const titles = [...a.getElementsByClassName("title"), ...a.getElementsByClassName("caption")];
        titles.forEach(div => formatIsRead(div));
      }
    });
  };

  // Main

  const entryList = document.getElementsByTagName("dd");
  const entryLinks = Array.from(entryList)
    .map(dd => dd.getElementsByClassName("name")[0])
    .filter(a => a !== undefined);
  const thumbnailList = Array.from(document.getElementsByClassName("thumbnail"));
  const thumbnailLinks = thumbnailList.filter(e => e.tagName === "A");

  if (entryLinks.length + thumbnailLinks.length < entryThreshold) {
    console.log(`Dynasty-IsRead: Less than ${entryThreshold} chapters on page, using serial fetch only`);
    entryLinks.forEach(a => markLinkIsRead(a));
    thumbnailLinks.forEach(a => markThumbnailIsRead(a));
  } else {
    console.log(`Dynasty-IsRead: ${entryLinks.length + thumbnailLinks.length} chapters, using hybrid batch fetch`);
    httpGet(listHref).then(responseHtml => {
      // GET the user's Read list (the url is different for each user)
      const listLinks = responseHtml.getElementsByClassName("table-link");
      const isReadHref = Array.from(listLinks).find(a => a.innerText === "Read").href;
      const fetchIsRead = httpGet(isReadHref);
      // Start checking and marking individual chapters while waiting on Read list
      entryLinks.slice(0, entryThreshold).forEach(a => markLinkIsRead(a));
      thumbnailLinks.slice(0, entryThreshold).forEach(a => markThumbnailIsRead(a));
      return fetchIsRead;
    }).then(responseHtml => {
      // Store all the user's Read chapters in a lookup map
      const isReadList = responseHtml.getElementsByTagName("dd");
      const isReadMap = Array.from(isReadList)
        .map(dd => dd.getElementsByClassName("name")[0])
        .filter(a => a !== undefined)
        .reduce((acc, a) => { acc[a.href] = true; return acc; }, {});

      // Mark chapters on page that are Read
      entryLinks
        .filter(a => isReadMap[a.href])
        .forEach(a => formatIsRead(a));
      thumbnailLinks
        .filter(a => isReadMap[a.href])
        .map(a => a.getElementsByClassName("title")[0])
        .filter(div => div !== undefined)
        .forEach(div => formatIsRead(div));
      thumbnailLinks
        .filter(a => isReadMap[a.href])
        .map(a => a.getElementsByClassName("caption")[0])
        .filter(div => div !== undefined)
        .forEach(div => formatIsRead(div));
    });
  }
})();