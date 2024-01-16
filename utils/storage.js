// Save a setting to Chrome storage using Promises
function saveSetting(key, value) {
  chrome.storage.local.set({ [key]: value });
}

// Retrieve a setting from Chrome storage using Promises
function getSetting(key, defaultValue = null) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], function (result) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (result[key] === undefined) {
        resolve(defaultValue);
      } else {
        resolve(result[key]);
      }
    });
  });
}

export { saveSetting, getSetting };
