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
      <button id="gpm-restore-btn" class="gpm-action-btn" style="display: none;">Restore All</button>
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
    document.getElementById('gpm-restore-btn').addEventListener('click', restoreAllBlocks);
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
    const restoreBtn = document.getElementById('gpm-restore-btn');
    
    if (isEditMode) {
      btn.classList.add('editing');
      btn.textContent = 'Done (ESC)';
      overlay.classList.add('gpm-editing');
      restoreBtn.style.display = 'block';
    } else {
      btn.classList.remove('editing');
      btn.textContent = 'Edit';
      overlay.classList.remove('gpm-editing');
      restoreBtn.style.display = 'none';
    }
  }

  function prepareBlocks() {
    const root = contentContainer.firstElementChild;
    if (!root) return;

    // Heuristic: Does it have many block children?
    const blockTags = ['DIV', 'P', 'SECTION', 'PRE'];
    const hasBlockChildren = Array.from(root.children).some(child => blockTags.includes(child.tagName));

    if (hasBlockChildren) {
        Array.from(root.children).forEach((child, i) => {
            child.classList.add('gpm-editable-block');
            child.dataset.gpmId = i;
        });
        attachClickHandlers();
        return;
    }

    // DOM-based splitting to avoid innerHTML XSS risks
    const newContent = document.createDocumentFragment();
    let currentBlock = document.createElement('div');
    currentBlock.className = 'gpm-editable-block';
    currentBlock.dataset.gpmId = 0;
    
    let blockIndex = 0;
    const childNodes = Array.from(root.childNodes); // Snapshot
    
    const startNewBlock = () => {
        if (currentBlock.hasChildNodes()) {
            newContent.appendChild(currentBlock);
        }
        blockIndex++;
        currentBlock = document.createElement('div');
        currentBlock.className = 'gpm-editable-block';
        currentBlock.dataset.gpmId = blockIndex;
    };

    for (let i = 0; i < childNodes.length; i++) {
        const node = childNodes[i];
        
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            // Check for double newlines
            const parts = text.split(/\n\s*\n/);
            
            if (parts.length > 1) {
                parts.forEach((part, index) => {
                    if (index > 0) startNewBlock();
                    if (part) currentBlock.appendChild(document.createTextNode(part));
                });
            } else {
                currentBlock.appendChild(node.cloneNode(true));
            }
        } else if (node.tagName === 'BR') {
            // Check if next is BR (Double BR -> Split)
            const next = childNodes[i+1];
            if (next && next.tagName === 'BR') {
                startNewBlock();
                i++; // Skip next BR
            } else {
                currentBlock.appendChild(node.cloneNode(true));
            }
        } else {
            currentBlock.appendChild(node.cloneNode(true));
        }
    }
    
    if (currentBlock.hasChildNodes()) {
        newContent.appendChild(currentBlock);
    }
    
    root.innerHTML = ''; 
    root.appendChild(newContent);
    
    attachClickHandlers();
  }

  function attachClickHandlers() {
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
      hiddenBlocks.add(id);
      saveHiddenBlocks();
    }
  }

  function restoreAllBlocks() {
    hiddenBlocks.clear();
    saveHiddenBlocks();
    applyHiddenBlocks();
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
        } else {
            block.classList.remove('gpm-hidden-block');
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
