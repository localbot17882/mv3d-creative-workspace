'use strict';
function tracker(graph,send,{now=Date.now,settings={}}={}){
 const processing=n=>/SamplerCustomAdvanced|LTXVTiledFusionSampler|KleinTiledUpscaler|TiledUpscaleRefine|DetailerForEach/.test(n.class_type);
 const entries=Object.entries(graph),samplers=entries.filter(([,n])=>processing(n));
 const weights=new Map(entries.map(([id,n])=>[id,processing(n)?(samplers.length===2?(samplers[0][0]===id?40:50):85):/Decode|Detailer|Upscale|Detector|SAM|Guide/.test(n.class_type)?3:0.2]));
 const done=new Set(),total=[...weights.values()].reduce((a,b)=>a+b,0);let active=null,fraction=0,firstTick=null,firstFraction=0,percent=0,eta=null;
 function publish(){let work=0;for(const id of done)work+=weights.get(id)||0;work+=(weights.get(active)||0)*fraction;percent=Math.min(98,Math.max(percent,100*work/Math.max(total,1)));
  const time=now();if(firstTick!==null&&time-firstTick>=5000&&percent-firstFraction>=1)eta=Math.max(0,(time-firstTick)/1000/(percent-firstFraction)*(100-percent));
  const cls=graph[active]?.class_type||'Local workflow';const stage=processing(graph[active]||{class_type:''})?(settings.task==='people'?'Enhancing people':/Upscal/.test(cls)?'Enhancing image':'Sampling'):/Decode/.test(cls)?'Decoding':/Save|CreateVideo/.test(cls)?'Saving result':/Loader/.test(cls)?'Loading models':/Detect|SEGS|SAM/.test(cls)?'Detecting people':/LoadClip/.test(cls)?'Reading source video':/Guide|Encode|Conditioning/.test(cls)?'Preparing guidance':'Preparing workflow';
  send({type:'progress',message:stage,stage,percent:Math.floor(percent),etaSeconds:eta,estimated:true});
 }
 return {event(type,data){if(type==='executing'&&data.node){if(active&&active!==String(data.node))done.add(active);active=String(data.node);fraction=0;publish();}else if(type==='execution_cached'){for(const id of data.nodes||[])done.add(String(id));publish();}else if(type==='progress'&&Number(data.max)>0){if(data.node)active=String(data.node);fraction=Math.max(0,Math.min(1,Number(data.value)/Number(data.max)));if(firstTick===null){firstTick=now();firstFraction=percent;}publish();}},finish(){send({type:'progress',message:'Saving result',stage:'Saving result',percent:99,etaSeconds:null,estimated:true});},snapshot(){return {percent,etaSeconds:eta};}};
}
function watchProgress(client,id,graph,send,settings){
 const t=tracker(graph,send,{settings});let socket;
 try{socket=new WebSocket('ws://127.0.0.1:8188/ws?clientId='+encodeURIComponent(client));socket.addEventListener('message',event=>{if(typeof event.data!=='string')return;try{const e=JSON.parse(event.data),d=e.data||{};if(d.prompt_id&&d.prompt_id!==id)return;if(['executing','execution_cached','progress'].includes(e.type))t.event(e.type,d);}catch{}});socket.addEventListener('error',()=>{});}catch{}
 return {finish:()=>t.finish(),close:()=>{try{socket?.close();}catch{}}};
}
module.exports={tracker,watchProgress};
