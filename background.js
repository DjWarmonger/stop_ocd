// background.js

function saveSetting(key, value) {
  chrome.storage.local.set({ [key]: value });
}

function getSetting(key, defaultValue = null) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], function (result) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      }

      const value = result[key];
      if (value === undefined) {
        resolve(defaultValue);
      } else if (value === 'number' && Number.isInteger(value)) {
        resolve(parseInt(value, 10));
      } else {
        resolve(value);
      }
    });
  });
}

function isLastTab(url, tabs) {
  console.log("Checking if it's the last open tab: ", url)
  return tabs.filter(tab => tab.url.includes(url)).length === 0;
}

function blockSite(url, blockList) {
  //newId = blockList.length ? blockList[blockList.length - 1].id + 1 : 1;

  newId = 1;
  if (blockList.length) {
    id = blockList[blockList.length - 1].id;
    if (Number.isFinite(id)) {
      newId = id + 1;
    }
  }
  
  // Fixme: newId is NaN
  console.log("Blocking site, rule id: ", newId);

  blockList.push({
    id: newId,
    url: url,
    type: 'domain',
    blockedAt: Date.now(),
    duration: 60
  });
  return blockList;
}

function checkUrlMatch(item, url)
{
  //console.log(`item.url: ${item.url}, url: ${url}`)
  itemDomain =  new URL(item.url).hostname;
  urlDomain = new URL(url).hostname;

  ret = false;
  if (item.type == 'domain') {
    //console.log(`url domain: ${urlDomain}, url.hostname: ${itemDomain}`)
    ret = urlDomain.includes(itemDomain);
  }
  else{
    ret = url == item.url;
  }
  return ret;
}

function isSiteBlocked(url) {

  return getSetting('blockList', []).then((blockList) => {
    
    if (blockList == undefined || blockList == null) {
      return false;
    }
    if (!blockList.length) {
      return false;
    }

    const currentTime = Date.now();
    console.log('Checking if site is blocked for URL:', url);

    ret =  blockList.some(item => {

      if (item.blockedAt === undefined || item.blockedAt == null) {
        // FIXME: undefined
        console.log('item.blockedAt: ', item.blockedAt)
        return false;
      }

      const matchUrl = checkUrlMatch(item, url);
      const timePassed = currentTime - item.blockedAt;
      const durationMs = item.duration * 60000; // Convert duration from minutes to milliseconds
      console.log(`matchUrl: ${matchUrl}, timePassed: ${timePassed}`)

      const isBlocked = matchUrl && timePassed < durationMs;
      console.log(
        `URL: ${item.url}, BlockedAt: ${new Date(item.blockedAt).toISOString()}, Duration: ${item.duration}, CurrentTime: ${new Date(currentTime).toISOString()}, IsBlocked: ${isBlocked}`
      ); // Added logging
      return isBlocked;
    });

    console.log(`Is site blocked: ${ret}`);
    return ret;
  });
}

function checkTabExists(tabId, callback) {
  try
  {
    callback(tabId);
  }
  catch (error)
  {
    console.log(`Tab ${tabId} does not exist`);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url)
  {
      isSiteBlocked(changeInfo.url).then(isBlocked => {
        if (isBlocked) {
          console.log(`Updated tab, closing ${changeInfo.url}`)
          checkTabExists(tabId, (id) => {
            chrome.tabs.update({url: chrome.runtime.getURL('blocked.html')});

            //chrome.tabs.remove(id);
            // TODO: Show block page instead
          });
        }
      });
  }
});

// Alternatively, using webNavigation
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (isSiteBlocked(details.url)) {

    // FIXME: exception at closing non-existent tab
    console.log(`Updated navigation, closing ${details.url}`)
    checkTabExists(details.tabId, (id) => {
      //chrome.tabs.remove(id);
    });

  }
});

function updateBlockTime(blockList, urlToUpdate) {

  console.log('Blocklist: ', blockList)
  // FIXME? Update every url that is a sub-url of target url (including whole domain), but not unrelated urls within same domain?
  blockList.forEach(item => {
      if (item.url.includes(urlToUpdate.hostname)) {
          item.blockedAt = Date.now();
          console.log('Updated last visit time for ', item.url);
      }
  });
  saveSetting('blockList', blockList);
  return blockList
}

chrome.runtime.onInstalled.addListener(function() {
    console.log("Stop_OCD_2 extension has been installed.");
    const defaultSettings = {
        blockList: [],
        whitelist: []
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

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {

  chrome.tabs.query({}, (tabs) => {
    let closedTabUrl = tabUrls[tabId];
    if (closedTabUrl) {

      console.log("Tab closed: ", closedTabUrl);

      const urlToCheck = closedTabUrl.hostname;
      if (isLastTab(urlToCheck, tabs)) {
        getSetting('blockList', []).then((blockList) => {
                    const updatedBlockList = updateBlockTime(blockList, closedTabUrl);
                    console.log('Block Listener details:', updatedBlockList);
                    //updateBlockingRules(updatedBlockList);
        }).catch((error) => {
                console.error('Failed to retrieve block list:', error);
        });
      }
    delete tabUrls[tabId];
  }
  });
});

function createBlockListener(blockList) {
  return function(details) {
    if (isSiteBlocked(details.url)) {
      return { redirectUrl: chrome.runtime.getURL("blocked.html?url=" + encodeURIComponent(details.url)) };
    }
  };
}
