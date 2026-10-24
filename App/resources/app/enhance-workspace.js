'use strict';
(()=>{
 const bar=document.createElement('nav');bar.className='actions enhanceSections';bar.setAttribute('aria-label','Enhance media');
 const buttons={};let videoSection=false,pending=false,revision=0,lastSource=null,lastTask=null;
 for(const [key,label] of [['enhance','Image'],['video','Video'],['people','Render People']]){const b=document.createElement('button');b.textContent=label;b.type='button';b.onclick=()=>{if(busy||videoBusy||canvasBusy)return;videoSection=key==='video';switchTask(key);if(videoSection){$('videoTool').value='refine';videoToolUI(true);}sync();if(!videoSection)prepare();};buttons[key]=b;bar.append(b);}
 $('imageApp').before(bar);$('tabPeople').hidden=true;
 const baseApply=applyTaskUI;applyTaskUI=function(){baseApply();sync();};
 const baseEnable=enable;enable=function(){baseEnable();if(pending&&['enhance','people'].includes(task))$('generate').disabled=true;};
 function sync(){const active=['enhance','people'].includes(task)||(task==='video'&&videoSection);bar.hidden=!active;bar.style.display=active?'flex':'none';for(const [key,b] of Object.entries(buttons)){const selected=task===key;b.setAttribute('aria-pressed',String(selected));b.classList.toggle('primary',selected);b.disabled=busy||videoBusy||canvasBusy;}$('tabPeople').hidden=true;$('tabEnhance').setAttribute('aria-selected',String(active));if(active&&videoSection)$('tabVideo').setAttribute('aria-selected','false');}
 const preservation='Restore subtle natural fine detail while preserving the original subjects, identity, geometry, framing, colours, lighting, timing and motion. Do not add or remove objects, invent texture or introduce camera movement.';
 const custom=document.createElement('label');custom.innerHTML='<input id="videoRefineCustom" type="checkbox"> Advanced: use custom refinement instructions';$('refineAdvanced').append(custom);
 function refinePromptUI(){const refine=$('videoTool').value==='refine',creative=$('videoRefineCustom').checked;for(const id of ['videoPrompt','videoDescribeImage'])$(id).hidden=refine&&!creative;$('videoAutoPrompt').closest('label').hidden=refine;const note=$('videoDescribeImage').nextElementSibling;if(note?.tagName==='SMALL')note.hidden=refine;custom.hidden=!refine;if(refine&&!creative){++videoPromptRequest;videoPromptPending=false;$('videoPrompt').value=preservation;}videoEnable();}
 $('videoRefineCustom').onchange=refinePromptUI;
 const toolUI=videoToolUI;videoToolUI=function(...args){toolUI(...args);refinePromptUI();};
 const clipSetter=videoSetClip;videoSetClip=function(clip){clipSetter(clip);if(clip&&$('videoTool').value==='refine'){++videoPromptRequest;videoPromptPending=false;$('videoRefineCustom').checked=false;refinePromptUI();$('videoMessage').textContent='Ready to refine. Original scene and motion will be preserved; no AI prompt description is required.';}};
 const sourceSetter=setImageSource;setImageSource=function(selected){sourceSetter(selected);if(selected&&['enhance','people'].includes(task))prepare(true);};
 async function prepare(force=false){
  if(!['enhance','people'].includes(task)||!original)return;
  if(!force&&lastSource===original&&lastTask===task)return;
  lastSource=original;lastTask=task;pending=false;const image=original,kind=task,token=++revision;
  $('prompt').value='';$('prompt').placeholder='Load an image to build an enhancement prompt from its contents.';
  if(task==='enhance'&&selectedMode()==='seedvr2')return;
  const connected=await api.assistantStatus().catch(()=>null);if(token!==revision||original!==image||task!==kind)return;
  if(!connected?.connected){message('Image loaded. Connect the assistant to analyse it, or write your enhancement instructions.');return;}
  pending=true;enable();message('Analysing your reference image…');
  try{const result=await api.assistantEnhanceImage({image:image.url,tool:kind});if(token===revision&&original===image&&task===kind&&!$('prompt').value.trim()){$('prompt').value=result.text;message('Enhancement prompt prepared from your reference image. Review or edit it before running.');}}
  catch(e){if(token===revision)message('Could not analyse the reference. '+e.message+' You can write your own instructions.');}
  finally{if(token===revision){pending=false;enable();}}
 }
 $('tabEnhance').onclick=()=>{videoSection=false;switchTask('enhance');sync();prepare();};
 const videoTab=$('tabVideo').onclick;$('tabVideo').onclick=()=>{videoSection=false;videoTab?.();sync();};
 $('preset').onchange=()=>{for(const [id,value] of [['creativity',10],['fidelity',0],['detail',0],['contrast',0],['steps',4]]){$(id).value=value;$(id).oninput?.();}prepare(true);};
 if(task==='enhance')$('prompt').value='';
 refinePromptUI();sync();
})();
