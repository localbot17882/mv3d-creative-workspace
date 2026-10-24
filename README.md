# Comfy Lab
### by @Miguelv3d

A Windows creative studio for local ComfyUI image, video and audio workflows. Build connected workflows on Canvas or use guided tools. The optional Gemini assistant helps write prompts and plan workflows; generation stays on the local ComfyUI engine.

## Features
- Qwen Image Studio: create and edit images; send a result directly to Enhance.
- Image enhancement with Klein, Tiled Refine and SeedVR2; lighting and automatic people segmentation.
- Character library, approved detail references and reusable character elements.
- Storyboards: per-shot images, identity references, approval before video, timing and quality, Canvas transfer and MP4 composition.
- LTX image-to-video, 3D Blocking and Refine, including full input duration.
- Canvas: typed image/video/audio connections, conversational assistant, reusable cached outputs, project download and deletion.
- Qwen speech and voice reference cloning; LTX ambience; video soundtracks with optional narration and volume controls.
- Draft to High Quality resamples existing video frames. It preserves motion and timing; it is not a second generative high-resolution pass.
- Media pan/zoom, comparison views, History downloads, model updates, discovery and an app-window screen recorder.
- Image post-production: light and colour controls, RGB/channel curves, levels, 1D/3D `.cube` LUTs with intensity, saved presets and full-resolution PNG export.
- Enhance groups Image, Video Refine and Render People in one workspace. Video Refine preserves the input scene by default; custom instructions are optional.

## Install on Windows

Prerequisites: 64-bit Windows, Git, Python 3.12 and a compatible NVIDIA driver. The development machine uses an RTX 4060 Ti with 16 GB VRAM and 64 GB RAM. Large resolutions and longer videos may exceed that GPU. Disk use depends heavily on which model families you install; weights are not part of this repository.

Clone this repository into a folder you own, then run in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\Install.ps1
powershell -ExecutionPolicy Bypass -File .\Start.ps1
```

If Python is not registered with the Windows `py` launcher:

```powershell
.\Install.ps1 -Python 'D:\Python312\python.exe'
```

`Install.ps1` checks Python and Git, downloads a checksum-verified Node runtime, installs the pinned Electron and Python dependencies, checks out the fixed ComfyUI/custom-node commits and installs the local adapters. It does not erase an existing installation or overwrite modified repositories. SAM2 is installed at a pinned Git commit; its optional CUDA extension is disabled so a local CUDA compiler is not required. Speech dependencies are isolated under Data/speech-runtime.

`Start.ps1` starts ComfyUI on localhost:8188 if necessary, then opens Comfy Lab. Use a dedicated installation and do not run two different ComfyUI installations on port 8188 at once.

Install the models you want using the app's Install controls. Each manifest fixes the source/revision/checksum where available. Gated models require your own Hugging Face access and licence acceptance. Start with short, small drafts. No model weights are distributed here.

### Optional services
Gemini: connect your own API key in the assistant settings. The assistant sends prompts and selected references to Gemini; your provider's quotas and charges apply. Do not commit your key. Generation tools work without the assistant.

PhotoCraft post-production is optional. To download the pinned portable release and verify its checksum, run `.venv\Scripts\python.exe setup/install-photocraft.py` after installation. This is a separate third-party application, not an API included with Comfy Lab.

## Data and privacy
Runtime data is stored in this checkout: Data, Personajes, Results, ComfyUI models and output. The launcher and app also keep Hugging Face, PyTorch and temporary-file caches in Data. These folders are excluded from Git. The source tree does not contain model weights, API keys, personal projects or generated examples. Installing another copy does not move your existing library.

## Development and checks
The app is in App/resources/app; main.js is Electron's main process, preload.js exposes limited IPC actions and the renderer uses HTML/CSS/JavaScript. Engine workflows are assembled locally and submitted to ComfyUI. Original custom nodes and the separately licensed LTX adapter are in nodes. Repository revisions are in setup/repositories.json. Python versions are in setup/requirements-lock.txt; Electron dependencies are pinned by package-lock.json.

The release audit covers graph construction, queue handling, downloads, assistant connection, identity references, colour processing and source dependencies. Run it with `npm test`, or use the downloaded runtime directly:

```powershell
.\.tools\node-v24.22.1-win-x64\node.exe setup/check-release.js
```

The integration check uses synthetic media to test navigation, history, colour presets, media playback/seeking and project export/deletion. It submits no model generation and needs no API key:

```powershell
.\node_modules\electron\dist\electron.exe App/resources/app --comfy-lab-release-ui-check
```

See docs/RELEASE-VALIDATION.md for the latest checks and their limits. GPU generation in the separate weight-free checkout has not been tested.

## Demo and licence
The local demo recording is a review draft and is not published. See docs/DEMO.md for its script.

Original application code is GPL-3.0-only. See LICENSE and NOTICE.md for third-party exceptions. Model licences are separate; an open-source application does not make all its model dependencies unrestricted. The optional Gemini assistant uses a closed external API.
