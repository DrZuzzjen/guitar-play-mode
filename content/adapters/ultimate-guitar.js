window.GuitarPlayMode = window.GuitarPlayMode || {};

window.GuitarPlayMode.UltimateGuitarAdapter = class {
  detect() {
    return window.location.hostname.includes('ultimate-guitar.com');
  }

  extractContent() {
    // Try multiple strategies to find the content
    // Prioritize JSON extraction for modern pages
    return this.findJsStoreContent() ||    // NEW: JSON from data-content attribute
           this.findUgAppContent() ||       // NEW: JSON from window.UGAPP global
           this.findCodeBlockPre() ||       // Existing: code > pre
           this.findLargestPre() ||         // Existing: heuristic fallback
           this.findDataAttributePre() ||   // Existing: [data-name="tab-content"]
           this.findJsTabContentPre();      // Existing: .js-tab-content
  }

  findJsStoreContent() {
    try {
      const element = document.querySelector('.js-store');
      if (!element || !element.dataset.content) return null;

      const data = JSON.parse(element.dataset.content);
      const content = data?.store?.page?.data?.tab_view?.wiki_tab?.content;
      
      if (!content) return null;

      return this.convertUgMarkup(content);
    } catch (e) {
      console.error('Guitar Play Mode: Failed to parse .js-store content', e);
      return null;
    }
  }

  findUgAppContent() {
    try {
      // Accessing global window object safely
      // Note: In a content script, window.UGAPP might not be available due to isolation.
      const ugApp = window.UGAPP;
      const content = ugApp?.store?.page?.data?.tab_view?.wiki_tab?.content;
      
      if (!content) return null;

      return this.convertUgMarkup(content);
    } catch (e) {
      console.error('Guitar Play Mode: Failed to access window.UGAPP content', e);
      return null;
    }
  }

  convertUgMarkup(content) {
    if (typeof content !== 'string') return null;

    const pre = document.createElement('pre');
    
    // Simple HTML escape to prevent XSS and rendering issues
    const escapeHtml = (unsafe) => {
        return unsafe.replace(/[&<>"']/g, m => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        })[m]);
    };

    // Security Note: We use a simple escape-then-replace strategy.
    // 1. We escape ALL special HTML characters in the input string.
    // 2. We then replace the known safe markers ([ch], [tab]) with HTML tags.
    // This ensures that any user-injected HTML tags in the content are escaped and rendered as text,
    // while our specific markers are converted to HTML.
    // This avoids the need for a heavy sanitization library like DOMPurify for this specific use case.
    // Assumption: content is raw text (JSON string), not HTML.
    // If content contains "&amp;", it will be rendered as "&amp;" (double escaped),
    // which is correct if the original text was literally "&amp;".
    let safeContent = escapeHtml(content);

    // Replace UG markup with HTML
    // Performance: String replacement is efficient enough for typical tab sizes (<100KB).
    let html = safeContent
      .replace(/\[ch\](.*?)\[\/ch\]/g, '<span class="ug-chord">$1</span>')
      .replace(/\[tab\](.*?)\[\/tab\]/g, '<span class="ug-tab">$1</span>');
      
    pre.innerHTML = html;
    return pre;
  }

  findLargestPre() {
    const pres = document.querySelectorAll('pre');
    let content = null;
    let maxLength = 0;
    
    pres.forEach(pre => {
        // Filter out very small pre tags, but be generous.
        // Some short songs or intros might be small.
        if (pre.textContent.length > maxLength && pre.textContent.length > 20) {
            maxLength = pre.textContent.length;
            content = pre;
        }
    });
    return content ? content.cloneNode(true) : null;
  }

  findCodeBlockPre() {
    // This selector matches the structure seen in "Wish You Were Here"
    const codeBlock = document.querySelector('code > pre');
    return codeBlock ? codeBlock.cloneNode(true) : null;
  }

  findDataAttributePre() {
    const tabContent = document.querySelector('[data-name="tab-content"]');
    if (tabContent) {
        const pre = tabContent.querySelector('pre');
        if (pre) return pre.cloneNode(true);
    }
    return null;
  }

  findJsTabContentPre() {
      // Fallback for older or different layouts
      // Try class first
      const container = document.querySelector('.js-tab-content');
      if (container) {
          const pre = container.querySelector('pre');
          if (pre) return pre.cloneNode(true);
      }
      return null;
  }

  getStyles() {
    return `
      pre {
        font-family: 'Courier New', Courier, monospace !important;
        font-size: 15px;
        line-height: 1.5;
        white-space: pre-wrap;
        color: #000;
      }
      span[style*="color: rgb(0, 0, 0)"] { color: #000 !important; }
      span[style*="color: rgb(140, 0, 0)"] { color: #e74c3c !important; font-weight: bold; } /* Chords often red/brown */
      
      /* UG specific span classes for chords often change, but they usually have inline styles or specific data attributes */
      [data-name="chord"] {
        color: #3498db !important;
        font-weight: bold;
      }

      /* New styles for JSON extracted content */
      .ug-chord {
        color: #e74c3c;
        font-weight: bold;
      }
      .ug-tab {
        /* tablature sections, keep monospace */
      }
    `;
  }
};
