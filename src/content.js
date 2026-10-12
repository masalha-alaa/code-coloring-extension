import hljs from './highlighter.js';
import { LANGUAGES, detectLanguage, fileName, languageLabel, prettyJson, rawSourceElement, validLanguage } from './core.js';
import viewerCss from './viewer.css';
import { renderLines } from './lines.js';
import { minimumFontSize } from './font-size.js';

async function start() {
  if (location.protocol !== 'file:' || document.getElementById('code-coloring-viewer')) return;
  const raw = rawSourceElement(document);
  if (!raw) return;
  const original = raw.textContent;
  const detected = detectLanguage(location.href);
  const canonicalUrl = new URL(location.href); canonicalUrl.hash = ''; canonicalUrl.search = '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalUrl.href));
  const fileKey = 'file:' + [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
  let saved = {};
  try { saved = await chrome.storage.local.get([fileKey, 'preferences']); } catch { /* Defaults still work. */ }
  const fileSettings = saved[fileKey] || {};
  const preferences = saved.preferences || {};
  const state = {
    mode: validLanguage(fileSettings.mode) ? fileSettings.mode : 'auto',
    pretty: fileSettings.pretty === true,
    wrap: preferences.wrap === true,
    fontSize: Math.min(24, Math.max(11, Number(preferences.fontSize) || 14)),
    lineNumbers: preferences.lineNumbers !== false
  };
  const host = document.createElement('div'); host.id = 'code-coloring-viewer';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style'); style.textContent = viewerCss; shadow.append(style);
  const element = (tag, attrs = {}, text = '') => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    node.textContent = text; return node;
  };
  const toolbar = element('header', { class: 'toolbar', 'aria-label': 'Code viewer controls' });
  const identity = element('div', { class: 'identity' });
  identity.append(element('span', { class: 'brand' }, '</>'), element('span', { class: 'filename', title: canonicalUrl.pathname }, fileName(location.href)));
  const controls = element('div', { class: 'controls' });
  const language = element('select', { 'aria-label': 'Language' });
  language.append(element('option', { value: 'auto' }, `Auto · ${languageLabel(detected)}`));
  for (const [id, label] of LANGUAGES) language.append(element('option', { value: id }, label));
  language.value = state.mode;
  const checkbox = (label, aria) => {
    const wrapper = element('label', { class: 'check' });
    const input = element('input', { type: 'checkbox', 'aria-label': aria || label });
    wrapper.append(input, element('span', {}, label)); controls.append(wrapper); return { input, wrapper };
  };
  controls.append(language);
  const pretty = checkbox('Pretty JSON');
  const wrap = checkbox('Wrap');
  const lines = checkbox('Lines', 'Line numbers');
  const smaller = element('button', { type: 'button', title: 'Smaller text', 'aria-label': 'Smaller text' }, 'A−');
  const larger = element('button', { type: 'button', title: 'Larger text', 'aria-label': 'Larger text' }, 'A+');
  const copy = element('button', { type: 'button', title: 'Copy the displayed code' }, 'Copy');
  const restore = element('button', { type: 'button', title: 'Restore original text and automatic language detection' }, 'Reset');
  controls.append(smaller, larger, copy, restore);
  toolbar.append(identity, controls);
  const status = element('div', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const pane = element('main', { class: 'pane', 'aria-label': 'Source code' });
  const pre = element('pre', { class: 'source' });
  const code = element('code', { class: 'hljs', translate: 'no' });
  pre.append(code); pane.append(pre); shadow.append(toolbar, status, pane);
  document.documentElement.style.cssText += ';background:#10141c;color-scheme:dark;';
  document.body.style.cssText += ';margin:0;background:#10141c;';
  document.body.replaceChildren(host);
  const minFontSize = minimumFontSize(pre, shadow);
  const maxFontSize = Math.max(24, minFontSize + 1);
  state.fontSize = Math.min(maxFontSize, Math.max(minFontSize, state.fontSize));
  const MAX_HIGHLIGHT_LENGTH = 2 * 1024 * 1024;
  let displayed = original;
  let currentMessage = '';
  let renderId = 0;
  const effective = () => state.mode === 'auto' ? detected : state.mode;
  function applyViewPreferences() {
    wrap.input.checked = state.wrap; lines.input.checked = state.lineNumbers;
    smaller.disabled = state.fontSize <= minFontSize;
    larger.disabled = state.fontSize >= maxFontSize;
    pane.style.setProperty('--font-size', state.fontSize + 'px');
    pre.classList.toggle('wrap', state.wrap);
    pre.classList.toggle('numbered', state.lineNumbers && !code.classList.contains('unlined'));
  }
  function render() {
    const id = ++renderId;
    const lang = effective();
    language.value = state.mode;
    pretty.wrapper.hidden = lang !== 'json';
    pretty.input.disabled = lang !== 'json';
    pretty.input.checked = state.pretty && lang === 'json';
    displayed = original;
    currentMessage = '';
    if (lang === 'json' && state.pretty) {
      if (original.length > MAX_HIGHLIGHT_LENGTH) currentMessage = 'JSON formatting skipped: file exceeds 2 MiB of text.';
      else try { displayed = prettyJson(original); }
      catch (error) { currentMessage = `${error instanceof SyntaxError ? 'Invalid JSON' : 'JSON formatting unavailable'}: ${error.message}. Showing the original text.`; }
    }
    const lineCount = displayed.split('\n').length;
    const useLines = lineCount <= 50000;
    pre.style.setProperty('--gutter-width', `${String(lineCount).length + 3}ch`);
    code.classList.toggle('unlined', !useLines);
    applyViewPreferences();
    if (useLines) renderLines(code, displayed);
    else code.textContent = displayed;
    status.textContent = currentMessage || `${languageLabel(lang)} · ${lineCount.toLocaleString()} lines · Viewing only`;
    status.classList.toggle('error', Boolean(currentMessage));
    if (displayed.length > MAX_HIGHLIGHT_LENGTH) {
      status.textContent = currentMessage || 'Highlighting skipped: file exceeds 2 MiB of text. Showing plain text.';
      return;
    }
    if (lang === 'plaintext') return;
    // Paint the file and controls before synchronous highlighting starts.
    requestAnimationFrame(() => setTimeout(() => {
      if (id !== renderId) return;
      try {
        const highlighted = hljs.highlight(displayed, { language: lang, ignoreIllegals: true }).value;
        // highlight.js escapes source text; only its generated token markup enters the DOM.
        if (useLines) renderLines(code, displayed, highlighted);
        else code.innerHTML = highlighted;
      } catch {
        code.textContent = displayed;
        status.textContent = 'Highlighting failed. Showing the original text safely.';
      }
    }, 0));
  }
  async function persist() {
    try {
      await chrome.storage.local.set({
        [fileKey]: { mode: state.mode, pretty: state.pretty },
        preferences: { wrap: state.wrap, fontSize: state.fontSize, lineNumbers: state.lineNumbers }
      });
    } catch { status.textContent = 'The view was updated, but settings could not be saved.'; }
  }
  async function update(patch) {
    const previousMode = state.mode;
    const previousPretty = state.pretty;
    if (patch.mode === 'auto' || validLanguage(patch.mode)) state.mode = patch.mode;
    if (typeof patch.pretty === 'boolean' && effective() === 'json') state.pretty = patch.pretty;
    if (typeof patch.wrap === 'boolean') state.wrap = patch.wrap;
    if (typeof patch.lineNumbers === 'boolean') state.lineNumbers = patch.lineNumbers;
    if (Number.isFinite(patch.fontSize)) state.fontSize = Math.min(maxFontSize, Math.max(minFontSize, patch.fontSize));
    if (state.mode !== previousMode || state.pretty !== previousPretty) render();
    else applyViewPreferences();
    await persist(); return snapshot();
  }
  const snapshot = () => ({ ...state, detected, effective: effective(), filename: fileName(location.href), error: currentMessage });
  language.addEventListener('change', () => update({ mode: language.value }));
  pretty.input.addEventListener('change', () => update({ pretty: pretty.input.checked }));
  wrap.input.addEventListener('change', () => update({ wrap: wrap.input.checked }));
  lines.input.addEventListener('change', () => update({ lineNumbers: lines.input.checked }));
  smaller.addEventListener('click', () => update({ fontSize: state.fontSize - 1 }));
  larger.addEventListener('click', () => update({ fontSize: state.fontSize + 1 }));
  restore.addEventListener('click', () => update({ mode: 'auto', pretty: false }));
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(displayed); status.textContent = 'Displayed code copied.'; }
    catch { status.textContent = 'Copy failed. Select the code and press Ctrl+C.'; }
  });
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message?.type === 'getState') { sendResponse(snapshot()); return; }
    if (message?.type === 'updateState') {
      update(message.patch || {}).then(sendResponse).catch(() => sendResponse({ error: 'Could not update the view.' }));
      return true;
    }
  });
  render();
}
start().catch(error => console.warn('Code Coloring could not initialize:', error));
