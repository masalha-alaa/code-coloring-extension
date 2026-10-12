// Measure actual glyphs: CSS font-size can report a requested value even when
// Chrome renders it larger because of the user's minimum-font-size preference.
export function minimumFontSize(pre, root) {
  const probe = pre.ownerDocument.createElement('span');
  probe.textContent = 'MMMM';
  probe.setAttribute('aria-hidden', 'true');
  Object.assign(probe.style, {
    position: 'fixed', top: '0', left: '0', visibility: 'hidden',
    display: 'inline-block', whiteSpace: 'pre', padding: '0', border: '0',
    margin: '0', fontFamily: getComputedStyle(pre).fontFamily,
    fontSize: '1px', fontWeight: '400', fontStyle: 'normal',
    letterSpacing: 'normal', lineHeight: 'normal'
  });
  root.append(probe);
  const minimumWidth = probe.getBoundingClientRect().width;
  probe.style.fontSize = '100px';
  const referenceWidth = probe.getBoundingClientRect().width;
  probe.remove();
  return Math.max(11, referenceWidth > 0 ? Math.round(100 * minimumWidth / referenceWidth) : 11);
}
