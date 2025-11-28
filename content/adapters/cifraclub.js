window.GuitarPlayMode = window.GuitarPlayMode || {};

window.GuitarPlayMode.CifraclubAdapter = class {
  detect() {
    return window.location.hostname.includes('cifraclub.com');
  }

  extractContent() {
    // Cifraclub usually has a container with class 'cifra_cnt' or similar
    // We clone it to avoid messing with the original page events initially
    const container = document.querySelector('.cifra_cnt') || document.querySelector('pre');
    return container ? container.cloneNode(true) : null;
  }

  getStyles() {
    return `
      .cifra_cnt pre, pre {
        font-family: 'Courier New', Courier, monospace !important;
        font-size: 16px;
        line-height: 1.5;
        white-space: pre-wrap;
        color: #333;
      }
      b { color: #f96800; font-weight: bold; } /* Chords color */
      .tablatura { color: #2c3e50; }
    `;
  }
};
