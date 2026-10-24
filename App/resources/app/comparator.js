'use strict';
function createComparator({canvas,layer,before,divider,readout,onPosition}){
 let width=0,height=0,zoom=1,x=0,y=0,position=50,drag=null;
 const fit=()=>width&&height?Math.min(canvas.clientWidth/width,canvas.clientHeight/height):1;
 function paint(){if(!width||!height)return;const f=fit(),w=width*f,h=height*f;const mx=Math.max(0,(w*zoom-canvas.clientWidth)/2),my=Math.max(0,(h*zoom-canvas.clientHeight)/2);x=Math.max(-mx,Math.min(mx,x));y=Math.max(-my,Math.min(my,y));layer.style.width=w+'px';layer.style.height=h+'px';layer.style.transform='translate('+x+'px,'+y+'px) scale('+zoom+')';readout.textContent=Math.round(f*zoom*100)+' %';before.style.clipPath='inset(0 '+(100-position)+'% 0 0)';divider.style.left=position+'%';divider.style.setProperty('--handle-scale',1/zoom);divider.setAttribute('aria-valuenow',Math.round(position));}
 function reset(){zoom=1;x=y=0;paint();}function change(next,mx=0,my=0){if(!width)return;next=Math.max(1,Math.min(32,next));if(next<1.015)next=1;const r=next/zoom;x=mx-(mx-x)*r;y=my-(my-y)*r;zoom=next;if(zoom===1)x=y=0;paint();}
 function setPosition(v){position=Math.max(0,Math.min(100,v));paint();if(onPosition)onPosition(position);}
 function slide(e){const r=layer.getBoundingClientRect();if(r.width)setPosition((e.clientX-r.left)/r.width*100);}
 canvas.addEventListener('wheel',e=>{if(!width)return;e.preventDefault();const r=canvas.getBoundingClientRect();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1);change(zoom*Math.exp(-Math.max(-120,Math.min(120,delta))*.002),e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2);},{passive:false});
 canvas.addEventListener('pointerdown',e=>{if(!width||e.button!==0)return;const sliding=divider===e.target||divider.contains(e.target);drag={sliding,x:e.clientX,y:e.clientY,px:x,py:y,id:e.pointerId};canvas.setPointerCapture(e.pointerId);if(sliding)slide(e);else canvas.classList.add('panning');e.preventDefault();});
 canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;if(drag.sliding)slide(e);else{x=drag.px+e.clientX-drag.x;y=drag.py+e.clientY-drag.y;paint();}});
 function stop(){drag=null;canvas.classList.remove('panning');}for(const n of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(n,stop);
 canvas.addEventListener('dblclick',e=>{if(!divider.contains(e.target))reset();});divider.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();setPosition(e.key==='Home'?0:e.key==='End'?100:position+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?10:2));}});
 new ResizeObserver(paint).observe(canvas);
 return {setSize(w,h){width=w;height=h;reset();},reset,changeBy(r){change(zoom*r);},actual(){if(width)change(1/fit());},setPosition,paint};
}
