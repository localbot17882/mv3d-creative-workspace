import sys,json,zipfile
from pathlib import Path
folder=Path(sys.argv[1]).resolve();out=Path(sys.argv[2]);project=json.loads((folder/'project.json').read_text(encoding='utf-8'))
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as archive:
    archive.write(folder/'project.json','project.json')
    for asset in project['assets']:
        file=(folder/'assets'/asset['file']).resolve()
        if folder not in file.parents or file.parent.name!='assets':raise ValueError('Invalid workflow asset path.')
        archive.write(file,'assets/'+asset['file'])
