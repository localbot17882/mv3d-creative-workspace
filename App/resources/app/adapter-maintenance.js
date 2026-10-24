'use strict';
const {app,safeStorage}=require('electron'),fs=require('node:fs/promises'),sync=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pipeline}=require('node:stream/promises'),{Readable,Transform}=require('node:stream');
const root=require('./app-root'),log=path.join(root,'Data','adapter-download-status.json');
app.setName('Comfy Lab');app.setPath('userData',path.join(root,'Data'));
const report=async value=>{await fs.writeFile(log,JSON.stringify({...value,updated:new Date().toISOString()},null,2));};
app.whenReady().then(async()=>{
 const results=[];let token;
 try{token=safeStorage.decryptString(await fs.readFile(path.join(root,'Data','huggingface-ltx-token.enc')));
  const adapters=require('./adapter-models.json'),extra=require('./video-models.json').filter(m=>m.dir==='latent_upscale_models');
  for(const m of [...adapters,...extra]){let partial;
   try{const dest=path.join(root,'ComfyUI','models',m.dir,m.file);await fs.mkdir(path.dirname(dest),{recursive:true});
    if(await fs.stat(dest).then(x=>x.size===m.size).catch(()=>false)){const hash=crypto.createHash('sha256');for await(const b of sync.createReadStream(dest))hash.update(b);if(hash.digest('hex')===m.sha){results.push({file:m.file,ready:true});continue;}throw Error('Existing model failed verification.');}
    if(await fs.stat(dest+'.comfylab-video.part').then(()=>true).catch(()=>false))throw Error('The app is already downloading this file.');
    await report({state:'connecting',file:m.file,results});
    const r=await fetch('https://huggingface.co/'+m.repo+'/resolve/'+m.rev+'/'+m.remote,{headers:{Authorization:'Bearer '+token}});
    if(!r.ok){results.push({file:m.file,ready:false,http:r.status,accessRequired:[401,403].includes(r.status)});continue;}
    partial=dest+'.adapter.part';let bytes=0,last=0;const hash=crypto.createHash('sha256');
    const meter=new Transform({transform(chunk,enc,cb){bytes+=chunk.length;hash.update(chunk);if(Date.now()-last>1000){last=Date.now();report({state:'downloading',file:m.file,bytes,total:m.size,percent:100*bytes/m.size,results}).catch(()=>{});}cb(null,chunk);}});
    await pipeline(Readable.fromWeb(r.body),meter,sync.createWriteStream(partial));if(bytes!==m.size||hash.digest('hex')!==m.sha)throw Error('Model verification failed.');await fs.rename(partial,dest);partial=null;results.push({file:m.file,ready:true});
    if(m.mode==='layout'){const workflow=await fetch('https://huggingface.co/'+m.repo+'/resolve/'+m.rev+'/LTX-2.5_ICLoRA_Layout_To_Render_Two_Stage_Distilled.json',{headers:{Authorization:'Bearer '+token}});if(workflow.ok)await fs.writeFile(path.join(root,'setup','layout-official-workflow.json'),Buffer.from(await workflow.arrayBuffer()));}
   }catch(e){results.push({file:m.file,ready:false,error:e.message});}finally{if(partial)await fs.rm(partial,{force:true}).catch(()=>{});}
  }
  await report({state:'finished',results});
 }catch(e){await report({state:'error',message:'Cannot use the saved Hugging Face connection. Connect inside Comfy Lab.',errorType:e.name});}
 app.quit();
});
