'use strict';
const manifest=require('./video-models.json');
const audioModels=manifest.filter(m=>['diffusion_models','text_encoders'].includes(m.dir)||m.file.includes('audio-vae'));
function checkedAudio(raw={}){
 const duration=Number(raw.duration??4),seed=Number(raw.seed??42),prompt=String(raw.prompt||'').trim().slice(0,4000);
 if(![2,4,6,8,10,20,30].includes(duration))throw Error('Choose an audio duration from the available options.');
 if(!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw Error('Invalid audio seed.');
 if(!prompt)throw Error('Describe the audio you want.');
 const textDevice=raw.textDevice??'auto';if(!['auto','cpu'].includes(textDevice))throw Error('Invalid text encoding mode.');
 return {task:'audio',duration,seed,prompt,textDevice,negative:String(raw.negative||'distortion, clipping, crackling, low quality').slice(0,2000),fps:24,frames:duration*24+1,format:'wav'};
}
function buildAudio(raw){
 const s=checkedAudio(raw),graph={};let next=0;
 const add=(class_type,inputs)=>{const id=String(++next);graph[id]={class_type,inputs};return [id,0];};
 const model=add('UNETLoader',{unet_name:audioModels.find(m=>m.dir==='diffusion_models').file,weight_dtype:'default'});
 const onlyAudio=add('LTXVAudioOnlyModel',{model});
 const clip=add('CLIPLoader',{clip_name:audioModels.find(m=>m.dir==='text_encoders').file,type:'ltxv',device:s.textDevice==='cpu'?'cpu':'default'});
 const vae=add('VAELoader',{vae_name:audioModels.find(m=>m.dir==='vae').file});
 const positive=add('CLIPTextEncode',{clip,text:s.prompt}),negative=add('CLIPTextEncode',{clip,text:s.negative});
 const cond=add('LTXVConditioning',{positive,negative,frame_rate:s.fps});
 const dummy=add('LTXVAudioOnlyEmptyVideoLatent',{});
 const audio=add('LTXVEmptyLatentAudio',{audio_vae:vae,frames_number:s.frames,frame_rate:s.fps,batch_size:1});
 const latent=add('LTXVConcatAVLatent',{video_latent:dummy,audio_latent:audio});
 const guider=add('CFGGuider',{model:onlyAudio,positive:cond,negative:[cond[0],1],cfg:1});
 const noise=add('RandomNoise',{noise_seed:s.seed}),sampler=add('KSamplerSelect',{sampler_name:'euler_ancestral'});
 const sigmas=add('ManualSigmas',{sigmas:'1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0'});
 const sampled=add('SamplerCustomAdvanced',{noise,guider,sampler,sigmas,latent_image:latent});
 const separated=add('LTXVSeparateAVLatent',{av_latent:sampled});
 const decoded=add('LTXVAudioVAEDecode',{samples:[separated[0],1],audio_vae:vae});
 const output=add('ComfyLabSaveAudioWAV',{audio:decoded,filename_prefix:'Comfy Lab/Audio/ltx25'});
 return {graph,output:output[0],settings:s,kind:'audio'};
}
module.exports={buildAudio,checkedAudio,audioModels};
