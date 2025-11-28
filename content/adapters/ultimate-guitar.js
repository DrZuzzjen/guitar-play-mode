window.GuitarPlayMode = window.GuitarPlayMode || {};

window.GuitarPlayMode.UltimateGuitarAdapter = class {
  detect() {
    return window.location.hostname.includes('ultimate-guitar.com');
  }

  extractContent() {
    // Ultimate Guitar uses dynamic classes, but often the content is in a <pre> tag inside a specific wrapper.
    // We look for the main tab content.
    // Sometimes it's inside `[class*="_3F2CP"]` or similar (generated classes).
    // But usually there is a `pre` tag that holds the text content.
    // We will try to find the largest PRE element on the page as a heuristic.
    
    const pres = document.querySelectorAll('pre');
    let content = null;
    let maxLength = 0;
    
    pres.forEach(pre => {
      if (pre.textContent.length > maxLength) {
        maxLength = pre.textContent.length;
        content = pre;
      }
    });

    // Fallback: look for specific container if pre is not found or too small
    if (!content || maxLength < 100) {
        const container = document.querySelector('section > div > code > pre');
        if (container) content = container;
    }

    return content ? content.cloneNode(true) : null;
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
    `;
  }
};
