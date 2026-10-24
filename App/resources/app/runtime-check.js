'use strict';
const {app,nativeImage,safeStorage}=require('electron'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=require('./app-root');app.setName('Comfy Lab');app.setPath('userData',path.join(root,'Data'));
app.whenReady().then(async()=>{
 const report={};
 try{const factory=require('./video-main'),handlers={},protocols={};
  const bytes=await fs.readFile(path.join(root,'ComfyUI/input/comfy-lab-layout-reference.png')),picture=nativeImage.createFromBuffer(bytes),size=picture.getSize();
  const fitted=factory.fitImage(nativeImage,{bytes,...size},320,512),im=nativeImage.createFromBuffer(fitted),pixels=im.toBitmap();
  assert.deepEqual(im.getSize(),{width:320,height:512});assert.equal(pixels[3],255);assert.equal(pixels[0],0);assert.equal(pixels[1],0);assert.equal(pixels[2],0);
  report.nativeImageFitting=true;report.websocketAvailable=typeof WebSocket==='function';assert(report.websocketAvailable);
  const feature=factory({root,nativeImage,safeStorage,ipcMain:{handle:(name,fn)=>handlers[name]=fn},protocol:{handle:(name,fn)=>protocols[name]=fn},dialog:{showOpenDialog:async(_win,options)=>({canceled:false,filePaths:[path.join(root,'ComfyUI/input',options.filters[0].extensions.includes('mp4')?'comfy-lab-clip-fixture.mp4':'comfy-lab-layout-reference.png')]})},shell:{},getWindow:()=>null,isImageBusy:()=>false,currentImage:()=>({file:'reference.png',bytes,...size}),send:()=>{},api:async(route,options)=>{const r=await fetch('http://127.0.0.1:8188'+route,options);if(!r.ok)throw Error('ComfyUI HTTP '+r.status);return r.json();}});
  const invoke=(name,arg)=>handlers['video-'+name](null,arg),status=await invoke('status');assert(status.connected&&status.nodesReady&&status.audioNodesReady&&status.guidedNodesReady);assert(status.models.every(m=>m.ready));assert(status.tokenSaved);
  report.allSevenModelsReady=true;report.allVideoNodesReady=true;report.encryptedConnectionReadable=true;
  const source=await invoke('choose');assert.equal(source.width,512);const dropped=await invoke('choose',path.join(root,'ComfyUI/input/comfy-lab-layout-reference.png'));assert.equal(dropped.width,512);await assert.rejects(()=>invoke('choose','relative.png'));report.droppedImagePath=true;const clip=await invoke('choose-clip');assert.equal(clip.width,256);assert.equal(clip.fps,24);report.realClipProbe=true;
  const droppedClip=await invoke('choose-clip',path.join(root,'ComfyUI/input/comfy-lab-clip-fixture.mp4'));assert.equal(droppedClip.fps,24);report.droppedVideoPath=true;feature.mount();const response=await protocols['comfylab-media'](new Request(droppedClip.url,{headers:{Range:'bytes=0-31'}}));assert.equal(response.status,206);assert.equal((await response.arrayBuffer()).byteLength,32);report.sourceVideoSeeking=true;
  await fs.writeFile(path.join(root,'setup/electron-runtime-check.json'),JSON.stringify({...report,passed:true},null,2));
 }catch(e){await fs.writeFile(path.join(root,'setup/electron-runtime-check.json'),JSON.stringify({...report,passed:false,error:e.stack},null,2));}
 app.quit();
});
