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
// @version     2.70
// @grant       none
// @downloadURL https://github.com/luejerry/dynasty-markread/raw/master/dynastymarkread.user.js
// @updateURL   https://github.com/luejerry/dynasty-markread/raw/master/dynastymarkread.user.js
// @require     https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js
// ==/UserScript==

(function () {
  const dynastyHref = 'https://dynasty-scans.com';
  const listHref = 'https://dynasty-scans.com/lists';
  const chapterHrefPrefix = 'https://dynasty-scans.com/chapters';
  const cacheExpiryTime = 24 * 3600 * 1000; // 24 hours in milliseconds

  /* Promisify XMLHttpRequest */
  const httpGet = function (url) {
    return new Promise((resolve, reject) => {
      const xhttp = new XMLHttpRequest();
      xhttp.onload = () => {
        if (xhttp.status === 200) {
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

  /* Hook a callback function into AJAX responses sent to the page */
  const addAjaxHook = function (handler) {
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, async, user, pass) {
      this.addEventListener(
        'load',
        (xmlHttpRequest => progressEvent => {
          handler(xmlHttpRequest, progressEvent);
        })(this),
      );
      open.call(this, method, url, true, user, pass);
    };
  };

  const setStorageObj = function (key, obj) {
    const compressed = LZString.compressToUTF16(JSON.stringify(obj));
    localStorage.setItem(key, compressed);
  };

  const getStorageObj = function (key) {
    const item = localStorage.getItem(key);
    const decompressed = LZString.decompressFromUTF16(item);
    if (!decompressed) {
      try {
        return JSON.parse(item);
      } catch (err) {
        console.log('Dynasty-MarkRead: No valid cache, refreshing');
        return null;
      }
    }
    return JSON.parse(decompressed);
  };

  /**
   * Defines statuses to mark. `status` and `display` fields must match identifiers on the site.
   * Items are listed in ascending priority order (if a chapter is in multiple lists, the last one
   * takes priority)
   */
  let statusMaps = [
    {
      id: 'subscribedMap',
      status: 'subscribed',
      display: 'Subscribed',
      urlPattern: /\/\d+-subscribed\//,
      table: {},
      formatter: element => (element.style.color = '#ad1457'),
    },
    {
      id: 'toReadMap',
      status: 'to_read',
      display: 'To Read',
      urlPattern: /\/\d+-to-read\//,
      table: {},
      formatter: element => (element.style.color = '#3a87ad'),
    },
    {
      id: 'isReadMap',
      status: 'read',
      display: 'Read',
      urlPattern: /\/\d+-read\//,
      table: {},
      formatter: element => (element.style.color = '#999999'),
    },
  ];

  /* Hook into list add/remove AJAX events to add/remove chapters from cache immediately */
  const hookListChanges = function () {
    statusMaps.forEach(statusObj => {
      addAjaxHook(xmlHttpRequest => {
        const responseUrl = xmlHttpRequest.responseURL;
        if (xmlHttpRequest.status === 200 && statusObj.urlPattern.test(responseUrl)) {
          const response = JSON.parse(xmlHttpRequest.response);
          const chapterUrl = location.href.split(/[?#]/)[0];
          if (response.added) {
            statusObj.table[chapterUrl] = true;
            setStorageObj(statusObj.id, statusObj.table);
          } else if (response.removed) {
            statusObj.table[chapterUrl] = false;
            setStorageObj(statusObj.id, statusObj.table);
          }
        }
      });
    });
  };

  /* Get elements in Lists dropdown on the given document */
  const getDropList = function (htmlDocument) {
    const dropListParent = htmlDocument.getElementById('lists-dropdown');
    return dropListParent
      ? Array.from(dropListParent.children)
          .map(e => e.children[0])
          .filter(a =>
            statusMaps.find(statusObj => statusObj.status === a.getAttribute('data-type')),
          )
      : [];
  };

  /* Promise to fetch the user's Read list and return it as a lookup table mapping href to boolean */
  const promiseStatusMap = async function (statusHref) {
    const isReadList = (await httpGet(statusHref)).getElementsByTagName('dd');
    return Array.from(isReadList)
      .map(dd => dd.getElementsByClassName('name')[0])
      .filter(a => a !== undefined)
      .reduce((acc, a) => {
        acc[a.href] = true;
        return acc;
      }, {});
  };

  /* Batch mark all links on page that exist in the status map, using a provided formatter function */
  const batchMark = function (statusMap, formatter) {
    entryLinks.filter(a => statusMap[a.href]).forEach(a => formatter(a));
    thumbnailLinks
      .filter(a => statusMap[a.href])
      .map(a => a.getElementsByClassName('title')[0] || a.getElementsByClassName('caption')[0])
      .filter(div => div !== undefined)
      .forEach(div => formatter(div));
  };

  /* Batch mark all links on page from a cached map in local storage, if it exists */
  const markAllFromCache = function (statusObjs) {
    return statusObjs.map(statusObj => {
      const cachedMap = getStorageObj(statusObj.id);
      if (cachedMap) {
        batchMark(cachedMap, statusObj.formatter);
        return Object.assign({}, statusObj, { table: cachedMap });
      } else {
        localStorage.setItem('markread_cache_invalid', '1');
      }
      return statusObj;
    });
  };

  /* Invalidate caches when user adds/removes an item from the list dropdown */
  const attachInvalidationListeners = function () {
    const dropList = getDropList(document);
    dropList.forEach(a => {
      a.addEventListener('click', () => {
        localStorage.setItem('markread_cache_invalid', '1');
        // console.log('cache invalidated');
      });
    });
  };

  /* Promise to fetch all of a user's lists that are defined in statusMap */
  const promiseFetchLists = async function (listPageHref) {
    // GET the user's Read list (the url is different for each user)
    const listLinks = Array.from(
      (await httpGet(listPageHref)).getElementsByClassName('table-link'),
    );
    const promiseStatusObjs = statusMaps.map(async statusMap => {
      const statusHref = listLinks.find(a => a.innerText === statusMap.display);
      return Object.assign({}, statusMap, {
        table: await promiseStatusMap(statusHref),
      });
    });
    return Promise.all(promiseStatusObjs);
  };

  /**
   * Adds the children of series and anthologies to the given map.
   * @param {{[href: string]: boolean}} rootMap Set of entities.
   */
  const visitChildren = async function (rootMap) {
    const linksObjPromises = Object.keys(rootMap)
      .filter(
        href =>
          href.includes('/series/', dynastyHref.length) ||
          href.includes('/anthologies/', dynastyHref.length),
      )
      .map(async href => {
        const chapterHrefs = await resolveSeriesAsync(href);
        chapterHrefs.forEach(linkHref => (rootMap[linkHref] = true));
        return Promise.resolve();
      });
    await Promise.all(linksObjPromises);
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
      thumbnailLinks: thumbnailLinks,
    };
  };

  /**
   * Gets the URLs of each chapter in a series via the JSON API.
   * @param {string} seriesPageHref URL of series page.
   * @returns {string[]} Chapter URLs.
   */
  const resolveSeriesAsync = async function (seriesPageHref) {
    const response = await fetch(`${seriesPageHref}.json`).then(r => r.json());
    return response.taggings.map(({ permalink }) => `${chapterHrefPrefix}/${permalink}`);
  };

  /* Promise to reload cache and mark all chapters */
  const promiseFetchMarkAll = async function () {
    const statusObjs = await promiseFetchLists(listHref);
    statusObjs.forEach(statusObj => {
      batchMark(statusObj.table, statusObj.formatter);
      setStorageObj(statusObj.id, statusObj.table);
    });
    for (const statusObj of statusObjs) {
      await visitChildren(statusObj.table);
      batchMark(statusObj.table, statusObj.formatter);
      setStorageObj(statusObj.id, statusObj.table);
    }
    localStorage.removeItem('markread_cache_invalid');
    localStorage.setItem('markread_time_refreshed', Date.now());
  };

  /* Check if cache expiry date has elapsed since last refresh */
  const isCacheExpired = function () {
    const lastTimeValid = parseInt(localStorage.getItem('markread_time_refreshed'), 10);
    if (isNaN(lastTimeValid)) {
      return true;
    }
    return Date.now() - lastTimeValid > cacheExpiryTime;
  };

  /* Main */

  // Find all links to chapters on the page
  const { entryLinks, thumbnailLinks } = getChapterLinks(document);

  statusMaps = markAllFromCache(statusMaps);

  hookListChanges();

  const cacheInvalid = localStorage.getItem('markread_cache_invalid') || isCacheExpired();

  if (cacheInvalid) {
    console.log('Dynasty-MarkRead: cache invalidated, refreshing...');
    promiseFetchMarkAll()
      .catch(error => {
        console.log(`Dynasty-MarkRead: ${error.name} occurred during cache refresh`, error);
      })
      .then(() => console.log('Dynasty-MarkRead: cache refresh successful'));
  }

  // TEMP CHANGE -- only refresh cache once every 24 hours
  // attachInvalidationListeners();
})();
