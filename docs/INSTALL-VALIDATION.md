# Fresh installation validation — 2026-10-23

Completed in an isolated checkout at F:/Codex/comfy-lab-public with a new Python virtual environment and new npm dependencies. No model weights, API keys, user projects or character libraries were copied.

Passed: Python 3.12 and Git checks; checksum-verified Node runtime; pinned Electron installation; pinned Python dependencies; SAM2 installed at its upstream Git commit; fixed ComfyUI and five external custom-node commits; original adapters; isolated speech packages; pip check with no broken requirements; CUDA availability check.

ComfyUI started successfully on CPU at localhost:8190, separate from the development server on 8188. Speech, Qwen Image Studio and audio-save nodes were present. See CLEAN-STARTUP.json. The test server was then stopped with an empty queue.

The fresh Electron application passed the same UI integration check as the development copy, including Canvas nodes, voice settings, full-duration Refine and Image Studio Enhance. The check submitted no generation.

GPU generation in this clean checkout has not been tested because no weights were downloaded. Actual generation examples are being prepared in the existing installation. PhotoCraft is optional and has its own separate install helper.
