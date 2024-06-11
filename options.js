
import { log } from './log.js';

import { saveSetting, getSetting } from './utils/storage.js';
import { showError } from './utils/ui.js';
import { isDuplicate, removeWebsiteFromBlockList } from './utils/blockListManager.js';

log("Options script loaded and running.");


document.addEventListener('DOMContentLoaded', function ()
{
	getSetting('blockList').then(existingBlockList =>
	{
		if (!existingBlockList)
		{
			saveSetting('blockList', []); // Initialize with an empty array if not present
			log('Initialized block list');
		}
		else
		{
			log("Block list already exists: ", existingBlockList);
		}
	});
	// Current list of recently visited and blocked sites
	getSetting('lastVisitList').then(existingLastVisitList =>
	{
		if (!existingLastVisitList)
		{
			saveSetting('lastVisitList', []); // Initialize with an empty array if not present
			log('Initialized last visit list');
		}
		else
		{
			log("Last visit list already exists: ", existingLastVisitList);
		}
	});

	getSetting('blockList', []).then(blockList =>
	{
		populateBlockList(blockList);
	});
	const form = document.getElementById('blocklist-form');
	form.addEventListener('submit', addWebsiteToBlockList);
});

function populateBlockList(blockList) {
	log("Populating block list: ", blockList);
	const listContainer = document.getElementById('block-list');
	listContainer.innerHTML = '';
	blockList.forEach((item) => {
		const listItem = document.createElement('div');
		listItem.className = 'block-list-item';
		listItem.textContent = `${item.url} - ${item.duration} minutes`;
		const removeButton = document.createElement('button');
		removeButton.textContent = 'Remove';
		removeButton.onclick = function() {
			const updatedBlockList = removeWebsiteFromBlockList(item.url, blockList, item.type);
			saveSetting('blockList', updatedBlockList);
			populateBlockList(updatedBlockList);
		};
		listItem.appendChild(removeButton);
		listContainer.appendChild(listItem);
	});
}

function addWebsiteToBlockList(event) {
	event.preventDefault();
	const urlInput = document.getElementById('website-url');
	const durationInput = document.getElementById('block-duration');
	const blockType = document.getElementById('block-type').value;
	if (!urlInput.value || !durationInput.value) {
		showError('Both URL and Duration are required fields!');
		return;
	}
	getSetting('blockList', []).then(blockList => {
		if (isDuplicate(urlInput.value, blockList, blockType)) {
		  showError('This website is already on the block list.');
		  return;
		}
		log("Adding website to block list: ", urlInput.value, " for ", durationInput.value, " minutes");
		blockList.push({
			url: urlInput.value,
			duration: parseInt(durationInput.value, 10),
			type: blockType
		});
		saveSetting('blockList', blockList);
		populateBlockList(blockList);
		urlInput.value = '';
		durationInput.value = '60'; // Reset duration input to default
	});
}

// TODO: Remove page from last visit list when it's removed from block list