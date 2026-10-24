'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),graph=require('./canvas-graph');
module.exports=async function({root,invoke,observe}){
 const report={started:new Date().toISOString()},events=[];let finish;
 observe(e=>{events.push({...e,project:undefined});if(e.type==='idle')finish?.();});
 async function run(p,target){const done=new Promise(r=>finish=r);await invoke('canvas-run',{project:p.id,target});await done;const error=events.find(e=>e.type==='error');if(error)throw Error(error.message);}
 try{
  let p=await invoke('canvas-new','Image Studio · create, edit and animate');report.project=p.id;
  const create={id:'studio-create',type:'studioCreate',x:40,y:100,settings:{...graph.settings('studioCreate'),width:512,height:320,aspectRatio:'16:10',seed:42,prompt:'Photorealistic product photograph of a red armchair on a plain light gray background. Whole chair visible, natural fabric texture, soft studio light. No text.'}};
  const edit={id:'studio-edit',type:'studioEdit',x:390,y:100,settings:{...graph.settings('studioEdit'),width:512,height:512,seed:42,prompt:'Change only the red upholstery to deep blue. Preserve the chair shape, camera, lighting and gray background. No text.'}};
  p.nodes=[create,edit];p.edges=[{from:create.id,to:edit.id,port:'image'}];await invoke('canvas-save',p);const started=Date.now();await run(p,edit.id);report.seconds=(Date.now()-started)/1000;p=await invoke('canvas-load',p.id);
  report.outputs={};for(const n of [create,edit]){const a=p.assets.find(a=>a.id===p.outputs[n.id]?.asset);assert(a);assert.equal(a.width,512);assert.equal(a.height,320);report.outputs[n.type]={width:a.width,height:a.height,file:path.join(root,'Data/canvas-projects',p.id,'assets',a.file)};}
  const count=events.length;await run(p);const cacheEvents=events.slice(count);assert.equal(cacheEvents.filter(e=>e.status==='cached').length,2);assert(!cacheEvents.some(e=>e.status==='running'));report.cachedBlocks=2;
  const video={id:'studio-video',type:'video',x:740,y:100,settings:graph.settings('video')};p.nodes.push(video);p.edges.push({from:edit.id,to:video.id,port:'image'});p.view={x:30,y:80,zoom:0.85};await invoke('canvas-save',p);report.videoConnected=true;report.videoGenerated=false;report.passed=true;
 }catch(e){report.passed=false;report.error=e.stack;}
 report.finished=new Date().toISOString();report.events=events;await fs.writeFile(path.join(root,'setup/image-studio-canvas-results.json'),JSON.stringify(report,null,2));
};
