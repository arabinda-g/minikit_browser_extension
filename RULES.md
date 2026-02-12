# Extension Rules

## Feature 1: Auto-Maximize Newly Opened Chrome Windows
- When a new Chrome window opens, the extension attempts to maximize it automatically.
- The feature can be enabled or disabled from the extension options page.
- A list of excluded URL patterns is supported.
- Exclusions are regular expressions.
- If any tab URL in a newly opened window matches any configured regex pattern, that window is not maximized.

## Feature 2: Switch to Last Tab (Google Chrome Only)
- Pressing the configured extension shortcut switches to the previously used tab in the current Chrome window.
- The switch happens only inside the current window; it does not move between different windows.
- The feature is enabled only for Google Chrome.
- The feature can be enabled or disabled from the extension options page.

## Feature 3: Move Current Tab to New Window
- Pressing the configured extension shortcut moves only the active tab to a newly created window.
- Other tabs remain in the original window.
- The feature can be enabled or disabled from the extension options page.
