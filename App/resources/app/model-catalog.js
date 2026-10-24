'use strict';
const fs=require('node:fs'),path=require('node:path');
const files=['speech-models.json','image-studio-models.json','models.json','video-models.json','adapter-models.json','character-models.json'];
const id=m=>m.dir+'/'+m.file;
function all(root=require('./app-root')){const found=new Map();for(const file of files)for(const m of require('./'+file))if((file!=='speech-models.json'||m.file.endsWith('.safetensors'))&&!found.has(id(m)))found.set(id(m),m);try{const extra=JSON.parse(fs.readFileSync(path.join(root,'Data/extra-models.json'),'utf8'));for(const m of extra)if(['diffusion_models','checkpoints','loras','vae','text_encoders','latent_upscale_models','model_patches','clip_vision'].includes(m.dir)&&typeof m.file==='string'&&path.basename(m.file)===m.file&&/^[\w.-]+\/[\w.-]+$/.test(m.repo||'')&&!found.has(id(m)))found.set(id(m),m);}catch{}return [...found.values()];}
function apply(root){let saved;try{saved=JSON.parse(fs.readFileSync(path.join(root,'Data/model-versions.json'),'utf8'));}catch{return;}for(const file of files)for(const m of require('./'+file)){const v=saved[id(m)];if(v&&/^[a-f0-9]{64}$/.test(v.sha)&&/^[a-f0-9]{40}$/.test(v.rev)&&Number.isSafeInteger(v.size)&&v.size>0)Object.assign(m,{sha:v.sha,rev:v.rev,size:v.size});}}
module.exports={all,id,apply};
