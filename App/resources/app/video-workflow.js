'use strict';
const files=require('./video-models.json');
const fileFor=role=>files.find(m=>role==='videoVae'?m.dir==='vae'&&m.file.includes('video-vae'):role==='audioVae'?m.dir==='vae'&&m.file.includes('audio-vae'):m.dir===role).file;
const resolutions={'small':[512,320],'medium':[768,448],'hd':[1024,576],'large':[1280,768],'full':[1920,1088]};
function checkedVideo(raw={}){
 const duration=Number(raw.duration??2),seed=Number(raw.seed??1);
 if(![2,4,6,8,10].includes(duration))throw Error('Choose a duration from 2 to 10 seconds.');
 if(!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw Error('Invalid video seed.');
 const resolution=raw.resolution??'small',quality=raw.quality??'draft';
 if(!resolutions[resolution]||!['draft','refined'].includes(quality))throw Error('Invalid video quality or resolution.');
 const prompt=String(raw.prompt||'').trim().slice(0,4000);if(!prompt)throw Error('Describe the movement you want.');
 let [width,height]=resolutions[resolution];const frameRatio=raw.frameRatio??null;if(frameRatio!==null){if(!['16:9','9:16','1:1'].includes(frameRatio))throw Error('Choose a supported storyboard aspect ratio.');const edge=width,grid=quality==='refined'?64:32,short=frameRatio==='1:1'?edge:Math.max(256,Math.round(edge*9/16/grid)*grid);[width,height]=frameRatio==='9:16'?[short,edge]:[edge,short];}
 const textDevice=raw.textDevice??'auto';if(!['auto','cpu'].includes(textDevice))throw Error('Invalid text encoding mode.');
 return {duration,resolution,quality,frameRatio,seed,prompt,textDevice,audio:raw.audio===true,width,height,fps:24,frames:duration*24+1};
}
function buildVideo(image,raw){
 const s=checkedVideo(raw),g={};let n=0;
 const add=(class_type,inputs)=>{const id=String(++n);g[id]={class_type,inputs};return [id,0];};
 const model=add('UNETLoader',{unet_name:fileFor('diffusion_models'),weight_dtype:'default'});
 const clip=add('CLIPLoader',{clip_name:fileFor('text_encoders'),type:'ltxv',device:s.textDevice==='cpu'?'cpu':'default'});
 const vae=add('VAELoader',{vae_name:fileFor('videoVae')}),audioVae=add('VAELoader',{vae_name:fileFor('audioVae')});
 const img=add('LoadImage',{image});
 const positive=add('CLIPTextEncode',{clip,text:s.prompt});
 const negative=add('CLIPTextEncode',{clip,text:'blurry, distorted architecture, warped geometry, flickering, low quality, text, watermark'});
 const cond=add('LTXVConditioning',{positive,negative,frame_rate:s.fps});
 const latent=add('EmptyLTXVLatentVideo',{width:s.quality==='refined'?s.width/2:s.width,height:s.quality==='refined'?s.height/2:s.height,length:s.frames,batch_size:1});
 const conditioned=add('LTXVImgToVideoInplace',{vae,image:img,latent,strength:s.quality==='refined'?0.7:1,bypass:false});
 const audio=add('LTXVEmptyLatentAudio',{audio_vae:audioVae,frames_number:s.frames,frame_rate:s.fps,batch_size:1});
 const guider=add('LTXVDualCFGGuider',{model,positive:cond,negative:[cond[0],1],video_cfg:1,audio_cfg:1});
 const sampler=add('KSamplerSelect',{sampler_name:'euler_ancestral'});
 function sample(video,aud,sigmas,seed){const av=add('LTXVConcatAVLatent',{video_latent:video,audio_latent:aud});const noise=add('RandomNoise',{noise_seed:seed});const sigma=add('ManualSigmas',{sigmas});const sampled=add('SamplerCustomAdvanced',{noise,guider,sampler,sigmas:sigma,latent_image:av});return add('LTXVSeparateAVLatent',{av_latent:sampled});}
 let out=sample(conditioned,audio,'1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0',s.seed);
 if(s.quality==='refined'){
  const upscale=add('LatentUpscaleModelLoader',{model_name:fileFor('latent_upscale_models')});
  const high=add('LTXVLatentUpsampler',{samples:out,upscale_model:upscale,vae});
  const second=add('LTXVImgToVideoInplace',{vae,image:img,latent:high,strength:1,bypass:false});
  out=sample(second,[out[0],1],'0.85, 0.7250, 0.4219, 0.0',(s.seed+1)%4294967296);
 }
 const images=add('VAEDecodeTiled',{samples:out,vae,tile_size:512,overlap:64,temporal_size:64,temporal_overlap:16});
 const inputs={images,fps:s.fps,bit_depth:8,color_space:'sRGB',codec:'none'};
 if(s.audio)inputs.audio=add('LTXVAudioVAEDecode',{samples:[out[0],1],audio_vae:audioVae});
 const video=add('CreateVideo',inputs);
 const saved=add('SaveVideo',{video,filename_prefix:'Comfy Lab/Video/ltx25',format:'mp4','format.codec':'h264','format.codec.encoding':'re-encode','format.codec.encoding.crf':18});
 return {graph:g,output:saved[0],settings:s};
}
module.exports={buildVideo,checkedVideo,resolutions};
