# Release validation — 2026-10-24

Candidate: Comfy Lab 0.4.0. Tested on Windows, RTX 4060 Ti 16 GB VRAM, 64 GB RAM.

## Automated checks

23 source regression suites passed. The prepared source ZIP was also extracted into a separate folder without model weights or user data; the same 23 suites passed there. They cover local dependency inclusion, Image Studio graph construction, aspect ratios, audio graphs, Canvas assistant validation, storyboard transfer and queueing, video/refine workflows, characters, composition, file drops, model downloads and updates, assistant connection, individual media deletion, colour processing and speech installation.

The speech installer test uses a controlled downloader. Download resumption, size/hash verification and cancellation are tested separately with tiny fixture files. No additional model weights were downloaded for these checks.

## Application integration

20 integration cases passed in both the working installation and the separate source checkout, with no renderer console errors. They use synthetic PNG, MP4 and WAV files and submit no generation.

- All main categories open and show one active tab.
- Enhance exposes Image, Video and Render People; Refine starts with preservation instructions rather than an unrelated motion prompt.
- Missing speech models expose a visible installation action.
- Image history can be read and exported.
- Colour controls, curves, levels and LUT controls are present. Presets restore their settings; PNG export keeps the original dimensions.
- Canvas imports image, video and audio, preserves connected projects, exposes contextual search and supports the Delete key.
- Video/audio playback and seeking work through the app's local media protocol.
- Workflow ZIP export includes the project and its media.
- Video/audio history downloads and individual deletion work. Exported files survive project/history deletion.

## Fresh local generation

Four new generations completed in the working installation, using installed local models and no Gemini calls:

| Operation | Settings | Generation time |
| --- | --- | --- |
| Image creation | Qwen Image Studio, 512 × 512, red mug | 49.8 s |
| Instruction edit | Same mug changed to blue, 512 × 512 | 15.8 s |
| Image to video | LTX, small draft, requested 2 s | 151.3 s |
| Speech | Ryan, English, seven words | 66.7 s |

Both images decode at the requested size. Video decodes as 49 frames at 24 fps, 512 × 320, approximately 2.04 seconds. Speech decodes as a non-silent 24 kHz WAV lasting 2.88 seconds. The image edit was visually checked for the requested colour change and retained mug shape/framing. Timings include model preparation and are observations, not performance guarantees.

## Separate installation

The separate checkout's Python dependency check passed, and its runtime imports and CUDA availability check passed. ComfyUI started on CPU on a separate localhost port and exposed 1,222 nodes, including Qwen Image Studio, speech, audio saving, clip loading, tiled video refinement and Klein enhancement. That test server was stopped afterwards. The working GPU server remains separate.

Installer validation checks Python 3.12, Git, package-lock JSON and repository pins. The previous complete dependency installation is documented in INSTALL-VALIDATION.md; this audit did not reinstall every dependency or redownload all weights.

## Corrections included

- Included recent Enhance and Refine changes in their actual app-source directory.
- Fixed multiple navigation tabs appearing selected.
- Moved colour-panel styles into a stylesheet compatible with the app's content security policy.
- Added an in-app speech-model installer that does not require an LTX access token.
- Kept caches and temporary files inside the installation.
- Removed a machine-specific character-library path from the interface.
- Updated portable tests that previously depended on the development machine's weights or outdated UI mocks.

## Scope and limits

The separate checkout contains no model weights or API keys, so GPU generation was tested only in the working installation. This audit did not rerun every model, resolution or long-video configuration. Earlier People, identity, storyboard, soundtrack and recorder checks remain separate evidence; several of those use simulated engine events. Gemini was not contacted by the new generation or integration checks. PhotoCraft remains optional and was not reinstalled in this audit.

Runtime reports and generated media stay under excluded Results/Data directories. SOURCE-SCAN.json reports the source inventory check. Code, models and optional services retain their separate licences. Publication and contest submission are not performed by these tests.
