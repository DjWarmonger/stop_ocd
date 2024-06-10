// Utility functions for managing the block behavior

export function blockSite(url, blockList) {

  console.log('UNUSED FUNCTION blockSite CALLED');

  blockList = blockList.filter(item => item.url !== url); // Remove existing entry if present
  blockList.push({
    //id: blockList.length ? blockList[blockList.length - 1].id + 1 : 1,
    url: url,
    //type: 'domain',
    duration: 60, // Assuming default 60 minutes block duration
    blockedAt: Date.now()
  });
  return blockList;
}

function onTabClosed(tabId, tabs) {

  console.log('UNUSED FUNCTION onTabClosed CALLED');
  const closedTab = tabs.find(tab => tab.id === tabId);
  if (closedTab) {
    return new URL(closedTab.url).hostname;
  } else {
    // If tab is not found, it might have already been removed from the array
    // Return null to indicate that we don't need to proceed with block check
    return null;
  }
}