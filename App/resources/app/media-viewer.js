'use strict';
function initializeMediaViewers(){
 for(const id of ['storyboardLargeImage','studioPreview','characterImage','videoPlayer','videoSource','canvasPreviewImage','canvasPreviewVideo','soundtrackResult']){
  const media=document.getElementById(id);if(!media||media.closest('.mediaInspector'))continue;
  const wrap=document.createElement('section'),stage=document.createElement('div'),bar=document.createElement('div');wrap.className='mediaInspector';stage.className='mediaPanStage';stage.setAttribute('aria-label','Pan and zoom result');bar.className='mediaPanBar';media.before(wrap);wrap.append(bar,stage);stage.append(media);let zoom=1,x=0,y=0,drag=null;
  const label=document.createElement('output');label.textContent='Fit';const button=(text,title,fn)=>{const b=document.createElement('button');b.textContent=text;b.title=title;b.type='button';b.onclick=fn;bar.append(b);return b;};
  function paint(){x=Math.max(-stage.clientWidth*(zoom-1)/2,Math.min(stage.clientWidth*(zoom-1)/2,x));y=Math.max(-stage.clientHeight*(zoom-1)/2,Math.min(stage.clientHeight*(zoom-1)/2,y));media.style.transform=`translate(${x}px,${y}px) scale(${zoom})`;label.textContent=zoom===1?'Fit':Math.round(zoom*100)+'%';stage.style.cursor=zoom>1?'grab':'zoom-in';}
  function change(next,px=0,py=0){next=Math.max(1,Math.min(16,next));const ratio=next/zoom;x=px-(px-x)*ratio;y=py-(py-y)*ratio;zoom=next;paint();}
  button('−','Zoom out',()=>change(zoom/1.25));bar.append(label);button('+','Zoom in',()=>change(zoom*1.25));button('Fit','Reset pan and zoom',()=>{zoom=1;x=y=0;paint();});
  const hint=document.createElement('small');hint.textContent='Scroll to zoom · drag to pan';bar.append(hint);
  stage.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();const r=stage.getBoundingClientRect();change(zoom*Math.exp(-e.deltaY*0.002),e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2);},{passive:false});
  stage.addEventListener('pointerdown',e=>{if(e.button!==0||zoom<=1)return;e.preventDefault();e.stopPropagation();drag={id:e.pointerId,x:e.clientX,y:e.clientY,ox:x,oy:y};stage.setPointerCapture(e.pointerId);});stage.addEventListener('pointermove',e=>{if(!drag)return;x=drag.ox+e.clientX-drag.x;y=drag.oy+e.clientY-drag.y;paint();});for(const name of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(name,()=>drag=null);
  const reset=()=>{zoom=1;x=y=0;paint();};media.addEventListener('load',reset);media.addEventListener('loadedmetadata',reset);new ResizeObserver(paint).observe(stage);new MutationObserver(()=>wrap.hidden=media.hidden).observe(media,{attributes:true,attributeFilter:['hidden']});wrap.hidden=media.hidden;
  if(media.tagName==='VIDEO'){
   media.controls=false;const play=button('Play','Play or pause video',()=>{if(media.paused)media.play().catch(e=>label.textContent=e.message);else media.pause();});const seek=document.createElement('input');seek.type='range';seek.min=0;seek.max=1000;seek.value=0;seek.setAttribute('aria-label','Video position');seek.oninput=()=>{if(Number.isFinite(media.duration))media.currentTime=Number(seek.value)/1000*media.duration;};bar.append(seek);button('Mute','Toggle video sound',()=>media.muted=!media.muted);media.addEventListener('timeupdate',()=>{seek.value=media.duration?media.currentTime/media.duration*1000:0;});media.addEventListener('play',()=>play.textContent='Pause');media.addEventListener('pause',()=>play.textContent='Play');
  }
 }
}
