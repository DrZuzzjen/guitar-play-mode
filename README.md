# Guitar Play Mode 🎸

A Chrome extension for guitarists that transforms chord/tab pages into a distraction-free, multi-column view. Say goodbye to constant scrolling while playing!

## Demo

https://github.com/DrZuzzjen/guitar-play-mode/raw/master/demo.mp4

## Quick Download

Download the latest version: [guitar-play-mode.zip](./guitar-play-mode.zip)

## Features

*   **Distraction-Free**: Fullscreen overlay showing only lyrics and chords.
*   **Multi-Column Layout**: Automatically adjusts columns based on screen width, or manually select 2, 3, or 4 columns.
*   **Edit Mode**: Click to hide unwanted blocks (intros, comments, etc.).
*   **Persistence**: Remembers your column preferences and hidden blocks for each song.
*   **Modular Adapters**: Currently supports **Cifraclub** and **Ultimate Guitar**.

## Installation (Developer Mode)

Since this extension is not yet in the Chrome Web Store, you need to install it manually:

1.  Clone or download this repository.
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable **Developer mode** in the top right corner.
4.  Click **Load unpacked**.
5.  Select the `guitar-play-mode` folder from this repository.

## Usage

1.  Go to a song page on [Cifraclub](https://www.cifraclub.com) or [Ultimate Guitar](https://www.ultimate-guitar.com).
2.  Click the **Guitar Play Mode** icon in the toolbar (or press `Alt+Shift+P`).
3.  Click **Activate Play Mode**.
4.  **Controls**:
    *   **Columns**: Switch between Auto, 2, 3, or 4 columns.
    *   **Edit**: Click "Edit", then click on any block of text to hide it. Click "Done" to save.
    *   **Exit**: Press `ESC` or click the close button.

## Contributing

This project is open source and contributions are welcome!

### Architecture

The extension uses a modular "Adapter" pattern to support different websites.
*   `content/adapters/`: Contains site-specific logic.
*   `content/content.js`: Main logic for the overlay and column system.

### Adding a New Site

1.  Create a new file in `content/adapters/` (e.g., `mysite.js`).
2.  Implement the adapter interface:
    ```javascript
    class MySiteAdapter {
      detect() { return window.location.hostname.includes('mysite.com'); }
      extractContent() { /* return HTMLElement */ }
      getStyles() { /* return CSS string */ }
    }
    ```
3.  Register the adapter in `content/adapters/index.js`.
4.  Add the URL pattern to `manifest.json` under `content_scripts`.

## License

MIT
