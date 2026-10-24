'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),g=require('./canvas-graph');
module.exports=async({root,BrowserWindow,desktopCapturer,shell,invoke})=>{
 const folder=path.join(root,'Results/Contest-Demo');await fs.mkdir(folder,{recursive:true});const report={started:new Date().toISOString(),generationSubmitted:false,usesExistingGeneratedImage:true,segments:[]};let win;
 try{
  const p=await invoke('canvas-new','Comfy Lab · image, motion and sound'),asset=await invoke('canvas-import',{project:p.id,file:path.join(root,'Results/Image-Studio-Tests-2026-10-23/create.png')});
  p.nodes=[{id:'reference',type:'image',asset:asset.id,x:0,y:60,settings:{}},{id:'motion',type:'video',x:300,y:60,settings:{...g.settings('video'),prompt:'Slow cinematic camera push towards the chair, preserve its shape and the room.'}},{id:'hq',type:'draftHQ',x:600,y:60,settings:g.settings('draftHQ')},{id:'voice',type:'speech',x:300,y:400,settings:{...g.settings('speech'),prompt:'One idea. Many directions. Create with Comfy Lab.'}},{id:'soundtrack',type:'soundtrack',x:900,y:60,settings:{...g.settings('soundtrack'),prompt:'Quiet interior ambience with soft distant birds.'}}];
  p.edges=[{from:'reference',to:'motion',port:'image'},{from:'motion',to:'hq',port:'clip'},{from:'hq',to:'soundtrack',port:'clip'},{from:'voice',to:'soundtrack',port:'narration'}];await invoke('canvas-save',p);report.project=p.id;
  win=new BrowserWindow({width:1500,height:1000,show:true,title:'Comfy Lab · demo',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  const recorder=require('./screen-recorder-main')({root,ipcMain:require('electron').ipcMain,desktopCapturer,getWindow:()=>win,shell});win.webContents.session.setDisplayMediaRequestHandler(recorder.request);
  await win.loadFile(path.join(__dirname,'index.html'),{query:{view:'studio'}});win.show();win.focus();await new Promise(r=>setTimeout(r,2500));
  await win.webContents.executeJavaScript(`(async()=>{await window.ppglab.recorderArm({audio:false});const stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:20},audio:false});await window.ppglab.recorderBegin();const rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:4500000});let write=Promise.resolve();rec.ondataavailable=e=>{if(e.data.size)write=write.then(async()=>window.ppglab.recorderChunk(await e.data.arrayBuffer()));};window.demoRecording={rec,stream,get write(){return write}};rec.start(500);})()`,true);
  const scene=async(label,js,seconds=8)=>{report.segments.push({label,seconds});await win.webContents.executeJavaScript(js);await new Promise(r=>setTimeout(r,seconds*1000));};
  await scene('Existing image generated locally with Qwen',`studioReuse('c396fb56-ba5f-4a6e-95b0-52c2b75750dc')`,9);
  await scene('Send image to Enhance',`document.getElementById('studioEnhance').click()`,7);
  await scene('Canvas workflow with image, motion and sound',`document.getElementById('tabCanvas').click();setTimeout(()=>document.getElementById('canvasFit').click(),700)`,9);
  await scene('Video duration, resolution and quality',`document.querySelector('[data-node="motion"] .canvasNodeBody').click()`,8);
  await scene('Local speech voices and speed',`document.querySelector('[data-node="voice"] .canvasNodeBody').click()`,8);
  await scene('Full video soundtrack with optional narration',`document.querySelector('[data-node="soundtrack"] .canvasNodeBody').click()`,8);
  await scene('Conversational workflow assistant',`document.getElementById('canvasChatToggle').click();document.getElementById('canvasChatInput').value='Help me adapt this workflow for a short product film.'`,7);
  await scene('Storyboard controls',`document.getElementById('tabStoryboard').click()`,8);
  await scene('Image creation and editing, fully local generation',`document.getElementById('tabStudio').click()`,7);
  report.recording=await win.webContents.executeJavaScript(`(async()=>{const d=window.demoRecording;await new Promise(r=>{d.rec.onstop=r;d.rec.stop()});d.stream.getTracks().forEach(t=>t.stop());await d.write;return window.ppglab.recorderFinish()})()`);
  assert(report.recording.file);await fs.copyFile(report.recording.file,path.join(folder,'comfy-lab-demo-draft.mp4'));report.passed=true;
 }catch(e){report.passed=false;report.error=e.stack||String(e);}finally{win?.destroy();await fs.writeFile(path.join(folder,'report.json'),JSON.stringify(report,null,2));}
};
