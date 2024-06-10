import { log } from '../log.js';

export function isUserLoggedIn()
{
  return new Promise((resolve) => {
    chrome.identity.getProfileUserInfo(function(userInfo) {
      log(`User logged in: ${!!userInfo.email}`);
      resolve(!!userInfo.email);
    });
  });
}
  
export function saveSetting(key, value)
{
  isUserLoggedIn().then(isLoggedIn => {
    const storage = isLoggedIn ? chrome.storage.sync : chrome.storage.local;
    storage.set({ [key]: value });
  });
}
  
export function getSetting(key, defaultValue = null)
{
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