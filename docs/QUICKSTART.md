# First run without an assistant API key

Run Install.ps1, then Start.ps1. Install the models for the tools you want to try. Model weights are separate downloads; gated repositories require your own access.

## Create and edit an image

1. Open Image Studio and install its models if prompted.
2. Choose Create image, 512 px, 1:1.
3. Try: `Photorealistic product photograph of a red ceramic mug on a light grey studio background. Soft studio lighting. Full mug visible. No text.`
4. Click Create image. Once complete, choose Edit this result.
5. Try: `Change only the red mug to cobalt blue. Preserve its shape, background, camera and lighting.`

## Enhance and finish

Send an Image Studio result to Enhance, choose an installed enhancement engine and compare the result. Creative enhancement engines accept manually written instructions; SeedVR2 restoration does not require a prompt.

Open Post-production to adjust light/colour, RGB curves and levels. Load a 1D or 3D .cube LUT if desired and adjust its intensity. Custom presets preserve colour settings and the LUT. Export saves a full-resolution PNG and adds a history entry.

## Animate

Open Video, load an image and start with a two-second small draft. A matching aspect ratio avoids padding. Write a short movement instruction, then generate. Model loading can take longer than sampling on the first run.

Video Refine is inside Enhance → Video. Its default instructions preserve the source scene and motion. Full-duration processing is available; long or high-resolution inputs require more resources.

## Generate speech

Open Audio and choose Speech and voice clone. If the models are missing, click Install speech and voice models. This download is independent of gated LTX access. Choose a voice and language, enter the exact words, then Generate speech. Listen and Download WAV are available after completion.

## Connect a workflow

Open Canvas, import a video and audio file, add Add audio to video and connect matching ports. Run workflow uses the local tools. Save retains the project; Download workflow exports the project and its media as a ZIP.

For storyboard work without Gemini, use New blank storyboard. Set each shot's image prompt, ratio and size, generate and approve its still, then animate. Keep identity references and previous-shot references help continuity, but results still need review.
