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

    // Retry logic for SPAs (like Ultimate Guitar) where content might load late
    let attempts = 0;
    const maxAttempts = 10; // Try for 2 seconds (200ms * 10)
    
    const tryExtract = () => {
        const content = adapter.extractContent();
        if (content) {
            // Success!
            initializeContent(content);
        } else {
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(tryExtract, 200);
            } else {
                alert('Could not extract song content. The page might not be fully loaded yet.');
            }
        }
    };
    
    tryExtract();
  }

  function initializeContent(content) {
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
    let root = contentContainer.firstElementChild;
    if (!root) return;

    // TARGET SELECTION STRATEGY:
    // 1. If root IS a PRE tag, use it directly
    // 2. Otherwise look for a PRE tag inside
    // 3. If not found, drill down through single-child wrappers

    let targetNode = root;

    if (root.tagName === 'PRE') {
        // Root is already the PRE, use it directly
        targetNode = root;
    } else {
        // Look for PRE inside
        const pre = root.querySelector('pre');
        if (pre) {
            targetNode = pre;
        } else {
            // Fallback: Drill down if only one element child (e.g. div > div > content)
            while (targetNode.children.length === 1 && ['DIV', 'SECTION'].includes(targetNode.firstElementChild.tagName)) {
                 targetNode = targetNode.firstElementChild;
            }
        }
    }
    
    // Now we have our targetNode (e.g. the PRE tag).
    // We want to replace the *content* of contentContainer with the split blocks from targetNode.
    // But we must preserve the styling of targetNode (e.g. font-family of pre).

    // NEW: Strip UI elements from PRE (Ultimate Guitar adds DIVs for close buttons etc.)
    if (targetNode.tagName === 'PRE') {
        // Remove any DIV children that are UI elements (short content like "X")
        // Performance: PRE tags usually have very few DIV children (often just 1 or 2 UI elements),
        // so querySelectorAll is fast enough here.
        Array.from(targetNode.querySelectorAll('div')).forEach(div => {
            if (div.textContent.trim().length <= 2) {
                div.remove();
            }
        });
    }
    
    const originalTag = targetNode.tagName;
    const originalClasses = targetNode.className;
    
    // Check if it's already "blocked" (has block children like P or DIV)
    // If we found a PRE, it likely contains text/spans, not divs, so we proceed to split.
    // If it's a DIV, it might already have paragraphs.
    
    const blockTags = ['DIV', 'P', 'SECTION', 'TABLE', 'UL', 'OL'];
    // Note: PRE is not in blockTags here because if we found a PRE, we WANT to split its internal text.
    const hasBlockChildren = Array.from(targetNode.children).some(child => blockTags.includes(child.tagName));

    if (hasBlockChildren && originalTag !== 'PRE') {
        // It's already structured (e.g. paragraphs). Just make them editable.
        const fragment = document.createDocumentFragment();
        Array.from(targetNode.children).forEach((child, i) => {
            child.classList.add('gpm-editable-block');
            child.dataset.gpmId = i;
            fragment.appendChild(child);
        });
        
        contentContainer.innerHTML = '';
        contentContainer.appendChild(fragment);
        attachClickHandlers();
        return;
    }

    // DOM-based splitting for text/mixed content (PRE or text-heavy DIV)
    const newContent = document.createDocumentFragment();
    let blockIndex = 0;
    
    // Helper to create a new block
    const createBlock = (lines) => {
        // Use PRE tag if original was PRE to keep styling, otherwise DIV
        const tag = originalTag === 'PRE' ? 'pre' : 'div';
        const el = document.createElement(tag);
        el.className = `gpm-editable-block ${originalClasses}`; 
        el.dataset.gpmId = blockIndex++;
        
        el.style.margin = '0 0 10px 0';
        el.style.whiteSpace = 'pre-wrap'; 
        // Force inherit font if it was PRE, just in case class doesn't cover it
        if (originalTag === 'PRE') el.style.fontFamily = 'inherit'; 

        lines.forEach((frag, idx) => {
            if (idx > 0) el.appendChild(document.createElement('br'));
            el.appendChild(frag);
        });
        return el;
    };

    const childNodes = Array.from(targetNode.childNodes);
    
    let lineBuffer = document.createDocumentFragment();
    let lines = []; 
    
    const flushLine = () => {
        lines.push(lineBuffer);
        lineBuffer = document.createDocumentFragment();
    };
    
    const processNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const parts = node.textContent.split('\n');
            parts.forEach((part, i) => {
                if (i > 0) flushLine();
                if (part) lineBuffer.appendChild(document.createTextNode(part));
            });
        } else if (node.tagName === 'BR') {
            flushLine();
        } else {
            lineBuffer.appendChild(node.cloneNode(true));
        }
    };
    
    childNodes.forEach(processNode);
    flushLine(); 
    
    // Group into chunks of 4
    let chunk = [];
    lines.forEach((lineFrag) => {
        chunk.push(lineFrag);
        if (chunk.length >= 4) {
            newContent.appendChild(createBlock(chunk));
            chunk = [];
        }
    });
    
    if (chunk.length > 0) {
        newContent.appendChild(createBlock(chunk));
    }
    
    contentContainer.innerHTML = ''; 
    contentContainer.appendChild(newContent);
    
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
