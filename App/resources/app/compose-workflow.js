'use strict';
function checkedCompose(raw={}){
 const width=Number(raw.width??1024),height=Number(raw.height??768),steps=Number(raw.steps??4),seed=Number(raw.seed??42);
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<256||height<256||width>1536||height>1536||width%16||height%16||width*height>1600000)throw Error('Use dimensions from 256 to 1536, multiples of 16, up to 1.6 megapixels.');
 if(!Number.isInteger(steps)||steps<1||steps>12||!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw Error('Invalid composition seed or steps.');
 const position=raw.position||'center',subjectSize=raw.subjectSize||'medium';if(!['left','center','right'].includes(position)||!['small','medium','large'].includes(subjectSize))throw Error('Choose a character position and size.');
 const prompt=String(raw.prompt||'').trim().slice(0,4000);if(!prompt)throw Error('Describe how the character should appear in the scene.');
 return {task:'compose',aspectRatio:String(raw.aspectRatio||'custom'),width,height,steps,seed,position,subjectSize,prompt,useDetails:raw.useDetails!==false};
}
function buildCompose(background,character,raw,details=[]){
 if(!background||!character)throw Error('Connect both a background image and a character reference.');
 const settings=checkedCompose(raw),s=settings,g={};let next=20;const add=(class_type,inputs)=>{const id=String(++next);g[id]={class_type,inputs};return [id,0];};
 const model=add('UNETLoader',{unet_name:'flux-2-klein-4b.safetensors',weight_dtype:'default'}),clip=add('CLIPLoader',{clip_name:'qwen_3_4b.safetensors',type:'flux2',device:'cpu'}),vae=add('VAELoader',{vae_name:'flux2-vae.safetensors'});
 const size={small:'in the middle distance, occupying approximately one quarter of the image height',medium:'at a natural human scale, occupying approximately half of the image height',large:'in the foreground, occupying approximately three quarters of the image height'}[s.subjectSize];
 const extra=s.useDetails&&Array.isArray(details)?details.slice(0,2):[];
 const text=(extra.length?'Images 3'+(extra.length>1?' and 4':'')+' show close-up details of the SAME person in image 2. Use these only to preserve facial identity, eye shape, skin detail and hairstyle. They are not additional people. ':'')+'Create one photorealistic scene. Image 1 is the background: preserve its camera view, architecture, geometry, materials and layout. Image 2 identifies the person to place into image 1: preserve their face, hairstyle, clothing and body proportions. Show only one instance of that person, with their entire body and feet visible. Place them on the '+s.position+' side of the composition, '+size+'. Match the scene perspective, lighting, colour temperature and ground contact shadows. Do not include the studio background from image 2. '+s.prompt;
 let positive=add('CLIPTextEncode',{clip,text});
 for(const image of [background,character,...extra]){const loaded=add('LoadImage',{image}),fit=add('ImageScaleToTotalPixels',{image:loaded,upscale_method:'lanczos',megapixels:0.5,resolution_steps:16}),latent=add('VAEEncode',{pixels:fit,vae});positive=add('ReferenceLatent',{conditioning:positive,latent});}
 const guider=add('BasicGuider',{model,conditioning:positive}),noise=add('RandomNoise',{noise_seed:s.seed}),sampler=add('KSamplerSelect',{sampler_name:'euler'}),sigmas=add('Flux2Scheduler',{steps:s.steps,width:s.width,height:s.height}),latent=add('EmptyFlux2LatentImage',{width:s.width,height:s.height,batch_size:1});
 const sampled=add('SamplerCustomAdvanced',{noise,guider,sampler,sigmas,latent_image:latent}),image=add('VAEDecode',{samples:sampled,vae});g['18']={class_type:'SaveImage',inputs:{images:image,filename_prefix:'Comfy Lab/Compose/scene'}};
 return {graph:g,settings};
}
module.exports={checkedCompose,buildCompose};
