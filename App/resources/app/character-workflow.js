'use strict';
function checkedCharacter(raw={}){
 const mode=raw.mode||'new';if(!['new','reference'].includes(mode))throw Error('Choose a character generation mode.');
 const width=Number(raw.width??768),height=Number(raw.height??1024),seed=Number(raw.seed??42),steps=Number(raw.steps??(mode==='new'?8:4));
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<256||height<256||width>1536||height>1536||width%16||height%16)throw Error('Use dimensions from 256 to 1536, in multiples of 16.');
 if(!Number.isSafeInteger(seed)||seed<0||seed>4294967295||!Number.isInteger(steps)||steps<1||steps>30)throw Error('Invalid character seed or step count.');
 const prompt=String(raw.prompt||'').trim().slice(0,4000);if(!prompt)throw Error('Describe your character.');
 return {task:'characters',seedLocked:raw.seedLocked!==false,aspectRatio:String(raw.aspectRatio||'custom'),mode,width,height,seed,steps,prompt,name:String(raw.name||'Character').slice(0,80)};
}
function buildCharacter(raw,reference){
 const s=checkedCharacter(raw),g={};let count=20;const add=(class_type,inputs)=>{const id=String(++count);g[id]={class_type,inputs};return [id,0];};
 let model,vae,positive,negative,latent,sampled;
 if(s.mode==='new'){
  model=add('UNETLoader',{unet_name:'z_image_turbo_bf16.safetensors',weight_dtype:'default'});model=add('ModelSamplingAuraFlow',{model,shift:3});
  const clip=add('CLIPLoader',{clip_name:'qwen_3_4b.safetensors',type:'lumina2',device:'default'});vae=add('VAELoader',{vae_name:'ae.safetensors'});
  positive=add('CLIPTextEncode',{clip,text:s.prompt});negative=add('ConditioningZeroOut',{conditioning:positive});latent=add('EmptySD3LatentImage',{width:s.width,height:s.height,batch_size:1});
  sampled=add('KSampler',{model,positive,negative,latent_image:latent,seed:s.seed,steps:s.steps,cfg:1,sampler_name:'res_multistep',scheduler:'simple',denoise:1});
 }else{
  if(!reference)throw Error('Choose a reference character first.');
  model=add('UNETLoader',{unet_name:'flux-2-klein-4b.safetensors',weight_dtype:'default'});const clip=add('CLIPLoader',{clip_name:'qwen_3_4b.safetensors',type:'flux2',device:'default'});vae=add('VAELoader',{vae_name:'flux2-vae.safetensors'});
  const image=add('LoadImage',{image:reference}),fit=add('ImageScaleToTotalPixels',{image,upscale_method:'lanczos',megapixels:1,resolution_steps:16}),ref=add('VAEEncode',{pixels:fit,vae});
  positive=add('CLIPTextEncode',{clip,text:'Use the same person as the reference image. Preserve their facial identity, age, distinctive features and body proportions. '+s.prompt});positive=add('ReferenceLatent',{conditioning:positive,latent:ref});
  const guider=add('BasicGuider',{model,conditioning:positive}),noise=add('RandomNoise',{noise_seed:s.seed}),sampler=add('KSamplerSelect',{sampler_name:'euler'}),sigmas=add('Flux2Scheduler',{steps:s.steps,width:s.width,height:s.height});
  latent=add('EmptyFlux2LatentImage',{width:s.width,height:s.height,batch_size:1});sampled=add('SamplerCustomAdvanced',{noise,guider,sampler,sigmas,latent_image:latent});
 }
 const decoded=add('VAEDecode',{samples:sampled,vae});g['18']={class_type:'SaveImage',inputs:{images:decoded,filename_prefix:'Comfy Lab/Characters/character'}};return {graph:g,settings:s};
}
module.exports={checkedCharacter,buildCharacter};
