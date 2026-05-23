document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('openBtn').addEventListener('click', function () {
        chrome.tabs.create({ url: chrome.runtime.getURL('app.html') });
        window.close();
    });
});