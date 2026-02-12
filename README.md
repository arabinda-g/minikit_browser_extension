# MiniKit

Browser extension with configurable window and tab productivity features.

## Features

### Auto-Maximize Newly Opened Chrome Windows
- Automatically maximizes newly opened Chrome windows.
- Supports exclusion by URL pattern list (regex, one per line).
- If any tab URL in the new window matches an exclusion regex, that window is not maximized.

### Ctrl+Q Switches to Last Tab (Google Chrome Only)
- Shortcut command switches to the previously used tab in the current Chrome window.
- Operates only in the current window.
- Can be enabled or disabled from extension options.

## Options Page
- Open extension options and configure:
  - Auto-maximize on/off
  - Excluded URL regex patterns
  - Ctrl+Q last-tab switching on/off

## Load in Chrome (Developer Mode)
1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this project folder.

## Cross-Browser Note
- The extension uses WebExtension-compatible APIs and can be adapted for other browsers.
- The Ctrl+Q behavior is restricted to Google Chrome by design.
