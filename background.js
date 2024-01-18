function isUserLoggedIn() {
  return new Promise((resolve) => {
    chrome.identity.getProfileUserInfo(function(userInfo) {
      //console.log(`User logged in: ${!!userInfo.email}`);
      resolve(!!userInfo.email);
    });
  });
}

function saveSetting(key, value) {
  isUserLoggedIn().then(isLoggedIn => {
    const storage = isLoggedIn ? chrome.storage.sync : chrome.storage.local;
    storage.set({ [key]: value });
  });
}

function getSetting(key, defaultValue = null) {
  return new Promise((resolve, reject) => {
    isUserLoggedIn().then(isLoggedIn => {
      const storage = isLoggedIn ? chrome.storage.sync : chrome.storage.local;

      storage.get([key], function (result) {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          const value = result[key];
          if (value === undefined) {
            resolve(defaultValue);
          } else if (typeof value === 'number' && Number.isInteger(value)) {
            resolve(parseInt(value, 10));
          } else {
            resolve(value);
          }
        }
      });
    });
  });
}


function isLastTab(url, tabs) {
  console.log("Checking if it's the last open tab: ", url)
  return tabs.filter(tab => tab.url.includes(url)).length === 0;
}

function blockSite(url, blockList) {
  newId = 1;
  if (blockList.length) {
    id = blockList[blockList.length - 1].id;
    if (Number.isFinite(id)) {
      newId = id + 1;
    }
  }

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
  itemDomain =  new URL(item.url).hostname;
  urlDomain = new URL(url).hostname;

  ret = false;
  if (item.type == 'domain') {
    ret = urlDomain.includes(itemDomain);
  }
  else{
    ret = url == item.url;
  }
  return ret;
}

function isSiteBlocked(url) {

  blockInfo = {
    blocked: false,
    lastVisitTime: undefined
  }

  return getSetting('blockList', []).then((blockList) => {
    
    if (blockList == undefined || blockList == null) {
      return blockInfo;
    }
    if (!blockList.length) {
      return blockInfo;
    }

    const currentTime = Date.now();

    ret =  blockList.some(item => {

      if (item.blockedAt === undefined || item.blockedAt == null) {
        return blockInfo;
      }

      const matchUrl = checkUrlMatch(item, url);
      const timePassed = currentTime - item.blockedAt;
      const durationMs = item.duration * 60000; // Convert duration from minutes to milliseconds

      const isBlocked = matchUrl && timePassed < durationMs;
      /*
      console.log(
        `URL: ${item.url}, BlockedAt: ${new Date(item.blockedAt).toISOString()}, Duration: ${item.duration}, CurrentTime: ${new Date(currentTime).toISOString()}, IsBlocked: ${isBlocked}`
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
    console.log(`Tab ${tabId} does not exist`);
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
          //console.log(`Updated navigation, closing ${details.url}`)
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

function updateBlockTime(blockList, urlToUpdate) {

  //console.log('Blocklist: ', blockList)
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
    console.log("Stop OCD extension has been installed.");
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

      //console.log("Tab closed: ", closedTabUrl);

      const urlToCheck = closedTabUrl.hostname;
      if (isLastTab(urlToCheck, tabs)) {
        getSetting('blockList', []).then((blockList) => {
                    const updatedBlockList = updateBlockTime(blockList, closedTabUrl);
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
