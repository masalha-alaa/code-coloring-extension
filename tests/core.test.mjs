import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, detectLanguage, fileName, prettyJson, rawSourceElement } from '../src/core.js';
import hljs from '../src/highlighter.js';

test('detects all declared extensions from Windows file URLs', () => {
  for (const [id, , exts] of LANGUAGES) for (const ext of exts) {
    assert.equal(detectLanguage(`file:///C:/Projects/My%20Project/file.${ext}?v=1#L2`), id, ext);
  }
  assert.equal(detectLanguage('file:///C:/imu_runner.cpp'), 'cpp');
  assert.equal(fileName('file:///C:/My%20Project/%D9%85%D9%84%D9%81.py'), 'ملف.py');
  assert.equal(detectLanguage('file:///C:/Makefile'), 'makefile');
  assert.equal(detectLanguage('file:///C:/CMakeLists.txt'), 'cmake');
  assert.equal(detectLanguage('file:///C:/Dockerfile'), 'dockerfile');
  assert.equal(detectLanguage('file:///C:/foo.C'), 'cpp');
  assert.equal(detectLanguage('file:///C:/foo.PY'), 'python');
  assert.equal(detectLanguage('file:///C:/unknown.abc'), 'plaintext');
});

test('every selectable highlighter is bundled and escapes markup', () => {
  for (const [id] of LANGUAGES) {
    if (id === 'plaintext') continue;
    assert.ok(hljs.getLanguage(id), id);
    const value = hljs.highlight('<script>alert("x")</script>', { language: id }).value;
    assert.ok(!value.includes('<script>'), id);
  }
  const cpp = hljs.highlight('static IMU *imu = nullptr; return imu; // instance', { language: 'cpp' }).value;
  assert.match(cpp, /hljs-keyword/);
  assert.match(cpp, /hljs-comment/);
});

test('JSON pretty-print retains exact tokens, order, escapes, and precision', () => {
  const input = String.raw`{"z":900719925474099312345,"a":1e+400,"z":-0,"escaped":"\u0041","quoted":"\"[,{}]","empty":[],"object":{},"array":[1,true,null]}`;
  const output = prettyJson(input);
  const tokenize = text => text.match(/"(?:\\[\s\S]|[^"\\])*"|[^\s]/g);
  assert.deepEqual(tokenize(output), tokenize(input));
  assert.match(output, /900719925474099312345/);
  assert.match(output, /1e\+400/);
  assert.match(output, /"empty": \[\]/);
  assert.equal(prettyJson(output), output);
  assert.equal(prettyJson('\uFEFF{"x":1}'), '{\n  "x": 1\n}');
  for (const value of ['null', 'true', '42', '"hello"', '{}', '[]']) assert.equal(prettyJson(value), value);
  for (const invalid of ['{"x":}', '{"x":1,}', '[1,]', 'NaN', '{/*comment*/}']) assert.throws(() => prettyJson(invalid));
});

test('only native raw text PRE wrappers are eligible', () => {
  const pre = { tagName: 'PRE', children: [] };
  assert.equal(rawSourceElement({ body: { children: [pre] }, contentType: 'text/plain' }), pre);
  assert.equal(rawSourceElement({ body: { children: [pre] }, contentType: 'application/json' }), pre);
  assert.equal(rawSourceElement({ body: { children: [pre] }, contentType: 'text/html' }), null);
  assert.equal(rawSourceElement({ body: { children: [pre, {}] }, contentType: 'text/plain' }), null);
  assert.equal(rawSourceElement({ body: { children: [{ tagName: 'PRE', children: [{}] }] }, contentType: 'text/plain' }), null);
});
