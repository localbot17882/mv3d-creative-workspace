'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({root,BrowserWindow,invoke})=>{
 const folder=path.join(root,'Results/Final-Review-2026-10-23');await fs.mkdir(folder,{recursive:true});const errors=[],report={started:new Date().toISOString(),generationSubmitted:false,tests:[]};
 let win;
 try{
  await invoke('canvas-new','QA · final interface review');
  win=new BrowserWindow({show:true,width:1500,height:1050,webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.on('console-message',(_e,level,message)=>{if(level>=3)errors.push(message);});
  await win.loadFile(path.join(__dirname,'index.html'),{query:{view:'canvas'}});await new Promise(r=>setTimeout(r,2500));
  const initial=await win.webContents.executeJavaScript(`({ready:!!document.querySelector('#canvasPalette button'),oldButton:!!document.getElementById('canvasBuildAssistant'),labels:[...document.querySelectorAll('#canvasPalette button')].map(b=>b.textContent)})`);
  assert(initial.ready);assert(!initial.oldButton);for(const label of ['Soundtrack a video','Speech · Qwen','Clone voice · Qwen','Enhance · SeedVR2','Lighting · Qwen'])assert(initial.labels.includes(label),label);report.tests.push('Complete Canvas catalogue and redundant button removal');
  await win.webContents.executeJavaScript(`document.querySelector('#canvasChatToggle').click();[...document.querySelectorAll('#canvasPalette button')].find(b=>b.textContent==='Soundtrack a video').click()`);await new Promise(r=>setTimeout(r,500));
  assert(await win.webContents.executeJavaScript(`!document.querySelector('[data-canvas-field="ambientLevel"]').hidden && !document.querySelector('[data-canvas-field="keepOriginal"]').hidden`));
  await fs.writeFile(path.join(folder,'canvas-soundtrack.png'),(await win.webContents.capturePage()).toPNG());report.tests.push('Soundtrack inspector and conversational assistant visible');
  await win.webContents.executeJavaScript(`[...document.querySelectorAll('#canvasPalette button')].find(b=>b.textContent==='Clone voice · Qwen').click()`);await new Promise(r=>setTimeout(r,300));assert(await win.webContents.executeJavaScript(`!document.querySelector('[data-canvas-field="refText"]').hidden`));report.tests.push('Clone voice transcript and settings');
  await win.webContents.executeJavaScript(`[...document.querySelectorAll('#canvasPalette button')].find(b=>b.textContent==='Refine video').click()`);await new Promise(r=>setTimeout(r,300));assert(await win.webContents.executeJavaScript(`document.querySelector('#canvasFullDuration').checked && !document.querySelector('[data-canvas-field="fullDuration"]').hidden`));report.tests.push('Full duration Refine control');
  await win.webContents.executeJavaScript(`document.getElementById('tabStudio').click()`);await new Promise(r=>setTimeout(r,300));assert(await win.webContents.executeJavaScript(`!!document.getElementById('studioEnhance') && !document.getElementById('studioApp').hidden`));await fs.writeFile(path.join(folder,'image-studio-enhance.png'),(await win.webContents.capturePage()).toPNG());report.tests.push('Image Studio Enhance action');
  assert.equal(errors.length,0,errors.join('\n'));report.passed=true;
 }catch(e){report.passed=false;report.error=e.stack;process.exitCode=1;}finally{report.errors=errors;await fs.writeFile(path.join(folder,'ui-report.json'),JSON.stringify(report,null,2));win?.destroy();}
};
