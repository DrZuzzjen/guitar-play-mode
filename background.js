chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle_play_mode') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'activate_play_mode' });
      }
    });
  }
});
