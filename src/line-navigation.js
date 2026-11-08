export function installLineNavigation({ shadow, toolbar, code, button, element, getLineCount }) {
  const dialog = element('dialog', { class: 'line-dialog', 'aria-labelledby': 'line-dialog-title' });
  const form = element('form');
  const title = element('h2', { id: 'line-dialog-title' }, 'Go to line');
  const label = element('label', { for: 'line-number' }, 'Line number');
  const field = element('input', {
    id: 'line-number', type: 'text', inputmode: 'numeric', autocomplete: 'off',
    'aria-describedby': 'line-range', autofocus: ''
  });
  const hint = element('p', { id: 'line-range', class: 'line-hint' });
  const warning = element('p', { id: 'line-warning', class: 'line-warning', role: 'alert', hidden: '' });
  const actions = element('div', { class: 'line-actions' });
  const cancel = element('button', { type: 'button' }, 'Cancel');
  const submit = element('button', { type: 'submit', class: 'line-submit' }, 'Go');
  actions.append(cancel, submit);
  form.append(title, label, field, hint, warning, actions);
  dialog.append(form);
  shadow.append(dialog);

  let markedLine;
  function clearHighlight() {
    markedLine?.classList.remove('jump-target');
    markedLine = null;
  }
  window.addEventListener('click', clearHighlight, { capture: true });

  function clearWarning() {
    warning.hidden = true;
    field.removeAttribute('aria-invalid');
    field.setAttribute('aria-describedby', 'line-range');
  }
  function open() {
    if (dialog.open) return;
    hint.textContent = `Enter a line from 1 to ${getLineCount().toLocaleString()}.`;
    field.value = '';
    clearWarning();
    dialog.showModal();
    field.focus();
  }
  button.addEventListener('click', open);
  cancel.addEventListener('click', () => dialog.close());
  field.addEventListener('input', clearWarning);
  window.addEventListener('keydown', event => {
    if (event.isComposing || !event.ctrlKey || event.altKey || event.metaKey ||
        event.shiftKey || event.key.toLowerCase() !== 'g') return;
    event.preventDefault();
    if (!event.repeat) open();
  }, { capture: true });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const value = field.value.trim();
    const line = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(line) || line < 1 || line > getLineCount()) {
      warning.replaceChildren(element('span', { 'aria-hidden': 'true' }, '⚠'), ' Enter a whole number in the displayed range.');
      warning.hidden = false;
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', 'line-range line-warning');
      field.focus();
      field.select();
      return;
    }
    dialog.close();
    const row = code.querySelector(`[data-line="${line}"]`);
    const top = row ? row.getBoundingClientRect().top : unlinedTop(code, line);
    window.scrollBy({ top: top - Math.max(toolbar.offsetHeight + 12, window.innerHeight / 4), behavior: 'instant' });
    clearHighlight();
    markedLine = row;
    row?.classList.add('jump-target');
  });
}

// Large files can omit the row elements. Locate the first glyph of the line
// directly in the rendered text so navigation still works in that view.
function unlinedTop(code, line) {
  let remaining = line - 1;
  const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    let offset = 0;
    while (remaining) {
      const newline = node.data.indexOf('\n', offset);
      if (newline === -1) break;
      offset = newline + 1;
      remaining--;
    }
    if (remaining || offset === node.length) continue;
    const range = document.createRange();
    range.setStart(node, offset);
    range.setEnd(node, offset + 1);
    return range.getBoundingClientRect().top;
  }
  return code.getBoundingClientRect().bottom;
}
