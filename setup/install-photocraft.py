from pathlib import Path
import json,urllib.request,hashlib,zipfile
root=Path(__file__).resolve().parents[1]
release=json.loads((root/'setup/photocraft-release.json').read_text(encoding='utf-8'))
asset=next(a for a in release['assets'] if a['name'].endswith('windows-x64-portable.zip'))
folder=root/'setup/photocraft-downloads';folder.mkdir(exist_ok=True)
sums=next(a for a in release['assets'] if a['name']=='SHA256SUMS.txt')
def download(asset):
 target=folder/asset['name']
 if not target.exists() or target.stat().st_size!=asset['size']:
  req=urllib.request.Request(asset['browser_download_url'],headers={'User-Agent':'Comfy-Lab'})
  with urllib.request.urlopen(req,timeout=90) as r,target.with_suffix(target.suffix+'.part').open('wb') as out:
   while chunk:=r.read(1024*1024):out.write(chunk)
  target.with_suffix(target.suffix+'.part').replace(target)
 return target
checks=download(sums).read_text(encoding='utf-8')
expected=next(line.split()[0] for line in checks.splitlines() if line.split()[-1].lstrip('*')==asset['name'])
archive=download(asset);actual=hashlib.file_digest(archive.open('rb'),'sha256').hexdigest()
assert actual==expected,'PhotoCraft archive checksum mismatch'
destination=root/'Tools/PhotoCraft'/release['tag_name'];destination.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(archive) as z:
 for member in z.infolist():
  target=(destination/member.filename).resolve()
  assert target.is_relative_to(destination.resolve()),'Unsafe archive path'
 z.extractall(destination)
exe=next(destination.rglob('photocraft.exe'))
info={'version':release['tag_name'],'exe':str(exe),'archiveSha256':actual,'source':release['html_url']}
(root/'Data/photocraft-install.json').write_text(json.dumps(info,indent=2),encoding='utf-8')
print(json.dumps(info))
