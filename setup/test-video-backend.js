'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),{createRequire}=require('node:module');
const app=path.resolve(__dirname,'../App/resources/app'),base=path.join(__dirname,'../Data/tests/video-backend-test');
async function main(){
 await fs.mkdir(base,{recursive:true});const root=await fs.mkdtemp(path.join(base,'run-'));await fs.mkdir(path.join(root,'Data'));
 const realModels=require(path.join(app,'video-models.json')),payload=Buffer.from('verified-model-fixture');
 const models=realModels.map(m=>({...m,size:payload.length,sha:crypto.createHash('sha256').update(payload).digest('hex')}));
 const adapterModels=require(path.join(app,'adapter-models.json')).map(m=>({...m,size:payload.length,sha:crypto.createHash('sha256').update(payload).digest('hex')}));
 const guided=require(path.join(app,'guided-workflow'));
 await fs.mkdir(path.join(root,'ComfyUI','input'),{recursive:true});const clipFile=path.join(root,'fixture.mp4');await fs.writeFile(clipFile,'fixture-clip');
 const handlers={},events=[],protocols={};let deleteAnswer=0;let fetchMode='ok',imageBusy=false,historyOutput=null,graphPosted;
 const fakeImage={isEmpty:()=>false,getSize:()=>({width:32,height:32}),toPNG:()=>Buffer.from('source'),toDataURL:()=> 'data:image/png;base64,c291cmNl',resize:()=>({toBitmap:()=>Buffer.alloc(320*320*4,255)})};
 const realRequire=createRequire(path.join(app,'video-main.js')),module={exports:{}};
 const context={module,exports:module.exports,__dirname:app,require:name=>name==='./video-models.json'?models:name==='./adapter-models.json'?adapterModels:name==='./guided-workflow'?{...guided,guidedModels:kind=>[...models.filter(m=>!m.optional||kind==='layout'),adapterModels.find(m=>m.mode===kind)]}:name==='node:util'?{promisify:()=>async()=>({stdout:JSON.stringify({width:256,height:160,fps:24,duration:1,poster:Buffer.from('source').toString('base64')})})}:realRequire(name),Buffer,URL,URLSearchParams,FormData,Blob,Response,AbortSignal,AbortController,process:{env:{}},console,setTimeout,clearTimeout,fetch:async(url,options)=>{
  if(url.startsWith('https://huggingface.co/')){assert.equal(options.headers.Authorization,'Bearer hf_fixturetoken1234');if(fetchMode==='denied')return new Response('',{status:401});return new Response(payload);}
  assert(url.startsWith('http://127.0.0.1:8188/view?'));return new Response(Buffer.from('test-mp4-file'));
 }};
 vm.runInNewContext(await fs.readFile(path.join(app,'video-main.js'),'utf8'),context,{filename:'video-main.js'});
 const workflow=require(path.join(app,'video-workflow'));
 const audioWorkflow=require(path.join(app,'audio-workflow'));
 const nodes=Object.fromEntries([...Object.values(workflow.buildVideo('test.png',{prompt:'test',quality:'refined',audio:true}).graph),...Object.values(audioWorkflow.buildAudio({prompt:'test'}).graph),...['layout','refine'].flatMap(task=>Object.values(guided.buildGuided('test.mp4','test.png',{task,prompt:'test',fullDuration:task==='refine',sourceDuration:2}).graph))].map(n=>[n.class_type,{}]));
 const feature=module.exports({root,ipcMain:{handle:(name,fn)=>handlers[name]=fn},protocol:{handle:(name,fn)=>protocols[name]=fn},getWindow:()=>null,isImageBusy:()=>imageBusy,currentImage:()=>({file:'test.png',bytes:Buffer.from('source')}),nativeImage:{createFromBuffer:()=>fakeImage,createFromBitmap:()=>fakeImage},dialog:{showMessageBoxSync:()=>deleteAnswer,showSaveDialog:async()=>({canceled:true}),showOpenDialog:async()=>({canceled:false,filePaths:[clipFile]})},shell:{openExternal:async()=>{}},safeStorage:{isEncryptionAvailable:()=>true,encryptString:t=>Buffer.from('encrypted:'+t),decryptString:b=>b.toString().slice(10)},send:e=>events.push(e),api:async(route,options)=>{
  if(route==='/system_stats')return {devices:[{name:'Fixture GPU'}]};if(route==='/object_info')return nodes;
  if(route==='/queue')return {queue_running:[],queue_pending:[]};
  if(route==='/upload/image')return {name:'test.png'};
  if(route==='/prompt'){graphPosted=JSON.parse(options.body).prompt;const output=Object.keys(graphPosted).at(-1),audio=graphPosted[output].class_type==='ComfyLabSaveAudioWAV';historyOutput={status:{completed:true},outputs:{[output]:{[audio?'audio':'images']:[{filename:audio?'test.wav':'test.mp4',subfolder:'',type:'output'}]}}};return {prompt_id:'fixture-job'};}
  if(route==='/history/fixture-job')return {'fixture-job':historyOutput};throw Error('Unexpected route '+route);
 }});
 const invoke=async(name,arg)=>handlers['video-'+name](null,arg);
 assert.equal((await invoke('status')).models.some(m=>m.ready),false);
 await assert.rejects(()=>invoke('install','draft'),/Connect Hugging Face/);
 imageBusy=true;await assert.rejects(()=>invoke('current'),/Wait/);imageBusy=false;
 await invoke('token','hf_fixturetoken1234');assert.equal((await invoke('status')).tokenSaved,true);
 const waitIdle=async()=>{for(let i=0;i<100&&feature.busy();i++)await new Promise(r=>setTimeout(r,30));assert(!feature.busy(),'Operation did not settle');};
 fetchMode='denied';await invoke('install','draft');await waitIdle();assert(events.some(e=>e.type==='error'&&e.message.includes('access is required')));
 fetchMode='ok';await invoke('install','refined');await waitIdle();assert((await invoke('status')).models.filter(m=>m.dir!=='loras').every(m=>m.ready));assert(events.some(e=>e.type==='installed'));
 await invoke('current');await invoke('generate',{prompt:'A slow camera move.',duration:2,quality:'refined'});await waitIdle();
 const entries=await invoke('history');assert.equal(entries.length,1);assert.equal(entries[0].settings.quality,'refined');assert(events.some(e=>e.type==='done'));
 const saved=await fs.readFile(path.join(root,'Data/video-history',entries[0].id,'clip.mp4'));assert.equal(saved.toString(),'test-mp4-file');
 const reused=await invoke('reuse',entries[0].id);assert.equal(reused.source.width,32);
 feature.mount();const handle=protocols['comfylab-media'];
 const r=await handle(new Request(entries[0].url,{headers:{Range:'bytes=0-3'}}));assert.equal(r.status,206);assert.equal(await r.text(),'test');
 const denied=await handle(new Request('comfylab-media://video/invalid/clip.mp4'));assert.equal(denied.status,404);
 const range=await handle(new Request(entries[0].url,{headers:{Range:'bytes=999-'}}));assert.equal(range.status,416);
 await assert.rejects(()=>invoke('reuse','../escape'),/Invalid video/);
 await invoke('generate',{task:'audio',prompt:'Wind in a forest.',duration:4,seed:42});await waitIdle();
 const audioEntries=(await invoke('history')).filter(e=>e.kind==='audio');assert.equal(audioEntries.length,1);assert(audioEntries[0].url.endsWith('clip.wav'));
 assert.equal((await invoke('reuse',audioEntries[0].id)).source,undefined);
 const wav=await handle(new Request(audioEntries[0].url));assert.equal(wav.headers.get('Content-Type'),'audio/wav');assert.equal(await wav.text(),'test-mp4-file');
 const chosen=await invoke('choose-clip');assert.equal(chosen.width,256);
 for(const task of ['layout','refine']){await invoke('install',task);await waitIdle();await invoke('generate',{task,prompt:'Sharp details.',duration:2,fullDuration:task==='refine',sourceDuration:999});await waitIdle();const e=(await invoke('history')).find(e=>e.settings.task===task);assert(e&&e.clipInput);if(task==='refine'){assert.equal(e.settings.duration,1,'Source probe overrides renderer duration');assert.equal(e.settings.fullDuration,true);assert.equal(Object.values(graphPosted).find(n=>n.class_type==='ComfyLabLoadClip').inputs.duration,0);assert(Object.values(graphPosted).some(n=>n.class_type==='ComfyLabTrimClip'));assert(e.beforeUrl.endsWith('/original.mp4'));const original=await handle(new Request(e.beforeUrl,{headers:{range:'bytes=0-6'}}));assert.equal(original.status,206);assert.equal(await original.text(),'fixture');}assert(e.models.some(m=>m.file===adapterModels.find(m=>m.mode===task).file));const reused=await invoke('reuse',e.id);assert.equal(reused.clip.width,256);}

 await assert.rejects(()=>invoke('delete','../escape'),/Invalid video/);const toDelete=audioEntries[0].id;assert.equal(await invoke('delete',toDelete),false);assert((await invoke('history')).some(e=>e.id===toDelete));imageBusy=true;await assert.rejects(()=>invoke('delete',toDelete),/Wait/);imageBusy=false;deleteAnswer=1;assert.equal(await invoke('delete',toDelete),true);assert(!(await invoke('history')).some(e=>e.id===toDelete));assert.equal((await fs.readdir(path.join(root,'Data/deleted-media-history'))).length,1);assert((await invoke('history')).some(e=>e.kind!=='audio'),'Deleting one item preserves the other media');console.log('Individual media deletion: cancel, busy guard, invalid path, isolated removal and recoverable archive passed.');
 await invoke('disconnect');assert.equal((await invoke('status')).tokenSaved,false);
 console.log('Video backend passed: access denial, encrypted-token flow, verified streaming install, job/archive/reuse, MP4 seeking and path restrictions. Fixture weights and media only.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
