'use strict';
const fs=require('node:fs/promises'),sync=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Readable,Transform}=require('node:stream'),{pipeline}=require('node:stream/promises');
const models=require('./video-models.json'),{buildVideo,checkedVideo}=require('./video-workflow');
const {buildAudio,audioModels}=require('./audio-workflow');
const {buildGuided,checkedGuided,guidedModels}=require('./guided-workflow'),adapters=require('./adapter-models.json');
const {watchProgress}=require('./job-progress');
const readImage=require('./image-input');
const origin='http://127.0.0.1:8188';
const validID=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(id);
function mediaRange(header,size){
 if(!header)return {start:0,end:size-1,status:200};
 const m=/^bytes=(\d*)-(\d*)$/.exec(header);if(!m||(!m[1]&&!m[2]))return null;
 let start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2]));let end=m[1]?(m[2]?Math.min(Number(m[2]),size-1):size-1):size-1;
 return Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&start<=end&&start<size?{start,end,status:206}:null;
}
function fitImage(nativeImage,s,width,height){
 const im=nativeImage.createFromBuffer(s.bytes),ratio=Math.min(width/s.width,height/s.height);
 const w=Math.max(1,Math.round(s.width*ratio)),h=Math.max(1,Math.round(s.height*ratio));
 const pixels=im.resize({width:w,height:h,quality:'best'}).toBitmap(),bg=Buffer.alloc(width*height*4);
 for(let i=3;i<bg.length;i+=4)bg[i]=255;
 const x=Math.floor((width-w)/2),y=Math.floor((height-h)/2);
 for(let row=0;row<h;row++)pixels.copy(bg,((y+row)*width+x)*4,row*w*4,(row+1)*w*4);
 return nativeImage.createFromBitmap(bg,{width,height,scaleFactor:1}).toPNG();
}
module.exports=function({ipcMain,protocol,nativeImage,dialog,shell,safeStorage,root,api,send,getWindow,isImageBusy,currentImage}){
 const archive=path.join(root,'Data','video-history'),tokenFile=path.join(root,'Data','huggingface-ltx-token.enc');
 let source=null,clipSource=null,voiceReference=null,job=null,installing=false,controller=null,last=null,starting=false,cancelRequested=false;
 const progressClient=crypto.randomUUID();
 const busy=()=>!!job||starting||installing;
 function idle(){if(busy()||isImageBusy())throw Error('Wait for the current generation or download to finish.');}
 async function token(){try{return safeStorage.decryptString(await fs.readFile(tokenFile));}catch{return process.env.HF_TOKEN||'';}}
 async function digest(file){const h=crypto.createHash('sha256');for await(const b of sync.createReadStream(file))h.update(b);return h.digest('hex');}
 async function installed(m){return fs.stat(path.join(root,'ComfyUI','models',m.dir,m.file)).then(x=>x.size===m.size).catch(()=>false);}
 async function status(){
  const list=await Promise.all([...models,...adapters].map(async m=>({...m,ready:await installed(m)})));let connected=false,nodesReady=false,audioNodesReady=false,guidedNodesReady=false,speechNodesReady=false,gpu='RTX 4060 Ti · 16 GB';
  try{const [stats,nodes]=await Promise.all([api('/system_stats'),api('/object_info')]);connected=true;speechNodesReady=!!nodes.ComfyLabSpeech;gpu=stats.devices?.[0]?.name||gpu;nodesReady=Object.values(buildVideo('test.png',{prompt:'test',quality:'refined',audio:true}).graph).every(n=>nodes[n.class_type]);audioNodesReady=Object.values(buildAudio({prompt:'test'}).graph).every(n=>nodes[n.class_type]);}catch{}
  if(connected)try{const nodes=await api('/object_info');guidedNodesReady=['layout','refine'].every(task=>Object.values(buildGuided('comfy-lab-clip-test.mp4','test.png',{task,prompt:'test',fullDuration:task==='refine',sourceDuration:2}).graph).every(n=>nodes[n.class_type]));}catch{}
  const speechModels=require('./speech-models.json');const speechReady=(await Promise.all(speechModels.map(installed))).every(Boolean);return {connected,nodesReady,audioNodesReady,guidedNodesReady,speechNodesReady,speechReady,gpu,models:list,tokenSaved:!!await token(),busy:busy(),job:!!job,installing};
 }
 function preview(s){return {name:path.basename(s.file),width:s.width,height:s.height,url:nativeImage.createFromBuffer(s.bytes).toDataURL()};}
 function parse(bytes,file){const im=nativeImage.createFromBuffer(bytes);if(im.isEmpty())throw Error('Cannot read this image.');const size=im.getSize();if(size.width*size.height>24e6)throw Error('Use an image up to 24 megapixels.');return {file,bytes:im.toPNG(),...size};}
 function fitted(s,width,height){
  return fitImage(nativeImage,s,width,height);
 }
 async function entry(id){if(!validID(id))throw Error('Invalid video identifier.');return JSON.parse(await fs.readFile(path.join(archive,id,'entry.json'),'utf8'));}
 function publicEntry(e){return {...e,beforeUrl:e.clipInput?'comfylab-media://video/'+e.id+'/original.mp4':null,url:'comfylab-media://video/'+e.id+(e.kind==='audio'?'/clip.wav':'/clip.mp4'),poster:e.kind==='audio'?null:'comfylab-media://video/'+e.id+'/source.png'};}
 async function history(){await fs.mkdir(archive,{recursive:true});const list=[];for(const d of await fs.readdir(archive)){if(validID(d))try{list.push(publicEntry(await entry(d)));}catch{}}return list.sort((a,b)=>b.created.localeCompare(a.created));}
 async function watch(id,context){
  const progress=watchProgress(progressClient,id,context.graph,send,context.settings);
  try{while(job===id){
   await new Promise(r=>setTimeout(r,1800));
   let h;try{h=(await api('/history/'+id))[id];}catch{send({type:'working',message:'Waiting for ComfyUI to respond…'});continue;}
   if(!h){if(cancelRequested){const q=await api('/queue');if(![...q.queue_running,...q.queue_pending].some(x=>x[1]===id))throw Error('Video generation cancelled.');}continue;}
   if(h.status?.status_str==='error'||h.status?.status_str==='interrupted'){
    const details=h.status.messages?.find(x=>x[0]==='execution_error')?.[1];
    throw Error((details?.exception_message||'Video generation stopped.').slice(0,1200));
   }
   const output=h.outputs?.[context.output];
   const file=(output?.audio||output?.images||output?.videos||output?.gifs)?.[0];
   if(!file){if(h.status?.completed)throw Error('The workflow finished without a media file. Check ComfyUI output.');continue;}
   progress.finish();const recordID=crypto.randomUUID(),folder=path.join(archive,recordID);await fs.mkdir(folder,{recursive:true});
   const r=await fetch(origin+'/view?'+new URLSearchParams({filename:file.filename,subfolder:file.subfolder||'',type:file.type||'output'}),{signal:AbortSignal.timeout(120000)});
   if(!r.ok)throw Error('Cannot retrieve the completed video (HTTP '+r.status+').');
   const isAudio=context.kind==='audio';
   await pipeline(Readable.fromWeb(r.body),sync.createWriteStream(path.join(folder,isAudio?'clip.wav':'clip.mp4')));
   if(!isAudio)await fs.writeFile(path.join(folder,'source.png'),context.source.bytes);
   if(isAudio&&context.settings.engine==='qwen')context.settings.duration=require('./speech-workflow').wavDuration(await fs.readFile(path.join(folder,'clip.wav')))||context.settings.duration;const e={id:recordID,kind:isAudio?'audio':'video',created:new Date().toISOString(),name:isAudio?context.settings.prompt.slice(0,90):path.basename(context.source.file),settings:context.settings,graph:context.graph,models:(context.models||(isAudio?audioModels:models.filter(m=>!m.optional||context.settings.quality==='refined'))).map(m=>({file:m.file,sha:m.sha,rev:m.rev}))};
   if(context.clipInput){e.clipInput=context.clipInput;e.clipInfo=context.clipInfo;e.models=context.models.map(m=>({file:m.file,sha:m.sha,rev:m.rev}));}
   await fs.writeFile(path.join(folder,'entry.json'),JSON.stringify(e,null,2));last=recordID;
   send({type:'done',entry:publicEntry(e),message:isAudio?'Audio saved locally as PCM WAV.':'Video saved locally. Review movement and geometry.'});return;
  }}catch(e){send({type:'error',message:e.message});}finally{progress.close();if(job===id)job=null;cancelRequested=false;send({type:'idle'});}
 }
 ipcMain.handle('video-status',status);
 ipcMain.handle('speech-reference',async(_,file)=>{idle();if(file===undefined){const r=await dialog.showOpenDialog(getWindow(),{title:'Voice reference · 3 to 30 seconds of clear speech',properties:['openFile'],filters:[{name:'Audio',extensions:['wav','mp3','flac','m4a','ogg']}]});if(r.canceled)return null;file=r.filePaths[0];}if(typeof file!=='string'||!path.isAbsolute(file))throw Error('Choose a reference audio file.');const stat=await fs.stat(file);if(!stat.isFile()||stat.size>30e6)throw Error('Use a voice clip below 30 MB.');const name='comfy-lab-voice-'+crypto.randomUUID()+'.wav',out=path.join(root,'ComfyUI/input',name);const {stdout}=await require('node:util').promisify(require('node:child_process').execFile)(path.join(root,'.venv/Scripts/python.exe'),[path.join(__dirname,'bin/voice-reference.py'),file,out],{windowsHide:true,timeout:30000,maxBuffer:1e6});voiceReference=name;return {name:path.basename(file),...JSON.parse(stdout)};});

 function clipPreview(c){return {id:c.id,name:c.name,...c.info,url:'comfylab-media://input/'+c.id+'/clip',poster:'data:image/png;base64,'+c.info.poster};}
 ipcMain.handle('video-choose-clip',async(_,file)=>{idle();starting=true;try{if(file===undefined){const r=await dialog.showOpenDialog(getWindow(),{title:'Open source video / Blender playblast',properties:['openFile'],filters:[{name:'Videos',extensions:['mp4','mov','mkv','webm']}]});if(r.canceled)return null;file=r.filePaths[0];}if(typeof file!=='string'||!path.isAbsolute(file)||!['.mp4','.mov','.mkv','.webm'].includes(path.extname(file).toLowerCase()))throw Error('Choose an MP4, MOV, MKV or WebM video.');const stat=await fs.stat(file);if(!stat.isFile())throw Error('Choose a video file.');if(stat.size>2e9)throw Error('Use a source video below 2 GB. Short clips are recommended.');const {stdout}=await require('node:util').promisify(require('node:child_process').execFile)(path.join(root,'.venv','Scripts','python.exe'),[path.join(__dirname,'bin','clip-probe.py'),file],{windowsHide:true,timeout:30000,maxBuffer:2e6});const info=JSON.parse(stdout);if(!info.duration||info.duration<0.4)throw Error('Use a video at least 0.4 seconds long.');clipSource={id:crypto.randomUUID(),file,name:path.basename(file),info};return clipPreview(clipSource);}finally{starting=false;}});
 ipcMain.handle('video-choose',async(_,file)=>{idle();if(file===undefined){const r=await dialog.showOpenDialog(getWindow(),{title:'Image to video · open render',properties:['openFile'],filters:[{name:'Images',extensions:['png','jpg','jpeg','webp']}]});if(r.canceled)return null;file=r.filePaths[0];}const selected=await readImage(file,nativeImage);source=parse(selected.bytes,file);return preview(source);});
 ipcMain.handle('video-current',()=>{idle();const s=currentImage();if(!s)throw Error('Load or enhance an image in Image tools first.');source=parse(s.bytes,s.file);return preview(source);});
 ipcMain.handle('video-token',async(_,value)=>{idle();const t=String(value||'').trim();if(!/^hf_[A-Za-z0-9]{10,250}$/.test(t))throw Error('Paste a Hugging Face read token.');if(!safeStorage.isEncryptionAvailable())throw Error('Windows encryption is unavailable. The token was not saved.');await fs.writeFile(tokenFile,safeStorage.encryptString(t));return true;});
 ipcMain.handle('video-disconnect',async()=>{idle();await fs.rm(tokenFile,{force:true});return true;});
 ipcMain.handle('video-model-page',(_,kind)=>shell.openExternal('https://huggingface.co/'+(adapters.find(m=>m.mode===kind)?.repo||'Lightricks/LTX-2.5')));
 ipcMain.handle('video-token-page',()=>shell.openExternal('https://huggingface.co/settings/tokens'));
 ipcMain.handle('video-install',async(_,quality)=>{
  if(quality==='speech'){
   idle();installing=true;controller=new AbortController();send({type:'download',message:'Checking local speech and voice models…',percent:0});
   (async()=>{try{await require('./model-set-download')({root,models:require('./speech-models.json'),signal:controller.signal,send:event=>{if(event.state!=='ready')send({type:'download',message:(event.state==='verifying'?'Verifying ':'Downloading ')+(event.file||'speech models'),percent:event.percent,etaSeconds:event.etaSeconds});}});send({type:'installed',message:'Speech and voice models installed and SHA-256 verified.'});}catch(e){send({type:'error',message:controller.signal.aborted?'Download cancelled. Completed speech models are preserved.':e.message});}finally{installing=false;controller=null;send({type:'idle'});}})();return true;
  }
  idle();starting=true;let t,list,missing;
  try{t=await token();if(!t)throw Error('Connect Hugging Face after accepting access on the official LTX 2.5 model page.');
  list=['layout','refine'].includes(quality)?guidedModels(quality):quality==='audio'?audioModels:models.filter(m=>!m.optional||quality==='refined');missing=[];
  for(const m of list)if(!await installed(m))missing.push(m);
  const free=await fs.statfs(root);if(Number(free.bavail)*Number(free.bsize)<missing.reduce((n,m)=>n+m.size,0)+30e9)throw Error('Free more space on F: before installing (models plus 30 GB working space).');
  installing=true;controller=new AbortController();send({type:'download',message:'Checking official model access…',percent:0});
  }finally{starting=false;}
  (async()=>{let tmp,completedBytes=0;const totalBytes=list.reduce((n,m)=>n+m.size,0);
   try{for(const m of list){
    const dest=path.join(root,'ComfyUI','models',m.dir,m.file);await fs.mkdir(path.dirname(dest),{recursive:true});
    if(await installed(m)){send({type:'download',message:'Verifying '+m.file});if(await digest(dest)===m.sha){completedBytes+=m.size;continue;}throw Error('Existing file failed verification: '+m.file);}
    const url='https://huggingface.co/'+m.repo+'/resolve/'+m.rev+'/'+m.remote;
    const r=await fetch(url,{headers:{Authorization:'Bearer '+t},signal:controller.signal});
    if(!r.ok)throw Error([401,403].includes(r.status)?'Hugging Face access is required for '+m.repo+'. Open its official model page and accept access with the account linked to your read token.':'Official download failed (HTTP '+r.status+').');
    tmp=dest+'.comfylab-video.part';let bytes=0,time=0;const hash=crypto.createHash('sha256');
    send({type:'download',message:'Downloading '+m.file,percent:0});
    const meter=new Transform({transform(chunk,enc,cb){bytes+=chunk.length;hash.update(chunk);if(Date.now()-time>700){time=Date.now();send({type:'download',message:m.file+' · '+(bytes/1e9).toFixed(2)+' / '+(m.size/1e9).toFixed(2)+' GB',percent:(completedBytes+bytes)/totalBytes*100});}cb(null,chunk);}});
    await pipeline(Readable.fromWeb(r.body),meter,sync.createWriteStream(tmp),{signal:controller.signal});
    if(bytes!==m.size||hash.digest('hex')!==m.sha)throw Error('Model verification failed: '+m.file);
    await fs.rename(tmp,dest);completedBytes+=m.size;tmp=null;
   }send({type:'installed',message:'Models installed and SHA-256 verified. Restart ComfyUI to refresh its model list.'});
   }catch(e){send({type:'error',message:controller.signal.aborted?'Download cancelled. Completed models are preserved.':e.message});}
   finally{if(tmp)await fs.rm(tmp,{force:true}).catch(()=>{});installing=false;controller=null;send({type:'idle'});}
  })();return true;
 });
 ipcMain.handle('video-generate',async(_,raw)=>{
  idle();
  if(['layout','refine'].includes(raw?.task)){
   if(!clipSource)throw Error('Open a source video first.');if(raw.task==='layout'&&!source)throw Error('Open a finished reference image first.');starting=true;
   try{const s=checkedGuided({...raw,sourceDuration:clipSource.info.duration}),st=await status(),required=guidedModels(s.task);if(!st.connected)throw Error('Start ComfyUI first.');if(!st.guidedNodesReady)throw Error('Restart ComfyUI to load the new video nodes.');if(required.some(m=>!st.models.find(x=>x.file===m.file)?.ready))throw Error('Install the models and LoRA for this tool first.');
    const q=await api('/queue');if(q.queue_running.length||q.queue_pending.length)throw Error('ComfyUI is busy. Wait for its queue to finish.');
    const input='comfy-lab-clip-'+crypto.randomUUID()+path.extname(clipSource.file).toLowerCase();await fs.copyFile(clipSource.file,path.join(root,'ComfyUI','input',input));
    const snapshot=s.task==='layout'?{...source}:{file:clipSource.name,bytes:Buffer.from(clipSource.info.poster,'base64')};let reference='';
    if(s.task==='layout'){const form=new FormData();form.append('image',new Blob([fitted(snapshot,s.width,s.height)]),'comfy-lab-reference-'+crypto.randomUUID()+'.png');const up=await api('/upload/image',{method:'POST',body:form});reference=up.subfolder?up.subfolder+'/'+up.name:up.name;}
    const workflow=buildGuided(input,reference,s),r=await api('/prompt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:workflow.graph,client_id:progressClient})});if(!r.prompt_id)throw Error('ComfyUI did not accept the workflow.');
    job=r.prompt_id;cancelRequested=false;send({type:'working',message:'Preparing '+(s.task==='layout'?'3D Blocking → Render':'Refine Video')+' · estimating progress…'});watch(job,{...workflow,source:snapshot,clipInput:input,clipInfo:clipSource.info});return job;
   }finally{starting=false;}
  }

  if(raw?.task==='audio'&&raw.engine==='qwen'){starting=true;try{const workflow=require('./speech-workflow').buildSpeech(raw,voiceReference),st=await status();if(!st.connected||!st.speechNodesReady)throw Error('Restart ComfyUI to load Speech and Voice Clone.');if(!st.speechReady)throw Error('Install the speech models first.');const q=await api('/queue');if(q.queue_running.length||q.queue_pending.length)throw Error('Wait for the ComfyUI queue to finish.');const r=await api('/prompt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:workflow.graph,client_id:progressClient})});if(!r.prompt_id)throw Error('ComfyUI did not accept the speech workflow.');job=r.prompt_id;cancelRequested=false;send({type:'working',message:'Generating local speech · duration follows the text…'});watch(job,workflow);return job;}finally{starting=false;}}
  if(raw?.task==='audio'){
   starting=true;
   try{const workflow=buildAudio(raw),st=await status();if(!st.connected)throw Error('Start ComfyUI first.');if(!st.audioNodesReady)throw Error('Restart ComfyUI to load the audio nodes.');if(st.models.some(m=>audioModels.some(a=>a.file===m.file)&&!m.ready))throw Error('Install the LTX 2.5 audio models first.');
    const q=await api('/queue');if(q.queue_running.length||q.queue_pending.length)throw Error('ComfyUI is busy. Wait for its queue to finish.');
    const r=await api('/prompt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:workflow.graph,client_id:progressClient})});
    if(!r.prompt_id)throw Error('ComfyUI did not accept the audio workflow.');job=r.prompt_id;cancelRequested=false;send({type:'working',kind:'audio',message:'Generating audio locally · first run may take several minutes.'});watch(job,workflow);return job;
   }finally{starting=false;}
  }
  if(!source)throw Error('Load an image first.');starting=true;
  try{const s=checkedVideo(raw),st=await status();if(!st.connected)throw Error('Start ComfyUI first.');if(!st.nodesReady)throw Error('Required LTX 2.5 nodes are unavailable.');if(st.models.some(m=>m.dir!=='loras'&&(!m.optional||s.quality==='refined')&&!m.ready))throw Error('Install the LTX 2.5 models first.');
   const q=await api('/queue');if(q.queue_running.length||q.queue_pending.length)throw Error('ComfyUI is busy. Wait for its queue to finish.');
   const snapshot={...source},form=new FormData();form.append('image',new Blob([fitted(snapshot,s.width,s.height)]),'comfy-lab-video-'+crypto.randomUUID()+'.png');
   const up=await api('/upload/image',{method:'POST',body:form}),workflow=buildVideo(up.subfolder?up.subfolder+'/'+up.name:up.name,s);
   const r=await api('/prompt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:workflow.graph,client_id:progressClient})});
   if(!r.prompt_id)throw Error('ComfyUI did not accept the video workflow.');job=r.prompt_id;cancelRequested=false;send({type:'working',message:'Generating locally · first run may take several minutes. Memory warnings are estimates; this GPU has not been benchmarked.'});watch(job,{...workflow,source:snapshot});return job;
  }finally{starting=false;}
 });
 ipcMain.handle('video-cancel',async()=>{if(installing){controller?.abort();return true;}if(!job)return false;cancelRequested=true;const q=await api('/queue');if(q.queue_pending.some(x=>x[1]===job))await api('/queue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({delete:[job]})});if(q.queue_running.some(x=>x[1]===job))await api('/interrupt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt_id:job})});return true;});
 ipcMain.handle('video-history',history);
 ipcMain.handle('video-delete',async(_,id)=>{idle();const e=await entry(id);if(dialog.showMessageBoxSync(getWindow(),{type:'question',buttons:['Cancel','Delete'],defaultId:0,cancelId:0,message:'Delete this '+(e.kind==='audio'?'audio':'video')+' from history? Exported files and Canvas copies will be kept.'})!==1)return false;const target=path.join(archive,id),trash=path.join(root,'Data','deleted-media-history');await fs.mkdir(trash,{recursive:true});await fs.rename(target,path.join(trash,id+'-'+crypto.randomUUID()));if(last===id)last=null;return true;});

 ipcMain.handle('video-reuse',async(_,id)=>{idle();const e=await entry(id);if(e.kind==='audio')return {settings:e.settings};source=parse(await fs.readFile(path.join(archive,id,'source.png')),e.name);if(e.clipInput){if(!/^comfy-lab-clip-[0-9a-f-]+\.(mp4|mov|mkv|webm)$/.test(e.clipInput))throw Error('Invalid archived clip.');clipSource={id:crypto.randomUUID(),file:path.join(root,'ComfyUI','input',e.clipInput),name:e.name,info:e.clipInfo};await fs.access(clipSource.file);}return {source:preview(source),settings:e.settings,clip:e.clipInput?clipPreview(clipSource):null};});
 ipcMain.handle('video-save',async(_,id)=>{const e=await entry(id||last),audio=e.kind==='audio',ext=audio?'wav':'mp4';const dir=path.join(root,'Results',audio?'Audio':'Video');await fs.mkdir(dir,{recursive:true});const r=await dialog.showSaveDialog(getWindow(),{defaultPath:path.join(dir,'Comfy Lab - '+e.settings.duration+'s.'+ext),filters:[{name:audio?'WAV audio':'MP4 video',extensions:[ext]}]});if(r.canceled)return null;await fs.copyFile(path.join(archive,e.id,'clip.'+ext),r.filePath);return r.filePath;});
 ipcMain.handle('video-export',async(_,id)=>{const e=await entry(id||last);const r=await dialog.showSaveDialog(getWindow(),{defaultPath:path.join(root,'Results','ltx25-workflow.json'),filters:[{name:'ComfyUI API workflow',extensions:['json']}]});if(r.canceled)return null;await fs.writeFile(r.filePath,JSON.stringify(e.graph,null,2));return r.filePath;});
 function mount(){protocol.handle('comfylab-media',async req=>{
  try{const u=new URL(req.url),parts=u.pathname.split('/').filter(Boolean);
   if(u.hostname==='input'&&parts.length===2&&parts[0]===clipSource?.id&&parts[1]==='clip'&&['GET','HEAD'].includes(req.method)){const stat=await fs.stat(clipSource.file),r=mediaRange(req.headers.get('range'),stat.size);if(!r)return new Response(null,{status:416});const headers={'Content-Type':path.extname(clipSource.file)==='.webm'?'video/webm':'video/mp4','Accept-Ranges':'bytes','Content-Length':String(r.end-r.start+1)};if(r.status===206)headers['Content-Range']='bytes '+r.start+'-'+r.end+'/'+stat.size;return new Response(req.method==='HEAD'?null:Readable.toWeb(sync.createReadStream(clipSource.file,{start:r.start,end:r.end})),{status:r.status,headers});}
   if(u.hostname!=='video'||parts.length!==2||!validID(parts[0])||!['clip.mp4','clip.wav','source.png','original.mp4'].includes(parts[1])||!['GET','HEAD'].includes(req.method))return new Response(null,{status:404});
   let file=path.join(archive,...parts);if(parts[1]==='original.mp4'){const e=await entry(parts[0]);if(!/^comfy-lab-clip-[0-9a-f-]+\.(mp4|mov|mkv|webm)$/.test(e.clipInput||''))return new Response(null,{status:404});file=path.join(root,'ComfyUI','input',e.clipInput);}
   const stat=await fs.stat(file),r=mediaRange(req.headers.get('range'),stat.size);
   if(!r)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+stat.size}});
   const headers={'Content-Type':parts[1]==='original.mp4'?(path.extname(file)==='.webm'?'video/webm':path.extname(file)==='.mkv'?'video/x-matroska':'video/mp4'):parts[1]==='clip.mp4'?'video/mp4':parts[1]==='clip.wav'?'audio/wav':'image/png','Accept-Ranges':'bytes','Content-Length':String(r.end-r.start+1)};
   if(r.status===206)headers['Content-Range']='bytes '+r.start+'-'+r.end+'/'+stat.size;
   return new Response(req.method==='HEAD'?null:Readable.toWeb(sync.createReadStream(file,{start:r.start,end:r.end})),{status:r.status,headers});
  }catch{return new Response(null,{status:404});}
 });}
 return {busy,mount,status,currentClip:()=>clipSource};
};
module.exports.mediaRange=mediaRange;
module.exports.fitImage=fitImage;
