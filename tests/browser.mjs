import { chromium } from 'playwright';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const directory = await mkdtemp(join(tmpdir(), 'code-coloring-tests-'));
await mkdir('test-results', { recursive: true });
const context = await chromium.launchPersistentContext(join(directory, 'profile'), {
  channel: 'chromium', headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: [`--disable-extensions-except=${resolve('dist')}`, `--load-extension=${resolve('dist')}`],
  viewport: { width: 1365, height: 900 }
});
try {
  const settings = await context.newPage();
  await settings.goto('chrome://extensions/');
  const info = await settings.evaluate(() => new Promise(resolve => chrome.developerPrivate.getExtensionsInfo({ includeDisabled: true }, resolve)));
  const extension = info.find(item => item.name === 'Code Coloring');
  assert.ok(extension, 'The actual extension must be loaded');
  await settings.evaluate(id => new Promise(resolve => chrome.developerPrivate.updateExtensionConfiguration({ extensionId: id, fileAccess: true }, resolve)), extension.id);
  await settings.close();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const file = async (name, source) => {
    const path = join(directory, name);
    await writeFile(path, source);
    await page.goto(pathToFileURL(path).href);
    await page.locator('#code-coloring-viewer').waitFor();
    assert.equal(await page.locator('.source code').textContent(), source);
    return path;
  };
  const cpp = '#include "imu_runner.h"\n\nstatic IMU *imu = nullptr; // global instance\n\nextern "C" bool IMU_RUNNER_IMU_init(bool chip_select_support) {\n  if (!imu) {\n    imu = createIMU(chip_select_support);\n  }\n  return imu->IMU_Init();\n}\n';
  const cppPath = await file('imu runner.cpp', cpp);
  await page.locator('.hljs-comment').waitFor();
  assert.equal(await page.getByRole('combobox', { name: 'Language' }).inputValue(), 'auto');
  assert.match(await page.locator('.status').textContent(), /C\+\+/);
  assert.equal(await page.locator('input[aria-label="Pretty JSON"]').count(), 1);
  assert.equal(await page.getByRole('checkbox', { name: 'Pretty JSON' }).isVisible(), false);
  await page.screenshot({ path: 'test-results/cpp-viewer.png', fullPage: true });
  await page.getByRole('combobox').selectOption('python');
  await page.reload(); await page.locator('#code-coloring-viewer').waitFor();
  assert.equal(await page.getByRole('combobox').inputValue(), 'python');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  assert.equal(await page.getByRole('combobox').inputValue(), 'auto');
  assert.equal(await readFile(cppPath, 'utf8'), cpp);

  // Font controls must change computed code and token sizes, not just settings.
  const fontSize = () => page.locator('.source code').evaluate(node => parseFloat(getComputedStyle(node).fontSize));
  const originalSize = await fontSize();
  await page.getByRole('button', { name: 'Larger text', exact: true }).click();
  assert.equal(await fontSize(), originalSize + 1);
  await page.locator('.hljs-comment').waitFor();
  assert.equal(await page.locator('.hljs-comment').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize)), originalSize + 1);
  await page.getByRole('button', { name: 'Smaller text', exact: true }).click();
  assert.equal(await fontSize(), originalSize);

  const json = '{"large":900719925474099312345,"items":[1,true,null],"escaped":"\\u0041","nested":{"ok":true}}';
  const jsonPath = await file('sample.json', json);
  await page.getByRole('checkbox', { name: 'Pretty JSON' }).check();
  await page.waitForFunction(() => document.querySelector('#code-coloring-viewer').shadowRoot.querySelector('code').textContent.includes('\n'));
  let displayed = await page.locator('.source code').textContent();
  assert.ok(displayed.includes('900719925474099312345'));
  assert.ok(displayed.includes('\\u0041'));
  await page.reload(); await page.locator('#code-coloring-viewer').waitFor();
  assert.equal(await page.getByRole('checkbox', { name: 'Pretty JSON' }).isChecked(), true);
  assert.equal(await page.locator('.source code').textContent(), displayed);
  await page.screenshot({ path: 'test-results/json-viewer.png', fullPage: true });
  await page.getByRole('checkbox', { name: 'Pretty JSON' }).uncheck();
  assert.equal(await page.locator('.source code').textContent(), json);
  assert.equal(await readFile(jsonPath, 'utf8'), json);

  const invalid = '{"x":1,}';
  await file('invalid.json', invalid);
  await page.getByRole('checkbox', { name: 'Pretty JSON' }).check();
  assert.match(await page.locator('.status').textContent(), /Invalid JSON/);
  assert.equal(await page.locator('.source code').textContent(), invalid);
  await file('data.txt', json);
  assert.equal(await page.getByRole('checkbox', { name: 'Pretty JSON' }).isVisible(), false);
  await page.getByRole('combobox').selectOption('json');
  await page.getByRole('checkbox', { name: 'Pretty JSON' }).check();
  assert.ok((await page.locator('.source code').textContent()).includes('\n'));
  await page.getByRole('checkbox', { name: 'Wrap', exact: true }).check();
  assert.equal(await page.locator('.source').evaluate(node => node.classList.contains('numbered')), true);
  await page.setViewportSize({ width: 420, height: 800 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'test-results/narrow-viewer.png', fullPage: true });

  // A long logical line wraps, and the next line starts after its entire height.
  const wrappedSource = '/* ' + 'wrapped comment '.repeat(20) + '\ncontinued comment */\n\nint value = 42;\n';
  await file('wrapped.cpp', wrappedSource);
  await page.locator('.hljs-comment').waitFor();
  const rowInfo = await page.locator('.code-line').evaluateAll(rows => rows.map(row => ({
    number: row.dataset.line, top: row.getBoundingClientRect().top,
    bottom: row.getBoundingClientRect().bottom, height: row.getBoundingClientRect().height,
    lineHeight: parseFloat(getComputedStyle(row).lineHeight),
    gutter: getComputedStyle(row, '::before').content
  })));
  assert.deepEqual(rowInfo.map(row => row.number), ['1', '2', '3', '4', '5']);
  assert.ok(rowInfo[0].height > rowInfo[0].lineHeight * 2);
  assert.ok(Math.abs(rowInfo[1].top - rowInfo[0].bottom) < 1);
  assert.equal(rowInfo[0].gutter, '"1"');
  assert.equal(await page.locator('.source code').textContent(), wrappedSource);
  const selected = await page.locator('.source code').evaluate(code => {
    const range = document.createRange(); range.selectNodeContents(code);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    const text = selection.toString(); selection.removeAllRanges(); return text;
  });
  assert.equal(selected, wrappedSource);
  assert.equal(await page.locator('[data-line="2"] .hljs-comment').count(), 1);
  await page.getByRole('checkbox', { name: 'Line numbers', exact: true }).uncheck();
  assert.equal(await page.locator('.code-line').first().evaluate(row => getComputedStyle(row, '::before').content), 'none');
  await page.getByRole('checkbox', { name: 'Line numbers', exact: true }).check();
  await page.getByRole('button', { name: 'Larger text', exact: true }).click();
  assert.equal(await fontSize(), originalSize + 1);
  await page.reload(); await page.locator('#code-coloring-viewer').waitFor();
  assert.equal(await fontSize(), originalSize + 1);
  assert.equal(await page.getByRole('checkbox', { name: 'Wrap', exact: true }).isChecked(), true);
  assert.equal(await page.locator('.code-line').first().evaluate(row => getComputedStyle(row, '::before').content), '"1"');
  await page.screenshot({ path: 'test-results/wrapped-lines-viewer.png', fullPage: true });

  // Markup in source files must remain text, including when HTML is selected.
  await file('markup.txt', '<script>globalThis.sourceExecuted=true</script><img src=x onerror="alert(1)">');
  await page.getByRole('combobox').selectOption('xml');
  await page.locator('.hljs-tag').first().waitFor();
  assert.equal(await page.evaluate(() => globalThis.sourceExecuted), undefined);
  assert.equal(await page.locator('#code-coloring-viewer script, #code-coloring-viewer img').count(), 0);

  const htmlPath = join(directory, 'rendered.html');
  await writeFile(htmlPath, '<!doctype html><title>Page</title><pre>Keep this page intact</pre>');
  await page.goto(pathToFileURL(htmlPath).href);
  assert.equal(await page.locator('#code-coloring-viewer').count(), 0);
  assert.equal(await page.locator('pre').textContent(), 'Keep this page intact');
  await file('large.txt', 'x'.repeat(2 * 1024 * 1024 + 1));
  await page.getByRole('combobox').selectOption('cpp');
  assert.match(await page.locator('.status').textContent(), /Highlighting skipped/);

  // Test popup against a real active file tab and the actual content-script API.
  await file('popup.json', '{"ok":true}');
  await page.bringToFront();
  // Keep the source tab active, as it is when Chrome opens an action popup.
  const cdp = await context.newCDPSession(page);
  const popupCreated = context.waitForEvent('page');
  await cdp.send('Target.createTarget', { url: `chrome-extension://${extension.id}/popup.html`, background: true });
  const popup = await popupCreated;
  try { await popup.locator('#controls:not([hidden])').waitFor({ timeout: 10000 }); }
  catch (error) {
    console.log('Popup notice:', await popup.locator('#notice').textContent());
    console.log('Active tab:', await popup.evaluate(() => chrome.tabs.query({ active: true, currentWindow: true })));
    throw error;
  }
  assert.equal(await popup.locator('#filename').textContent(), 'popup.json');
  await popup.locator('#pretty').check();
  await page.waitForFunction(() => document.querySelector('#code-coloring-viewer').shadowRoot.querySelector('code').textContent.includes('\n'));
  await popup.close();
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: real file URLs, highlighting, overrides, JSON, persistence, unchanged files, popup, safe markup, large files, and responsive layout.');
} finally {
  await context.close();
  await rm(directory, { recursive: true, force: true });
}
