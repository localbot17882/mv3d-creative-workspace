'use strict';
function initializeFileDrop(){
 const images=/\.(png|jpe?g|webp)$/i,videos=/\.(mp4|mov|mkv|webm)$/i;
 let loading=false;
 const fileDrag=e=>Array.from(e.dataTransfer?.types||[]).includes('Files');
 const clear=()=>{document.body.classList.remove('draggingFiles');};
 function destination(target){
  if(target?.closest?.('#tabPost,#postDialog'))return 'post';
  if(document.querySelector('dialog[open]'))throw Error('Close this dialog before dropping a file.');
  if(task==='canvas')return 'canvas';if(task==='studio')return 'studio';
  if(task==='audio')throw Error('Audio generation uses a text prompt. Switch to an image or video tool to drop a file.');
  return task==='video'?$('videoTool').value:'image';
 }
 function locked(){return loading||busy||videoBusy||canvasBusy||downloading||restartingUI||postBusy;}
 document.addEventListener('dragover',e=>{
  if(!fileDrag(e))return;e.preventDefault();
  try{if(locked())throw Error('Wait for the current operation to finish.');const mode=destination(e.target);document.body.dataset.dropMessage=mode==='canvas'?'Drop image, video or audio into Canvas':mode==='post'?'Drop image for post-production':mode==='refine'?'Drop video to refine':mode==='layout'?'Drop reference image or source video':'Drop image to load';document.body.classList.add('draggingFiles');e.dataTransfer.dropEffect='copy';}
  catch{clear();e.dataTransfer.dropEffect='none';}
 });
 document.addEventListener('dragleave',e=>{if(!e.relatedTarget)clear();});
 window.addEventListener('blur',clear);
 document.addEventListener('dragend',clear);
 document.addEventListener('drop',async e=>{
  if(!fileDrag(e)&&!e.dataTransfer?.files?.length)return;e.preventDefault();clear();
  const error=err=>{const text=err.message.replace(/^Error invoking remote method '[^']+': Error: /,'');if($('postDialog').open)$('postStatus').textContent=text;else if(task==='video')$('videoMessage').textContent=text;else if(task==='studio')$('studioMessage').textContent=text;else message(text);};
  try{
   if(locked())throw Error('Wait for the current operation to finish.');
   const files=Array.from(e.dataTransfer.files);if(files.length!==1)throw Error('Drop one image or video at a time.');
   const mode=destination(e.target),file=files[0];loading=true;
   if(mode==='canvas'){await canvasImportDropped(file,e.clientX,e.clientY);}
   else if(mode==='studio'){if(!images.test(file.name))throw Error('Drop a PNG, JPG or WebP image.');studioSetSource(await api.dropFile(file,'studio'));}
   else if(mode==='post'){if(!images.test(file.name))throw Error('Drop a PNG, JPG or WebP image.');await openPost(null,file);}
   else if(mode==='refine'||mode==='layout'&&videos.test(file.name)){if(!videos.test(file.name))throw Error('Drop an MP4, MOV, MKV or WebM video.');videoSetClip(await api.dropFile(file,'clip'));}
   else {if(!images.test(file.name))throw Error('Drop a PNG, JPG or WebP image.');if(task==='video')videoSetSource(await api.dropFile(file,'videoImage'));else {const ref=await api.dropFile(file,'image');setImageSource(ref);if(task==='characters'){characterReference=true;$('characterReferenceInfo').textContent=ref.name;$('characterMode').value='reference';$('characterSteps').value=4;characterEnable();}}}
  }catch(e){error(e);}finally{loading=false;}
 });
 for(const id of ['videoChoose','videoChooseClip'])$(id).title='Click to browse, or drag and drop your file onto this workspace.';
 $('videoEmpty').querySelector('p')?.append(' Drag and drop a file here to start.');
 $('tabPost').title='Open post-production, or drop an image onto this button.';
}
