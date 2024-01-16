// Utility functions for managing the block list

function isDuplicate(url, blockList, type) {
  const extractedDomain = extractDomain(url);
  return blockList.some(item => {
    const itemDomain = extractDomain(item.url);
    if (type === 'url' && item.url === url) return true;
    if (type === 'domain' && itemDomain === extractedDomain) return true;
    if (item.type === 'domain' && type === 'url' && itemDomain === extractedDomain) return true;
    return false;
  });
}

function extractDomain(url) {
  const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i);
  return match ? match[1] : url;
}

function removeWebsiteFromBlockList(url, blockList, type) {
  return blockList.filter(item => !(item.url === url && item.type === type));
}

export { isDuplicate, removeWebsiteFromBlockList, extractDomain };
