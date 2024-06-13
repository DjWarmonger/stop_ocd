import { log } from './log.js';
import { saveSetting, getSetting } from './utils/storage.js';

function isLastTab(url, tabs)
{
  let lastTab = (tabs.filter(tab => tab.url.includes(url)).length == 0);
  return lastTab;
}

function checkUrlMatch(item, domain, blockType)
{
  let itemDomain = new URL(item).hostname;
  let urlDomain = new URL(domain).hostname;

  let itemUrl = new URL(item);

  if (itemUrl.pathname.startsWith('/embed') || itemUrl.pathname.startsWith('/plugins')) {
    // Exception for Youtube videos and Facebook embeds
    log("Ignoring embedded content");
    return false; // Do not block if it's not the main site
  }

  // Check if the top-level and second-level domain names match exactly
  let ret = false;
  if (blockType == 'domain') {

    if (itemDomain !== urlDomain) {
      ret = false;
    }
    else
    {
      ret = true;
    }
  }
  else {
    log("Checking exact address: ", itemUrl.pathname);
    ret = urlDomain === itemDomain;
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

      const matchUrl = checkUrlMatch(new URL(url), new URL(item.url), item.blockType);
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

async function updateBlockTime(urlToUpdate, expirationDate, blockType) 
{
  if (!(urlToUpdate instanceof URL)) 
  {
    console.error("urlToUpdate must be a URL object");
    return;
  }

  try
  {
    let lastVisitList = await getSetting('lastVisitList', []);

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
        expirationDate: expirationDate,
        blockType: blockType
      });
      log('Added new URL to lastVisitList: ', urlToUpdate.toString());
    }

    await saveSetting('lastVisitList', lastVisitList);
  }
  catch (error)
  {
    console.error('Failed to update block time:', error);
  }
}

chrome.runtime.onInstalled.addListener(async function() 
{
	console.log("Stop OCD extension has been installed.");
	const defaultSettings = 
	{
		blockList: [],
		whitelist: [],
		lastVisitList: []
	};

	// Initialize default settings if not present
	for (const [key, value] of Object.entries(defaultSettings)) 
	{
		try 
		{
			const currentValue = await getSetting(key, value);
			if (currentValue === null) 
			{
				await saveSetting(key, value);
			}
		} 
		catch (error) 
		{
			console.error('Failed to initialize default settings:', error);
		}
	}

	// Fix issue from 1.1.0
	try 
	{
		let lastVisitList = await getSetting('lastVisitList', []);
		lastVisitList.forEach(item => 
		{
			if (!item.blockType) 
			{
				item.blockType = "domain";
				log('Set default blockType for ', item.url);
			}
		});
		await saveSetting('lastVisitList', lastVisitList);
	} 
	catch (error) 
	{
		console.error('Failed to update lastVisitList:', error);
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
            let blockType = undefined;
						blockList.forEach(blockItem =>
						{
							if (checkUrlMatch(closedTabUrl, blockItem.url, blockItem.type))
							{
								urlMatchFound = true;
                expirationDate = Date.now() + blockItem.duration * 60000;
                blockType = blockItem.type;
							}
						});

            if (urlMatchFound)
            {
              log("Saving expiration date: ", expirationDate);
              updateBlockTime(closedTabUrl, expirationDate, blockType);
            }
					}).catch((error) =>
					{
						console.error('Failed to check blockList for URL match:', error);

            log("blockList: ", blockList);
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