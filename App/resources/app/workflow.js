'use strict';
const lighting=require('./lighting.json');
const {buildPeople}=require('./people-workflow');
const template={"1":{"class_type":"LoadImage","inputs":{"image":"ppglab-original-referencia.png"}},"3":{"class_type":"UNETLoader","inputs":{"unet_name":"flux-2-klein-4b.safetensors","weight_dtype":"default"}},"4":{"class_type":"CLIPLoader","inputs":{"clip_name":"qwen_3_4b.safetensors","type":"flux2","device":"cpu"}},"5":{"class_type":"VAELoader","inputs":{"vae_name":"flux2-vae.safetensors"}},"6":{"class_type":"CLIPTextEncode","inputs":{"clip":["4",0],"text":"Transform this architectural aerial render into a convincing real aerial photograph. Reconstruct natural foliage with varied leaf clusters, believable tree crowns and subtle variation. Give existing building materials realistic surface texture, glass reflections and natural tonal variation. Preserve building volumes, floor count, straight facade lines, road layout, camera angle and sunlight direction. Keep the same scene and objects."}},"7":{"class_type":"ConditioningZeroOut","inputs":{"conditioning":["6",0]}},"8":{"class_type":"BasicGuider","inputs":{"model":["13",0],"conditioning":["6",0]}},"9":{"class_type":"KSamplerSelect","inputs":{"sampler_name":"euler"}},"10":{"class_type":"Flux2Scheduler","inputs":{"steps":4,"width":1024,"height":1024}},"11":{"class_type":"KleinTiledUpscaler","inputs":{"guider":["8",0],"positive":["6",0],"negative":["7",0],"sampler":["9",0],"sigmas":["10",0],"vae":["5",0],"image":["1",0],"seed":42,"scale_factor":2,"tiling_strategy":"Detail-First","tile_size_mode":"Auto","tile_width":1024,"tile_height":1024,"padding":128,"color_match":true,"mask_blur":32,"adaptive_tiling":false,"skip_threshold":0,"core_anchor":1,"consistent_noise":true}},"13":{"class_type":"Flux2KleinRefLatentWeight","inputs":{"model":["3",0],"reference_index":0,"weight":0.85}}};
function build(image,s,width,height){
if(s.task==='people')return buildPeople(image,s);
if(!['klein','tiled','seedvr2'].includes(s.mode))throw Error('Engine unavailable');
if(s.task==='lighting'&&s.mode!=='klein')throw Error('Local lighting uses Klein Creative.');
const w=Math.round(width*s.scale),h=Math.round(height*s.scale);
if(w*h>24e6||w>8192||h>8192)throw Error('Output exceeds 24 megapixels or 8192 px per side. Use a smaller image.');
const n=JSON.parse(JSON.stringify(template));n['1'].inputs.image=image;n['6'].inputs.text=s.prompt||template['6'].inputs.text;n['10'].inputs.steps=s.steps;n['10'].inputs.width=1024;n['10'].inputs.height=1024;n['11'].inputs.seed=s.seed;n['11'].inputs.scale_factor=s.scale;n['11'].inputs.core_anchor=0.9+s.creativity*0.01;n['13'].inputs.weight=0.85+s.fidelity*0.015;
if(s.task==='lighting'){if(!lighting[s.lightingPreset])throw Error('Unknown lighting preset');n['6'].inputs.text=String(s.prompt||'').trim()||lighting[s.lightingPreset];n['11'].inputs.color_match=false;n['11'].inputs.core_anchor=1;n['13'].inputs.weight=1;}
let output=['11',0];
if(s.mode==='tiled'){
 for(const id of ['8','9','10','11','13'])delete n[id];
 n['11']={class_type:'TiledUpscaleRefine',inputs:{model:['3',0],positive:['6',0],negative:['7',0],vae:['5',0],image:['1',0],upscale_by:s.scale,tile_size:1024,overlap:320,feather:1,seed:s.seed,steps:s.steps,cfg:1,sampler_name:'euler',scheduler:'simple',denoise:0.75+s.creativity*0.025,sequential_context:true,color_match:'none',color_match_strength:0,final_color_match:false,reference_mode:'conditioning',redo_first_tile:true}};
}
if(s.mode==='seedvr2'){
 for(const id of Object.keys(n))if(id!=='1')delete n[id];
 n['3']={class_type:'UNETLoader',inputs:{unet_name:'seedvr2_3b_int8_convrot.safetensors',weight_dtype:'default'}};
 n['5']={class_type:'VAELoader',inputs:{vae_name:'seedvr2_ema_vae_fp16.safetensors'}};
 n['21']={class_type:'ImageScaleBy',inputs:{image:['1',0],upscale_method:'lanczos',scale_by:s.scale}};
 n['22']={class_type:'SeedVR2Preprocess',inputs:{resized_images:['21',0]}};
 n['23']={class_type:'VAEEncodeTiled',inputs:{pixels:['22',0],vae:['5',0],tile_size:512,overlap:128,temporal_size:64,temporal_overlap:8}};
 n['24']={class_type:'SeedVR2Conditioning',inputs:{model:['3',0],vae_conditioning:['23',0]}};
 n['25']={class_type:'KSampler',inputs:{model:['3',0],positive:['24',0],negative:['24',1],latent_image:['23',0],seed:s.seed,steps:1,cfg:1,sampler_name:'euler',scheduler:'simple',denoise:1}};
 n['26']={class_type:'VAEDecodeTiled',inputs:{samples:['25',0],vae:['5',0],tile_size:512,overlap:128,temporal_size:64,temporal_overlap:8}};
 n['11']={class_type:'SeedVR2PostProcessing',inputs:{images:['26',0],original_resized_images:['21',0],color_correction_method:'none'}};
}
if(s.task!=='lighting'&&s.detail>0){n['16']={class_type:'ImageSharpen',inputs:{image:output,sharpen_radius:1,sigma:1,alpha:s.detail*0.05}};output=['16',0];}if(s.task!=='lighting'&&s.contrast!==0){n['17']={class_type:'AdjustContrast',inputs:{images:output,factor:1+s.contrast*0.025}};output=['17',0];}const colorStrength=Math.max(0,Math.min(1,Number(s.colorPreservation||0)/100));if(colorStrength>0){n['20']={class_type:'ColorTransfer',inputs:{image_target:output,image_ref:['1',0],method:'mkl_lab',source_stats:'per_frame',strength:colorStrength}};output=['20',0];}n['18']={class_type:'SaveImage',inputs:{images:output,filename_prefix:s.task==='lighting'?'Comfy Lab/iluminacion_'+s.lightingPreset:'Comfy Lab/'+s.mode}};return n;}
module.exports={build};
