'use strict';

const engines = {
  studio:{name:'Image Studio · Qwen-Image 2.1 Turbo',nodes:['UNETLoader','CLIPLoader','VAELoader','TextEncodeQwenImage21','QwenImage21Cache','EmptyLatentImage','ManualSigmas','CFGGuider','RandomNoise','KSamplerSelect','SamplerCustomAdvanced','VAEDecodeTiled','SaveImage'],note:'General text-to-image and instruction editing.'},
  characters:{name:'Characters · Z-Image-Turbo',nodes:['UNETLoader','CLIPLoader','VAELoader','ModelSamplingAuraFlow','CLIPTextEncode','ConditioningZeroOut','EmptySD3LatentImage','KSampler','VAEDecode','SaveImage'],note:'Photorealistic character generation.'},
  klein: {
    name: 'Klein Creative',
    nodes: ['LoadImage', 'UNETLoader', 'CLIPLoader', 'VAELoader', 'CLIPTextEncode', 'ConditioningZeroOut', 'BasicGuider', 'KSamplerSelect', 'Flux2Scheduler', 'KleinTiledUpscaler', 'Flux2KleinRefLatentWeight', 'SaveImage'],
    note: 'Creative refinement of vegetation and materials. May reinterpret architectural details.'
  },
  tiled: {
    name: 'Tiled Refine',
    nodes: ['LoadImage', 'UNETLoader', 'CLIPLoader', 'VAELoader', 'CLIPTextEncode', 'ConditioningZeroOut', 'TiledUpscaleRefine', 'SaveImage'],
    note: 'Refines overlapping tiles using your image as a reference. Lower creativity favours the original.'
  },
  people: {
    name: 'People · Automatic segmentation',
    nodes: ['LoadImage','LoadImageMask','MaskToSEGS','ComfyLabPeopleMasks','UltralyticsDetectorProvider','SAMLoader','ImpactSimpleDetectorSEGS','ImpactSEGSLabelFilter','SegsToCombinedMask','MaskToImage','ImpactCount_Elts_in_SEGS','PreviewAny','CheckpointLoaderSimple','CLIPTextEncode','ControlNetLoader','ImpactControlNetApplyAdvancedSEGS','DetailerForEach','ImageCompositeMasked','SaveImage'],
    note: 'Detect people, refine their silhouettes and enhance each person separately.'
  },
  seedvr2: {
    name: 'SeedVR2 Restore',
    nodes: ['LoadImage', 'UNETLoader', 'VAELoader', 'ImageScaleBy', 'SeedVR2Preprocess', 'VAEEncodeTiled', 'SeedVR2Conditioning', 'KSampler', 'VAEDecodeTiled', 'SeedVR2PostProcessing', 'SaveImage'],
    note: 'Restores and upscales without a text prompt. Best compared against the original at 100% zoom.'
  }
};

function availability(nodes, models) {
  return Object.fromEntries(Object.entries(engines).map(([id, engine]) => {
    const missing = engine.nodes.filter(name => !nodes[name]);
    const needed = models.filter(model => model.modes.includes(id));
    return [id, {
      name: engine.name,
      workflowReady: missing.length === 0,
      ready: missing.length === 0 && needed.length > 0 && needed.every(model => model.ready),
      error: missing.length ? 'Missing nodes for ' + engine.name + ': ' + missing.join(', ') : null
    }];
  }));
}

module.exports = { engines, availability };
