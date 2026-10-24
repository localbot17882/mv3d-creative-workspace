'use strict';

let canvasController=null,canvasBusy=false;

function applyCanvasUI(){const active=task==='canvas';$('canvasApp').hidden=!active;$('tabCanvas').setAttribute('aria-selected',String(active));if(active){$('imageApp').hidden=true;$('videoApp').hidden=true;$('audioApp').hidden=true;$('videoPlayer').pause();$('audioPlayer').pause();canvasController?.open();}}

function canvasAssistantTool(){return canvasController?.type()||'enhance';}

async function canvasImportDropped(file,x,y){return canvasController?.import(file,x,y);}

function initializeCanvas(){

 const tools=CanvasGraph,board=$('canvasBoard'),world=$('canvasWorld');let project=null,selected=null,wire=null,drag=null,dirty=false,timer=null,revision=0,saveQueue=Promise.resolve(),opening=false,compare=[],states={};

 const selectedNodes=new Set();const selectionBox=document.createElement('div');selectionBox.id='canvasSelectionBox';selectionBox.hidden=true;board.append(selectionBox);

 const catalog=()=>[...Object.entries(tools.types).map(([type,spec])=>({type,label:spec.label})),{type:'enhance',label:'Enhance · Klein',settings:{mode:'klein'}},{type:'enhance',label:'Enhance · Tiled',settings:{mode:'tiled'}},{type:'enhance',label:'Enhance · SeedVR2',settings:{mode:'seedvr2'}},{type:'lighting',label:'Lighting · Qwen',settings:{lightingEngine:'qwen'}},{type:'lighting',label:'Lighting · Klein',settings:{lightingEngine:'klein'}}];

 function addCatalog(entry,x,y){const n=add(entry.type,x,y);if(entry.settings){Object.assign(n.settings,entry.settings);dirtyNow();render();}return n;}

 const menu=document.createElement('div');menu.id='canvasContextMenu';menu.hidden=true;menu.setAttribute('role','menu');menu.setAttribute('aria-label','Add Canvas node');document.body.append(menu);

 board.addEventListener('contextmenu',e=>{e.preventDefault();if(!project||canvasBusy)return;drag=null;const p=point(e.clientX,e.clientY);menu.replaceChildren();const title=document.createElement('strong');title.textContent='Canvas';menu.append(title);const search=document.createElement('button');search.setAttribute('role','menuitem');search.textContent='Search elements… @';search.onclick=()=>{menu.hidden=true;action(()=>showCharacterLibrary({elements:true,at:p,query:'@'}));};menu.append(search);const divider=document.createElement('hr');menu.append(divider);for(const entry of catalog()){const {type}=entry;const button=document.createElement('button');button.setAttribute('role','menuitem');button.textContent=entry.label;button.onclick=()=>{if(type==='characterAsset')action(()=>showCharacterLibrary());else addCatalog(entry,Math.max(20,p.x),Math.max(20,p.y));menu.hidden=true;};menu.append(button);}menu.hidden=false;menu.style.left=Math.min(e.clientX,window.innerWidth-250)+'px';menu.style.top=Math.max(10,Math.min(e.clientY,window.innerHeight-menu.offsetHeight-12))+'px';});

 document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))menu.hidden=true;});

 const buildDialog=document.createElement('dialog');buildDialog.id='canvasAssistantDialog';buildDialog.innerHTML='<div class="canvasDialogHead"><h2>Build a workflow</h2><button id="canvasAssistantClose">Close</button></div><p class="hint">Describe your idea in any language. Gemini proposes connected blocks using our installed engines. Nothing runs until you click Run workflow.</p><label for="canvasAssistantIdea">What would you like to make?</label><textarea id="canvasAssistantIdea" rows="4" maxlength="4000" placeholder="For example: improve this render, make a sunset version, animate it and add gentle outdoor ambience."></textarea><button id="canvasAssistantBuild" class="primary">Propose workflow ✦</button><p id="canvasAssistantStatus" role="status"></p><ol id="canvasAssistantPreview"></ol><button id="canvasAssistantApply" class="primary" disabled>Add proposed blocks to Canvas</button>';document.body.append(buildDialog);let proposal=null,assistantWorking=false;

 $('canvasAssistantClose').onclick=()=>{if(!assistantWorking)buildDialog.close();};buildDialog.addEventListener('cancel',e=>{if(assistantWorking)e.preventDefault();});

 $('canvasAssistantBuild').onclick=async()=>{assistantWorking=true;$('canvasAssistantBuild').disabled=true;$('canvasAssistantClose').disabled=true;$('canvasAssistantApply').disabled=true;$('canvasAssistantStatus').textContent='Designing your workflow…';try{await flush();proposal=await api.assistantWorkflow({project:project.id,idea:$('canvasAssistantIdea').value,selectedAsset:node()?assetFor(node())?.id:null});$('canvasAssistantPreview').replaceChildren();for(const n of proposal.nodes){const li=document.createElement('li');li.textContent=tools.types[n.type].label+(['image','clip','sound','characterAsset'].includes(n.type)&&!n.asset?' · choose a source file':'');$('canvasAssistantPreview').append(li);}$('canvasAssistantStatus').textContent=proposal.summary;$('canvasAssistantApply').disabled=false;}catch(e){$('canvasAssistantStatus').textContent=e.message;}finally{assistantWorking=false;$('canvasAssistantBuild').disabled=false;$('canvasAssistantClose').disabled=false;}};

 $('canvasAssistantApply').onclick=()=>{if(!proposal||canvasBusy)return;const offset=project.nodes.length?Math.max(...project.nodes.map(n=>n.x))+320:0;const next={...project,nodes:[...project.nodes,...proposal.nodes.map(n=>({...n,x:n.x+offset}))],edges:[...project.edges,...proposal.edges]};try{tools.validate(next);project=next;selected=proposal.nodes[0]?.id;dirtyNow();render();fit();buildDialog.close();info('Proposed blocks added. Review their files and settings, then run the workflow.');}catch(e){$('canvasAssistantStatus').textContent=e.message;}};

 const chat=document.createElement('section');chat.className='canvasChat';chat.id='canvasChat';chat.innerHTML='<div class="canvasChatHead"><strong>Assistant · Gemini</strong><button id="canvasChatToggle" aria-expanded="false">Open chat</button></div><div id="canvasChatBody" class="canvasChatBody" hidden><div id="canvasChatMessages" class="canvasChatMessages" role="log" aria-live="polite"></div><textarea id="canvasChatInput" aria-label="Message Canvas assistant" maxlength="4000" placeholder="Describe the workflow you want to build…"></textarea><div class="canvasChatActions"><button id="canvasChatSend">Send ✦</button><button id="canvasChatApply" hidden>Add proposed workflow</button></div><small>Uses your Gemini connection. Workflows run only when you choose Run.</small></div>';board.append(chat);let chatWorking=false,chatProposal=null,chatProject=null;const chatThreads=new Map();

 for(const name of ['pointerdown','wheel','contextmenu'])chat.addEventListener(name,e=>e.stopPropagation());

 function chatRender(){if(chatProject!==project?.id){chatProject=project?.id;chatProposal=null;$('canvasChatApply').hidden=true;}const list=$('canvasChatMessages');list.replaceChildren();for(const m of chatThreads.get(project?.id)||[]){const p=document.createElement('p');p.className=m.role;p.textContent=m.text;list.append(p);}list.scrollTop=list.scrollHeight;}

 function showChat(){chatRender();$('canvasChatBody').hidden=false;$('canvasChatToggle').textContent='Minimise';$('canvasChatToggle').setAttribute('aria-expanded','true');$('canvasChatInput').focus();}

 $('canvasChatToggle').onclick=()=>{if($('canvasChatBody').hidden)showChat();else{$('canvasChatBody').hidden=true;$('canvasChatToggle').textContent='Open chat';$('canvasChatToggle').setAttribute('aria-expanded','false');}};

 $('canvasChatSend').onclick=()=>action(async()=>{if(chatWorking||!project)return;const message=$('canvasChatInput').value.trim();if(!message)return;await flush();const id=project.id,history=chatThreads.get(id)||[];chatWorking=true;$('canvasChatSend').disabled=true;$('canvasChatApply').hidden=true;chatProposal=null;const prior=history.slice(-10);history.push({role:'user',text:message});chatThreads.set(id,history);$('canvasChatInput').value='';chatRender();try{const response=await api.assistantCanvasChat({project:id,message,history:prior});history.push({role:'assistant',text:response.reply});if(project.id===id){chatProposal=response.proposal;$('canvasChatApply').hidden=!chatProposal;}}catch(e){history.push({role:'assistant',text:e.message.replace(/^Error invoking remote method '[^']+': Error: /,'')});}finally{chatWorking=false;$('canvasChatSend').disabled=false;chatRender();}});

 $('canvasChatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('canvasChatSend').click();}});$('canvasChatApply').onclick=()=>{if(!chatProposal||canvasBusy)return;proposal=chatProposal;$('canvasAssistantApply').onclick();chatProposal=null;$('canvasChatApply').hidden=true;};

 const speechFields=document.createElement('section');speechFields.innerHTML='<label data-canvas-field="voice">Voice<select id="canvasSpeechVoice"></select></label><label data-canvas-field="language">Language<select id="canvasSpeechLanguage"></select></label><label data-canvas-field="speed">Reading speed<input id="canvasSpeechSpeed" type="number" min="0.75" max="1.5" step="0.05"></label><label data-canvas-field="refText">Reference transcript<textarea id="canvasSpeechTranscript" maxlength="2000"></textarea></label>'; $('canvasPrompt').closest('[data-canvas-field]').after(speechFields);

 for(const voice of ['Ryan','Aiden','Vivian','Serena','Dylan','Eric','Ono_Anna','Sohee','Uncle_Fu'])$('canvasSpeechVoice').add(new Option(voice,voice));

 for(const language of ['Auto','English','Spanish','French','German','Italian','Portuguese','Chinese','Japanese','Korean','Russian'])$('canvasSpeechLanguage').add(new Option(language,language));

 const soundtrackFields=document.createElement('section');soundtrackFields.innerHTML='<label data-canvas-field="ambientLevel">Ambient volume<input id="canvasAmbientLevel" type="number" min="0" max="1" step="0.05"></label><label data-canvas-field="voiceLevel">Voice volume<input id="canvasVoiceLevel" type="number" min="0" max="1.5" step="0.05"></label><label data-canvas-field="keepOriginal"><input id="canvasKeepOriginal" type="checkbox">Keep original audio</label>'; $('canvasPrompt').closest('[data-canvas-field]').after(soundtrackFields);
 const durationFields=document.createElement('label');durationFields.dataset.canvasField='fullDuration';durationFields.innerHTML='<input id="canvasFullDuration" type="checkbox">Use full input video duration';$('canvasDuration').closest('[data-canvas-field]').after(durationFields);
 const map={fullDuration:'canvasFullDuration',ambientLevel:'canvasAmbientLevel',voiceLevel:'canvasVoiceLevel',keepOriginal:'canvasKeepOriginal',voice:'canvasSpeechVoice',language:'canvasSpeechLanguage',speed:'canvasSpeechSpeed',refText:'canvasSpeechTranscript',autoPrompt:'canvasAutoPrompt',seedLocked:'canvasSeedLock',aspectRatio:'canvasAspectRatio',useDetails:'canvasUseDetails',position:'canvasPosition',subjectSize:'canvasSubjectSize',name:'canvasCharacterName',width:'canvasCharacterWidth',height:'canvasCharacterHeight',mode:'canvasMode',lightingEngine:'canvasLightingEngine',scale:'canvasScale',prompt:'canvasPrompt',negative:'canvasNegative',steps:'canvasSteps',seed:'canvasSeed',duration:'canvasDuration',resolution:'canvasResolution',quality:'canvasQuality',audio:'canvasAudio',preserveAudio:'canvasPreserveAudio',strength:'canvasStrength',guideStrength:'canvasGuideStrength',tile:'canvasTile',window:'canvasWindow',overlap:'canvasOverlap',peopleConfidence:'canvasPeopleConfidence',peopleDenoise:'canvasPeopleDenoise'};

 const numeric=new Set(['ambientLevel','voiceLevel','speed','width','height','scale','steps','seed','duration','strength','guideStrength','window','overlap','peopleConfidence','peopleDenoise']);

 const node=()=>project?.nodes.find(n=>n.id===selected);

 const assetFor=n=>project?.assets.find(a=>a.id===(project.outputs[n.id]?.asset||n.asset));

 const info=text=>$('canvasMessage').textContent=text;

 function accept(p){if(project?.id===p.id)p.view=project.view;project=p;}

 async function action(fn){try{return await fn();}catch(e){info(e.message.replace(/^Error invoking remote method '[^']+': Error: /,''));}}

 function dirtyNow(){dirty=true;revision++;$('canvasSaved').textContent='Unsaved changes';clearTimeout(timer);timer=setTimeout(()=>action(save),700);}

 async function save(){clearTimeout(timer);if(!project||!dirty||canvasBusy)return;const copy=JSON.parse(JSON.stringify(project)),stamp=revision;saveQueue=saveQueue.catch(()=>{}).then(async()=>{const p=await api.canvasSave(copy);if(revision===stamp){project=p;dirty=false;$('canvasSaved').textContent='Saved on F:';}});await saveQueue;}

 async function flush(){clearTimeout(timer);await saveQueue;if(dirty)await save();}

 async function projects(){const list=await api.canvasList(),select=$('canvasProjects');select.replaceChildren(new Option('Open saved project',''));for(const p of list)select.add(new Option(p.name,p.id));if(project)select.value=project.id;}

 async function open(){if(project||opening)return;opening=true;try{const list=await api.canvasList();project=list.length?await api.canvasLoad(list[0].id):await api.canvasNew('My first canvas');$('canvasName').value=project.name;await projects();render();await characterEntries();info('Drop media to start. Add blocks and connect matching ports.');}catch(e){info(e.message);}finally{opening=false;}}

 function view(){if(!project)return;const v=project.view||{x:80,y:80,zoom:1};world.style.transform='translate('+v.x+'px,'+v.y+'px) scale('+v.zoom+')';$('canvasZoom').value=Math.round(v.zoom*100)+'%';}

 function point(x,y){const r=board.getBoundingClientRect(),v=project.view;return {x:(x-r.left-v.x)/v.zoom,y:(y-r.top-v.y)/v.zoom};}

 function position(n,port,output=false){const idx=Object.keys(tools.types[n.type].inputs).indexOf(port);return {x:n.x+(output?230:0),y:n.y+(output?65:65+idx*25)};}

 function curve(a,b){const reach=Math.max(70,Math.abs(b.x-a.x)*0.45);return 'M '+a.x+' '+a.y+' C '+(a.x+reach)+' '+a.y+','+(b.x-reach)+' '+b.y+','+b.x+' '+b.y;}

 function drawWires(cursor){const svg=$('canvasWires');svg.replaceChildren();for(const e of project.edges){const from=project.nodes.find(n=>n.id===e.from),to=project.nodes.find(n=>n.id===e.to);if(!from||!to)continue;const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',curve(position(from,null,true),position(to,e.port)));p.setAttribute('class','wire-'+tools.types[from.type].output);svg.append(p);}if(wire&&cursor){const from=project.nodes.find(n=>n.id===wire);if(from){const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',curve(position(from,null,true),cursor));p.setAttribute('class','wire-'+tools.types[from.type].output);p.setAttribute('stroke-dasharray','5 5');svg.append(p);}}}

 function invalidate(id){if($('canvasSceneToVideo'))$('canvasSceneToVideo').disabled=true;for(const next of tools.descendants(project,id)){delete project.outputs[next];delete states[next];}dirtyNow();}

 function connect(from,to,port){if(canvasBusy)return;const edges=project.edges.filter(e=>!(e.to===to&&e.port===port));edges.push({from,to,port});tools.validate({...project,edges});project.edges=edges;wire=null;invalidate(to);render();info('Connected. Select a block to edit or run its branch.');}

 function select(id,toggle=false){if(!toggle){selectedNodes.clear();selectedNodes.add(id);}else if(selectedNodes.has(id))selectedNodes.delete(id);else selectedNodes.add(id);selected=selectedNodes.has(id)?id:[...selectedNodes].at(-1)||null;renderNodes();inspector();}

 function renderNodes(){

  for(const id of selectedNodes)if(!project.nodes.some(n=>n.id===id))selectedNodes.delete(id);

  $('canvasNodes').replaceChildren();$('canvasWelcome').hidden=project.nodes.length>0;

  for(const n of project.nodes){const spec=tools.types[n.type],a=assetFor(n),card=document.createElement('article');card.className='canvasNode'+(selected===n.id||selectedNodes.has(n.id)?' selected':'')+(states[n.id]==='running'?' running':'');card.dataset.node=n.id;card.style.left=n.x+'px';card.style.top=n.y+'px';

   const head=document.createElement('div');head.className='canvasNodeHead';const title=document.createElement('span');const shot=project.storyboard?.shots.find(s=>s.imageNode===n.id||s.videoNode===n.id);title.textContent=shot?String(project.storyboard.shots.indexOf(shot)+1).padStart(2,'0')+' · '+shot.title+' · '+(shot.imageNode===n.id?'Image':'Video'):n.type==='characterAsset'?'@'+(a?.character?.name||'Character'):spec.label;const state=document.createElement('small');state.textContent=states[n.id]|| (a?'Ready':'');head.append(title,state);card.append(head);

   head.onclick=e=>e.stopPropagation();head.onpointerdown=e=>{if(canvasBusy||e.button!==0)return;e.preventDefault();e.stopPropagation();if(e.ctrlKey||e.metaKey||e.shiftKey){select(n.id,true);return;}if(!selectedNodes.has(n.id))select(n.id);else {selected=n.id;inspector();}drag={kind:'node',x:e.clientX,y:e.clientY,positions:[...selectedNodes].map(id=>{const item=project.nodes.find(n=>n.id===id);return {id,x:item.x,y:item.y};})};};

   const body=document.createElement('div');body.className='canvasNodeBody';if(a?.poster){const img=document.createElement('img');img.src=a.poster;img.alt=a.name;body.append(img);}else body.textContent=a?.kind==='audio'?'♪ Audio ready':['image','clip','sound','characterAsset'].includes(n.type)?'Drop media onto the canvas':'Connect inputs and run';card.append(body);

   const foot=document.createElement('div');foot.className='canvasNodeFoot';foot.textContent=a?(a.name+(a.character?' · '+(1+(a.character.references?.length||0))+' refs':'')):n.settings?.prompt?.slice(0,65)||'No result yet';card.append(foot);

   Object.entries(spec.inputs).forEach(([name,kind],i)=>{const input=document.createElement('button');input.className='canvasPort input';input.style.top=(65+i*25)+'px';input.dataset.port=name;input.dataset.node=n.id;input.dataset.kind=kind;input.title=name+' input · '+kind;input.setAttribute('aria-label',spec.label+' '+name+' input');input.onclick=e=>{e.stopPropagation();if(wire)action(()=>connect(wire,n.id,name));else info('Click an output port first, then this input.');};card.append(input);const label=document.createElement('span');label.className='canvasPortLabel';label.style.top=(65+i*25)+'px';label.textContent=n.type==='video'&&name==='image'?'image / character':n.type==='studioEdit'&&name.startsWith('identity')?'Identity photo '+name.slice(-1):name;card.append(label);});

   const output=document.createElement('button');output.className='canvasPort output'+(wire===n.id?' armed':'');output.dataset.kind=spec.output;output.title='Connect '+spec.output+' output';output.setAttribute('aria-label',spec.label+' output');output.onclick=e=>{e.stopPropagation();if(canvasBusy)return;wire=n.id;info('Now click a matching input on another block.');renderNodes();};output.onpointerdown=e=>{if(canvasBusy)return;e.stopPropagation();wire=n.id;};card.append(output);

   card.onclick=e=>{if(!e.target.closest('.canvasPort'))select(n.id,e.ctrlKey||e.metaKey||e.shiftKey);};body.ondblclick=()=>preview(n);$('canvasNodes').append(card);

  }drawWires();

 }

 function render(){if(!project)return;chatRender();$('canvasName').value=project.name;view();renderNodes();inspector();controls();}

 function controls(){if($('canvasSceneToVideo'))$('canvasSceneToVideo').disabled=canvasBusy||!node()||!assetFor(node());for(const id of ['canvasCharacterQuickSearch','canvasCharacters','canvasName','canvasProjects','canvasNew','canvasSave','canvasDeleteProject','canvasDownloadProject','canvasRunAll','canvasImport','canvasStarter'])$(id).disabled=canvasBusy;for(const b of document.querySelectorAll('#canvasPalette button,.topNav button'))b.disabled=canvasBusy;$('canvasStop').hidden=!canvasBusy;for(const id of Object.values(map))$(id).disabled=canvasBusy;$('canvasRunSelected').disabled=canvasBusy;$('canvasRemove').disabled=canvasBusy;$('canvasRemove').textContent=selectedNodes.size>1?'Remove selected nodes ('+selectedNodes.size+')':'Remove block';}

 function inspector(){const n=node();$('canvasNodeSettings').hidden=!n;$('canvasNoSelection').hidden=!!n;if(!n){$('canvasNodeTitle').textContent='Your workflow';return;}$('canvasNodeTitle').textContent=tools.types[n.type].label;

  const s={...tools.settings(n.type),...n.settings},fields=new Set(Object.keys(s));if(['image','clip','sound','characterAsset','mux'].includes(n.type))fields.clear();if(['character','characterEdit'].includes(n.type))fields.delete('mode');if(n.type==='enhance'&&s.mode==='seedvr2'){fields.delete('prompt');fields.delete('steps');}if(n.type==='people'){fields.delete('scale');}if(n.type==='lighting'&&s.lightingEngine==='qwen')fields.delete('steps');for(const key of Object.keys(map)){const row=document.querySelector('[data-canvas-field="'+key+'"]');row.hidden=!fields.has(key);const el=$(map[key]);if(el.type==='checkbox')el.checked=!!s[key];else if(key==='seedLocked'){el.textContent=s.seedLocked===false?'New seed each run':'Seed locked';el.setAttribute('aria-pressed',String(s.seedLocked!==false));}else if(key==='aspectRatio')el.textContent='Aspect ratio · '+(n.settings?.aspectRatio==='source'?'Original':PhotoAspect.name(s.width,s.height)==='custom'?'Custom':PhotoAspect.name(s.width,s.height));else el.value=key==='resolution'&&s[key]==='test'?'small':s[key]??'';}

  $('canvasDuration').disabled=canvasBusy||(n.type==='refine'&&s.fullDuration===true);
  const uhd=$('canvasResolution').querySelector('option[value=uhd]');uhd.disabled=n.type!=='refine';uhd.hidden=n.type!=='refine';

  const inputs=$('canvasInputList');inputs.replaceChildren();for(const [port,kind] of Object.entries(tools.types[n.type].inputs)){const e=project.edges.find(e=>e.to===n.id&&e.port===port),b=document.createElement('button');b.textContent=port+' · '+(e?'connected · click to disconnect':'needs '+kind);b.disabled=canvasBusy;b.onclick=()=>{project.edges=project.edges.filter(x=>x!==e);invalidate(n.id);render();};inputs.append(b);}

  if(n.type==='characterAsset'){const text=document.createElement('p');text.className='hint';text.textContent='@'+(assetFor(n)?.character?.name||'Character')+' · '+(1+(assetFor(n)?.character?.references?.length||0))+' reference photos. Connect this element to a character variation or video input.';inputs.append(text);const choose=document.createElement('button');choose.textContent='Open character library';choose.disabled=canvasBusy;choose.onclick=()=>action(()=>showCharacterLibrary());inputs.append(choose);const update=document.createElement('button');update.textContent='Update full details';update.disabled=canvasBusy;update.onclick=()=>action(()=>importCharacter(assetFor(n).character.id));inputs.append(update);}

  if(['image','clip','sound'].includes(n.type)){const b=document.createElement('button');b.textContent=n.asset?'Replace source media':'Choose source media';b.disabled=canvasBusy;b.onclick=()=>action(()=>importMedia(null,null,null,n));inputs.append(b);}

  if(['characterAsset','character','characterEdit'].includes(n.type)){const animate=document.createElement('button');animate.textContent='Animate character →';animate.disabled=canvasBusy;animate.onclick=()=>action(()=>{const video=add('video',n.x+320,n.y);video.settings.prompt='The same person as the reference image, preserving their face, hairstyle, clothing and body proportions. Subtle natural breathing and a gentle turn of the head, stable camera, realistic movement.';connect(n.id,video.id,'image');fit();info('Character connected to Image to video. Set the motion, duration and quality, then run this branch.');});inputs.append(animate);}

  if(n.type==='video'&&!project.edges.some(e=>e.to===n.id&&e.port==='image')){const choose=document.createElement('button');choose.textContent='Choose character reference';choose.disabled=canvasBusy;choose.onclick=()=>action(()=>showCharacterLibrary());inputs.append(choose);}

  if(n.type==='compose'){

   if(!project.edges.some(e=>e.to===n.id&&e.port==='character')){const choose=document.createElement('button');choose.textContent='Choose @character';choose.disabled=canvasBusy;choose.onclick=()=>action(()=>showCharacterLibrary());inputs.append(choose);}

   if(!project.edges.some(e=>e.to===n.id&&e.port==='background')){const choose=document.createElement('button');choose.textContent='Choose background image';choose.disabled=canvasBusy;choose.onclick=()=>action(async()=>{await flush();const asset=await api.canvasImport({project:project.id});if(!asset)return;if(asset.kind!=='image')throw Error('Choose an image as the background.');project.assets.push(asset);const source=add('image',Math.max(20,n.x-320),n.y+280);source.asset=asset.id;connect(source.id,n.id,'background');fit();});inputs.append(choose);}

   const video=document.createElement('button');video.id='canvasSceneToVideo';video.textContent='Create video from this scene →';video.disabled=canvasBusy||!assetFor(n);video.onclick=()=>action(()=>{if(canvasBusy||!assetFor(n))throw Error('Generate and review the scene image first.');const v=add('video',n.x+320,n.y);v.settings.prompt='Gentle natural movement of the person. Preserve the character face, clothing, scene architecture and composition. Stable camera, subtle breathing, realistic movement.';connect(n.id,v.id,'image');fit();info('Video block prepared. Review duration and motion, then run it when ready.');});inputs.append(video);

  }

  if(['studioCreate','studioEdit'].includes(n.type)){const video=document.createElement('button');video.id='canvasStudioToVideo';video.textContent='Create video from this image →';video.disabled=canvasBusy;video.onclick=()=>action(()=>{const v=add('video',n.x+320,n.y);connect(n.id,v.id,'image');fit();info('Video connected. Generate and review the image, then run the video block when ready.');});inputs.append(video);}

  if(n.type==='image'||['characterAsset','character','characterEdit'].includes(n.type)){const compose=document.createElement('button');compose.textContent=n.type==='image'?'Compose with a character →':'Place character in a scene →';compose.disabled=canvasBusy;compose.onclick=()=>action(()=>{const scene=add('compose',n.x+320,n.y);connect(n.id,scene.id,n.type==='image'?'background':'character');fit();info('Connect the other reference, then generate the scene image before making a video.');});inputs.append(compose);}

  if(tools.types[n.type].output==='video'&&n.type!=='draftHQ'){const upscale=document.createElement('button');upscale.textContent='Draft to High Quality →';upscale.disabled=canvasBusy;upscale.onclick=()=>action(()=>{const next=add('draftHQ',n.x+340,n.y);connect(n.id,next.id,'clip');fit();info('Existing draft connected. Frames are scaled, preserving motion and audio without regenerating the scene.');});inputs.append(upscale);}

  if(tools.types[n.type].output==='video'){const audio=document.createElement('button');audio.textContent='Add audio →';audio.disabled=canvasBusy;audio.onclick=()=>showVideoAudio(n);inputs.append(audio);}

  $('canvasRisk').textContent=['studioCreate','studioEdit'].includes(n.type)?'Qwen-Image 2.1 Turbo · 8 steps. Start around 1 MP on a 16 GB GPU. Edit references are adapted to the selected format.':n.type==='draftHQ'?'Preserves existing frames, timing, composition and audio. Lanczos scaling increases pixel size; it does not reconstruct native high-resolution detail. Large outputs take longer.':n.type==='compose'?'First generate and review the scene image. Position and size guide the model; face and architecture may vary. Start around 1 MP on a 16 GB GPU.':['video','layout','refine','audio'].includes(n.type)?'16 GB GPU: start short and small. Large resolutions, long clips and Refined quality can exceed memory.':n.type==='lighting'&&s.lightingEngine==='qwen'?'Qwen-Image 2.1 Turbo · 8 steps, local. Output is capped at 2048 px. Start at 1× on a 16 GB GPU. Research licence; commercial use requires a separate Qwen licence.':n.type==='mux'?'Replaces the video soundtrack. Audio is trimmed or padded with silence to match the video.':n.type==='people'?'Automatic detection enhances all detected people. Use the People category for individual masks and brush editing.':'';

  $('canvasRunSelected').textContent=n.type==='compose'?'Generate scene image ↗':'Run this branch ↗';const a=assetFor(n);$('canvasPreview').disabled=!a;$('canvasExport').disabled=!a;$('canvasCompare').disabled=a?.kind!=='image';$('canvasRunSelected').hidden=['image','clip','sound','characterAsset'].includes(n.type);controls();

 }

 const audioDialog=document.createElement('dialog');audioDialog.id='canvasVideoAudioDialog';audioDialog.innerHTML='<div class="canvasDialogHead"><h2>Add audio to video</h2><button id="canvasVideoAudioClose">Close</button></div><p>Choose a soundtrack. A connected Add audio to video block replaces the original sound, trimming or padding the audio to match the video. A finished video is reused without regenerating it.</p><button id="canvasVideoAudioImport">Import audio file</button><button id="canvasVideoAudioGenerate">Generate soundtrack</button><label for="canvasVideoAudioExisting">Audio already on Canvas</label><select id="canvasVideoAudioExisting"></select><button id="canvasVideoAudioUse">Connect selected audio</button><p id="canvasVideoAudioMessage" role="status"></p>';document.body.append(audioDialog);let audioTarget=null;

 function showVideoAudio(n){if(canvasBusy)return;audioTarget=n.id;const select=$('canvasVideoAudioExisting');select.replaceChildren(new Option('Choose an audio node',''));for(const a of project.nodes.filter(a=>tools.types[a.type].output==='audio'))select.add(new Option(assetFor(a)?.name||a.settings?.prompt?.slice(0,60)||tools.types[a.type].label,a.id));$('canvasVideoAudioUse').disabled=true;$('canvasVideoAudioMessage').textContent='';audioDialog.showModal();}

 function addVideoSound(audio){const video=project.nodes.find(n=>n.id===audioTarget);if(!video||canvasBusy)throw Error('Choose a video block first.');const mix=add('mux',video.x+340,video.y+80);connect(video.id,mix.id,'video');connect(audio.id,mix.id,'audio');fit();audioDialog.close();info('Audio connected. Run the Add audio to video branch; existing video results are reused.');return mix;}

 $('canvasVideoAudioClose').onclick=()=>audioDialog.close();$('canvasVideoAudioExisting').onchange=()=>{$('canvasVideoAudioUse').disabled=!$('canvasVideoAudioExisting').value;};

 $('canvasVideoAudioUse').onclick=()=>action(()=>{const audio=project.nodes.find(n=>n.id===$('canvasVideoAudioExisting').value);if(audio)addVideoSound(audio);});

 $('canvasVideoAudioImport').onclick=()=>action(async()=>{if(canvasBusy)return;await flush();const asset=await api.canvasImport({project:project.id,kind:'audio'});if(!asset)return;if(asset.kind!=='audio')throw Error('Choose an audio file.');project.assets.push(asset);const video=project.nodes.find(n=>n.id===audioTarget),sound=add('sound',video.x,video.y+320);sound.asset=asset.id;addVideoSound(sound);await flush();});

 $('canvasVideoAudioGenerate').onclick=()=>action(()=>{if(canvasBusy)return;const video=project.nodes.find(n=>n.id===audioTarget),audio=add('audio',video.x,video.y+320);audio.settings.duration=Math.min(10,Math.max(2,Math.ceil((Number(video.settings.duration)||Number(assetFor(video)?.duration)||4)/2)*2));addVideoSound(audio);select(audio.id);info('Describe your soundtrack in the audio block. Then select Add audio to video and run its branch.');});

 const libraryDialog=document.createElement('dialog');libraryDialog.id='canvasCharacterLibrary';libraryDialog.innerHTML='<div class="canvasDialogHead"><h2>Character library</h2><button id="canvasCharacterLibraryClose">Close</button></div><p class="hint">Choose a saved character to add it as a reusable reference element. You can also type @ in a Canvas prompt.</p><input id="canvasCharacterSearch" aria-label="Search characters" placeholder="Search characters"><div id="canvasCharacterChoices"></div><p id="canvasCharacterLibraryStatus" role="status"></p>';document.body.append(libraryDialog);

 const mentions=document.createElement('div');mentions.id='canvasCharacterMentions';mentions.hidden=true;mentions.setAttribute('role','listbox');mentions.setAttribute('aria-label','Saved characters');document.body.append(mentions);

 let library=[],libraryTarget=null,libraryPosition=null,libraryElements=false,mentionState=null,mentionIndex=0,mentionMatches=[];

 async function characterEntries(){library=await api.canvasCharacters();drawQuickCharacters();return library;}

 async function importCharacter(id,targetId=null,replacement=null){

  if(canvasBusy)return;await open();await flush();const asset=await api.canvasCharacterImport({project:project.id,character:id});if(!project.assets.some(a=>a.id===asset.id))project.assets.push(asset);

  const result=CanvasCharacters.attach(project,asset,targetId,crypto.randomUUID()),target=project.nodes.find(n=>n.id===targetId);

  if(result.updated)invalidate(result.element.id);if(result.connected&&target)invalidate(target.id);

  if(replacement){const field=replacement.field,old=replacement.text,value=old.slice(0,replacement.start)+'@'+asset.character.name+' '+old.slice(replacement.end);if(field.id==='canvasPrompt'&&target){target.settings.prompt=value;invalidate(target.id);}else field.value=value;}

  if(libraryDialog.open&&libraryPosition){result.element.x=Math.max(20,libraryPosition.x);result.element.y=Math.max(20,libraryPosition.y);}selected=target?.id||result.element.id;selectedNodes.clear();selectedNodes.add(selected);dirtyNow();render();fit();await flush();mentions.hidden=true;libraryDialog.close();

  info(result.connected?'@'+asset.character.name+' added and connected as a character reference.':'@'+asset.character.name+' added as an element. Connect its image output to a compatible input; existing connections are kept.');

 }

 async function useExistingElement(asset){if(canvasBusy)return;const type={image:'image',video:'clip',audio:'sound'}[asset.kind];if(!type)return;let n=project.nodes.find(n=>n.asset===asset.id&&['image','clip','sound','characterAsset'].includes(n.type));if(!n){n=add(type,Math.max(20,libraryPosition?.x||100),Math.max(20,libraryPosition?.y||100));n.asset=asset.id;}selected=n.id;selectedNodes.clear();selectedNodes.add(n.id);dirtyNow();render();fit();await flush();libraryDialog.close();info('@'+asset.name+' added as an element.');}

 function drawCharacterChoices(){const box=$('canvasCharacterChoices');box.replaceChildren();const query=$('canvasCharacterSearch').value.trim().replace(/^@/,'').toLocaleLowerCase(),entries=[...library.map(c=>({...c,source:'character'})),...(libraryElements?project.assets.filter(a=>!a.character).map(a=>({...a,source:'asset'})):[])];for(const c of entries.filter(c=>c.name.toLocaleLowerCase().includes(query))){const button=document.createElement('button'),label=document.createElement('span');button.className='canvasCharacterChoice';if(c.poster){const img=document.createElement('img');img.src=c.poster;img.alt=c.name;button.append(img);}label.textContent='@'+c.name+(c.referenceCount>1?' · '+c.referenceCount+' photos':'');button.append(label);button.onclick=()=>action(()=>c.source==='character'?importCharacter(c.id,libraryTarget):useExistingElement(c));box.append(button);}$('canvasCharacterLibraryStatus').textContent=box.children.length?'':'No matching elements. Save a character or import media into this project first.';}

 function drawQuickCharacters(){const box=$('canvasCharacterQuickResults'),query=$('canvasCharacterQuickSearch').value.trim().replace(/^@/,'').toLocaleLowerCase();box.replaceChildren();if(!query)return;const matches=library.filter(c=>c.name.toLocaleLowerCase().includes(query));for(const c of matches.slice(0,8)){const button=document.createElement('button'),img=document.createElement('img'),label=document.createElement('span');img.src=c.poster;img.alt='';label.textContent='@'+c.name+(c.referenceCount>1?' · '+c.referenceCount+' photos':'');button.title='Add '+c.name+' as a character element';button.disabled=canvasBusy;button.append(img,label);button.onclick=()=>action(async()=>{await importCharacter(c.id,selected);$('canvasCharacterQuickSearch').value='';drawQuickCharacters();});box.append(button);}if(!matches.length)box.textContent='No matching characters.';}

 $('canvasCharacterQuickSearch').oninput=drawQuickCharacters;$('canvasCharacterQuickSearch').onfocus=()=>action(characterEntries);

 async function showCharacterLibrary(options={}){if(canvasBusy)return;await open();libraryPosition=options.at||null;libraryElements=!!options.elements;libraryTarget=libraryPosition?null:selected;await characterEntries();libraryDialog.querySelector('h2').textContent=libraryElements?'Search elements':'Character library';libraryDialog.querySelector('.hint').textContent=libraryElements?'Type @name to find saved characters and media in this project. Select a result to call it onto the canvas.':'Choose a saved character to add it as a reusable reference element. You can also type @ in a Canvas prompt.';$('canvasCharacterSearch').setAttribute('aria-label',libraryElements?'Search elements':'Search characters');$('canvasCharacterSearch').placeholder='Search name or @name';$('canvasCharacterSearch').value=options.query||'';drawCharacterChoices();libraryDialog.showModal();$('canvasCharacterSearch').focus();$('canvasCharacterSearch').setSelectionRange($('canvasCharacterSearch').value.length,$('canvasCharacterSearch').value.length);}

 libraryDialog.addEventListener('close',()=>{libraryPosition=null;libraryElements=false;});$('canvasCharacterLibraryClose').onclick=()=>libraryDialog.close();$('canvasCharacterSearch').oninput=drawCharacterChoices;$('canvasCharacterSearch').onkeydown=e=>{if(e.key==='Enter'){const first=$('canvasCharacterChoices').querySelector('button');if(first){e.preventDefault();first.click();}}};$('canvasCharacters').onclick=()=>action(showCharacterLibrary);

 async function showMentions(field){const state=CanvasCharacters.mention(field.value,field.selectionStart);if(!state||canvasBusy){mentions.hidden=true;return;}const text=field.value,caret=field.selectionStart,target=field.id==='canvasPrompt'?selected:null;await characterEntries();if(field.value!==text||field.selectionStart!==caret||document.activeElement!==field)return;

  if(library.some(c=>state.query.startsWith(c.name+' '))){mentions.hidden=true;return;}(field.id==='canvasAssistantIdea'?buildDialog:document.body).append(mentions);mentionMatches=library.filter(c=>c.name.toLocaleLowerCase().includes(state.query.toLocaleLowerCase())).slice(0,12);mentionIndex=0;mentionState={...state,text,field,target};mentions.replaceChildren();

  for(const c of mentionMatches){const button=document.createElement('button'),img=document.createElement('img'),label=document.createElement('span');button.setAttribute('role','option');img.src=c.poster;img.alt='';label.textContent='@'+c.name+(c.referenceCount>1?' · '+c.referenceCount+' photos':'');button.append(img,label);button.onpointerdown=e=>e.preventDefault();button.onclick=()=>action(()=>importCharacter(c.id,target,mentionState));mentions.append(button);}

  if(!mentionMatches.length){const empty=document.createElement('p');empty.textContent='No saved characters match. Create one in Characters.';mentions.append(empty);}const rect=field.getBoundingClientRect();mentions.style.left=Math.max(8,Math.min(rect.left,innerWidth-310))+'px';mentions.style.top=Math.max(8,Math.min(rect.bottom+4,innerHeight-300))+'px';mentions.hidden=false;highlightMention();

 }

 function highlightMention(){Array.from(mentions.querySelectorAll('button')).forEach((b,i)=>b.setAttribute('aria-selected',String(i===mentionIndex)));}

 for(const field of [$('canvasPrompt'),$('canvasAssistantIdea')]){field.addEventListener('input',()=>action(()=>showMentions(field)));field.addEventListener('keydown',e=>{if(mentions.hidden)return;if(e.key==='Escape'){mentions.hidden=true;e.preventDefault();}else if(['ArrowDown','ArrowUp'].includes(e.key)&&mentionMatches.length){e.preventDefault();mentionIndex=(mentionIndex+(e.key==='ArrowDown'?1:-1)+mentionMatches.length)%mentionMatches.length;highlightMention();}else if(e.key==='Enter'&&mentionMatches.length){e.preventDefault();action(()=>importCharacter(mentionMatches[mentionIndex].id,mentionState.target,mentionState));}});}

 document.addEventListener('pointerdown',e=>{if(!mentions.contains(e.target)&&e.target!==$('canvasPrompt')&&e.target!==$('canvasAssistantIdea'))mentions.hidden=true;});

 function add(type,x=100+(project.nodes.length%4)*300,y=100+Math.floor(project.nodes.length/4)*300){if(!project||canvasBusy)return null;const n={id:crypto.randomUUID(),type,x,y,settings:tools.settings(type)};project.nodes.push(n);selected=n.id;selectedNodes.clear();selectedNodes.add(n.id);dirtyNow();render();return n;}

 async function importMedia(file,x,y,replace){if(canvasBusy)return;await open();await flush();const a=file?await api.canvasImportFile(file,project.id):await api.canvasImport({project:project.id});if(!a)return;project.assets.push(a);const type={image:'image',video:'clip',audio:'sound'}[a.kind];if(replace){if(replace.type!==type)throw Error('Choose a file matching the source block type.');replace.asset=a.id;invalidate(replace.id);}else{const p=Number.isFinite(x)?point(x,y):{x:100+project.nodes.length*60,y:100};const n=add(type,Math.max(20,p.x),Math.max(30,p.y));n.asset=a.id;invalidate(n.id);}render();await flush();info('Media copied into this project on F:.');}

 async function run(target){await flush();tools.validate(project,true,target);canvasBusy=true;controls();info('Starting workflow…');try{await api.canvasRun({project:project.id,target});}catch(e){canvasBusy=false;controls();throw e;}}

 function preview(n){const a=assetFor(n);if(!a)return;for(const id of ['canvasPreviewImage','canvasPreviewVideo','canvasPreviewAudio']){$(id).hidden=true;if($(id).pause)$(id).pause();}const el=$(a.kind==='image'?'canvasPreviewImage':a.kind==='video'?'canvasPreviewVideo':'canvasPreviewAudio');el.src=a.url;el.hidden=false;$('canvasPreviewDialog').showModal();}

 function zoom(factor,x=board.getBoundingClientRect().left+board.clientWidth/2,y=board.getBoundingClientRect().top+board.clientHeight/2){if(!project)return;const p=point(x,y),r=board.getBoundingClientRect(),z=Math.max(0.25,Math.min(2,project.view.zoom*factor));project.view={x:x-r.left-p.x*z,y:y-r.top-p.y*z,zoom:z};view();dirtyNow();}

 function fit(){if(!project?.nodes.length)return;const ns=project.nodes,minX=Math.min(...ns.map(n=>n.x)),minY=Math.min(...ns.map(n=>n.y)),maxX=Math.max(...ns.map(n=>n.x+230)),maxY=Math.max(...ns.map(n=>n.y+235)),z=Math.max(0.25,Math.min(1,(board.clientWidth-70)/(maxX-minX),(board.clientHeight-70)/(maxY-minY)));project.view={x:(board.clientWidth-(maxX-minX)*z)/2-minX*z,y:(board.clientHeight-(maxY-minY)*z)/2-minY*z,zoom:z};view();dirtyNow();}

 for(const entry of catalog()){const {type}=entry;const button=document.createElement('button');button.textContent=entry.label;button.onclick=()=>action(async()=>{await open();if(type==='characterAsset')await showCharacterLibrary();else addCatalog(entry);});$('canvasPalette').append(button);}

 function photoRatioSource(n){const port=n.type==='compose'?'background':'image',edge=project.edges.find(e=>e.to===n.id&&e.port===port),parent=project.nodes.find(n=>n.id===edge?.from);return parent?assetFor(parent):null;}

 $('canvasAspectRatio').onclick=()=>{const n=node();if(!n||canvasBusy)return;openPhotoAspect({current:{width:n.settings.width,height:n.settings.height},source:photoRatioSource(n),aspect:n.settings.aspectRatio||'custom',onSelect:(aspect,dimensions)=>{Object.assign(n.settings,dimensions,{aspectRatio:aspect});invalidate(n.id);render();}});};

 $('canvasSeedLock').onclick=()=>{const n=node();if(!n||canvasBusy)return;n.settings.seedLocked=n.settings.seedLocked===false;dirtyNow();inspector();};

 for(const [key,id] of Object.entries(map).filter(([key])=>!['seedLocked','aspectRatio'].includes(key)))$(id).addEventListener(['prompt','negative'].includes(key)?'input':'change',()=>{const n=node();if(!n||canvasBusy)return;let value=$(id).type==='checkbox'?$(id).checked:numeric.has(key)?Number($(id).value):$(id).value;if(key==='resolution'&&['layout','refine'].includes(n.type)&&value==='small')value='test';if(['width','height'].includes(key)&&n.settings.aspectRatio&&n.settings.aspectRatio!=='custom'){Object.assign(n.settings,PhotoAspect.resize(n.settings.aspectRatio,photoRatioSource(n),n.settings,key,value));}else n.settings[key]=value;if(key==='prompt'&&n.type==='video'){n.settings.autoPrompt=false;$('canvasAutoPrompt').checked=false;}invalidate(n.id);renderNodes();if(['fullDuration','mode','lightingEngine','width','height'].includes(key))inspector();});

 $('tabCanvas').onclick=()=>switchTask('canvas');$('canvasImport').onclick=()=>action(()=>importMedia());$('canvasSave').onclick=()=>action(async()=>{await flush();await projects();});$('canvasName').oninput=()=>{project.name=$('canvasName').value;dirtyNow();};

 $('canvasDownloadProject').onclick=()=>action(async()=>{await flush();const file=await api.canvasDownload(project.id);if(file)info('Workflow and media downloaded: '+file);});

 $('canvasDeleteProject').onclick=()=>action(async()=>{if(canvasBusy||!project)return;await flush();if(!await api.canvasDelete(project.id))return;project=null;selected=null;selectedNodes.clear();states={};compare=[];await open();info('Project removed from saved workflows.');});

 $('canvasNew').onclick=()=>action(async()=>{await flush();project=await api.canvasNew('Untitled canvas');selected=null;selectedNodes.clear();states={};compare=[];await projects();render();});

 $('canvasProjects').onchange=()=>action(async()=>{if(!$('canvasProjects').value)return;const id=$('canvasProjects').value;await flush();project=await api.canvasLoad(id);selected=null;selectedNodes.clear();states={};compare=[];render();});

 $('canvasRunAll').onclick=()=>action(()=>run(null));$('canvasRunSelected').onclick=()=>action(()=>run(selected));$('canvasStop').onclick=()=>action(async()=>{await api.canvasStop();info('Stopping after the current block. Its result will be saved.');});

 function removeSelected(){if(!project||canvasBusy)return;const ids=new Set([...selectedNodes,...(selected?[selected]:[])]);if(!ids.size)return;project=tools.removeNodes(project,ids);for(const id of ids)delete states[id];selectedNodes.clear();selected=null;wire=null;drag=null;selectionBox.hidden=true;menu.hidden=true;dirtyNow();render();info(ids.size+' nodes removed from Canvas. Library files are kept.');}

 $('canvasRemove').onclick=removeSelected;

 document.addEventListener('keydown',e=>{if(e.key!=='Delete'||task!=='canvas'||canvasBusy||document.querySelector('dialog[open]')||e.target.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable=""]'))return;if(!selected&&!selectedNodes.size)return;e.preventDefault();removeSelected();});

 $('canvasStarter').onclick=()=>{if(!project||canvasBusy)return;const a=add('image',60,100),b=add('enhance',380,100),c=add('video',700,100);project.edges.push({from:a.id,to:b.id,port:'image'},{from:b.id,to:c.id,port:'image'});dirtyNow();render();fit();info('Select the Image block and choose a render, then Run workflow.');};

 $('canvasPreview').onclick=()=>preview(node());$('canvasExport').onclick=()=>action(async()=>{const a=assetFor(node());if(a){await flush();const file=await api.canvasExport({project:project.id,asset:a.id});if(file)info('Saved: '+file);}});

 $('canvasPreviewClose').onclick=()=>{$('canvasPreviewVideo').pause();$('canvasPreviewAudio').pause();$('canvasPreviewDialog').close();};$('canvasPreviewDialog').addEventListener('cancel',()=>{$('canvasPreviewVideo').pause();$('canvasPreviewAudio').pause();});

 $('canvasCompare').onclick=()=>{const a=assetFor(node());if(a?.kind!=='image')return;compare=compare.filter(x=>x.id!==a.id);compare.push(a);compare=compare.slice(-2);if(compare.length<2){info('Branch A selected. Select another image result and add it to comparison.');return;}$('canvasCompareA').src=compare[0].url;$('canvasCompareB').src=compare[1].url;$('canvasCompareNames').textContent='A: '+compare[0].name+' · B: '+compare[1].name;$('canvasCompareDialog').showModal();};$('canvasCompareClose').onclick=()=>$('canvasCompareDialog').close();$('canvasCompareSlider').oninput=()=>$('canvasCompareA').style.clipPath='inset(0 '+(100-Number($('canvasCompareSlider').value))+'% 0 0)';

 $('canvasZoomIn').onclick=()=>zoom(1.2);$('canvasZoomOut').onclick=()=>zoom(1/1.2);$('canvasFit').onclick=fit;

 board.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?1.08:1/1.08,e.clientX,e.clientY);},{passive:false});

 board.onpointerdown=e=>{if(!project||e.target.closest('.canvasNode')||e.button>1)return;e.preventDefault();if(e.button===1||e.altKey){drag={kind:'pan',x:e.clientX,y:e.clientY,startX:project.view.x,startY:project.view.y};return;}if(canvasBusy)return;drag={kind:'select',x:e.clientX,y:e.clientY,base:e.shiftKey?new Set(selectedNodes):new Set()};selectionBox.hidden=false;selectionBox.style.width='0px';selectionBox.style.height='0px';};

 document.addEventListener('pointermove',e=>{if(!project)return;if(wire)drawWires(point(e.clientX,e.clientY));if(!drag)return;if(drag.kind==='pan'){project.view.x=drag.startX+e.clientX-drag.x;project.view.y=drag.startY+e.clientY-drag.y;view();}else if(drag.kind==='select'){const r=board.getBoundingClientRect(),left=Math.min(drag.x,e.clientX),top=Math.min(drag.y,e.clientY),right=Math.max(drag.x,e.clientX),bottom=Math.max(drag.y,e.clientY);Object.assign(selectionBox.style,{left:left-r.left+'px',top:top-r.top+'px',width:right-left+'px',height:bottom-top+'px'});selectedNodes.clear();for(const id of drag.base)selectedNodes.add(id);if(right-left>3||bottom-top>3){const a=point(left,top),b=point(right,bottom);for(const n of project.nodes)if(n.x<b.x&&n.x+230>a.x&&n.y<b.y&&n.y+235>a.y)selectedNodes.add(n.id);}selected=[...selectedNodes].at(-1)||null;for(const card of $('canvasNodes').children)card.classList.toggle('selected',selectedNodes.has(card.dataset.node));}

 else{for(const start of drag.positions){const n=project.nodes.find(n=>n.id===start.id);if(!n)continue;n.x=start.x+(e.clientX-drag.x)/project.view.zoom;n.y=start.y+(e.clientY-drag.y)/project.view.zoom;const card=$('canvasNodes').querySelector('[data-node="'+n.id+'"]');if(card){card.style.left=n.x+'px';card.style.top=n.y+'px';}}drawWires();}});

 document.addEventListener('pointerup',e=>{if(wire){const input=document.elementFromPoint(e.clientX,e.clientY)?.closest('.canvasPort.input');if(input)action(()=>connect(wire,input.dataset.node,input.dataset.port));}if(drag){const selecting=drag.kind==='select';drag=null;selectionBox.hidden=true;if(selecting){inspector();info(selectedNodes.size+' nodes selected. Drag a selected header to move them together. Shift-drag adds to the selection.');}else dirtyNow();}});

 board.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.hidden=true;selectionBox.hidden=true;drag=null;selectedNodes.clear();selected=null;renderNodes();inspector();wire=null;drawWires();info('Connection cancelled.');}});

 api.onCanvasUpdate(e=>{if(e.type==='working'){canvasBusy=true;if(e.project){accept(e.project);render();}controls();}if(e.type==='node'){if(e.project)accept(e.project);states[e.node]=e.status;render();info(e.completed+' / '+e.total+' processing blocks complete.');}if(e.type==='progress'){const total=e.total||1,p=Number.isFinite(e.percent)?Math.min(99,(e.completed+e.percent/100)/total*100):null;$('canvasProgress').hidden=false;if(p===null)$('canvasProgress').removeAttribute('value');else $('canvasProgress').value=p;info((p===null?'Processing':Math.floor(p)+'% · estimated workflow progress')+' · '+(e.stage||'Working…'));}if(['done','error'].includes(e.type)){if(e.project)accept(e.project);if(e.type==='error'&&e.node)states[e.node]='error';render();info(e.message);if(e.type==='done')$('canvasProgress').value=100;}if(e.type==='idle'){canvasBusy=false;controls();inspector();projects();if(dirty)action(save);}});

 canvasController={fit,flush,openProject:async id=>{await flush();project=await api.canvasLoad(id);selected=null;selectedNodes.clear();states={};$('canvasName').value=project.name;await projects();render();},open,importCharacter,import:importMedia,importPath:async file=>{await open();await flush();const a=await api.canvasImport({project:project.id,file});if(a){project.assets.push(a);const n=add('image');n.asset=a.id;invalidate(n.id);render();await flush();}},type:()=>node()?.type};

}
