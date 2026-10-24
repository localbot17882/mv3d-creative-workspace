from pathlib import Path
import hashlib
import json
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
out = Path(sys.argv[1]).resolve()
if root not in out.parents:
    raise SystemExit('Choose an output inside this checkout, normally Results/.')
scan = json.loads((root / 'docs/SOURCE-SCAN.json').read_text())
if not scan.get('passed'):
    raise SystemExit('Run setup/check-package.js and resolve its findings first.')
files = sorted(set(subprocess.check_output(
    ['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=root
).decode('utf-8').split('\0')) - {''})
excluded = {'Data', 'Results', 'Personajes', 'ComfyUI', 'Tools', 'Python', 'Backups', 'node_modules', '.venv', '.cache', '.tools', '.git'}
out.parent.mkdir(parents=True, exist_ok=True)
manifest = []
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as archive:
    for relative in files:
        file = (root / relative).resolve()
        if not file.is_file():
            continue
        if root not in file.parents or Path(relative).parts[0] in excluded:
            raise SystemExit('Runtime or out-of-tree file in source inventory: ' + relative)
        data = file.read_bytes()
        archive.writestr('comfy-lab/' + relative, data)
        manifest.append({'file': relative, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
with zipfile.ZipFile(out) as archive:
    assert archive.testzip() is None
    assert 'comfy-lab/Install.ps1' in archive.namelist()
    assert 'comfy-lab/App/resources/app/enhance-workspace.js' in archive.namelist()
    assert 'comfy-lab/App/resources/app/post-grading-controls.js' in archive.namelist()
out.with_suffix('.manifest.json').write_text(json.dumps(manifest, indent=2))
out.with_suffix('.sha256').write_text(hashlib.sha256(out.read_bytes()).hexdigest() + '  ' + out.name + '\n')
print(json.dumps({'archive': str(out), 'sourceFiles': len(manifest), 'bytes': out.stat().st_size}))
