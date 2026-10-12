import { LANGUAGES, languageLabel } from './core.js';
const $ = id => document.getElementById(id);
let tab;
let busy = false;
for (const [id, label] of [['auto', 'Auto detect'], ...LANGUAGES.map(([id, label]) => [id, label])]) {
  const option = document.createElement('option'); option.value = id; option.textContent = label; $('language').append(option);
}
function display(state) {
  $('controls').hidden = false;
  $('filename').textContent = state.filename;
  $('language').value = state.mode;
  $('language').options[0].textContent = `Auto · ${languageLabel(state.detected)}`;
  $('pretty-label').hidden = state.effective !== 'json';
  $('pretty').disabled = state.effective !== 'json';
  $('pretty').checked = state.pretty && state.effective === 'json';
  $('wrap').checked = state.wrap;
  $('notice').textContent = state.error || `Viewing as ${languageLabel(state.effective)}. Changes apply immediately.`;
}
async function update(patch) {
  if (busy) return;
  busy = true;
  try { display(await chrome.tabs.sendMessage(tab.id, { type: 'updateState', patch })); }
  catch { $('notice').textContent = 'This tab changed. Reload it, then reopen this popup.'; $('controls').hidden = true; $('reload').hidden = false; }
  finally { busy = false; }
}
$('language').addEventListener('change', () => update({ mode: $('language').value }));
$('pretty').addEventListener('change', () => update({ pretty: $('pretty').checked }));
$('wrap').addEventListener('change', () => update({ wrap: $('wrap').checked }));
$('reset').addEventListener('click', () => update({ mode: 'auto', pretty: false }));
$('settings').addEventListener('click', () => chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` }));
$('reload').addEventListener('click', async () => { if (tab?.id) await chrome.tabs.reload(tab.id); window.close(); });
async function initialize() {
  const allowed = await chrome.extension.isAllowedFileSchemeAccess();
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!allowed) {
    $('notice').textContent = 'Enable “Allow access to file URLs” in the extension’s details, then reload your local file tab.';
    $('settings').hidden = false; return;
  }
  if (!tab?.url?.startsWith('file:')) { $('notice').textContent = 'Open a local source file in Chrome to color it automatically.'; return; }
  try { display(await chrome.tabs.sendMessage(tab.id, { type: 'getState' })); }
  catch {
    $('notice').textContent = 'No text viewer is active. Try reloading this tab. Chrome must display the file as plain text; rendered pages and downloaded files cannot be colored here.';
    $('reload').hidden = false;
  }
}
initialize().catch(() => { $('notice').textContent = 'Could not check this tab. Reopen the popup.'; });
