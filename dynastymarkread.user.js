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
// @include     https://dynasty-scans.com/lists/*
// @version     2.1
// @grant       none
// @downloadURL https://github.com/luejerry/dynasty-markread/raw/master/dynastymarkread.user.js
// @updateURL   https://github.com/luejerry/dynasty-markread/raw/master/dynastymarkread.user.js
// ==/UserScript==

(function () {
  // console.log('Running Dynasty-IsRead user script.');

  // const timeStart = performance.now();

  const listHref = 'https://dynasty-scans.com/lists';

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
      xhttp.open('GET', url);
      xhttp.responseType = 'document';
      xhttp.send();
    });
  };

  /* Defines status ids and link formatter functions */
  const statusFormatters = {
    read: element => element.style.color = '#999999',
    to_read: element => element.style.color = '#3a87ad'
  };

  /* Returns list of statuses of a chapter that match those defined in statusFormatters */
  const scrapeStatus = function (htmlDocument) {
    const dropList = htmlDocument.getElementById('lists-dropdown').children;
    const readElements = Array.from(dropList)
      .map(e => e.children[0])
      .filter(a => statusFormatters.hasOwnProperty(a.getAttribute('data-type')))
      .filter(a => a.getElementsByClassName('icon-remove').length > 0)
      .map(a => a.getAttribute('data-type'));
    return readElements;
  };

  /* Mark an individual chapter link if it matches a defined status */
  const promiseMarkLink = function (a) {
    return httpGet(a.href).then(responseHtml => {
      scrapeStatus(responseHtml).forEach(status => statusFormatters[status](a));
      return Promise.resolve();
    });
  };

  /* Mark an individual thumbnail caption if it matches a defined status */
  const promiseMarkThumbnail = function (a) {
    const titleDiv = a.getElementsByClassName('title')[0] || a.getElementsByClassName('caption')[0];
    return httpGet(a.href).then(responseHtml => {
      scrapeStatus(responseHtml).forEach(status => statusFormatters[status](titleDiv));
      return Promise.resolve();
    });
  };

  /* Promise to fetch the user's Read list and return it as a lookup table mapping href to boolean */
  const promiseStatusMap = function (statusHref) {
    return httpGet(statusHref).then(responseHtml => {
      const isReadList = responseHtml.getElementsByTagName('dd');
      return Array.from(isReadList)
        .map(dd => dd.getElementsByClassName('name')[0])
        .filter(a => a !== undefined)
        .reduce((acc, a) => {
          acc[a.href] = true; return acc;
        }, {});
    });
  };

  /* Promise to individually check and mark all given links and thumbnails that are Read */
  const promiseMarkIndividualLinks = function (entryLinks, thumbnailLinks, cachedMap) {
    const markLinkPromises = entryLinks.filter(a => !cachedMap.hasOwnProperty(a.href))
      .map(a => promiseMarkLink(a));
    const markThumbnailPromises = thumbnailLinks.filter(a => !cachedMap.hasOwnProperty(a.href))
      .map(a => promiseMarkThumbnail(a));
    return Promise.all([...markLinkPromises, ...markThumbnailPromises]);
  };

  /* Batch mark all links on page that exist in the status map, using a provided formatter function */
  const batchMark = function (statusMap, formatter) {
    entryLinks
      .filter(a => statusMap[a.href])
      .forEach(a => formatter(a));
    thumbnailLinks
      .filter(a => statusMap[a.href])
      .map(a => a.getElementsByClassName('title')[0] || a.getElementsByClassName('caption')[0])
      .filter(div => div !== undefined)
      .forEach(div => formatter(div));
  };

  /* Batch mark all links on page from a cached map in local storage, if it exists */
  const markFromCache = function (statusMapId, formatter) {
    const cachedMap = JSON.parse(localStorage.getItem(statusMapId));
    if (cachedMap) {
      batchMark(cachedMap, formatter);
      return cachedMap;
    }
    return {};
  };

  /* Main */

  // Find all links to chapters on the page
  const entryList = document.getElementsByTagName('dd');
  const entryLinks = Array.from(entryList)
    .map(dd => dd.getElementsByClassName('name')[0])
    .filter(a => a !== undefined);
  const thumbnailList = Array.from(document.getElementsByClassName('thumbnail'));
  const thumbnailLinks = thumbnailList
    .filter(e => e.tagName === 'A')
    .filter(a => a.getElementsByClassName('title')[0] || a.getElementsByClassName('caption')[0]);
  const numLinks = entryLinks.length + thumbnailLinks.length;

  // Immediately mark if cached lists are available
  const cachedIsRead = markFromCache('isReadMap', statusFormatters.read);
  const cachedToRead = markFromCache('toReadMap', statusFormatters.to_read);

  // Run algorithm based on the number of chapter links found.
  // Below a certain threshold, it is faster to scrape Read status from each individual chapter page.
  // Above that threshold, it is faster to request the user's entire Read list.
  // If above threshold, both methods are used concurrently to improve perceived responsiveness.
  if (numLinks < entryThreshold) {
    // console.log(`Dynasty-IsRead: Less than ${entryThreshold} chapters on page, using serial fetch only`);
    promiseMarkIndividualLinks(entryLinks, thumbnailLinks, Object.assign({}, cachedToRead, cachedIsRead)).then(promises => {
      // const timeDeltaMillis = performance.now() - timeStart;
      // console.log(`Dynasty-IsRead: finished marking ${promises.length} chapters in ${timeDeltaMillis.toFixed()} ms.`);
    }).catch(error => console.log(`Dynasty-IsRead: ${error.name} occurred during marking: ${error.message}`));
  } else {
    // console.log(`Dynasty-IsRead: ${numLinks} chapters, using hybrid batch fetch`);
    httpGet(listHref).then(responseHtml => {
      // GET the user's Read list (the url is different for each user)
      const listLinks = Array.from(responseHtml.getElementsByClassName('table-link'));
      const isReadHref = listLinks.find(a => a.innerText === 'Read').href;
      const toReadHref = listLinks.find(a => a.innerText === 'To Read').href;
      const fetchIsReadMap = promiseStatusMap(isReadHref);
      const fetchToReadMap = promiseStatusMap(toReadHref);
      // Start checking and marking individual chapters while waiting on Read list
      promiseMarkIndividualLinks(
        entryLinks.slice(0, entryThreshold),
        thumbnailLinks.slice(0, entryThreshold),
        Object.assign({}, cachedToRead, cachedIsRead)
      ).then(promises => {
        // const timeDeltaMillis = performance.now() - timeStart;
        // console.log(`Dynasty-IsRead: finished pre-marking ${promises.length} chapters in ${timeDeltaMillis.toFixed()} ms.`);
      }).catch(error => console.log(`Dynasty-IsRead: ${error.name} occurred during pre-marking: ${error.message}`));
      return Promise.all([fetchIsReadMap, fetchToReadMap]);
    }).then(statusMaps => {
      const isReadMap = statusMaps[0];
      const toReadMap = statusMaps[1];
      localStorage.setItem('isReadMap', JSON.stringify(isReadMap));
      localStorage.setItem('toReadMap', JSON.stringify(toReadMap));
      batchMark(isReadMap, statusFormatters.read);
      batchMark(toReadMap, statusFormatters.to_read);
      return Promise.resolve();
    }).then(() => {
      // const timeDeltaMillis = performance.now() - timeStart;
      // console.log(`Dynasty-IsRead: finished marking ${numLinks} chapters in ${timeDeltaMillis.toFixed()} ms.`);
    }).catch(error => {
      console.log(`Dynasty-IsRead: ${error.name} occurred during batch fetch: ${error.message}`);
    });
  }
})();