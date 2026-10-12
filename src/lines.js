// Keep logical lines separate for layout, but retain literal newline text between
// them so selecting/copying the source still produces the original text.
export function renderLines(code, source, highlighted) {
  const document = code.ownerDocument;
  const parsed = document.createElement('template');
  if (highlighted === undefined) parsed.content.append(document.createTextNode(source));
  else parsed.innerHTML = highlighted;
  const fragment = document.createDocumentFragment();
  let number = 0;
  function nextLine() {
    const line = document.createElement('span');
    line.className = 'code-line';
    line.dataset.line = String(++number);
    fragment.append(line);
    return line;
  }
  let line = nextLine();
  function walk(node, ancestors = []) {
    if (node.nodeType === 3) {
      const parts = node.textContent.split('\n');
      for (let index = 0; index < parts.length; index++) {
        if (index) {
          // Give empty interior lines a real line break for native selection.
          // Leave the final empty line empty so a trailing newline stays single.
          if (!line.hasChildNodes()) line.append(document.createElement('br'));
          fragment.append(document.createTextNode('\n'));
          line = nextLine();
        }
        if (!parts[index]) continue;
        let parent = line;
        // A multiline token (comment/string/etc.) continues with the same token
        // styles on the next logical line instead of crossing layout containers.
        for (const ancestor of ancestors) {
          const clone = ancestor.cloneNode(false);
          parent.append(clone);
          parent = clone;
        }
        parent.append(document.createTextNode(parts[index]));
      }
    } else if (node.nodeType === 1) {
      for (const child of node.childNodes) walk(child, [...ancestors, node]);
    }
  }
  for (const node of parsed.content.childNodes) walk(node);
  code.replaceChildren(fragment);
}
