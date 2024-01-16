// Utility functions for managing site blocking with Chrome webRequest API

/*
function createBlockListener(blockList) {
  return function(details) {
    if (isSiteOnBlockList(details.url, blockList)) {
      return { redirectUrl: chrome.runtime.getURL("blocked.html?url=" + encodeURIComponent(details.url)) };
    }
  };
}
*/

//export { createBlockListener };

function isSiteOnBlockList(url, blockList) {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname;
  return blockList.some(blocked => hostname.includes(blocked));
}
