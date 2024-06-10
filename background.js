import { log } from './log.js';
import { saveSetting, getSetting } from './utils/storage.js';
// FIXME: Unused import doesn't work?
import { blockSite } from './utils/blockManagement.js';

function isLastTab(url, tabs)
{
  let lastTab = (tabs.filter(tab => tab.url.includes(url)).length == 0);
  return lastTab;
}

function checkUrlMatch(item, domain)
{
  // TODO: ignore things that are not webpages (ie. extension tabs)
  let itemDomain = new URL(item).hostname;
  let urlDomain = new URL(domain).hostname;

  let ret = false;
  if (item.type == 'domain') {
    ret = itemDomain.includes(urlDomain)
  }
  else{
    ret = urlDomain == itemDomain;
  }
  return ret;
}

function isSiteBlocked(url) {

  let blockInfo = {
    blocked: false,
    lastVisitTime: undefined
  }

  return getSetting('lastVisitList', []).then((lastVisitList) => {
    
    if (lastVisitList == undefined || lastVisitList == null) {
      return blockInfo;
    }
    if (!lastVisitList.length) {
      return blockInfo;
    }

    const currentTime = Date.now();

    lastVisitList.some(item => {

      if (item.blockedAt === undefined || item.blockedAt == null) {
        return blockInfo;
      }

      const matchUrl = checkUrlMatch(new URL(url), new URL(item.url));
      const isBlocked = matchUrl && currentTime < item.expirationDate;

      /*
      log(
        `URL: ${item.url}, BlockedAt: ${new Date(item.blockedAt).toString()}, Expires at: ${new Date(item.expirationDate).toString()}, CurrentTime: ${new Date(currentTime).toString()}, IsBlocked: ${isBlocked}`
      );
      */

      if (isBlocked)
      {
        blockInfo.blocked = true;
        blockInfo.lastVisitTime = item.blockedAt;
      }

      return isBlocked;
    });

    return blockInfo;
  });
}

function checkTabExists(tabId, callback) {
  try
  {
    callback(tabId);
  }
  catch (error)
  {
    log(`Tab ${tabId} does not exist`);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url)
  {
    isSiteBlocked(changeInfo.url).then(blockInfo => {
      if (blockInfo.blocked) {
        checkTabExists(tabId, (id) => {
          chrome.tabs.update({url: chrome.runtime.getURL('blocked.html') + `?url=${changeInfo.url}&lastvisittime=${blockInfo.lastVisitTime}`});

        });
      }
    });
  }
});

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if(details.url)
  {
    isSiteBlocked(details.url).then(blockInfo => {
      if (blockInfo.blocked) {
        checkTabExists(details.tabId, (id) => {
          log(`Updated navigation, closing ${details.url}`)
          chrome.tabs.update({url: chrome.runtime.getURL('blocked.html') + `?url=${details.url}&lastvisittime=${blockInfo.lastVisitTime}`});
        });
      }
    });
  }
  // FIXME: exception at closing non-existent tab?
  /*
  checkTabExists(details.tabId, (id) => {
    //chrome.tabs.remove(id);
  });
  */
});

function updateBlockTime(urlToUpdate, expirationDate) 
{
	if (!(urlToUpdate instanceof URL)) 
	{
		console.error("urlToUpdate must be a URL object");
		return;
	}

  getSetting('lastVisitList', []).then((lastVisitList) => {

    let found = false;
    lastVisitList.forEach(item => 
    {
      if (item.url.includes(urlToUpdate.hostname)) 
      {
        item.blockedAt = Date.now();
        item.expirationDate = expirationDate;
        log('Updated last visit time for ', item.url);
        found = true;
      }
    });

    if (!found) 
    {
      // Add new entry to lastVisitList
      lastVisitList.push(
      {
        url: urlToUpdate.toString(),
        blockedAt: Date.now(),
        expirationDate: expirationDate
      });
      log('Added new URL to lastVisitList: ', urlToUpdate.toString());
    }

    saveSetting('lastVisitList', lastVisitList);
    return lastVisitList;
  });
}

chrome.runtime.onInstalled.addListener(function() {
    console.log("Stop OCD extension has been installed.");
    const defaultSettings = {
        blockList: [],
        whitelist: [],
        lastVisitList: []
    };
    for (const [key, value] of Object.entries(defaultSettings)) {
        getSetting(key, value).then((currentValue) => {
            if (currentValue === null) {
                saveSetting(key, value);
            }
        }).catch((error) => {
            console.error('Failed to initialize default settings:', error);
        });
    }
});

let tabUrls = {};

// Track tab URLs when they are updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        tabUrls[tabId] = new URL(changeInfo.url);
    }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) =>
{
	chrome.tabs.query({}, (tabs) =>
	{
		let closedTabUrl = tabUrls[tabId];
		if (closedTabUrl)
		{
			// Ensure closedTabUrl is a valid URL object or string
			if (typeof closedTabUrl === 'string' || closedTabUrl instanceof URL)
			{
				// Proceed with operations using closedTabUrl
				if (isLastTab(closedTabUrl, tabs))
				{
					getSetting('blockList', []).then((blockList) =>
					{
						let urlMatchFound = false;
            let expirationDate = undefined;
						blockList.forEach(blockItem =>
						{
							if (checkUrlMatch(closedTabUrl, blockItem.url))
							{
								urlMatchFound = true;
                expirationDate = Date.now() + blockItem.duration * 60000;
							}
						});

            if (urlMatchFound)
            {
              log("Saving expiration date: ", expirationDate);
              updateBlockTime(closedTabUrl, expirationDate);
            }
					}).catch((error) =>
					{
						console.error('Failed to check blockList for URL match:', error);
					});
				}
			}
			else
			{
				console.error('Invalid URL stored for tabId:', tabId);
			}
		}
		else
		{
			console.log('No URL found for closed tabId:', tabId);
		}

		// Cleanup the URL from tabUrls to prevent memory leaks
		delete tabUrls[tabId];
	});
});

function createBlockListener(blockList) {
  return function(details) {
    if (isSiteBlocked(details.url)) {
      return { redirectUrl: chrome.runtime.getURL("blocked.html?url=" + encodeURIComponent(details.url)) };
    }
  };
}