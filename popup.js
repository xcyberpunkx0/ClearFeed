// popup.js (v1.1)

document.addEventListener('DOMContentLoaded', () => {
  const settings = ['hideShorts', 'hideSidebar'];
  
  // 1. Load Initial State
  chrome.storage.sync.get(settings, (data) => {
    settings.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = data[id] !== false;
    });
  });

  // 2. React to Toggles
  settings.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('change', (e) => {
      const val = e.target.checked;
      chrome.storage.sync.set({ [id]: val }, () => {
        // Sync with active YouTube tabs
        chrome.tabs.query({ url: "*://*.youtube.com/*" }, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { action: 'updateSettings' }).catch(() => {
              // Ignore orphaned tabs
            });
          });
        });
      });
    });
  });
});
