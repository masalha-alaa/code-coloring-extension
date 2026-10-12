# Code Coloring

A Chrome Manifest V3 extension that automatically syntax-highlights local source files opened at `file:///` URLs. It works entirely offline and changes only the browser view. Your files are never edited.

## Install

Download this repository as a ZIP and extract it. In `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the repository’s **`extension`** folder. The bundled extension is ready to use; no build is required.

In the extension’s **Details**, enable **Allow access to file URLs**. Reload any local file tabs that were already open.

Alternatively, download the `code-coloring-extension` artifact from the latest successful [Actions run](https://github.com/masalha-alaa/code-coloring-extension/actions), extract the ZIP inside it, and load the folder containing `manifest.json`.

## Use

Open a source file in Chrome, for example:

```text
file:///C:/Projects/work/upnride/Main_Board_VGDB/imu_driver/Src/imu_runner.cpp
```

The viewer automatically chooses the language from the filename. Use the **Language** menu in the viewer or extension popup to override it. Overrides and JSON formatting preferences are remembered separately for each file. **Reset** restores the original text and automatic language detection.

For JSON files, **Pretty JSON** formats the view with two-space indentation. The option appears only when the effective language is JSON, either detected or selected manually. Turning it off restores the exact original text. Invalid JSON stays visible with an error message. Formatting preserves large integers, numeric notation, duplicate keys, property order, and string escapes.

The toolbar also provides line numbers, line wrapping, font size, and copying the displayed text. Wrapping hides line numbers so wrapped visual rows are not mistaken for source lines. Wrap, font size, and line number preferences apply across files. The dark theme is the default.

## Languages

C, C++, Python, JSON, C#, JavaScript, TypeScript, Rust, Java, Go, Shell/Bash, PowerShell, SQL, YAML, Markdown, CSS, SCSS, HTML/XML, INI/TOML, Makefile, CMake, Diff/Patch, Ruby, PHP, Swift, Kotlin, Lua, Dart, R, Objective-C, Dockerfile, Assembly, and plain text.

Common extensions are mapped automatically, including `.h` → C, `.hpp` → C++, `.jsx` → JavaScript and `.tsx` → TypeScript. Headers with ambiguous language can be overridden. Special names such as `Makefile`, `CMakeLists.txt`, and `Dockerfile` are detected too. Unknown extensions use plain text until a language is selected.

## Browser behavior and limits

- Chrome must display the file as raw text. A file that Chrome downloads instead of opening has no page for the extension to color; open a `.txt` copy and select the language manually if needed.
- Rendered HTML pages, XML trees, SVG images, PDFs, directory listings, and other media are left intact. HTML/XML highlighting is available when the source is displayed as raw text, such as in a `.txt` copy.
- Highlighting and JSON formatting are skipped above 2 MiB of text to keep large files usable. The original text remains visible. JSON formatting additionally limits nesting to 200 levels and output to 8 MiB. Line numbers are hidden above 50,000 lines.
- Reload the tab to read changes made to the file by another application.
- Chrome controls text decoding and newline normalization. The extension displays the text Chrome supplies.

## Privacy and permissions

No network requests, analytics, remote scripts, or uploads. Highlight.js is bundled locally. File contents are used only in the current tab and are never stored. Local extension storage contains viewing preferences and a SHA-256 hash of each file URL for its saved settings.

`storage` remembers settings. The popup communicates directly with the viewer in the active tab without requesting browsing history or tab URL access. The content script matches only `file:///*`, with file access separately controlled by Chrome. The extension has no filesystem write capability.

## Development

Requires Node.js 22+ and Python 3 for ZIP packaging.

```sh
npm ci
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:browser
npm run package
```

Edit `src/` for viewer/popup behavior and `extension/` for the manifest, popup HTML/CSS, and icons. `npm run build` regenerates the committed `extension/content.js`, `extension/popup.js`, and third-party notices, then creates `dist/`. Commit the regenerated bundles with source changes so the repository stays ready to load.

`npm run package` creates `artifacts/code-coloring-extension-v1.0.0.zip` with `manifest.json` at the root. GitHub Actions runs core tests and real Chromium extension tests before uploading this package and viewer screenshots.

## License

MIT for the extension’s own code. Highlight.js is licensed under BSD-3-Clause; see `extension/vendor/highlightjs-LICENSE`.
