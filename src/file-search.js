const allMatches = 'code-coloring-matches';
const activeMatch = 'code-coloring-active-match';
const wordCharacter = '[\\p{L}\\p{M}\\p{N}\\p{Pc}]';

export function installFileSearch({ toolbar, pane, code, button, element }) {
  const bar = element('form', { id: 'file-search', class: 'search-bar', role: 'search', 'aria-label': 'Find in file', hidden: '' });
  const input = element('input', { type: 'search', placeholder: 'Find in file', 'aria-label': 'Find in file', autocomplete: 'off', spellcheck: 'false' });
  const icon = (text, label, attrs = {}) => element('button', { type: 'button', 'aria-label': label, title: label, ...attrs }, text);
  const caseButton = icon('Aa', 'Case sensitive', { 'aria-pressed': 'false' });
  const wordButton = icon('ab', 'Whole word', { class: 'search-word', 'aria-pressed': 'false' });
  const previous = icon('↑', 'Previous result', { title: 'Previous result (Shift+Enter)' });
  const next = icon('↓', 'Next result', { title: 'Next result (Enter)' });
  const close = icon('×', 'Close search', { title: 'Close search (Esc)' });
  const counter = element('output', { class: 'search-count', 'aria-live': 'polite' });
  bar.append(input, caseButton, wordButton, counter, previous, next, close);
  toolbar.append(bar);

  let source = '';
  let nodes = [];
  let matches = [];
  let current = 0;
  let caseSensitive = false;
  let wholeWord = false;
  let returnFocus;

  function position(offset, atEnd) {
    let low = 0, high = nodes.length - 1;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (atEnd ? nodes[mid].end < offset : nodes[mid].end <= offset) low = mid + 1;
      else high = mid;
    }
    return [nodes[low].node, offset - nodes[low].start];
  }
  function rangeFor(index) {
    const range = document.createRange();
    range.setStart(...position(matches[index * 2], false));
    range.setEnd(...position(matches[index * 2 + 1], true));
    return range;
  }
  function clearHighlights() {
    CSS.highlights.delete(allMatches);
    CSS.highlights.delete(activeMatch);
  }
  function showCurrent(reveal) {
    const count = matches.length / 2;
    previous.disabled = next.disabled = count < 2;
    counter.textContent = count ? (current + 1).toLocaleString() + ' / ' + count.toLocaleString() :
      input.value ? 'No results' : '';
    if (!count) return;
    const range = rangeFor(current);
    const highlight = new Highlight(range);
    highlight.priority = 1;
    CSS.highlights.set(activeMatch, highlight);
    if (!reveal) return;
    const rect = range.getClientRects()[0];
    if (!rect) return;
    const toolbarBottom = toolbar.getBoundingClientRect().bottom;
    if (rect.top < toolbarBottom + 8 || rect.bottom > window.innerHeight - 8) {
      window.scrollBy({ top: rect.top - Math.max(toolbarBottom + 12, window.innerHeight / 4), behavior: 'instant' });
    }
    const viewport = pane.getBoundingClientRect();
    if (rect.left < viewport.left + 8 || rect.right > viewport.right - 8) {
      pane.scrollBy({ left: rect.left - viewport.left - 16, behavior: 'instant' });
    }
  }
  function search(reveal, keepCurrent = false) {
    clearHighlights();
    matches = [];
    if (!keepCurrent) current = 0;
    if (input.value) {
      const literal = input.value.replace(/[.*+?^$&{}()|[\]\\]/g, '\\$&');
      const pattern = wholeWord ? '(?<!' + wordCharacter + ')' + literal + '(?!' + wordCharacter + ')' : literal;
      const regex = new RegExp(pattern, caseSensitive ? 'gu' : 'giu');
      for (let match; (match = regex.exec(source));) matches.push(match.index, regex.lastIndex);
      current = Math.min(current, Math.max(0, matches.length / 2 - 1));
      // Large result sets still have full counts and navigation. Limit the
      // number of simultaneous paint ranges to keep the viewer responsive.
      if (matches.length && matches.length <= 4000) {
        const ranges = Array.from({ length: matches.length / 2 }, (_, index) => rangeFor(index));
        CSS.highlights.set(allMatches, new Highlight(...ranges));
      }
    }
    showCurrent(reveal);
  }
  function refresh(reveal = false) {
    if (bar.hidden) return;
    const text = code.textContent;
    const unchanged = text === source;
    source = text;
    nodes = [];
    let start = 0;
    const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.length) continue;
      const end = start + node.length;
      nodes.push({ node, start, end });
      start = end;
    }
    search(reveal || !unchanged, unchanged);
  }
  function step(delta) {
    const count = matches.length / 2;
    if (!count) return;
    current = (current + delta + count) % count;
    showCurrent(true);
  }
  function open() {
    if (bar.hidden) {
      returnFocus = toolbar.getRootNode().activeElement || button;
      bar.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      refresh(true);
    }
    input.focus({ preventScroll: true });
    input.select();
  }
  function dismiss() {
    clearHighlights();
    bar.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    nodes = [];
    matches = [];
    source = '';
    returnFocus?.focus({ preventScroll: true });
  }
  function onSearchControl(control, action) {
    control.addEventListener('click', event => {
      action();
      // A pointer click should leave typing and navigation in the search field.
      // Keyboard activation keeps focus on the control for tab navigation.
      if (event.detail > 0) input.focus({ preventScroll: true });
    });
  }
  button.addEventListener('click', () => bar.hidden ? open() : dismiss());
  close.addEventListener('click', dismiss);
  input.addEventListener('input', () => search(true));
  onSearchControl(caseButton, () => {
    caseSensitive = !caseSensitive;
    caseButton.setAttribute('aria-pressed', String(caseSensitive));
    search(true);
  });
  onSearchControl(wordButton, () => {
    wholeWord = !wholeWord;
    wordButton.setAttribute('aria-pressed', String(wholeWord));
    search(true);
  });
  onSearchControl(previous, () => step(-1));
  onSearchControl(next, () => step(1));
  bar.addEventListener('submit', event => { event.preventDefault(); step(1); });
  bar.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
    } else if (event.target === input && event.key === 'Enter') {
      event.preventDefault();
      step(event.shiftKey ? -1 : 1);
    }
  });
  window.addEventListener('keydown', event => {
    if (event.isComposing || !event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey ||
        event.key.toLowerCase() !== 'f' || toolbar.getRootNode().querySelector('dialog[open]')) return;
    event.preventDefault();
    if (!event.repeat) open();
  }, { capture: true });
  return { refresh };
}
