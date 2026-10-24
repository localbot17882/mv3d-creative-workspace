# Licensing and third-party components

Original Comfy Lab application code and original adapters: GPL-3.0-only; see LICENSE. Author: Miguel (@Miguelv3d).

The application runs ComfyUI as a separate local process. ComfyUI and external custom-node repositories are downloaded from the exact commits in setup/repositories.json; their upstream licences apply. They are not relicensed by this repository.

nodes/comfy-lab-ltx-audio contains adapted and unmodified Lightricks code. It is an explicit exception to the root licence and retains the included LTX-2 Community License and PROVENANCE.txt. Review that licence before use and redistribution. Upstream: https://github.com/Lightricks/ComfyUI-LTXVideo .

Model manifests identify external weight repositories and revisions. Model weights are not included. Each model has its own licence and access conditions, including gated downloads. The application licence does not grant rights to those weights. In particular, the Qwen Image 2.1 UI identifies its research-use conditions.

Comfy logo identifies the ComfyUI ecosystem; no affiliation or endorsement is claimed. PhotoCraft, Electron, Python, PyTorch, Qwen and other dependencies retain their respective licences. PhotoCraft is optional and downloaded separately from its publisher with an archive checksum.
