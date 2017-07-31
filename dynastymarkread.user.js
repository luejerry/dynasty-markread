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
// @include     https://dynasty-scans.com/?*
// @version     1.9
// @grant       none
// ==/UserScript==

(function () {
  console.log("Running Dynasty-IsRead user script.");
  
  const timeStart = performance.now();

  const listHref = "https://dynasty-scans.com/lists";

  /* Minimum number of chapters on page needed to trigger a batch fetch */
  const entryThreshold = 30;

  /* Promisify XMLHttpRequest */
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

  /* Check if an individual chapter is Read */
  const scrapeIsRead = function (htmlDocument) {
    var dropList = htmlDocument.getElementById("lists-dropdown").children;
    var readElements = Array.from(dropList)
      .map(e => e.children[0])
      .filter(a => a.getAttribute("data-type") === "read")
      .filter(a => a.getElementsByClassName("icon-remove").length > 0);
    return readElements.length > 0;
  };

  /* Apply style to Read link or caption */
  const formatIsRead = function (element) {
    element.style.color = "#999999";
  };

  /* Check and mark an individual link if Read */
  const markLinkIsRead = function (a) {
    return httpGet(a.href).then(responseHtml => {
      if (scrapeIsRead(responseHtml)) {
        formatIsRead(a);
      }
      return Promise.resolve();
    });
  };

  /* Check and mark an individual thumbnail caption if Read */
  const markThumbnailIsRead = function (a) {
    const titleDiv = a.getElementsByClassName("title")[0] || a.getElementsByClassName("caption")[0];
    return httpGet(a.href).then(responseHtml => {
      if (scrapeIsRead(responseHtml)) {
        formatIsRead(titleDiv);
      }
      return Promise.resolve();
    });
  };

  /* Promise to fetch the user's Read list and return it as a lookup table */
  const promiseIsReadMap = function(isReadHref) {
    return httpGet(isReadHref).then(responseHtml => {
      const isReadList = responseHtml.getElementsByTagName("dd");
      return Array.from(isReadList)
        .map(dd => dd.getElementsByClassName("name")[0])
        .filter(a => a !== undefined)
        .reduce((acc, a) => { acc[a.href] = true; return acc; }, {});
    });
  };
  
  const promiseMarkIndividualLinks = function(entryLinks, thumbnailLinks) {
    const markLinkPromises = entryLinks.map(a => markLinkIsRead(a));
    const markThumbnailPromises = thumbnailLinks.map(a => markThumbnailIsRead(a));
    return Promise.all([...markLinkPromises, ...markThumbnailPromises]);
  };

  /* Main */

  // Find all links to chapters on the page
  const entryList = document.getElementsByTagName("dd");
  const entryLinks = Array.from(entryList)
    .map(dd => dd.getElementsByClassName("name")[0])
    .filter(a => a !== undefined);
  const thumbnailList = Array.from(document.getElementsByClassName("thumbnail"));
  const thumbnailLinks = thumbnailList
    .filter(e => e.tagName === "A")
    .filter(a => a.getElementsByClassName("title")[0] || a.getElementsByClassName("caption")[0]);
  const numLinks = entryLinks.length + thumbnailLinks.length;

  // Run algorithm based on the number of chapter links found.
  // Below a certain threshold, it is faster to scrape Read status from each individual chapter page.
  // Above that threshold, it is faster to request the user's entire Read list.
  // If above threshold, both methods are used concurrently to improve perceived responsiveness.
  if (numLinks < entryThreshold) {
    console.log(`Dynasty-IsRead: Less than ${entryThreshold} chapters on page, using serial fetch only`);
    promiseMarkIndividualLinks(entryLinks, thumbnailLinks).then(promises => {
      const timeDeltaMillis = performance.now() - timeStart;
      console.log(`Dynasty-IsRead: finished marking ${promises.length} chapters in ${timeDeltaMillis.toFixed()} ms.`);
    }).catch(error => console.log(`Dynasty-IsRead: ${error.name} occurred during marking: ${error.message}`));
  } else {
    console.log(`Dynasty-IsRead: ${numLinks} chapters, using hybrid batch fetch`);
    httpGet(listHref).then(responseHtml => {
      // GET the user's Read list (the url is different for each user)
      const listLinks = responseHtml.getElementsByClassName("table-link");
      const isReadHref = Array.from(listLinks).find(a => a.innerText === "Read").href;
      const fetchIsReadMap = promiseIsReadMap(isReadHref);
      // Start checking and marking individual chapters while waiting on Read list
      promiseMarkIndividualLinks(entryLinks.slice(0, entryThreshold), thumbnailLinks.slice(0, entryThreshold)).then(promises => {
        const timeDeltaMillis = performance.now() - timeStart;
        console.log(`Dynasty-IsRead: finished pre-marking ${promises.length} chapters in ${timeDeltaMillis.toFixed()} ms.`);
      }).catch(error => console.log(`Dynasty-IsRead: ${error.name} occurred during pre-marking: ${error.message}`));
      return fetchIsReadMap;
    }).then(isReadMap => {
      // Mark chapters on page that are Read
      entryLinks
        .filter(a => isReadMap[a.href])
        .forEach(a => formatIsRead(a));
      thumbnailLinks
        .filter(a => isReadMap[a.href])
        .map(a => a.getElementsByClassName("title")[0] || a.getElementsByClassName("caption")[0])
        .filter(div => div !== undefined)
        .forEach(div => formatIsRead(div));
      return Promise.resolve();
    }).then(() => {
      const timeDeltaMillis = performance.now() - timeStart;
      console.log(`Dynasty-IsRead: finished marking ${numLinks} chapters in ${timeDeltaMillis.toFixed()} ms.`);
    }).catch(error => {
      console.log(`Dynasty-IsRead: ${error.name} occurred during batch fetch: ${error.message}`);
    });
  }
})();