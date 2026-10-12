"""Create a ZIP with manifest.json at its root, ready to extract/load unpacked."""
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
version = json.loads((dist / 'manifest.json').read_text())['version']
output = root / 'artifacts' / f'code-coloring-extension-v{version}.zip'
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    for path in sorted(dist.rglob('*')):
        if path.is_file():
            archive.write(path, path.relative_to(dist))
print(output)
