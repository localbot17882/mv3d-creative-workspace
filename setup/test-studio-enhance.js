'use strict';
const assert=require('node:assert/strict');
const handlers={},bytes=Buffer.from('generated-result-fixture');let busy=false,selected;
const image={getSize:()=>({width:1024,height:576}),toDataURL:()=> 'data:image/png;base64,'+bytes.toString('base64')};
const feature=require('../App/resources/app/image-studio-main')({root:require('node:path').resolve('.'),ipcMain:{handle:(n,f)=>handlers[n]=f},nativeImage:{createFromBuffer:b=>{assert.deepEqual(b,bytes);return image;}},dialog:{},shell:{},getWindow:()=>null,history:{get:async()=>({settings:{task:'studio',mode:'create'},result:image.toDataURL(),graph:{}})},isBusy:()=>busy,useForEnhance:s=>{selected=s;return {name:s.file,width:s.width,height:s.height,url:image.toDataURL()};},send:()=>{}});
(async()=>{
 assert.throws(()=>handlers['studio-to-enhance'](),/Generate an image first/);
 feature.onEvent({type:'done',url:image.toDataURL()});
 // Restore a saved result to exercise the same transfer used for History results.
 await handlers['studio-use-history'](null,'saved-studio-result');
 const transferred=handlers['studio-to-enhance']();
 assert.deepEqual(selected.bytes,bytes);assert.equal(transferred.width,1024);assert.equal(transferred.height,576);assert.equal(transferred.url,image.toDataURL());
 busy=true;assert.throws(()=>handlers['studio-to-enhance'](),/Wait for/);
 console.log('Image Studio to Enhance: saved result bytes and original dimensions transferred; missing result and busy operations guarded. No generation submitted.');
})().catch(e=>{console.error(e);process.exitCode=1;});
