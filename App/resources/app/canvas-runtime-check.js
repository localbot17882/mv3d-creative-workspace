'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const graph=require('./canvas-graph');
module.exports=async function({root,invoke,observe}){
 const report={started:new Date().toISOString()},events=[];let finish;
 observe(e=>{events.push({...e,project:undefined});if(e.type==='idle')finish?.();});
 if(process.argv.includes('--comfy-lab-canvas-ai-check')){
  let result;
  try{const saved=JSON.parse(await fs.readFile(path.join(root,'setup/canvas-runtime-results.json'),'utf8'));const proposal=await invoke('assistant-workflow',{project:saved.project,idea:'Create a local workflow using my source image: enhance the image, animate it into a two-second video, generate two seconds of outdoor ambience and add this audio to the video.'});graph.validate(proposal);result={passed:true,requiresSourceFiles:proposal.nodes.filter(n=>['image','clip','sound'].includes(n.type)&&!n.asset).length,nodes:proposal.nodes.map(n=>n.type),edges:proposal.edges,summary:proposal.summary,proposal};}catch(e){result={passed:false,error:e.message};}
  await fs.writeFile(path.join(root,'setup/canvas-ai-results.json'),JSON.stringify(result,null,2));return;
 }
 if(process.argv.includes('--comfy-lab-canvas-cache-check')){
  const saved=JSON.parse(await fs.readFile(path.join(root,'setup/canvas-runtime-results.json'),'utf8'));
  const p=await invoke('canvas-load',saved.project),done=new Promise(resolve=>finish=resolve);
  await invoke('canvas-run',{project:p.id});await done;
  const a=p.assets[0],response=await require('electron').net.fetch('comfylab-canvas://project/'+p.id+'/'+a.file,{headers:{Range:'bytes=0-31'}});
  const bytes=(await response.arrayBuffer()).byteLength,cached=events.filter(e=>e.status==='cached').length;
  await fs.writeFile(path.join(root,'setup/canvas-cache-results.json'),JSON.stringify({passed:cached===4&&response.status===206&&bytes===32&&!events.some(e=>e.status==='running'||e.type==='error'),cachedBlocks:cached,rangeStatus:response.status,rangeBytes:bytes},null,2));return;
 }
 try{
  let p=await invoke('canvas-new','Canvas · verified local workflow');
  const a=await invoke('canvas-import',{project:p.id,file:path.join(root,'ComfyUI/input/comfy-lab-layout-reference.png')});
  const make=(type,x,y,settings={})=>({id:crypto.randomUUID(),type,x,y,settings:{...graph.settings(type),...settings}});
  const source=make('image',60,140);source.asset=a.id;
  const image=make('enhance',380,140,{mode:'klein',steps:1,scale:1,seed:8391});
  const video=make('video',700,140,{seed:8391,duration:2,quality:'draft',resolution:'small',audio:false});
  const audio=make('audio',700,470,{seed:8391,duration:2,prompt:'Gentle natural wind and distant birds in a peaceful garden. No speech or music.'});
  const mux=make('mux',1020,240);
  p.nodes=[source,image,video,audio,mux];p.edges=[{from:source.id,to:image.id,port:'image'},{from:image.id,to:video.id,port:'image'},{from:video.id,to:mux.id,port:'video'},{from:audio.id,to:mux.id,port:'audio'}];
  p.view={x:30,y:30,zoom:0.55};await invoke('canvas-save',p);report.project=p.id;
  const done=new Promise(resolve=>finish=resolve);await invoke('canvas-run',{project:p.id});await done;
  const error=events.find(e=>e.type==='error');if(error)throw Error(error.message);
  p=await invoke('canvas-load',p.id);for(const n of [image,video,audio,mux])if(!p.outputs[n.id])throw Error('Missing output: '+n.type);
  report.outputs=Object.fromEntries([image,video,audio,mux].map(n=>{const a=p.assets.find(a=>a.id===p.outputs[n.id].asset);return [n.type,{file:path.join(root,'Data/canvas-projects',p.id,'assets',a.file),kind:a.kind,width:a.width,height:a.height,duration:a.duration}];}));
  report.passed=true;
 }catch(e){report.passed=false;report.error=e.stack;}
 report.finished=new Date().toISOString();report.events=events;await fs.writeFile(path.join(root,'setup/canvas-runtime-results.json'),JSON.stringify(report,null,2));
};
