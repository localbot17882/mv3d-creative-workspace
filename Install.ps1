param([string]$Python='py',[switch]$ValidateOnly)
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
function Run([string]$Exe,[string[]]$Arguments){ & $Exe @Arguments; if($LASTEXITCODE -ne 0){throw "Command failed: $Exe"} }
$pythonArgs=@();if($Python -eq 'py'){$pythonArgs=@('-3.12')}
Run $Python ($pythonArgs+@((Join-Path $root 'setup/check-prerequisites.py')))
$null=Get-Command git -ErrorAction Stop
$repositories=Get-Content -LiteralPath (Join-Path $root 'setup/repositories.json') -Raw | ConvertFrom-Json
foreach($repo in $repositories){
 $resolved=[IO.Path]::GetFullPath((Join-Path $root $repo.folder))
 if($repo.commit -notmatch '^[a-f0-9]{40}$' -or $repo.url -notmatch '^https://github\.com/' -or -not $resolved.StartsWith([IO.Path]::GetFullPath($root)+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid repository manifest entry.'}
}
if($ValidateOnly){Write-Output 'Python 3.12, Git, package lock and repository manifest validated. No files installed.';return}
foreach($entry in @{HF_HOME='Data/huggingface';TORCH_HOME='Data/torch';XDG_CACHE_HOME='Data/cache';TEMP='Data/temp';TMP='Data/temp'}.GetEnumerator()){
 $value=Join-Path $root $entry.Value
 New-Item -ItemType Directory -Path $value -Force | Out-Null
 [Environment]::SetEnvironmentVariable($entry.Key,$value,'Process')
}
$runtime=Join-Path $root '.tools';New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$nodeVersion='24.22.1';$nodeFolder=Join-Path $runtime "node-v$nodeVersion-win-x64";$npm=Join-Path $nodeFolder 'npm.cmd'
if(!(Test-Path -LiteralPath $npm)){
 $name="node-v$nodeVersion-win-x64.zip";$base="https://nodejs.org/dist/v$nodeVersion";$archive=Join-Path $runtime $name;$sums=Join-Path $runtime 'SHASUMS256.txt'
 Invoke-WebRequest "$base/SHASUMS256.txt" -OutFile $sums
 Invoke-WebRequest "$base/$name" -OutFile $archive
 $line=Get-Content $sums | Where-Object { $_ -match "  $([regex]::Escape($name))$" };if(!$line){throw 'Node checksum unavailable.'}
 if((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLower() -ne $line.Split(' ')[0]){throw 'Node checksum mismatch.'}
 Expand-Archive -LiteralPath $archive -DestinationPath $runtime
}
$env:PATH="$nodeFolder;$env:PATH"
$env:PIP_CACHE_DIR=Join-Path $root '.cache/pip'
$env:npm_config_cache=Join-Path $root '.cache/npm'
$env:ELECTRON_CACHE=Join-Path $root '.cache/electron' 
Set-Location $root
if(Test-Path -LiteralPath 'package-lock.json'){Run $npm @('ci')}else{Run $npm @('install')}
Run (Join-Path $nodeFolder 'node.exe') @('node_modules/electron/install.js')
if(!(Test-Path -LiteralPath '.venv/Scripts/python.exe')){Run $Python ($pythonArgs+@('-m','venv','.venv'))}
$venv=Join-Path $root '.venv/Scripts/python.exe'
Run $venv @('-m','ensurepip','--upgrade')
Run $venv @('-m','pip','install','--extra-index-url','https://download.pytorch.org/whl/cu130','-r','setup/requirements-lock.txt')
$env:SAM2_BUILD_CUDA='0'
Run $venv @('-m','pip','install','setuptools==84.2.1','wheel==0.48.0')
Run $venv @('-m','pip','install','--no-build-isolation','--no-deps','git+https://github.com/facebookresearch/sam2@2b90b9f5ceec907a1c18123530e92e794ad901a4')
$repos=Get-Content setup/repositories.json -Raw | ConvertFrom-Json
foreach($repo in $repos){
 $target=Join-Path $root $repo.folder
 $fresh=!(Test-Path -LiteralPath $target)
 if($fresh){Run 'git' @('clone','--filter=blob:none','--no-checkout',$repo.url,$target)}
 $actual=(& git -C $target rev-parse HEAD 2>$null)
 if($fresh -or $actual -ne $repo.commit){
  $changes=(& git -C $target status --porcelain --untracked-files=no)
  if(!$fresh -and $changes){throw "Preserving local changes in $target"}
  Run 'git' @('-C',$target,'fetch','origin',$repo.commit)
  Run 'git' @('-C',$target,'checkout','--detach',$repo.commit)
 }
}
foreach($name in @('comfy-lab-people','comfy-lab-speech','comfy-lab-ltx-audio')){
 $target=Join-Path $root "ComfyUI/custom_nodes/$name"
 if(Test-Path -LiteralPath $target){
  foreach($file in Get-ChildItem -LiteralPath (Join-Path $root "nodes/$name") -File -Recurse){$rel=$file.FullName.Substring((Join-Path $root "nodes/$name").Length+1);$other=Join-Path $target $rel;if(!(Test-Path -LiteralPath $other) -or (Get-FileHash -LiteralPath $file.FullName).Hash -ne (Get-FileHash -LiteralPath $other).Hash){throw "Preserving changed adapter: $target"}}
  continue
 }
 Copy-Item -LiteralPath (Join-Path $root "nodes/$name") -Destination $target -Recurse
}
New-Item -ItemType Directory -Path (Join-Path $root 'Data/speech-runtime') -Force | Out-Null
Run $venv @('-m','pip','install','--no-deps','--target','Data/speech-runtime','-r','setup/speech-requirements.txt')
Run $venv @('-m','pip','check')
Run $venv @('setup/check-python-runtime.py')
Write-Output 'Installation complete. Run Start.ps1. Model weights are installed from the app; gated models require your own account.'
