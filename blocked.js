document.addEventListener('DOMContentLoaded', (event) => {

	const urlParams = new URLSearchParams(window.location.search);

	timeInfo = 'a moment ago';
	miliseconds = urlParams.get('lastvisittime');
	if (miliseconds)
	{
		const minutes = Math.floor((Date.now() - miliseconds) / 60000);
		if (minutes > 1)
		{
			timeInfo = `${minutes} minutes ago`
		}
		else if (minutes > 0)
		{
			timeInfo = `a minute ago`;
		}
	}

	document.getElementById('message').textContent = `Site ${urlParams.get('url')} is blocked.`;
	document.getElementById('timePassed').textContent = `You already visited it ${timeInfo}.`;
});
