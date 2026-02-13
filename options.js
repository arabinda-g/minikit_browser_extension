const ext = globalThis.browser ?? globalThis.chrome;

const DEFAULT_CONFIG = {
  autoMaximizeEnabled: true,
  autoMaximizeExcludePatterns: [],
  lastTabShortcutEnabled: true,
  moveCurrentTabToNewWindowEnabled: true
};

const autoMaximizeEnabled = document.getElementById("autoMaximizeEnabled");
const excludePatterns = document.getElementById("excludePatterns");
const lastTabShortcutEnabled = document.getElementById("lastTabShortcutEnabled");
const moveCurrentTabToNewWindowEnabled = document.getElementById("moveCurrentTabToNewWindowEnabled");
const saveButton = document.getElementById("saveButton");
const resetButton = document.getElementById("resetButton");
const openShortcutsButtons = document.querySelectorAll(".open-shortcuts-button");
const statusNode = document.getElementById("status");
const patternCount = document.getElementById("patternCount");
const patternCountHero = document.getElementById("patternCountHero");
const patternValidation = document.getElementById("patternValidation");
const enabledCount = document.getElementById("enabledCount");
const dirtyBadge = document.getElementById("dirtyBadge");

let initialState = null;

function hasExtensionStorage() {
  return Boolean(ext && ext.storage && ext.storage.sync);
}

function storageGet(keys) {
  return new Promise((resolve) => {
    if (!hasExtensionStorage()) {
      const result = {};
      Object.entries(keys).forEach(([key, defaultValue]) => {
        const raw = localStorage.getItem(`mbe_${key}`);
        if (raw === null) {
          result[key] = defaultValue;
          return;
        }
        try {
          result[key] = JSON.parse(raw);
        } catch (error) {
          result[key] = defaultValue;
        }
      });
      resolve(result);
      return;
    }

    ext.storage.sync.get(keys, (result) => {
      resolve(result ?? {});
    });
  });
}

function storageSet(values) {
  return new Promise((resolve, reject) => {
    if (!hasExtensionStorage()) {
      Object.entries(values).forEach(([key, value]) => {
        localStorage.setItem(`mbe_${key}`, JSON.stringify(value));
      });
      resolve();
      return;
    }

    ext.storage.sync.set(values, () => {
      const err = ext.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve();
    });
  });
}

function normalizePatterns(rawText) {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getCurrentState() {
  return {
    autoMaximizeEnabled: autoMaximizeEnabled.checked,
    autoMaximizeExcludePatterns: normalizePatterns(excludePatterns.value),
    lastTabShortcutEnabled: lastTabShortcutEnabled.checked,
    moveCurrentTabToNewWindowEnabled: moveCurrentTabToNewWindowEnabled.checked
  };
}

function isSameState(a, b) {
  if (!a || !b) {
    return false;
  }

  return (
    a.autoMaximizeEnabled === b.autoMaximizeEnabled &&
    a.lastTabShortcutEnabled === b.lastTabShortcutEnabled &&
    a.moveCurrentTabToNewWindowEnabled === b.moveCurrentTabToNewWindowEnabled &&
    a.autoMaximizeExcludePatterns.length === b.autoMaximizeExcludePatterns.length &&
    a.autoMaximizeExcludePatterns.every((value, index) => value === b.autoMaximizeExcludePatterns[index])
  );
}

function updatePatternCount() {
  const patterns = normalizePatterns(excludePatterns.value);
  const count = patterns.length;
  patternCount.textContent = `${count} pattern${count === 1 ? "" : "s"}`;
  patternCountHero.textContent = String(count);
}

function validatePatterns(patterns) {
  const invalid = [];
  for (const pattern of patterns) {
    try {
      new RegExp(pattern);
    } catch (error) {
      invalid.push(pattern);
    }
  }
  return invalid;
}

function renderPatternValidation() {
  const patterns = normalizePatterns(excludePatterns.value);
  const invalidPatterns = validatePatterns(patterns);
  const hasErrors = invalidPatterns.length > 0;

  patternValidation.classList.toggle("is-error", hasErrors);
  excludePatterns.classList.toggle("has-error", hasErrors);

  if (!hasErrors) {
    patternValidation.textContent = "";
    return true;
  }

  patternValidation.textContent = `Invalid regex: ${invalidPatterns.join(", ")}`;
  return false;
}

function updateEnabledCount() {
  const count = [autoMaximizeEnabled, lastTabShortcutEnabled, moveCurrentTabToNewWindowEnabled].filter(
    (node) => node.checked
  ).length;
  enabledCount.textContent = `${count} / 3`;
}

function updateDirtyState() {
  const currentState = getCurrentState();
  const isDirty = !isSameState(initialState, currentState);
  dirtyBadge.hidden = !isDirty;
  saveButton.disabled = !isDirty;
}

function showStatus(message, isError = false) {
  statusNode.textContent = message;
  statusNode.classList.add("is-visible");
  statusNode.classList.toggle("is-error", isError);
  statusNode.classList.toggle("is-success", !isError);
}

async function loadOptions() {
  const values = await storageGet(DEFAULT_CONFIG);
  autoMaximizeEnabled.checked = Boolean(values.autoMaximizeEnabled ?? DEFAULT_CONFIG.autoMaximizeEnabled);
  lastTabShortcutEnabled.checked = Boolean(values.lastTabShortcutEnabled ?? DEFAULT_CONFIG.lastTabShortcutEnabled);
  moveCurrentTabToNewWindowEnabled.checked = Boolean(
    values.moveCurrentTabToNewWindowEnabled ?? DEFAULT_CONFIG.moveCurrentTabToNewWindowEnabled
  );
  excludePatterns.value = Array.isArray(values.autoMaximizeExcludePatterns)
    ? values.autoMaximizeExcludePatterns.join("\n")
    : "";

  initialState = getCurrentState();
  updatePatternCount();
  renderPatternValidation();
  updateEnabledCount();
  updateDirtyState();
}

async function saveOptions() {
  if (!renderPatternValidation()) {
    showStatus("Fix invalid regex patterns before saving.", true);
    return;
  }

  const currentState = getCurrentState();
  await storageSet(currentState);
  initialState = currentState;
  updateDirtyState();

  showStatus("Settings saved.");
  setTimeout(() => {
    if (statusNode.textContent === "Settings saved.") {
      statusNode.textContent = "";
      statusNode.classList.remove("is-visible", "is-success", "is-error");
    }
  }, 2500);
}

async function resetToDefaults() {
  autoMaximizeEnabled.checked = DEFAULT_CONFIG.autoMaximizeEnabled;
  lastTabShortcutEnabled.checked = DEFAULT_CONFIG.lastTabShortcutEnabled;
  moveCurrentTabToNewWindowEnabled.checked = DEFAULT_CONFIG.moveCurrentTabToNewWindowEnabled;
  excludePatterns.value = DEFAULT_CONFIG.autoMaximizeExcludePatterns.join("\n");

  updatePatternCount();
  renderPatternValidation();
  updateEnabledCount();
  updateDirtyState();
  showStatus("Defaults restored. Save to apply changes.");
}

function onAnyInputChange() {
  updatePatternCount();
  renderPatternValidation();
  updateEnabledCount();
  updateDirtyState();
}

function openShortcutSettings() {
  const shortcutsUrl = "chrome://extensions/shortcuts";
  if (ext && ext.tabs && typeof ext.tabs.create === "function") {
    ext.tabs.create({ url: shortcutsUrl }, () => {
      const err = ext.runtime?.lastError;
      if (err) {
        showStatus("Unable to open shortcut settings automatically. Open chrome://extensions/shortcuts.", true);
      }
    });
    return;
  }
  const opened = window.open(shortcutsUrl, "_blank", "noopener");
  if (!opened) {
    showStatus("Open chrome://extensions/shortcuts from Chrome to customize shortcuts.", true);
  }
}

openShortcutsButtons.forEach((button) => {
  button.addEventListener("click", openShortcutSettings);
});

excludePatterns.addEventListener("input", onAnyInputChange);
autoMaximizeEnabled.addEventListener("change", onAnyInputChange);
lastTabShortcutEnabled.addEventListener("change", onAnyInputChange);
moveCurrentTabToNewWindowEnabled.addEventListener("change", onAnyInputChange);

saveButton.addEventListener("click", () => {
  saveOptions().catch((error) => {
    showStatus(`Failed to save settings: ${error.message}`, true);
  });
});

resetButton.addEventListener("click", () => {
  resetToDefaults().catch((error) => {
    showStatus(`Failed to restore defaults: ${error.message}`, true);
  });
});

loadOptions().catch((error) => {
  showStatus(`Failed to load settings: ${error.message}`, true);
});
