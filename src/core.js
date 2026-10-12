export const LANGUAGES = [
  ['plaintext', 'Plain text', ['txt', 'text', 'log']],
  ['c', 'C', ['c', 'h']],
  ['cpp', 'C++', ['cpp', 'cc', 'cxx', 'c++', 'hpp', 'hh', 'hxx', 'h++', 'ipp', 'tpp', 'inl', 'ino']],
  ['python', 'Python', ['py', 'pyw', 'pyi']],
  ['json', 'JSON', ['json', 'ipynb', 'geojson']],
  ['csharp', 'C#', ['cs', 'csx']],
  ['javascript', 'JavaScript', ['js', 'mjs', 'cjs', 'jsx']],
  ['typescript', 'TypeScript', ['ts', 'mts', 'cts', 'tsx']],
  ['rust', 'Rust', ['rs']],
  ['java', 'Java', ['java']],
  ['go', 'Go', ['go']],
  ['bash', 'Shell / Bash', ['sh', 'bash', 'zsh']],
  ['powershell', 'PowerShell', ['ps1', 'psm1', 'psd1']],
  ['sql', 'SQL', ['sql']],
  ['yaml', 'YAML', ['yaml', 'yml']],
  ['markdown', 'Markdown', ['md', 'markdown', 'mdown']],
  ['css', 'CSS', ['css']],
  ['scss', 'SCSS', ['scss']],
  ['xml', 'HTML / XML', ['html', 'htm', 'xml', 'xhtml', 'svg']],
  ['ini', 'INI / TOML', ['ini', 'cfg', 'conf', 'toml', 'properties', 'editorconfig']],
  ['makefile', 'Makefile', ['mk', 'mak']],
  ['cmake', 'CMake', ['cmake']],
  ['diff', 'Diff / Patch', ['diff', 'patch']],
  ['ruby', 'Ruby', ['rb', 'rake', 'gemspec']],
  ['php', 'PHP', ['php', 'phtml']],
  ['swift', 'Swift', ['swift']],
  ['kotlin', 'Kotlin', ['kt', 'kts']],
  ['lua', 'Lua', ['lua']],
  ['dart', 'Dart', ['dart']],
  ['r', 'R', ['r']],
  ['objectivec', 'Objective-C', ['m', 'mm']],
  ['dockerfile', 'Dockerfile', ['dockerfile']],
  ['assembly', 'Assembly', ['s', 'asm']]
];

const extensions = new Map(LANGUAGES.flatMap(([id, , exts]) => exts.map(ext => [ext, id])));
const filenames = new Map([
  ['makefile', 'makefile'], ['gnumakefile', 'makefile'], ['dockerfile', 'dockerfile'],
  ['cmakelists.txt', 'cmake'], ['gemfile', 'ruby'], ['rakefile', 'ruby'],
  ['.bashrc', 'bash'], ['.zshrc', 'bash'], ['.bash_profile', 'bash'], ['.profile', 'bash']
]);

export function fileName(url) {
  try { return decodeURIComponent(new URL(url).pathname.split('/').pop()); }
  catch { return ''; }
}

export function detectLanguage(url) {
  const name = fileName(url);
  if (name.endsWith('.C') || name.endsWith('.H')) return 'cpp';
  const lower = name.toLowerCase();
  return filenames.get(lower) || extensions.get(lower.split('.').pop()) || 'plaintext';
}

export function validLanguage(id) { return LANGUAGES.some(([value]) => value === id); }
export function languageLabel(id) { return LANGUAGES.find(([value]) => value === id)?.[1] || 'Plain text'; }

// Validation does not supply the output: keep every original token, including
// large numbers, duplicate keys, escapes, exponent spelling, and key order.
export function prettyJson(source, indent = 2) {
  const input = source.replace(/^\uFEFF/, '');
  JSON.parse(input);
  const tokens = input.match(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\],:]|[^\s{}\[\],:]+/g) || [];
  let depth = 0;
  let output = '';
  const newline = () => { output += '\n' + ' '.repeat(depth * indent); };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '{' || token === '[') {
      output += token;
      if (tokens[i + 1] === (token === '{' ? '}' : ']')) output += tokens[++i];
      else {
        if (++depth > 200) throw new RangeError('JSON nesting exceeds the formatting limit of 200 levels');
        newline();
      }
    } else if (token === '}' || token === ']') {
      depth--; newline(); output += token;
    } else if (token === ',') { output += ','; newline(); }
    else if (token === ':') output += ': ';
    else output += token;
    if (output.length > 8 * 1024 * 1024) throw new RangeError('Formatted JSON exceeds the 8 MiB viewing limit');
  }
  return output;
}

export function rawSourceElement(document) {
  // Chrome wraps a raw text file in a direct PRE. Leave rendered pages, directory
  // listings, XML trees, PDFs, and media untouched, even if they contain a PRE.
  const body = document.body;
  if (!body) return null;
  const elements = [...body.children];
  if (elements.length !== 1 || elements[0].tagName !== 'PRE') return null;
  const pre = elements[0];
  if (pre.children.length !== 0) return null;
  const mime = (document.contentType || '').toLowerCase();
  if (['text/html', 'application/xhtml+xml', 'image/svg+xml', 'text/xml', 'application/xml'].includes(mime)) return null;
  return pre;
}
