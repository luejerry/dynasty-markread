# Dynasty Mark Read

This userscript visually marks chapters in your Read and To Read lists on all site views.

## Compatibility note
Since version 2.4, an updated browser with support for [async-await](https://caniuse.com/#feat=async-functions) is required. Your browser must be at the following versions or newer:

| Browser | Version | Released |
|----|----|----|
| Firefox | 52 | Mar 6, 2017 |
| Chrome | 55 | Nov 30, 2016 |
| Safari | 10.1 | Mar 26, 2017 |
| Edge | 15 | Apr 10, 2017 |

## Changelog
* 2.4: slight performance improvement. Refactored to use ES8 async-await.
* 2.3: chapters can now inherit Read status from their parent groupings.
    * Mechanism for cache reloading has changed. To force a cache reload, remove or add an item from a list using the list drop down, then navigate to the front page or any chapter list.
* 2.2: Subscribed items now marked in red.
* 2.1: now enabled for list views. Chapters on To Read list now marked in blue.
* 2.0: implement caching for significant performance improvement and removed perf logging.
* 1.9: output performance stats to console. Refactor to better adhere to ES6 best practices.
* 1.8: improved performance by skipping checking links with no text (e.g. image links).
* 1.7: refactoring for clarity. No functionality changes.
* 1.6: significant performance enhancement, especially on short lists.
* 1.5: now also works on chapters shown as thumbnails as well (e.g. on the main page).
* 1.4: slight optimizations.
* 1.3: null handling and code cleanup.
* 1.2: now applies to search results pages.
* 1.1: significant performance enhancement on large lists.
* 1.0: initial release.