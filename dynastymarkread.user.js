// ==UserScript==
// @name        Dynasty Mark IsRead
// @author      cyricc
// @description Mark chapters that you have already read in Dynasty Scans chapter lists.
// @namespace   https://dynasty-scans.com
// @include     https://dynasty-scans.com/chapters/*
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
// @version     2.4
// @grant       none
// @downloadURL https://github.com/luejerry/dynasty-markread/raw/master/dynastymarkread.user.js
// @updateURL   https://github.com/luejerry/dynasty-markread/raw/master/dynastymarkread.user.js
// ==/UserScript==

(function () {

  const dynastyHref = 'https://dynasty-scans.com';
  const listHref = 'https://dynasty-scans.com/lists';

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
      table: {},
      formatter: element => element.style.color = '#999999'
    },
    {
      id: 'toReadMap',
      status: 'to_read',
      display: 'To Read',
      table: {},
      formatter: element => element.style.color = '#3a87ad'
    },
    {
      id: 'subscribedMap',
      status: 'subscribed',
      display: 'Subscribed',
      table: {},
      formatter: element => element.style.color = '#ad1457'
    }
  ];

  /* Get elements in Lists dropdown on the given document */
  const getDropList = function (htmlDocument) {
    const dropListParent = htmlDocument.getElementById('lists-dropdown');
    return dropListParent ?
      Array.from(dropListParent.children)
        .map(e => e.children[0])
        .filter(a => statusMaps.find(statusObj =>
          statusObj.status === a.getAttribute('data-type'))) :
      [];
  };

  /* Promise to fetch the user's Read list and return it as a lookup table mapping href to boolean */
  const promiseStatusMap = async function (statusHref) {
    const isReadList = (await httpGet(statusHref)).getElementsByTagName('dd');
    return Array.from(isReadList)
      .map(dd => dd.getElementsByClassName('name')[0])
      .filter(a => a !== undefined)
      .reduce((acc, a) => {
        acc[a.href] = true; return acc;
      }, {});
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
        batchMark(cachedMap, statusObj.formatter);
        return cachedMap;
      }
      return {};
    });
  };

  /* Invalidate caches when user adds/removes an item from the list dropdown */
  const attachInvalidationListeners = function () {
    const dropList = getDropList(document);
    dropList.forEach(a => {
      a.addEventListener('click', () => {
        localStorage.setItem('cache_invalid', '1');
        // console.log('cache invalidated');
      });
    });
  };

  /* Promise to fetch all of a user's lists that are defined in statusMap */
  const promiseFetchLists = async function (listPageHref) {
    // GET the user's Read list (the url is different for each user)
    const listLinks = Array.from((await httpGet(listPageHref)).getElementsByClassName('table-link'));
    const promiseStatusObjs = statusMaps.map(statusMap => {
      const statusHref = listLinks.find(a => a.innerText === statusMap.display);
      return promiseStatusMap(statusHref).then(table => {
        return Object.assign({}, statusMap, { table: table });
      });
    });
    return Promise.all(promiseStatusObjs);
  };

  /* Add children of entries marked Read to the Read table */
  const markReadRecursive = async function (isReadMap) {
    const linksObjPromises = Object.keys(isReadMap)
      .filter(href =>
        href.includes('/series/', dynastyHref.length) ||
        href.includes('/anthologies/', dynastyHref.length))
      .map(href => promiseScrapeLinks(href));
    (await Promise.all(linksObjPromises)).forEach(linksObj => {
      const {entryLinks, thumbnailLinks} = linksObj;
      [...entryLinks, ...thumbnailLinks]
        .map(a => a.href)
        .forEach(href => isReadMap[href] = true);
    });
    return Promise.resolve();
  };

  /* Scrape all chapter and thumbnail link elements on the given document */
  const getChapterLinks = function (htmlDocument) {
    const entryList = htmlDocument.getElementsByTagName('dd');
    const entryLinks = Array.from(entryList)
      .map(dd => dd.getElementsByClassName('name')[0])
      .filter(a => a !== undefined);
    const thumbnailList = Array.from(htmlDocument.getElementsByClassName('thumbnail'));
    const thumbnailLinks = thumbnailList
      .filter(e => e.tagName === 'A')
      .filter(a => a.getElementsByClassName('title')[0] || a.getElementsByClassName('caption')[0]);
    return {
      entryLinks: entryLinks,
      thumbnailLinks: thumbnailLinks
    };
  };

  /* Promise to scrape chapter and thumbnail link elements from a given URL */
  const promiseScrapeLinks = async function (seriesPageHref) {
    return getChapterLinks(await httpGet(seriesPageHref));
  };

  /* Promise to reload cache and mark all chapters */
  const promiseFetchMarkAll = async function () {
    const statusObjs = await promiseFetchLists(listHref);
    const isReadMap = statusObjs.find(statusObj => statusObj.id === 'isReadMap');
    statusObjs.forEach(statusObj => {
      batchMark(statusObj.table, statusObj.formatter);
      localStorage.setItem(statusObj.id, JSON.stringify(statusObj.table));
    });
    await markReadRecursive(isReadMap.table);
    statusObjs.forEach(statusObj =>
      localStorage.setItem(statusObj.id, JSON.stringify(statusObj.table)));
    localStorage.removeItem('cache_invalid');
    batchMark(isReadMap.table, isReadMap.formatter);
  };


  /* Main */

  // Find all links to chapters on the page
  const {entryLinks, thumbnailLinks} = getChapterLinks(document);

  markAllFromCache(statusMaps);

  const cacheInvalid = localStorage.getItem('cache_invalid');

  if (cacheInvalid) {
    promiseFetchMarkAll().catch(error => {
      console.log(`Dynasty-IsRead: ${error.name} occurred during cache refresh: ${error.message}`);
    });
  }

  attachInvalidationListeners();
})();