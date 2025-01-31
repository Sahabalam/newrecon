document.getElementById('scanButton').addEventListener('click', async () => {
  try {
    console.log('Fetching payloads...');
    const response = await fetch(chrome.runtime.getURL('payload.json'));
    if (!response.ok) {
      throw new Error('Failed to load payloads');
    }
    const payloads = await response.json();
    console.log('Payloads loaded:', payloads);

    for (const payload of payloads) {
      console.log('Processing payload:', payload);
      const targetUrl = `https://brutelogic.com.br/gym.php?p17=${encodeURIComponent(payload)}`;
      console.log('Target URL:', targetUrl);

      chrome.tabs.create({ url: targetUrl, active: false }, (newTab) => {
        console.log('New tab created with ID:', newTab.id);
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
          if (tabId === newTab.id && changeInfo.status === 'complete') {
            console.log('Tab loaded, injecting script...');
            chrome.scripting.executeScript({
              target: { tabId: tabId },
              func: () => {
                console.log('Script injected, checking for alert...');
                const hadAlert = !!window.alert;
                window.alert = () => {};
                return hadAlert;
              },
            }, (results) => {
              if (results && results[0].result) {
                console.log(`XSS found with payload: ${payload}`);
                alert(`XSS found with payload: ${payload}`);
              }
              console.log('Closing tab...');
              chrome.tabs.remove(tabId);
            });

            chrome.tabs.onUpdated.removeListener(listener);
          }
        });
      });
    }
  } catch (error) {
    console.error('Error during scanning:', error);
    alert('An error occurred. Check the console for details.');
  }
});
