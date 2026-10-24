'use strict';
let videoSeedLocked=true;
let videoSource=null,videoClip=null,videoEntry=null,videoState=null,videoBusy=false,videoPolling=false,lastVideoTool='image',videoPromptRequest=0,videoPromptPending=false;
const videoDrafts={};
function videoSettings(){const task=$('videoTool').value;return {task,refineCustomPrompt:task==='refine'&&!!document.getElementById('videoRefineCustom')?.checked,fullDuration:task==='refine'&&$('videoFullDuration').checked,textDevice:$('videoTextDevice').value,prompt:$('videoPrompt').value,duration:Number($('videoDuration').value),resolution:task!=='image'&&$('videoResolution').value==='small'?'test':$('videoResolution').value,quality:$('videoQuality').value,seed:Number($('videoSeed').value),audio:$('videoAudio').checked,strength:Number($('videoLoraStrength').value),guideStrength:Number($('videoGuideStrength').value),overlap:Number($('videoOverlap').value),tile:$('videoTile').value,window:Number($('videoWindow').value),preserveAudio:$('videoPreserveAudio').checked};}
function videoToolUI(changePrompt=true){
 const tool=$('videoTool').value,guided=tool!=='image';
 if(changePrompt){videoDrafts[lastVideoTool]=$('videoPrompt').value;$('videoPrompt').value=videoDrafts[tool]||(tool==='layout'?'A photorealistic architectural shot matching the reference image. Coherent materials, natural daylight and sharp architectural details.':'Sharp photographic detail, crisp edges, realistic surface texture, natural grain, high resolution footage.');lastVideoTool=tool;}
 $('videoFullDurationLabel').hidden=tool!=='refine';$('videoDuration').closest('.row').hidden=tool==='refine'&&$('videoFullDuration').checked;
 $('guidedInputs').hidden=!guided;$('guidedParameters').hidden=!guided;$('refineAdvanced').hidden=tool!=='refine';
 $('videoChoose').hidden=tool==='refine';$('videoCurrent').hidden=tool==='refine';$('videoFile').hidden=tool==='refine';$('videoChoose').textContent=tool==='layout'?'Open finished reference image':'Open image';
 $('videoQuality').closest('.row').hidden=guided;$('videoAudio').closest('label').hidden=guided;
 $('videoDuration').closest('.row').querySelector('label').textContent=guided?'Process first':'Duration';
 document.querySelector('label[for=videoPrompt]').textContent=guided?'Finished look':'Motion prompt';$('videoApp').querySelector('h1').textContent=tool==='layout'?'From blocking to finished shot.':tool==='refine'?'Sharper detail. Same shot.':'Bring your render to life.';$('videoChooseClip').textContent=tool==='layout'?'Open Blender / clay video':'Open video to refine';
 $('guidedHelp').textContent=tool==='layout'?'Use a Blender playblast and a finished image from the same first-frame camera. The clip guides motion; the image guides materials and lighting.':'Refines fine detail and can upscale. Generated detail may differ from the original; inspect faces, text and geometry. No new sound is generated.';
 let uhd=$('videoResolution').querySelector('option[value="uhd"]');if(!uhd){uhd=document.createElement('option');uhd.value='uhd';uhd.textContent='3840 × 2176 · 4K / very demanding';$('videoResolution').append(uhd);}uhd.hidden=tool!=='refine';uhd.disabled=tool!=='refine';if(tool!=='refine'&&$('videoResolution').value==='uhd')$('videoResolution').value='small';
 $('videoLoraStrengthValue').textContent=Number($('videoLoraStrength').value).toFixed(2);$('videoGuideStrengthValue').textContent=Number($('videoGuideStrength').value).toFixed(2);$('videoOverlapValue').textContent=Math.round(Number($('videoOverlap').value)*100)+'%';videoWarning();videoEnable();
}
function videoSetClip(clip){if(!clip)return;videoClip=clip;$('guidedPreview').src=clip.url;$('guidedPreview').poster=clip.poster;$('guidedPreview').hidden=false;$('videoClipInfo').textContent=clip.name+' · '+clip.width+' × '+clip.height+' · '+clip.duration.toFixed(1)+' sec · '+clip.fps.toFixed(2)+' fps';if($('videoTool').value==='refine'){$('videoSource').src=clip.poster;$('videoSource').hidden=false;$('videoPlayer').hidden=true;$('videoEmpty').hidden=true;}videoEnable();}
function videoWarning(){
 const s=videoSettings(),high=['large','full','uhd'].includes(s.resolution)||(s.duration>=6&&!['small','test'].includes(s.resolution)),warn=high||s.task!=='image'||s.quality==='refined'||s.duration>4||s.resolution==='hd';
 $('videoRisk').dataset.risk=high?'high':'normal';
 $('videoRisk').textContent=(high?'HIGH MEMORY RISK · Your 16 GB GPU may not support this combination. It may fail with an out-of-memory error. ':warn?'GPU MEMORY WARNING · This option may exceed the memory of your 16 GB GPU. ':'16 GB GPU · Start with 2 seconds, 512 × 320, Draft. ')+(s.task==='layout'?'3D Blocking uses two sampling passes. ':s.task==='refine'?(s.fullDuration?'Full input duration · the whole clip is processed; long videos need more RAM and time. ':'')+'Refine uses tiled processing; 4K can take a long time and needs substantial system RAM. ':s.quality==='refined'?'Refined adds a learned upscale and a second sampling pass. ':'')+'These are estimates; this workflow has not been benchmarked on this computer.';
}
function applyVideoUI(){const active=task==='video';$('imageApp').hidden=active;$('videoApp').hidden=!active;$('tabVideo').setAttribute('aria-selected',String(active));if(!active){$('videoPlayer').pause();videoComparisonClose();}else {videoRefresh();videoLoadHistory();}}
function videoEnable(){
 const tool=$('videoTool').value,guided=tool!=='image';
 const required=videoState?.models?.filter(m=>m.dir==='loras'?m.mode===tool:!m.optional||tool==='layout'||!guided&&$('videoQuality').value==='refined')||[];
 const ready=videoState?.connected&&(guided?videoState.guidedNodesReady:videoState.nodesReady)&&required.length>0&&required.every(m=>m.ready);
 const locked=videoBusy||busy||downloading||restartingUI;
 for(const id of ['videoFullDuration','videoTextDevice','videoTool','videoChooseClip','videoLoraStrength','videoGuideStrength','videoPreserveAudio','videoTile','videoOverlap','videoWindow','videoChoose','videoCurrent','videoDuration','videoResolution','videoQuality','videoPrompt','videoSeed','videoAudio','videoRandom','videoSeedLock','videoInstall','videoConnect','videoBack','videoStart','videoRestart'])$(id).disabled=locked;
 $('tabVideo').disabled=busy||downloading||restartingUI;
 $('videoGenerate').disabled=locked||videoPromptPending||!ready||(guided?!videoClip||tool==='layout'&&!videoSource:!videoSource);
 $('videoGenerate').textContent=tool==='layout'?'Render from 3D Blocking ↗':tool==='refine'?'Refine video ↗':'Generate video ↗';
 $('videoCancel').hidden=!videoBusy;$('videoSave').disabled=!videoEntry;$('videoExport').disabled=!videoEntry;
 $('videoShowSource').disabled=!videoSource;$('videoShowResult').disabled=!videoEntry;
 $('videoReadiness').textContent=!videoState?.connected?'ComfyUI is offline. Start the local engine.':!(guided?videoState.guidedNodesReady:videoState.nodesReady)?'Restart ComfyUI to load the required nodes.':ready?'Models ready · '+videoState.gpu:required.filter(m=>!m.ready).length+' model files missing. Each LoRA requires access on its own official Hugging Face page.';
 $('videoSizeInfo').textContent=(required.reduce((n,m)=>n+m.size,0)/1e9).toFixed(1)+' GB total for this tool · shared files are reused · saved on F:.';$('videoInstall').textContent=guided?'Install models + '+(tool==='layout'?'Layout LoRA':'Refine LoRA'):'Install LTX 2.5 models';
 $('videoConnect').textContent=videoState?.tokenSaved?'Hugging Face connection':'Connect Hugging Face';
 $('videoInstall').hidden=!!ready;
 if(!ready&&!videoBusy)$('videoSetup').open=true;
}
async function videoRefresh(){if(videoPolling)return;videoPolling=true;try{videoState=await api.videoStatus();videoBusy=!!videoState.busy;videoEnable();}catch(e){$('videoMessage').textContent=e.message;}finally{videoPolling=false;}}
async function videoAction(fn){try{return await fn();}catch(e){$('videoMessage').textContent=e.message;}finally{videoEnable();}}
function videoSetSource(s){if(!s)return;videoSource=s;$('videoSource').src=s.url;$('videoSource').hidden=false;$('videoPlayer').hidden=true;$('videoPlayer').pause();$('videoEmpty').hidden=true;$('videoFile').textContent=s.name+' · '+s.width+' × '+s.height;videoEnable();if($('videoAutoPrompt')?.checked)videoDescribeSource(s);}
async function videoDescribeSource(s,force=false){if($('videoTool').value==='refine')return;const request=++videoPromptRequest,originalPrompt=$('videoPrompt').value;try{if(!(await api.assistantStatus()).connected){$('videoMessage').textContent='Connect Gemini to generate a motion prompt from your image.';return;}if(request!==videoPromptRequest)return;videoPromptPending=true;videoEnable();$('videoMessage').textContent='Gemini is reading the reference image…';const result=await api.assistantVideoImage({image:s.url,tool:$('videoTool').value});if(request===videoPromptRequest&&videoSource===s&&!videoBusy&&(force||$('videoPrompt').value===originalPrompt)){$('videoPrompt').value=result.text;$('videoMessage').textContent='Motion prompt generated from your reference. Review it before generating video.';}}catch(e){if(request===videoPromptRequest)$('videoMessage').textContent='Image prompt: '+e.message;}finally{if(request===videoPromptRequest){videoPromptPending=false;videoEnable();}}}
function videoShow(e){videoEntry=e;$('videoPlayer').src=e.url;$('videoPlayer').hidden=false;$('videoSource').hidden=true;$('videoEmpty').hidden=true;videoEnable();videoComparisonShow(e);if(task==='video')queueMicrotask(()=>$('videoPlayer').closest('.mediaInspector')?.scrollIntoView({block:'nearest'}));}
async function videoLoadHistory(){try{const entries=(await api.videoHistory()).filter(e=>e.kind!=='audio'),list=$('videoHistory');list.replaceChildren();if(!entries.length){list.textContent='Completed videos will appear here automatically.';return;}for(const e of entries){const card=document.createElement('article'),img=document.createElement('img'),p=document.createElement('p');img.src=e.poster;img.alt=e.name;p.textContent=e.name+' · '+new Date(e.created).toLocaleString()+' · '+e.settings.width+' × '+e.settings.height+' · '+Number(e.settings.duration).toFixed(1)+'s · '+e.settings.quality;card.append(img,p);function button(label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=()=>videoAction(fn);card.append(b);}button('Play',async()=>{videoShow(e);await $('videoPlayer').play();});button('Reuse',async()=>{const r=await api.videoReuse(e.id);$('videoTool').value=['layout','refine'].includes(r.settings.task)?r.settings.task:'image';videoToolUI(false);lastVideoTool=$('videoTool').value;videoSetSource(r.source);if(r.clip)videoSetClip(r.clip);for(const [k,id] of Object.entries({prompt:'videoPrompt',duration:'videoDuration',resolution:'videoResolution',quality:'videoQuality',seed:'videoSeed',audio:'videoAudio',strength:'videoLoraStrength',guideStrength:'videoGuideStrength',overlap:'videoOverlap',tile:'videoTile',window:'videoWindow',preserveAudio:'videoPreserveAudio',textDevice:'videoTextDevice',fullDuration:'videoFullDuration'})){if(k==='audio'||k==='preserveAudio'||k==='fullDuration')$(id).checked=!!r.settings[k];else if(r.settings[k]!==undefined)$(id).value=k==='resolution'&&r.settings[k]==='test'?'small':r.settings[k];}videoToolUI(false);videoWarning();videoEnable();});button('Download MP4',()=>api.videoSave(e.id));button('Delete',async()=>{if(await api.videoDelete(e.id)){if(videoEntry?.id===e.id){videoComparisonClose();if(videoComparison)videoComparison.button.hidden=true;$('videoPlayer').pause();$('videoPlayer').removeAttribute('src');$('videoPlayer').load();$('videoPlayer').hidden=true;$('videoEmpty').hidden=false;videoEntry=null;videoEnable();}await videoLoadHistory();}});list.append(card);}}catch(e){$('videoMessage').textContent=e.message;}}
function initializeVideo(){const auto=document.createElement('label');auto.className='peopleToggle';auto.innerHTML='<input id="videoAutoPrompt" type="checkbox" checked> Generate prompt from input with Gemini';$('videoPrompt').before(auto);const retry=document.createElement('button');retry.id='videoDescribeImage';retry.textContent='Generate prompt from image ✦';retry.onclick=()=>{if(videoSource)videoDescribeSource(videoSource,true);};$('videoPrompt').after(retry);const note=document.createElement('small');note.textContent='Sends a resized reference image to your Gemini connection. You can edit the suggestion.';retry.after(note);

 $('videoFullDuration').onchange=()=>videoToolUI(false);
 $('videoTool').onchange=()=>videoToolUI();
 $('videoChooseClip').onclick=()=>videoAction(async()=>videoSetClip(await api.videoChooseClip()));
 for(const id of ['videoLoraStrength','videoGuideStrength','videoOverlap'])$(id).oninput=()=>videoToolUI(false);
 $('tabVideo').onclick=()=>switchTask('video');$('videoBack').onclick=()=>switchTask('enhance');
 $('videoChoose').onclick=()=>videoAction(async()=>videoSetSource(await api.videoChoose()));$('videoCurrent').onclick=()=>videoAction(async()=>videoSetSource(await api.videoCurrent()));
 for(const id of ['videoDuration','videoResolution','videoQuality'])$(id).onchange=()=>{videoWarning();videoEnable();};
 $('videoSeedLock').onclick=()=>{videoSeedLocked=!videoSeedLocked;$('videoSeedLock').textContent=videoSeedLocked?'Seed locked':'New seed each run';$('videoSeedLock').setAttribute('aria-pressed',String(videoSeedLocked));};
 $('videoRandom').onclick=()=>{$('videoSeed').value=crypto.getRandomValues(new Uint32Array(1))[0];};
 $('videoGenerate').onclick=()=>videoAction(async()=>{videoBusy=true;videoEnable();try{if(!videoSeedLocked)$('videoSeed').value=crypto.getRandomValues(new Uint32Array(1))[0];await api.videoGenerate(videoSettings());}catch(e){videoBusy=false;throw e;}});
 $('videoInstall').onclick=()=>videoAction(async()=>{await api.videoInstall($('videoTool').value==='image'?$('videoQuality').value:$('videoTool').value);videoBusy=true;videoEnable();});
 $('videoCancel').onclick=()=>videoAction(()=>api.videoCancel());
 $('videoStart').onclick=()=>videoAction(async()=>{await api.openComfy();$('videoMessage').textContent='Starting ComfyUI. Wait for the local engine to connect…';});
 $('videoRestart').onclick=()=>videoAction(async()=>{$('videoMessage').textContent='Restarting ComfyUI…';await api.restartComfy();await videoRefresh();});
 $('videoSave').onclick=()=>videoAction(async()=>{const p=await api.videoSave(videoEntry?.id);if(p)$('videoMessage').textContent='Saved: '+p;});
 $('videoExport').onclick=()=>videoAction(async()=>{const p=await api.videoExport(videoEntry?.id);if(p)$('videoMessage').textContent='Workflow saved: '+p;});
 $('videoShowSource').onclick=()=>{videoComparisonClose();$('videoPlayer').pause();$('videoPlayer').hidden=true;$('videoSource').hidden=false;};$('videoShowResult').onclick=()=>{if(videoEntry)videoShow(videoEntry);};
 $('videoHistoryRefresh').onclick=()=>videoLoadHistory();
 $('videoConnect').onclick=()=>{$('videoToken').value='';$('videoConnectionMessage').textContent=videoState?.tokenSaved?'A read token is saved on this computer.':'';$('videoConnectDialog').showModal();};
 $('videoModelPage').onclick=()=>api.videoModelPage($('videoTool').value);$('videoTokenPage').onclick=()=>api.videoTokenPage();
 $('videoTokenSave').onclick=async()=>{try{await api.videoToken($('videoToken').value);$('videoConnectionMessage').textContent='Connection saved encrypted. You can now install the models.';await videoRefresh();}catch(e){$('videoConnectionMessage').textContent=e.message;}finally{$('videoToken').value='';}};
 $('videoDisconnect').onclick=async()=>{try{await api.videoDisconnect();$('videoConnectionMessage').textContent='Saved token removed.';await videoRefresh();}catch(e){$('videoConnectionMessage').textContent=e.message;}};
 $('videoConnectClose').onclick=()=>{$('videoToken').value='';$('videoConnectDialog').close();};$('videoConnectDialog').addEventListener('cancel',()=>{$('videoToken').value='';});
 api.onVideoUpdate(e=>{if(e.message)$('videoMessage').textContent=e.message;
  if(['working','download'].includes(e.type))videoBusy=true;
  if(e.type==='download'||e.type==='progress'){$('videoProgress').hidden=false;if(Number.isFinite(e.percent))$('videoProgress').value=e.percent;else $('videoProgress').removeAttribute('value');}
  if(e.type==='idle'){videoBusy=false;$('videoProgress').hidden=true;videoRefresh();}
  if(e.type==='done'&&e.entry?.kind!=='audio'){videoShow(e.entry);videoLoadHistory();}
  videoEnable();
 });
 videoToolUI(false);videoWarning();videoEnable();setInterval(()=>{if(task==='video')videoRefresh();},10000);
}

// Both players use the result clock; the input never plays a second audio track.
let videoComparison=null;
function videoComparisonClose(){if(!videoComparison)return;videoComparison.after.pause();videoComparison.before.pause();videoComparison.panel.hidden=true;$('videoPlayer').closest('.videoStage').hidden=false;}
function videoComparisonShow(entry){
 if(!videoComparison){
  const panel=document.createElement('section');panel.className='videoComparison';panel.hidden=true;
  panel.innerHTML='<div class="videoCompareStage"><video class="compareAfter" preload="metadata" playsinline></video><video class="compareBefore" preload="metadata" playsinline muted></video><span class="compareBeforeLabel">Before</span><span class="compareAfterLabel">After</span><div class="compareDivider"></div></div><label>Before / After<input class="compareWipe" type="range" min="0" max="100" value="50" aria-label="Before and after comparison"></label><div class="actions"><button class="comparePlay">Play</button><input class="compareSeek" type="range" min="0" max="1000" value="0" aria-label="Comparison video position"><output class="compareTime">0.0s</output><button class="compareMute">Mute</button></div><p class="hint">Drag the comparison bar · both videos show the same time. Output is processed at 24 fps.</p>';
  $('videoPlayer').closest('.videoStage').after(panel);
  const before=panel.querySelector('.compareBefore'),after=panel.querySelector('.compareAfter'),wipe=panel.querySelector('.compareWipe'),seek=panel.querySelector('.compareSeek'),play=panel.querySelector('.comparePlay'),time=panel.querySelector('.compareTime');
  const button=document.createElement('button');button.textContent='Before / After';button.hidden=true;$('videoShowResult').after(button);
  videoComparison={panel,before,after,button};
  const align=(force=false)=>{if(before.readyState&&Number.isFinite(after.currentTime)&&(force||Math.abs(before.currentTime-after.currentTime)>0.08))before.currentTime=Math.min(after.currentTime,Number.isFinite(before.duration)?Math.max(0,before.duration-0.001):after.currentTime);};
  const draw=()=>{if(!after.paused&&!panel.hidden){align();requestAnimationFrame(draw);}};
  wipe.oninput=()=>{before.style.clipPath='inset(0 '+(100-Number(wipe.value))+'% 0 0)';panel.querySelector('.compareDivider').style.left=wipe.value+'%';};wipe.oninput();
  seek.oninput=()=>{if(Number.isFinite(after.duration)){after.currentTime=Number(seek.value)/1000*after.duration;align(true);}};
  after.addEventListener('seeked',()=>align(true));before.addEventListener('loadedmetadata',()=>align(true));
  after.addEventListener('timeupdate',()=>{seek.value=after.duration?after.currentTime/after.duration*1000:0;time.textContent=after.currentTime.toFixed(1)+' / '+(after.duration||0).toFixed(1)+'s';align();});
  after.addEventListener('play',()=>{play.textContent='Pause';align(true);before.play().catch(()=>{});draw();});
  for(const name of ['pause','ended'])after.addEventListener(name,()=>{before.pause();play.textContent='Play';});
  after.addEventListener('waiting',()=>before.pause());after.addEventListener('playing',()=>{if(before.paused)before.play().catch(()=>{});});
  play.onclick=()=>{if(after.paused)after.play().catch(e=>$('videoMessage').textContent=e.message);else after.pause();};
  panel.querySelector('.compareMute').onclick=()=>{after.muted=!after.muted;panel.querySelector('.compareMute').textContent=after.muted?'Unmute':'Mute';};
  for(const media of [before,after])media.addEventListener('error',()=>{$('videoMessage').textContent='This video could not be loaded for comparison. Reuse the result to check its source file.';});
  button.onclick=()=>{if(!panel.hidden){videoComparisonClose();return;}$('videoPlayer').pause();$('videoPlayer').closest('.videoStage').hidden=true;panel.hidden=false;align(true);};
 }
 videoComparisonClose();videoComparison.button.hidden=entry.settings?.task!=='refine'||!entry.beforeUrl;
 if(!videoComparison.button.hidden){videoComparison.before.src=entry.beforeUrl;videoComparison.after.src=entry.url;videoComparison.panel.querySelector('.compareSeek').value=0;videoComparison.after.muted=true;videoComparison.panel.querySelector('.compareMute').textContent='Unmute';if(task==='video')videoComparison.button.click();}
}
