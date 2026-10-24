$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$env:COMFY_LAB_ROOT=$root
$env:YOLO_CONFIG_DIR=Join-Path $root 'Data/ultralytics'
foreach($entry in @{
 HF_HOME='Data/huggingface';TORCH_HOME='Data/torch';XDG_CACHE_HOME='Data/cache';
 MPLCONFIGDIR='Data/matplotlib';CUDA_CACHE_PATH='Data/cuda-cache';TEMP='Data/temp';TMP='Data/temp'
}.GetEnumerator()){
 $value=Join-Path $root $entry.Value
 New-Item -ItemType Directory -Path $value -Force | Out-Null
 [Environment]::SetEnvironmentVariable($entry.Key,$value,'Process')
}
$python=Join-Path $root '.venv/Scripts/python.exe';$electron=Join-Path $root 'node_modules/electron/dist/electron.exe'
if(!(Test-Path -LiteralPath $python) -or !(Test-Path -LiteralPath $electron)){throw 'Run Install.ps1 first.'}
New-Item -ItemType Directory -Path (Join-Path $root 'Data/logs') -Force | Out-Null
try{$null=Invoke-RestMethod 'http://127.0.0.1:8188/system_stats' -TimeoutSec 2}catch{
 Start-Process -FilePath $python -ArgumentList @('main.py','--listen','127.0.0.1','--port','8188','--enable-manager') -WorkingDirectory (Join-Path $root 'ComfyUI') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root 'Data/logs/comfy-out.log') -RedirectStandardError (Join-Path $root 'Data/logs/comfy-err.log')
}
Start-Process -FilePath $electron -ArgumentList '"App/resources/app"' -WorkingDirectory $root
