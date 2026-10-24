'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
(async()=>{
 const app=path.resolve(__dirname,'../App/resources/app'),realRequire=createRequire(path.join(app,'video-main.js')),module={exports:{}},handlers={},events=[];
 const parent=path.resolve(__dirname,'../Data/tests');await fs.mkdir(parent,{recursive:true});const root=await fs.mkdtemp(path.join(parent,'speech-install-'));
 let imageBusy=false,download,finish,networkCalls=0;
 const downloader=raw=>{download=raw;assert.equal(raw.root,root);assert(raw.models.every(m=>m.repo.startsWith('Qwen/')));raw.send({state:'downloading',file:'fixture',percent:25});return new Promise((resolve,reject)=>{finish=resolve;raw.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});});};
 const context={module,exports:module.exports,__dirname:app,require:name=>name==='./model-set-download'?downloader:realRequire(name),Buffer,URL,URLSearchParams,FormData,Blob,Response,AbortSignal,AbortController,process:{env:{}},console,setTimeout,clearTimeout,fetch:async()=>{networkCalls++;throw Error('Unexpected network call');}};
 vm.runInNewContext(await fs.readFile(path.join(app,'video-main.js'),'utf8'),context,{filename:'video-main.js'});
 const feature=module.exports({root,ipcMain:{handle:(name,fn)=>handlers[name]=fn},getWindow:()=>null,isImageBusy:()=>imageBusy,send:e=>events.push(e)}),invoke=(name,arg)=>handlers['video-'+name](null,arg);
 imageBusy=true;await assert.rejects(()=>invoke('install','speech'),/Wait/);imageBusy=false;
 await invoke('install','speech');assert(feature.busy());assert(download);assert(events.some(e=>e.type==='download'&&e.percent===25));
 await assert.rejects(()=>invoke('install','speech'),/Wait/);await invoke('cancel');await new Promise(r=>setImmediate(r));assert(!feature.busy());assert(events.some(e=>e.type==='error'&&e.message.includes('Completed speech models')));
 events.length=0;await invoke('install','speech');finish();await new Promise(r=>setImmediate(r));assert(!feature.busy());assert(events.some(e=>e.type==='installed'&&e.message.includes('SHA-256')));assert.equal(networkCalls,0);
 console.log('Speech installer passed: no LTX token required, manifest download, progress, busy guard, cancellation and completion. No weights downloaded.');
})().catch(e=>{console.error(e);process.exitCode=1;});
