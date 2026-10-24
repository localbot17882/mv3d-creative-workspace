'use strict';
function initializeOperationProgress(){
 const box=document.getElementById('operationProgress'),bar=document.getElementById('operationBar'),title=document.getElementById('operationTitle'),info=document.getElementById('operationInfo');
 let started=0,lastPercent=0,downloadStart=0,downloadPercent=0,lastMessage='',revision=0,timer=null;
 function duration(s){if(s<60)return Math.max(1,Math.round(s))+' sec';if(s<3600)return Math.ceil(s/60)+' min';return (s/3600).toFixed(1)+' hr';}
 function render(d){
  const terminal=['done','detectionDone','downloadDone','installed','error','operationDone','operationError'].includes(d.type);
  if(['working','download','progress','operationStart'].includes(d.type)){
   revision++;if(!started)started=Date.now();box.hidden=false;
   let eta=Number.isFinite(d.etaSeconds)?d.etaSeconds:null;
   const p=Number.isFinite(d.percent)?Math.max(0,Math.min(100,d.percent)):null;
   if(d.type==='download'&&p!==null){if(!downloadStart||p<lastPercent||d.message!==lastMessage&&p===0){downloadStart=Date.now();downloadPercent=p;}if(Date.now()-downloadStart>5000&&p-downloadPercent>0.1)eta=(Date.now()-downloadStart)/1000/(p-downloadPercent)*(100-p);}
   title.textContent=d.stage||d.message||'Processing…';
   if(p===null)bar.removeAttribute('value');else bar.value=p;
   info.textContent=(p===null?'Progress unavailable':Math.floor(p)+'%'+(d.estimated?' · estimated overall progress':''))+' · '+(eta===null?'Remaining: calculating…':'About '+duration(eta)+' remaining')+' · Elapsed '+duration((Date.now()-started)/1000);
   lastPercent=p??lastPercent;lastMessage=d.message;
  }else if(terminal){revision++;const token=revision;title.textContent=d.message||(['error','operationError'].includes(d.type)?'Operation stopped':'Complete');bar.value=['error','operationError'].includes(d.type)?lastPercent:100;info.textContent=['error','operationError'].includes(d.type)?'Review the message above.':'100% · Finished';started=0;downloadStart=0;clearTimeout(timer);timer=setTimeout(()=>{if(token===revision)box.hidden=true;},5000);}
 }
 window.ppglab.onUpdate(render);window.ppglab.onVideoUpdate(render);
 window.ppglab.onCanvasUpdate?.(e=>{if(e.type==='progress')render({type:'progress',stage:'Canvas · '+(e.stage||'Processing'),percent:Number.isFinite(e.percent)?Math.min(99,(e.completed+e.percent/100)/(e.total||1)*100):undefined,estimated:true});else if(e.type==='working')render({type:'operationStart',message:'Canvas workflow'});else if(['done','error'].includes(e.type))render(e);});
 setInterval(()=>{if(started&&!box.hidden)info.textContent=info.textContent.replace(/Elapsed .*/,'Elapsed '+duration((Date.now()-started)/1000));},1000);
}
