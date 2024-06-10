let isLoggingEnabled = true; // You can toggle this to enable/disable logging

export function log(...args) {
  if (isLoggingEnabled) {
    console.log(...args);
  }
}

// Potentially toggle logs by persistent setting

/*
function updateLoggingPreference() {
  getSetting('loggingEnabled', true).then(enabled => {
    isLoggingEnabled = enabled;
  });
}

chrome.runtime.onInstalled.addListener(function() {
  saveSetting('loggingEnabled', true); // Default logging enabled
  updateLoggingPreference();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.toggleLogging !== undefined) {
    saveSetting('loggingEnabled', request.toggleLogging);
    isLoggingEnabled = request.toggleLogging;
  }
});

chrome.runtime.sendMessage({toggleLogging: false}); // Call this to disable logging
*/