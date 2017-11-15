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
// @version     2.2
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

  /* Defines statuses to mark. `status` and `display` fields must match identifiers on the site */
  const statusMaps = [
    {
      id: 'isReadMap',
      status: 'read',
      display: 'Read',
      table: {}
    },
    {
      id: 'toReadMap',
      status: 'to_read',
      display: 'To Read',
      table: {}
    },
    {
      id: 'subscribedMap',
      status: 'subscribed',
      display: 'Subscribed',
      table: {}
    }
  ];

  /* Defines status ids and link formatter functions */
  const statusFormatters = {
    read: element => element.style.color = '#999999',
    to_read: element => element.style.color = '#3a87ad',
    subscribed: element => element.style.color = '#ad1457'
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
  const markAllFromCache = function (statusObjs) {
    return statusObjs.map(statusObj => {
      const cachedMap = JSON.parse(localStorage.getItem(statusObj.id));
      if (cachedMap) {
        batchMark(cachedMap, statusFormatters[statusObj.status]);
        return cachedMap;
      }
      return {};
    });
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

  const cachedMaps = markAllFromCache(statusMaps);

  // Run algorithm based on the number of chapter links found.
  // Below a certain threshold, it is faster to scrape Read status from each individual chapter page.
  // Above that threshold, it is faster to request the user's entire Read list.
  // If above threshold, both methods are used concurrently to improve perceived responsiveness.
  if (numLinks < entryThreshold) {
    promiseMarkIndividualLinks(entryLinks, thumbnailLinks, Object.assign({}, ...cachedMaps))
      .catch(error => console.log(`Dynasty-IsRead: ${error.name} occurred during marking: ${error.message}`));
  } else {
    httpGet(listHref).then(responseHtml => {
      // GET the user's Read list (the url is different for each user)
      const listLinks = Array.from(responseHtml.getElementsByClassName('table-link'));
      const promiseStatusObjs = statusMaps.map(statusMap => {
        const statusHref = listLinks.find(a => a.innerText === statusMap.display);
        return promiseStatusMap(statusHref).then(table => {
          return Object.assign({}, statusMap, { table: table });
        });
      });
      // Start checking and marking individual chapters while waiting on Read list
      promiseMarkIndividualLinks(
        entryLinks.slice(0, entryThreshold),
        thumbnailLinks.slice(0, entryThreshold),
        Object.assign({}, ...cachedMaps)
      ).catch(error => console.log(`Dynasty-IsRead: ${error.name} occurred during pre-marking: ${error.message}`));
      return Promise.all(promiseStatusObjs);
    }).then(statusObjs => {
      statusObjs.forEach(statusObj => {
        localStorage.setItem(statusObj.id, JSON.stringify(statusObj.table));
        batchMark(statusObj.table, statusFormatters[statusObj.status]);
      });
      return Promise.resolve();
    }).catch(error => {
      console.log(`Dynasty-IsRead: ${error.name} occurred during batch fetch: ${error.message}`);
    });
  }
})();