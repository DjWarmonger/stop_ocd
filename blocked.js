document.addEventListener('DOMContentLoaded', (event) => {

    /*
    getSetting('blockList', []).then((blockList) => {

        const foundElement = blockList.find(item => {
            return checkUrlMatch(item, url);
        });
        if (foundElement)
        {
            const minutes = (Date.now() - foundElement.blockedAt) / 60000;

            document.getElementById('message').textContent = "Site blocked. You already visited it " +
            minutes + " minutes ago.";
        }
    });
    */

    const urlParams = new URLSearchParams(window.location.search);
    document.getElementById('message').textContent = "Site blocked. You already visited it " +
    "TODO" + " minutes ago.";

    /*
    const urlParams = new URLSearchParams(window.location.search);
    document.getElementById('message').textContent = "Site blocked. You already visited it " +
    decodeURIComponent(urlParams.get('url')) + " minutes ago.";
    */
});
