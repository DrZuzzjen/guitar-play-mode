document.addEventListener('DOMContentLoaded', async () => {
  const activateBtn = document.getElementById('activate-btn');
  const statusMessage = document.getElementById('status-message');
  const colButtons = document.querySelectorAll('.column-selector button');

  // Load saved settings
  const { defaultColumns = 'auto' } = await chrome.storage.local.get('defaultColumns');
  updateColumnButtons(defaultColumns);

  // Check if current tab is supported
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) return;

  // Send message to content script to check support
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'check_support' });
    if (response && response.supported) {
      activateBtn.disabled = false;
    } else {
      activateBtn.disabled = true;
      statusMessage.textContent = 'Site not supported';
      statusMessage.classList.remove('hidden');
    }
  } catch (e) {
    // Content script might not be loaded or error
    activateBtn.disabled = true;
    statusMessage.textContent = 'Reload page to activate';
    statusMessage.classList.remove('hidden');
  }

  // Activate Play Mode
  activateBtn.addEventListener('click', () => {
    chrome.tabs.sendMessage(tab.id, { action: 'activate_play_mode' });
    window.close();
  });

  // Column selector
  colButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const cols = btn.dataset.cols;
      updateColumnButtons(cols);
      chrome.storage.local.set({ defaultColumns: cols });
    });
  });

  function updateColumnButtons(activeCols) {
    colButtons.forEach(btn => {
      if (btn.dataset.cols === activeCols) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
});
