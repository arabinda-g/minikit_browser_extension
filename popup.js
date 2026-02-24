const ext = globalThis.browser ?? globalThis.chrome;

const copyAllLinksButton = document.getElementById("copyAllLinksButton");
const statusNode = document.getElementById("status");

function tabsQuery(queryInfo) {
  return new Promise((resolve, reject) => {
    ext.tabs.query(queryInfo, (tabs) => {
      const err = ext.runtime?.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(tabs ?? []);
    });
  });
}

async function writeClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const succeeded = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!succeeded) {
    throw new Error("Clipboard is unavailable.");
  }
}

function setStatus(message, isError = false) {
  statusNode.textContent = message;
  statusNode.classList.toggle("error", isError);
  statusNode.classList.toggle("success", !isError);
}

async function copyAllLinksInCurrentWindow() {
  copyAllLinksButton.disabled = true;
  const tabs = await tabsQuery({ currentWindow: true });
  const urls = tabs
    .map((tab) => tab.url)
    .filter((url) => typeof url === "string" && url.length > 0);

  if (!urls.length) {
    setStatus("No links found in current window.", true);
    copyAllLinksButton.disabled = false;
    return;
  }

  await writeClipboard(urls.join("\n"));
  setStatus(`Copied ${urls.length} link${urls.length === 1 ? "" : "s"}.`);
  copyAllLinksButton.disabled = false;
}

copyAllLinksButton.addEventListener("click", () => {
  copyAllLinksInCurrentWindow().catch((error) => {
    setStatus(`Copy failed: ${error.message}`, true);
    copyAllLinksButton.disabled = false;
  });
});
