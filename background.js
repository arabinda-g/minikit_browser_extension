const ext = globalThis.browser ?? globalThis.chrome;

const DEFAULT_CONFIG = {
  autoMaximizeEnabled: true,
  autoMaximizeExcludePatterns: [],
  lastTabShortcutEnabled: true
};

const previousTabIdByWindowId = new Map();

function storageGet(keys) {
  return new Promise((resolve) => {
    ext.storage.sync.get(keys, (result) => {
      resolve(result ?? {});
    });
  });
}

function tabsQuery(queryInfo) {
  return new Promise((resolve) => {
    ext.tabs.query(queryInfo, (tabs) => {
      resolve(tabs ?? []);
    });
  });
}

function tabsUpdate(tabId, updateProperties) {
  return new Promise((resolve, reject) => {
    ext.tabs.update(tabId, updateProperties, (updatedTab) => {
      const err = ext.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(updatedTab);
    });
  });
}

function windowsUpdate(windowId, updateInfo) {
  return new Promise((resolve, reject) => {
    ext.windows.update(windowId, updateInfo, (updatedWindow) => {
      const err = ext.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(updatedWindow);
    });
  });
}

function windowsGetLastFocused(getInfo = { populate: false }) {
  return new Promise((resolve, reject) => {
    ext.windows.getLastFocused(getInfo, (windowInfo) => {
      const err = ext.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(windowInfo);
    });
  });
}

async function getConfig() {
  const values = await storageGet(DEFAULT_CONFIG);
  return {
    autoMaximizeEnabled: Boolean(values.autoMaximizeEnabled),
    autoMaximizeExcludePatterns: Array.isArray(values.autoMaximizeExcludePatterns)
      ? values.autoMaximizeExcludePatterns
      : [],
    lastTabShortcutEnabled: Boolean(values.lastTabShortcutEnabled)
  };
}

function isGoogleChromeBrowser() {
  const brands = navigator.userAgentData?.brands;
  if (Array.isArray(brands) && brands.length > 0) {
    const hasGoogleChromeBrand = brands.some((entry) => /Google Chrome/i.test(entry.brand));
    const hasKnownNonChromeBrand = brands.some((entry) =>
      /(Microsoft Edge|Opera|Brave|Vivaldi|Yandex)/i.test(entry.brand)
    );
    if (hasGoogleChromeBrand && !hasKnownNonChromeBrand) {
      return true;
    }
  }

  const ua = navigator.userAgent || "";
  const isChromiumFamily = /Chrome\//.test(ua) || /CriOS\//.test(ua);
  const vendor = typeof navigator.vendor === "string" ? navigator.vendor : "";
  const excludedChromiumBrowsers = /(Edg|OPR|Brave|Vivaldi|YaBrowser|DuckDuckGo|SamsungBrowser)\//;
  if (!isChromiumFamily || excludedChromiumBrowsers.test(ua)) {
    return false;
  }

  // Worker environments can report empty vendor; allow that as Chrome-compatible.
  return vendor === "" || /Google Inc\./.test(vendor);
}

function shouldSkipWindowByUrl(urls, patterns) {
  if (!patterns.length) {
    return false;
  }

  const regexes = [];
  for (const pattern of patterns) {
    try {
      regexes.push(new RegExp(pattern));
    } catch (error) {
      // Invalid user regex should not break background behavior.
    }
  }

  if (!regexes.length) {
    return false;
  }

  return urls.some((url) => regexes.some((regex) => regex.test(url)));
}

async function tryMaximizeNewWindow(windowInfo) {
  if (!windowInfo || typeof windowInfo.id !== "number") {
    return;
  }

  if (windowInfo.type === "devtools") {
    return;
  }

  const config = await getConfig();
  if (!config.autoMaximizeEnabled) {
    return;
  }

  const tabs = await tabsQuery({ windowId: windowInfo.id });
  const urls = tabs
    .map((tab) => tab.url)
    .filter((url) => typeof url === "string" && url.length > 0);

  if (shouldSkipWindowByUrl(urls, config.autoMaximizeExcludePatterns)) {
    return;
  }

  try {
    await windowsUpdate(windowInfo.id, { state: "maximized" });
  } catch (error) {
    // Ignore invalid-window or unsupported-state errors.
  }
}

async function switchToLastTabInCurrentWindow() {
  const config = await getConfig();
  if (!config.lastTabShortcutEnabled) {
    return;
  }

  if (!isGoogleChromeBrowser()) {
    return;
  }

  let focusedWindow;
  try {
    focusedWindow = await windowsGetLastFocused({ populate: false });
  } catch (error) {
    return;
  }

  if (!focusedWindow || typeof focusedWindow.id !== "number") {
    return;
  }

  const tabs = await tabsQuery({ windowId: focusedWindow.id });
  if (tabs.length < 2) {
    return;
  }

  const activeTab = tabs.find((tab) => tab.active);
  if (!activeTab || typeof activeTab.id !== "number") {
    return;
  }

  const previousTabId = previousTabIdByWindowId.get(focusedWindow.id);
  if (typeof previousTabId === "number" && previousTabId !== activeTab.id) {
    const targetTab = tabs.find((tab) => tab.id === previousTabId);
    if (targetTab && typeof targetTab.id === "number") {
      try {
        await tabsUpdate(targetTab.id, { active: true });
        return;
      } catch (error) {
        // Fall back to lastAccessed ordering below.
      }
    }
  }

  const candidates = tabs
    .filter((tab) => typeof tab.id === "number" && !tab.active)
    .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

  if (!candidates.length) {
    return;
  }

  const target = candidates[0];
  try {
    await tabsUpdate(target.id, { active: true });
  } catch (error) {
    // Ignore transient update errors.
  }
}

ext.runtime.onInstalled.addListener(async () => {
  const existing = await storageGet(DEFAULT_CONFIG);
  const merged = {
    autoMaximizeEnabled:
      typeof existing.autoMaximizeEnabled === "boolean"
        ? existing.autoMaximizeEnabled
        : DEFAULT_CONFIG.autoMaximizeEnabled,
    autoMaximizeExcludePatterns: Array.isArray(existing.autoMaximizeExcludePatterns)
      ? existing.autoMaximizeExcludePatterns
      : DEFAULT_CONFIG.autoMaximizeExcludePatterns,
    lastTabShortcutEnabled:
      typeof existing.lastTabShortcutEnabled === "boolean"
        ? existing.lastTabShortcutEnabled
        : DEFAULT_CONFIG.lastTabShortcutEnabled
  };
  ext.storage.sync.set(merged);
});

ext.windows.onCreated.addListener((windowInfo) => {
  // Delay slightly so startup tabs are available for URL checks.
  setTimeout(() => {
    tryMaximizeNewWindow(windowInfo);
  }, 300);
});

ext.commands.onCommand.addListener((command) => {
  if (command === "switch-to-last-tab") {
    switchToLastTabInCurrentWindow();
  }
});

ext.tabs.onActivated.addListener((activeInfo) => {
  if (!activeInfo || typeof activeInfo.windowId !== "number") {
    return;
  }
  if (typeof activeInfo.previousTabId === "number" && activeInfo.previousTabId >= 0) {
    previousTabIdByWindowId.set(activeInfo.windowId, activeInfo.previousTabId);
  }
});

ext.windows.onRemoved.addListener((windowId) => {
  previousTabIdByWindowId.delete(windowId);
});
