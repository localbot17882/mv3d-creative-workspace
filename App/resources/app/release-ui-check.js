'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
module.exports=async({root,BrowserWindow,invoke})=>{
 const {dialog,nativeImage}=require('electron'),folder=path.join(root,'Results/Release-Audit-2026-10-24'),fixtures=path.join(folder,'fixtures');await fs.mkdir(folder,{recursive:true});
 const report={started:new Date().toISOString(),generationSubmitted:false,syntheticFixturesOnly:true,tests:[],consoleErrors:[]};let win,historyId,projectId,saveTarget,presetId;const mediaIds=[],postHistoryIds=[];
 const originalSave=dialog.showSaveDialog,originalConfirm=dialog.showMessageBoxSync;
 dialog.showSaveDialog=async()=>{assert(saveTarget&&path.resolve(saveTarget).startsWith(path.resolve(folder)+path.sep));return {canceled:false,filePath:saveTarget};};
 dialog.showMessageBoxSync=(_win,options)=>{assert(!/every saved|Clear history/i.test(options.message));return 1;};
 const store=require('./history-store')(path.join(root,'Data/image-history'),nativeImage);
 async function test(name,fn){const started=Date.now();try{await fn();report.tests.push({name,passed:true,milliseconds:Date.now()-started});}catch(e){report.tests.push({name,passed:false,error:e.stack});}await fs.writeFile(path.join(folder,'ui-progress.json'),JSON.stringify(report,null,2));}
 try{
  await promisify(execFile)(path.join(root,'.venv/Scripts/python.exe'),[path.join(root,'setup/make-smoke-media.py'),fixtures],{windowsHide:true,timeout:60000});
  let p=await invoke('canvas-new','QA release audit');projectId=p.id;
  win=new BrowserWindow({show:false,width:1500,height:1050,webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,autoplayPolicy:'no-user-gesture-required'}});
  win.webContents.on('console-message',(_event,level,message)=>{if(level>=3&&!/ERR_CONNECTION_REFUSED|ERR_ABORTED/.test(message))report.consoleErrors.push(message);});
  await win.loadFile(path.join(__dirname,'index.html'));await new Promise(r=>setTimeout(r,1400));
  const js=code=>win.webContents.executeJavaScript(code,true);
  for(const [button,expected,view] of [['tabStudio','studio','studioApp'],['tabEnhance','enhance','imageApp'],['tabLighting','lighting','imageApp'],['tabVideo','video','videoApp'],['tabAudio','audio','audioApp'],['tabCharacters','characters','charactersApp'],['tabStoryboard','storyboard','storyboardApp'],['tabCanvas','canvas','canvasApp'],['tabModelUpdates','updates','modelUpdatesApp'],['tabModelDiscover','discover','modelDiscoverApp']]){
   await test('Navigation: '+expected,async()=>{
    const state=await js(`(()=>{const b=document.getElementById(${JSON.stringify(button)});if(!b)throw Error('Missing navigation '+${JSON.stringify(button)});b.click();return {task,visible:!document.getElementById(${JSON.stringify(view)})?.hidden,selected:[...document.querySelectorAll('.topNav button[aria-selected="true"]')].filter(b=>!b.hidden).map(b=>b.id)};})()`);
    assert.equal(state.task,expected);assert(state.visible);assert.equal(state.selected.length,1,JSON.stringify(state.selected));
   });
  }
  await test('Enhance contains Image, Video and Render People; Refine uses safe instructions',async()=>{
   const result=await js(`(()=>{document.getElementById('tabEnhance').click();const labels=[...document.querySelectorAll('.enhanceSections button')].map(b=>b.textContent);document.querySelectorAll('.enhanceSections button')[2].click();const people=task==='people'&&!document.getElementById('peopleControls').hidden;document.getElementById('videoPrompt').value='Stale unrelated scene';document.querySelectorAll('.enhanceSections button')[1].click();return {labels,people,tool:document.getElementById('videoTool').value,prompt:document.getElementById('videoPrompt').value,promptHidden:document.getElementById('videoPrompt').hidden};})()`);
   assert.deepEqual(result.labels,['Image','Video','Render People']);assert(result.people);assert.equal(result.tool,'refine');assert(!result.prompt.includes('Stale'));assert(result.promptHidden);
  });
  await test('Fresh speech installation has a visible install action without downloading in this test',async()=>{
   const state=await js(`(()=>{document.getElementById('tabAudio').click();document.getElementById('audioEngine').value='qwen';document.getElementById('audioEngine').dispatchEvent(new Event('change'));const previous=audioState;audioState={...audioState,speechReady:false};audioEnable();const shown=!document.getElementById('speechControls').hidden&&!document.getElementById('speechInstall').hidden;audioState=previous;audioEnable();return {shown,label:document.getElementById('speechInstall').textContent};})()`);assert(state.shown);assert(state.label.includes('Install speech'));
  });
  await test('Image history save, download, reopen and individual delete',async()=>{
   const bytes=await fs.readFile(path.join(fixtures,'fixture.png'));historyId=await store.add({file:'QA fixture.png',bytes,width:96,height:64},bytes,{task:'import'},null);
   assert((await invoke('history-list')).some(e=>e.id===historyId));saveTarget=path.join(folder,'history-download.png');await invoke('history-download',historyId);assert((await fs.readFile(saveTarget)).equals(bytes));
   const entry=await invoke('history-get',historyId);assert.equal(entry.width,96);assert(entry.result.startsWith('data:image/png;base64,'));
  });
  await test('Colour, curves, levels and LUT controls; presets and full resolution export',async()=>{
   const source=await invoke('post-import',path.join(fixtures,'fixture.png'));await js(`openPost(null,null,${JSON.stringify(source)})`);
   const state=await js(`(()=>{setPostValues({exposure:.25,shadows:15,curves:{master:[[0,0],[.5,.65],[1,1]]},levels:{gamma:1.2}});return {settings:postValues(),hasLUT:!!document.getElementById('postLUTFile'),hasCurves:!!document.getElementById('postCurveCanvas')};})()`);
   assert(state.hasLUT&&state.hasCurves);assert.equal(state.settings.curves.master.length,3);
   const list=await invoke('post-preset-save',{name:'QA colour preset',settings:state.settings});presetId=list.at(-1).id;assert.equal(list.at(-1).settings.levels.gamma,1.2);
   await js('setPostValues({});');await js(`setPostValues(${JSON.stringify(list.at(-1).settings)})`);assert.equal(await js('postValues().shadows'),15);
   saveTarget=path.join(folder,'post-production.png');const png=await js(`(()=>{const c=document.createElement('canvas');c.width=postPixels.width;c.height=postPixels.height;c.getContext('2d').putImageData(new ImageData(applyPostPixels(postPixels.data,c.width,c.height,postValues()),c.width,c.height),0,0);return c.toDataURL();})()`);
   const earlier=new Set((await store.list()).map(e=>e.id));const savedPost=await invoke('post-save',{png,settings:state.settings});postHistoryIds.push(...(await store.list()).filter(e=>!earlier.has(e.id)).map(e=>e.id));assert(!savedPost.warning,savedPost.warning);assert.equal(postHistoryIds.length,1);assert.deepEqual(nativeImage.createFromBuffer(await fs.readFile(saveTarget)).getSize(),{width:96,height:64});
   await js(`document.querySelectorAll('.postColourGroup').forEach(g=>g.open=['RGB curves','Levels','Creative LUT'].includes(g.querySelector('summary').textContent));`);await win.webContents.capturePage();await fs.writeFile(path.join(folder,'post-production.png-ui.png'),(await win.webContents.capturePage()).toPNG());await js(`document.getElementById('postDialog').close()`);
  });
  await test('Canvas project: image, video and audio import, save and reopen',async()=>{
   const assets=[];for(const file of ['fixture.png','fixture.mp4','fixture.wav'])assets.push(await invoke('canvas-import',{project:projectId,file:path.join(fixtures,file)}));p=await invoke('canvas-load',projectId);
   p.nodes=[{id:'qa-image',type:'image',asset:assets[0].id,x:20,y:20,settings:{}},{id:'qa-video',type:'clip',asset:assets[1].id,x:20,y:250,settings:{}},{id:'qa-audio',type:'sound',asset:assets[2].id,x:20,y:480,settings:{}},{id:'qa-mux',type:'mux',x:450,y:300,settings:{}}];p.edges=[{from:'qa-video',to:'qa-mux',port:'video'},{from:'qa-audio',to:'qa-mux',port:'audio'}];await invoke('canvas-save',p);const restored=await invoke('canvas-load',projectId);assert.equal(restored.assets.length,3);assert.equal(restored.edges.length,2);await js(`(async()=>{switchTask('canvas');await canvasController.openProject(${JSON.stringify(projectId)});canvasController.fit();})()`);
  });
  await test('Canvas right-click search, @ elements and Delete key',async()=>{
   const result=await js(`(async()=>{const board=document.getElementById('canvasBoard'),rect=board.getBoundingClientRect();board.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:rect.left+30,clientY:rect.top+30}));const search=[...document.querySelectorAll('#canvasContextMenu button')].some(b=>b.textContent.includes('Search elements'));document.getElementById('canvasContextMenu').hidden=true;document.querySelector('[data-node="qa-image"]').click();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true}));await canvasController.flush();return {search};})()`);assert(result.search);assert(!(await invoke('canvas-load',projectId)).nodes.some(n=>n.id==='qa-image'));
  });
  await test('Video and audio protocols support muted playback and seeking',async()=>{
   const project=await invoke('canvas-load',projectId);for(const kind of ['video','audio']){
    const asset=project.assets.find(a=>a.kind===kind);assert(asset,'Missing '+kind+' asset');
    const playback=await js(`new Promise(async(resolve,reject)=>{const media=document.createElement(${JSON.stringify(kind)});media.muted=true;media.preload='auto';document.body.append(media);const timeout=setTimeout(()=>{media.remove();reject(Error('Playback timeout'));},7000);media.onerror=()=>{clearTimeout(timeout);reject(Error('Media error '+media.error?.message));};media.onloadedmetadata=async()=>{try{media.currentTime=.5;await media.play();setTimeout(()=>{const value={duration:media.duration,time:media.currentTime};media.pause();media.remove();clearTimeout(timeout);resolve(value);},350);}catch(e){clearTimeout(timeout);reject(e);}};media.src=${JSON.stringify(asset.url)};})`);assert(playback.duration>=1.9);assert(playback.time>.5);
   }
  });
  await test('Canvas workflow download includes its project and media',async()=>{saveTarget=path.join(folder,'QA-workflow.comfylab.zip');await invoke('canvas-download',projectId);const zip=await fs.readFile(saveTarget);assert.equal(zip.subarray(0,2).toString(),'PK');assert(zip.includes(Buffer.from('project.json')));});
  await test('Video and audio history download and individual deletion',async()=>{
   for(const kind of ['video','audio']){const id=crypto.randomUUID();mediaIds.push(id);const dir=path.join(root,'Data/video-history',id),ext=kind==='video'?'mp4':'wav';await fs.mkdir(dir,{recursive:true});await fs.copyFile(path.join(fixtures,'fixture.'+ext),path.join(dir,'clip.'+ext));await fs.writeFile(path.join(dir,'entry.json'),JSON.stringify({id,name:'QA '+kind,kind,created:new Date().toISOString(),width:96,height:64,settings:{task:kind==='audio'?'audio':'image',duration:2}}));assert((await invoke('video-history')).some(e=>e.id===id));saveTarget=path.join(folder,'history-'+kind+'.'+ext);await invoke('video-save',id);assert((await fs.readFile(saveTarget)).equals(await fs.readFile(path.join(fixtures,'fixture.'+ext))));await invoke('video-delete',id);assert(!(await invoke('video-history')).some(e=>e.id===id));}
  });
  await test('Individual history and project deletion preserves exported files',async()=>{assert(historyId&&projectId);await invoke('history-delete',historyId);assert(!(await invoke('history-list')).some(e=>e.id===historyId));historyId=null;await invoke('canvas-delete',projectId);assert(!(await invoke('canvas-list')).some(e=>e.id===projectId));projectId=null;assert((await fs.stat(path.join(folder,'QA-workflow.comfylab.zip'))).size>0);});
 }catch(e){report.fatal=e.stack;}finally{
  if(presetId)await invoke('post-preset-delete',presetId).catch(()=>{});
  if(historyId)await store.remove(historyId).catch(()=>{});
  for(const id of postHistoryIds)await store.remove(id).catch(()=>{});
  if(projectId)await invoke('canvas-delete',projectId).catch(()=>{});
  dialog.showSaveDialog=originalSave;dialog.showMessageBoxSync=originalConfirm;win?.destroy();
  report.passed=!report.fatal&&report.tests.every(t=>t.passed)&&!report.consoleErrors.length;report.finished=new Date().toISOString();await fs.writeFile(path.join(folder,'ui-tests.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,tests:report.tests.map(t=>({name:t.name,passed:t.passed,error:t.error}))}));if(!report.passed)process.exitCode=1;
 }
};
