'use strict';
const base=require('./video-models.json'),adapters=require('./adapter-models.json');
const sizes={test:[512,320],medium:[768,448],hd:[1024,576],large:[1280,768],full:[1920,1088],uhd:[3840,2176]};
function checkedGuided(raw={}){
 const kind=raw.task;if(!['layout','refine'].includes(kind))throw Error('Choose 3D Blocking or Refine Video.');
 const resolution=raw.resolution||'test';if(!sizes[resolution]||(kind==='layout'&&resolution==='uhd'))throw Error('Unsupported output resolution.');
 const num=(key,fallback,min,max)=>{const n=Number(raw[key]??fallback);if(!Number.isFinite(n)||n<min||n>max)throw Error('Invalid '+key);return n;};
 const fullDuration=kind==='refine'&&raw.fullDuration===true;
 const duration=fullDuration?num('sourceDuration',0,0.4,86400):num('duration',2,1,10);if(!fullDuration&&![2,4,6,8,10].includes(duration))throw Error('Invalid clip duration.');
 const seed=num('seed',42,0,4294967295);if(!Number.isInteger(seed))throw Error('Invalid seed.');
 const tile=raw.tile||'trained';if(!['trained','small'].includes(tile))throw Error('Invalid processing tile.');
 const window=Number(raw.window??49);if(![25,49,97].includes(window))throw Error('Invalid processing window.');
 const refineCustomPrompt=kind==='refine'&&raw.refineCustomPrompt===true;const prompt=kind==='refine'&&!refineCustomPrompt?'Restore subtle natural fine detail while preserving the original subjects, identity, geometry, framing, colours, lighting, timing and motion. Do not add or remove objects, invent texture or introduce camera movement.':String(raw.prompt||'').trim().slice(0,4000);if(!prompt)throw Error('Describe the finished look.');
 const [width,height]=sizes[resolution];
 const textDevice=raw.textDevice??'auto';if(!['auto','cpu'].includes(textDevice))throw Error('Invalid text encoding mode.');
 return {task:kind,prompt,refineCustomPrompt,textDevice,negative:String(raw.negative||'blurry, soft focus, low resolution, painting, watermark, warped geometry').slice(0,2000),resolution,width,height,duration,fullDuration,sourceDuration:duration,seed,strength:num('strength',1,0,1.5),guideStrength:num('guideStrength',1,0.1,1),overlap:num('overlap',0.5,0.5,0.75),tile,window,preserveAudio:raw.preserveAudio!==false,fps:24,quality:kind==='layout'?'two-stage':'tiled-refine'};
}
function guidedModels(kind){return [...base.filter(m=>!m.optional||kind==='layout'),adapters.find(m=>m.mode===kind)];}
function buildGuided(video,reference,raw){
 const s=checkedGuided(raw),graph={};let next=0;
 const add=(class_type,inputs)=>{const id=String(++next);graph[id]={class_type,inputs};return [id,0];};
 const name=dir=>base.find(m=>m.dir===dir).file;
 const model=add('UNETLoader',{unet_name:name('diffusion_models'),weight_dtype:'default'});
 const lora=add('LTXICLoRALoaderModelOnly',{model,lora_name:adapters.find(m=>m.mode===s.task).file,strength_model:s.strength});
 const clip=add('CLIPLoader',{clip_name:name('text_encoders'),type:'ltxv',device:s.textDevice==='cpu'?'cpu':'default'});
 const vae=add('VAELoader',{vae_name:base.find(m=>m.file.includes('video-vae')).file});
 const input=add('ComfyLabLoadClip',{file:video,width:s.width,height:s.height,duration:s.fullDuration?0:s.duration,fps:s.fps,preserve_audio:s.preserveAudio});
 const positive=add('CLIPTextEncode',{clip,text:s.prompt}),negative=add('CLIPTextEncode',{clip,text:s.negative});
 const cond=add('LTXVConditioning',{positive,negative,frame_rate:s.fps});
 const ref=s.task==='layout'?add('LoadImage',{image:reference}):null;
 function guide(latent){
  let g=add('LTXAddVideoICLoRAGuide',{positive:cond,negative:[cond[0],1],vae,latent,image:input,frame_idx:0,strength:s.guideStrength,latent_downscale_factor:s.task==='refine'?1:[lora[0],1],crop:'disabled',use_tiled_encode:s.task!=='refine',tile_size:256,tile_overlap:64,use_streaming:s.task==='refine',tile_frames:s.window});
  if(ref)g=add('LTXAddVideoICLoRAGuide',{positive:g,negative:[g[0],1],vae,latent:[g[0],2],image:ref,frame_idx:-1,strength:1,latent_downscale_factor:1,crop:'disabled',use_tiled_encode:true,tile_size:256,tile_overlap:64});
  return g;
 }
 const fullSigmas='1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0';
 const sampler=add('KSamplerSelect',{sampler_name:s.task==='refine'?'euler':'euler_ancestral'});
 const latent=add('EmptyLTXVLatentVideo',{width:s.task==='layout'?s.width/2:s.width,height:s.task==='layout'?s.height/2:s.height,length:[input[0],1],batch_size:1});
 let samples;
 if(s.task==='refine'){
  const g=guide(latent),sigmas=add('ManualSigmas',{sigmas:fullSigmas});
  samples=add('LTXVTiledFusionSampler',{model:lora,positive:g,negative:[g[0],1],latents:[g[0],2],sigmas,sampler,seed:s.seed,cfg:1,tile_width:s.tile==='trained'?1024:512,tile_height:s.tile==='trained'?576:320,overlap_frac:s.overlap,blend_var:0.05,grid_cycle:1,tile_frames:s.window,vae,canvas_device:'cpu'});
 }else{
  function sample(lat,sigmasText,seed){const g=guide(lat),guider=add('CFGGuider',{model:lora,positive:g,negative:[g[0],1],cfg:1}),noise=add('RandomNoise',{noise_seed:seed}),sigmas=add('ManualSigmas',{sigmas:sigmasText});const sampled=add('SamplerCustomAdvanced',{noise,guider,sampler,sigmas,latent_image:[g[0],2]});const cropped=add('LTXVCropGuides',{positive:g,negative:[g[0],1],latent:sampled});return [cropped[0],2];}
  const first=sample(latent,fullSigmas,s.seed),upscaler=add('LatentUpscaleModelLoader',{model_name:name('latent_upscale_models')}),high=add('LTXVLatentUpsampler',{samples:first,upscale_model:upscaler,vae});
  samples=sample(high,'0.85, 0.7250, 0.4219, 0.0',(s.seed+1)%4294967296);
 }
 const images=add('VAEDecodeTiled',{samples,vae,tile_size:512,overlap:64,temporal_size:32,temporal_overlap:8});
 const trimmed=s.fullDuration?add('ComfyLabTrimClip',{images,audio:[input[0],2],duration:s.duration,fps:s.fps}):null;
 const v=add('CreateVideo',{images:trimmed||images,fps:s.fps,audio:trimmed?[trimmed[0],1]:[input[0],2],bit_depth:8,color_space:'sRGB',codec:'none'});
 const output=add('SaveVideo',{video:v,filename_prefix:'Comfy Lab/'+(s.task==='layout'?'3D Blocking':'Refine Video')+'/ltx25',format:'mp4','format.codec':'h264','format.codec.encoding':'re-encode','format.codec.encoding.crf':18});
 return {graph,output:output[0],settings:s,kind:'video',models:guidedModels(s.task)};
}
module.exports={buildGuided,checkedGuided,guidedModels,sizes};
