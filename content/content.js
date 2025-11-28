(function() {
  if (window.GuitarPlayMode && window.GuitarPlayMode.initialized) return;
  window.GuitarPlayMode = window.GuitarPlayMode || {};
  window.GuitarPlayMode.initialized = true;

  const { getAdapter } = window.GuitarPlayMode;
  let adapter = null;
  let overlay = null;
  let contentContainer = null;
  let toolbar = null;
  let isEditMode = false;
  let currentColumns = 'auto';
  let hiddenBlocks = new Set(); 

  // Listen for messages
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'check_support') {
      adapter = getAdapter();
      sendResponse({ supported: !!adapter });
    } else if (request.action === 'activate_play_mode') {
      activatePlayMode();
    }
  });

  function activatePlayMode() {
    adapter = getAdapter();
    if (!adapter) {
      alert('Site not supported or not detected.');
      return;
    }

    if (!overlay) {
      createOverlay();
    }

    const content = adapter.extractContent();
    if (!content) {
      alert('Could not extract song content.');
      return;
    }

    // Prepare content
    contentContainer.innerHTML = '';
    contentContainer.appendChild(content);
    
    // Inject adapter styles
    const styleId = 'gpm-adapter-style';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = adapter.getStyles();

    // Load saved preferences
    loadPreferences().then(() => {
      applyColumns(currentColumns);
      prepareBlocks(); // Split content into blocks if needed
      applyHiddenBlocks();
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden'; // Prevent scrolling on main page
    });
  }

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'guitar-play-mode-overlay';
    
    toolbar = document.createElement('div');
    toolbar.id = 'gpm-toolbar';
    toolbar.innerHTML = `
      <div class="gpm-btn-group">
        <button class="gpm-btn" data-cols="auto">Auto</button>
        <button class="gpm-btn" data-cols="2">2</button>
        <button class="gpm-btn" data-cols="3">3</button>
        <button class="gpm-btn" data-cols="4">4</button>
      </div>
      <button id="gpm-edit-btn" class="gpm-action-btn">Edit</button>
      <button id="gpm-close-btn" class="gpm-close-btn">✕</button>
    `;

    contentContainer = document.createElement('div');
    contentContainer.id = 'gpm-content';

    overlay.appendChild(toolbar);
    overlay.appendChild(contentContainer);
    document.body.appendChild(overlay);

    // Event listeners
    toolbar.querySelectorAll('.gpm-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cols = e.target.dataset.cols;
        setColumns(cols);
      });
    });

    document.getElementById('gpm-edit-btn').addEventListener('click', toggleEditMode);
    document.getElementById('gpm-close-btn').addEventListener('click', closePlayMode);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (!overlay.classList.contains('active')) return;
      
      if (e.key === 'Escape') {
        if (isEditMode) {
          toggleEditMode();
        } else {
          closePlayMode();
        }
      }
      
      if (e.key === 'e' || e.key === 'E') {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          toggleEditMode();
        }
      }
    });

    // Resize observer for Auto mode
    window.addEventListener('resize', () => {
      if (currentColumns === 'auto' && overlay.classList.contains('active')) {
        applyColumns('auto');
      }
    });
  }

  function setColumns(cols) {
    currentColumns = cols;
    applyColumns(cols);
    chrome.storage.local.set({ defaultColumns: cols });
    
    // Update active button
    toolbar.querySelectorAll('.gpm-btn').forEach(btn => {
      if (btn.dataset.cols === cols) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }

  function applyColumns(cols) {
    let colCount = 2;
    if (cols === 'auto') {
      const width = window.innerWidth;
      colCount = Math.floor(width / 400);
      if (colCount < 2) colCount = 2;
      if (colCount > 4) colCount = 4;
    } else {
      colCount = parseInt(cols);
    }
    
    contentContainer.style.columnCount = colCount;
    
    toolbar.querySelectorAll('.gpm-btn').forEach(btn => {
      if (btn.dataset.cols === cols) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }

  function closePlayMode() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    if (isEditMode) toggleEditMode();
  }

  function toggleEditMode() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('gpm-edit-btn');
    
    if (isEditMode) {
      btn.classList.add('editing');
      btn.textContent = 'Done (ESC)';
      overlay.classList.add('gpm-editing');
    } else {
      btn.classList.remove('editing');
      btn.textContent = 'Edit';
      overlay.classList.remove('gpm-editing');
    }
  }

  function prepareBlocks() {
    // Try to identify blocks.
    // If we have a PRE, we try to split it into divs if it's not already structured.
    const pre = contentContainer.querySelector('pre');
    
    if (pre) {
        // Check if it already has block children
        if (pre.children.length === 0 || pre.querySelector('br')) {
            // It's likely text with BRs or just newlines.
            // We'll try to split by double newlines to create "verses".
            const html = pre.innerHTML;
            // We use a regex to find double newlines, but we must be careful with tags.
            // A safer way is to iterate over text nodes, but that's complex.
            // Let's try a simple split if it looks safe (no complex nesting).
            
            // If the content is mostly text and <b>/<span> tags, splitting by \n\n is usually safe enough for display.
            const parts = html.split(/\n\s*\n/);
            if (parts.length > 1) {
                pre.innerHTML = parts.map((part, i) => `<div class="gpm-editable-block" data-gpm-id="${i}">${part}</div>`).join('\n\n');
            } else {
                // Just one block
                pre.classList.add('gpm-editable-block');
                pre.dataset.gpmId = 0;
            }
        } else {
            // It has children, maybe divs or spans.
            Array.from(pre.children).forEach((child, i) => {
                child.classList.add('gpm-editable-block');
                child.dataset.gpmId = i;
            });
        }
    } else {
        // Maybe it's a container with divs
        const children = contentContainer.children;
        Array.from(children).forEach((child, i) => {
            child.classList.add('gpm-editable-block');
            child.dataset.gpmId = i;
        });
    }

    // Attach click handlers
    const blocks = contentContainer.querySelectorAll('.gpm-editable-block');
    blocks.forEach(block => {
        block.onclick = (e) => {
            if (!isEditMode) return;
            e.stopPropagation();
            hideBlock(block.dataset.gpmId);
        };
    });
  }

  function hideBlock(id) {
    const block = contentContainer.querySelector(`[data-gpm-id="${id}"]`);
    if (block) {
      block.classList.add('gpm-hidden-block');
      hiddenBlocks.add(id); // Store as string or int, consistent with dataset
      saveHiddenBlocks();
    }
  }

  async function loadPreferences() {
    const { defaultColumns } = await chrome.storage.local.get('defaultColumns');
    if (defaultColumns) currentColumns = defaultColumns;

    const url = window.location.href;
    const { hiddenBlocksMap = {} } = await chrome.storage.local.get('hiddenBlocksMap');
    if (hiddenBlocksMap[url]) {
      hiddenBlocks = new Set(hiddenBlocksMap[url]);
    } else {
      hiddenBlocks = new Set();
    }
  }

  function applyHiddenBlocks() {
    const blocks = contentContainer.querySelectorAll('.gpm-editable-block');
    blocks.forEach(block => {
        if (hiddenBlocks.has(block.dataset.gpmId)) {
            block.classList.add('gpm-hidden-block');
        }
    });
  }

  function saveHiddenBlocks() {
    const url = window.location.href;
    chrome.storage.local.get('hiddenBlocksMap', (result) => {
      const map = result.hiddenBlocksMap || {};
      map[url] = Array.from(hiddenBlocks);
      chrome.storage.local.set({ hiddenBlocksMap: map });
    });
  }

})();
