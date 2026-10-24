'use strict';
const peopleDefaultPrompt='Photorealistic people in an architectural photograph, natural human anatomy, realistic faces and hands, detailed natural skin and fabric, coherent lighting and shadows. Preserve the existing number of people, their pose, position, clothing colours and scale.';
const peopleKeys=['peopleConfidence','peopleDenoise','peopleControl','peopleMaskExpansion','peopleFeather','peopleCropFactor','peopleGuideSize','peopleCfg'];
let peopleMaskUrl=null,peopleCount=null,peopleMaskRevision=0,peopleMaskPng=null,peopleMaskHasPixels=false;
let peopleRegions=[],peopleSelected=new Set(),peopleImportedMask=null,peoplePaintStrokes=[];
function peopleSettings(){return {...Object.fromEntries(peopleKeys.map(key=>[key,Number($(key).value)])),peopleSam:$('peopleSam').checked,peopleNegative:$('peopleNegative').value,...(peopleMaskPng?{peopleMaskPng,peopleSelectedIds:[...peopleSelected],peopleMaskEdited:peoplePaintStrokes.length>0||!!peopleImportedMask}:{})};}
function updatePeopleValues(){for(const key of ['peopleConfidence','peopleDenoise','peopleControl'])$(key+'Val').textContent=Math.round(Number($(key).value)*100)+' %';}
function enablePeople(){
 const locked=busy||downloading||restartingUI;
 for(const key of [...peopleKeys,'peopleSam','peopleNegative'])$(key).disabled=locked;
 const detectionModels=state?.models?.filter(m=>['ultralytics/segm','sams'].includes(m.dir))||[];
 $('peopleDetect').disabled=locked||!original||!state?.connected||!state?.engines?.people?.workflowReady||detectionModels.length!==2||detectionModels.some(m=>!m.ready);
 $('peopleShowMasks').disabled=!peopleMaskUrl||busy;$('peopleEditMask').disabled=locked||!original;
 for(const id of ['peopleSelectAll','peopleSelectNone'])$(id).disabled=locked||!peopleRegions.length;
 for(const input of $('peopleList').querySelectorAll('input'))input.disabled=locked;
 for(const button of $('peopleMarkers').querySelectorAll('button'))button.disabled=locked;
 if(task==='people'&&((peopleMaskPng&&!peopleMaskHasPixels)||(!peopleMaskPng&&peopleCount===0)))$('generate').disabled=true;
}
function updatePeopleOverlay(){const visible=task==='people'&&$('peopleShowMasks').checked&&!!peopleMaskUrl;$('peopleMaskOverlay').hidden=!visible;$('peopleMarkers').hidden=!visible||!peopleRegions.length;if(peopleMaskUrl)$('peopleMaskOverlay').src=peopleMaskUrl;}
function resetPeopleDetection(){
 peopleMaskRevision++;peopleMaskUrl=null;peopleMaskPng=null;peopleCount=null;peopleMaskHasPixels=false;peopleRegions=[];peopleSelected=new Set();peopleImportedMask=null;peoplePaintStrokes=[];
 $('peopleShowMasks').checked=false;$('peopleMaskOverlay').removeAttribute('src');$('peopleList').replaceChildren();$('peopleMarkers').replaceChildren();updatePeopleOverlay();
 $('peopleSelectionStatus').textContent='Select people individually after detection, or paint a missing person.';
 $('peopleDetectionStatus').textContent=original?'Detection runs automatically when enhancing. Preview the masks first to check the selection.':'Load a render to detect people.';
}
async function loadPeopleAlphaMask(url){
 const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Could not read the edit mask.'));image.src=url;});
 const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext('2d');context.drawImage(image,0,0);const pixels=context.getImageData(0,0,canvas.width,canvas.height);
 for(let i=0;i<pixels.data.length;i+=4){const alpha=pixels.data[i];pixels.data[i]=242;pixels.data[i+1]=255;pixels.data[i+2]=89;pixels.data[i+3]=alpha;}context.putImageData(pixels,0,0);return canvas;
}
function buildPeopleBaseMask(){const canvas=document.createElement('canvas');canvas.width=original.width;canvas.height=original.height;const context=canvas.getContext('2d');if(peopleImportedMask)context.drawImage(peopleImportedMask,0,0);for(const person of peopleRegions)if(peopleSelected.has(person.id))context.drawImage(person.canvas,person.crop[0],person.crop[1]);return canvas;}
function rebuildPeopleMask(){
 const mask=buildPeopleBaseMask(),context=mask.getContext('2d');for(const stroke of peoplePaintStrokes)drawMaskStroke(context,stroke);
 const pixels=context.getImageData(0,0,mask.width,mask.height).data;peopleMaskHasPixels=false;for(let i=3;i<pixels.length;i+=4)if(pixels[i]){peopleMaskHasPixels=true;break;}
 const output=document.createElement('canvas');output.width=mask.width;output.height=mask.height;const out=output.getContext('2d');out.drawImage(mask,0,0);out.globalCompositeOperation='source-in';out.fillStyle='white';out.fillRect(0,0,mask.width,mask.height);out.globalCompositeOperation='destination-over';out.fillStyle='black';out.fillRect(0,0,mask.width,mask.height);peopleMaskPng=output.toDataURL('image/png');
 const preview=document.createElement('canvas'),scale=Math.min(1,1800/Math.max(mask.width,mask.height));preview.width=Math.max(1,Math.round(mask.width*scale));preview.height=Math.max(1,Math.round(mask.height*scale));preview.getContext('2d').drawImage(mask,0,0,preview.width,preview.height);peopleMaskUrl=preview.toDataURL('image/png');$('peopleMaskOverlay').style.opacity='.55';
 $('peopleSelectionStatus').textContent=(peopleRegions.length?peopleSelected.size+' of '+peopleRegions.length+' people selected. ':'')+(peoplePaintStrokes.length?'Brush corrections applied.':peopleImportedMask?'Saved mask restored.':!peopleMaskHasPixels?'Select a person or paint an area to enhance.':'Only highlighted areas will change.');
 for(const person of peopleRegions){const checkbox=$('peopleList').querySelector('[data-person="'+person.id+'"]');if(checkbox)checkbox.checked=peopleSelected.has(person.id);const marker=$('peopleMarkers').querySelector('[data-person="'+person.id+'"]');if(marker)marker.setAttribute('aria-pressed',String(peopleSelected.has(person.id)));}updatePeopleOverlay();enable();
}
function togglePerson(id,selected){if(busy||downloading||restartingUI)return;if(selected)peopleSelected.add(id);else peopleSelected.delete(id);rebuildPeopleMask();}
function renderPeopleChoices(){
 $('peopleList').replaceChildren();$('peopleMarkers').replaceChildren();
 peopleRegions.forEach((person,index)=>{
  const label=document.createElement('label');label.className='personChoice';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=peopleSelected.has(person.id);checkbox.dataset.person=person.id;checkbox.setAttribute('aria-label','Select person '+(index+1));checkbox.onchange=()=>togglePerson(person.id,checkbox.checked);
  const thumbnail=document.createElement('canvas');thumbnail.width=45;thumbnail.height=60;const [x1,y1,x2,y2]=person.bbox;thumbnail.getContext('2d').drawImage($('before'),x1,y1,Math.max(1,x2-x1),Math.max(1,y2-y1),0,0,45,60);const image=document.createElement('img');image.src=thumbnail.toDataURL();image.alt='Person '+(index+1);const text=document.createElement('span');text.textContent='Person '+(index+1);label.append(checkbox,image,text);$('peopleList').append(label);
  const marker=document.createElement('button');marker.textContent=String(index+1);marker.dataset.person=person.id;marker.setAttribute('aria-label','Toggle person '+(index+1));marker.setAttribute('aria-pressed',String(peopleSelected.has(person.id)));marker.style.left=(x1+x2)/2/original.width*100+'%';marker.style.top=Math.max(0,y1)/original.height*100+'%';marker.onpointerdown=e=>e.stopPropagation();marker.onclick=()=>togglePerson(person.id,!peopleSelected.has(person.id));$('peopleMarkers').append(marker);
 });
}
async function showPeopleMask(url,count,regions){
 const revision=++peopleMaskRevision,people=regions?.items||[];const loaded=await Promise.all(people.map(async person=>({...person,canvas:await loadPeopleAlphaMask(person.mask)})));const imported=loaded.length?null:await loadPeopleAlphaMask(url);if(revision!==peopleMaskRevision)return;
 peopleRegions=loaded;peopleSelected=new Set(loaded.map(person=>person.id));peopleImportedMask=imported;peoplePaintStrokes=[];peopleCount=count;$('peopleShowMasks').checked=count>0;renderPeopleChoices();rebuildPeopleMask();
 $('peopleDetectionStatus').textContent=count?count+(count===1?' person detected.':' people detected.')+' Choose the people to improve.':'No people detected. Lower the confidence or paint the missing person.';
}
async function restorePeopleMask(url){const revision=++peopleMaskRevision,mask=await loadPeopleAlphaMask(url);if(revision!==peopleMaskRevision)return;peopleRegions=[];peopleSelected=new Set();peopleImportedMask=mask;peoplePaintStrokes=[];peopleCount=null;$('peopleShowMasks').checked=true;renderPeopleChoices();rebuildPeopleMask();$('peopleDetectionStatus').textContent='Saved mask restored. Detect again if you want to select individual people.';}
function applyPeopleUI(){
 const people=task==='people';$('peopleControls').hidden=!people;$('tabPeople').setAttribute('aria-selected',String(people));$('tabEnhance').setAttribute('aria-selected',String(task==='enhance'));$('taskEyebrow').textContent=people?'02 / IMPROVE PEOPLE':'02 / ENHANCE';document.querySelector('.promptlabel').textContent=people?'Describe the people':'Describe materials and lighting';document.querySelector('.workspace h1').textContent=people?'Real people. Same scene.':'Your image. Taken further.';
 if(people){for(const id of ['mode','scale','preset'])$(id).closest('.row').hidden=true;for(const id of ['creativity','fidelity','detail','contrast','colorPreservation'])$(id).closest('.slider').hidden=true;$('modeNote').hidden=true;$('prompt').hidden=false;$('prompt').readOnly=false;document.querySelector('.promptlabel').hidden=false;$('promptHelp').hidden=false;$('promptHelp').textContent='Applies to the selected people and painted areas. Existing poses and clothes guide the result.';$('steps').closest('.row').hidden=false;$('steps').closest('details').querySelector('small').textContent='Juggernaut XL: start with 30 steps. Selected regions are refined in separate crops, capped at 1024 px.';$('generate').innerHTML='Enhance people <span>↗</span>';document.querySelector('.footnote').textContent='Local processing · no per-image credits. Pixels outside the edit masks are preserved.';}
 else{$('modeNote').hidden=false;$('promptHelp').textContent='Write your instructions in any language or edit the description.';}updatePeopleValues();updatePeopleOverlay();
}
function initializePeople(){
 $('tabPeople').onclick=()=>switchTask('people');$('peopleShowMasks').onchange=updatePeopleOverlay;
 for(const key of peopleKeys)$(key).oninput=()=>{updatePeopleValues();if(['peopleConfidence','peopleMaskExpansion','peopleCropFactor'].includes(key)){resetPeopleDetection();enable();}};$('peopleSam').onchange=()=>{resetPeopleDetection();enable();};
 $('peopleSelectAll').onclick=()=>{peopleSelected=new Set(peopleRegions.map(person=>person.id));rebuildPeopleMask();};$('peopleSelectNone').onclick=()=>{peopleSelected.clear();rebuildPeopleMask();};$('peopleEditMask').onclick=()=>guard(openPeopleMaskEditor);
 $('peopleDetect').onclick=()=>guard(async()=>{busy=true;enable();$('progress').hidden=false;$('progress').removeAttribute('value');message('Detecting people and refining silhouettes…');try{await api.peopleDetect({...settings(),task:'people',mode:'people'});}catch(error){busy=false;$('progress').hidden=true;enable();throw error;}});
 initializeMaskEditor();
}
