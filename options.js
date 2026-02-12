const ext = globalThis.browser ?? globalThis.chrome;

const DEFAULT_CONFIG = {
  autoMaximizeEnabled: true,
  autoMaximizeExcludePatterns: [],
  lastTabShortcutEnabled: true
};

const autoMaximizeEnabled = document.getElementById("autoMaximizeEnabled");
const excludePatterns = document.getElementById("excludePatterns");
const lastTabShortcutEnabled = document.getElementById("lastTabShortcutEnabled");
const saveButton = document.getElementById("saveButton");
const statusNode = document.getElementById("status");

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

function showStatus(message, isError = false) {
  statusNode.textContent = message;
  statusNode.style.color = isError ? "#b91c1c" : "#166534";
}

async function loadOptions() {
  const values = await storageGet(DEFAULT_CONFIG);
  autoMaximizeEnabled.checked = Boolean(values.autoMaximizeEnabled);
  lastTabShortcutEnabled.checked = Boolean(values.lastTabShortcutEnabled);
  excludePatterns.value = Array.isArray(values.autoMaximizeExcludePatterns)
    ? values.autoMaximizeExcludePatterns.join("\n")
    : "";
}

async function saveOptions() {
  const patterns = normalizePatterns(excludePatterns.value);
  const invalidPatterns = validatePatterns(patterns);

  if (invalidPatterns.length) {
    showStatus(`Invalid regex pattern(s): ${invalidPatterns.join(", ")}`, true);
    return;
  }

  await storageSet({
    autoMaximizeEnabled: autoMaximizeEnabled.checked,
    autoMaximizeExcludePatterns: patterns,
    lastTabShortcutEnabled: lastTabShortcutEnabled.checked
  });

  showStatus("Settings saved.");
  setTimeout(() => {
    if (statusNode.textContent === "Settings saved.") {
      statusNode.textContent = "";
    }
  }, 2500);
}

saveButton.addEventListener("click", () => {
  saveOptions().catch((error) => {
    showStatus(`Failed to save settings: ${error.message}`, true);
  });
});

loadOptions().catch((error) => {
  showStatus(`Failed to load settings: ${error.message}`, true);
});
