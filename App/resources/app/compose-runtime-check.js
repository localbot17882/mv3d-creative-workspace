'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),graph=require('./canvas-graph');
module.exports=async({root,invoke,observe})=>{
 const report={started:new Date().toISOString()},events=[];let idle;
 observe(e=>{events.push({...e,project:undefined});if(e.type==='idle')idle?.();});
 try{
  let p=await invoke('canvas-new','Compose scene · image first');report.project=p.id;
  const background=await invoke('canvas-import',{project:p.id,file:path.join(root,'Data/image-history/2a4f97fe-a054-4674-9500-59446c6d7be1/result.png')}),person=await invoke('canvas-character-import',{project:p.id,character:'a69ea531-e088-4414-bd20-c380bec9e849'});
  const make=(type,x,y,settings={})=>({id:crypto.randomUUID(),type,x,y,settings:{...graph.settings(type),...settings}}),bg=make('image',30,40),actor=make('characterAsset',30,340),scene=make('compose',360,140,{width:768,height:432,position:'right',subjectSize:'medium',seed:4721,prompt:'Place the woman standing on the paved poolside terrace on the right, away from the water. Keep her white top, blue jeans and white shoes. Preserve the orange buildings, pine trees, swimming pool and wide camera view. Natural sunlight and grounded shadows.'});
  bg.asset=background.id;actor.asset=person.id;p.nodes=[bg,actor,scene];p.edges=[{from:bg.id,to:scene.id,port:'background'},{from:actor.id,to:scene.id,port:'character'}];p.view={x:20,y:20,zoom:0.65};await invoke('canvas-save',p);
  const before=(await invoke('video-history')).length,done=new Promise(resolve=>idle=resolve);await invoke('canvas-run',{project:p.id,target:scene.id});await done;const error=events.find(e=>e.type==='error');if(error)throw Error(error.message);
  p=await invoke('canvas-load',p.id);const result=p.assets.find(a=>a.id===p.outputs[scene.id]?.asset);if(!result||result.kind!=='image'||result.width!==768||result.height!==432)throw Error('The composed scene image is missing or has incorrect dimensions.');
  const file=path.join(root,'Data/canvas-projects',p.id,'assets',result.file),out=path.join(root,'Results/Compose-Tests-2026-10-23');await fs.mkdir(out,{recursive:true});await fs.copyFile(file,path.join(out,'composed-scene.png'));
  report.image=file;report.preview=path.join(out,'composed-scene.png');report.imageFirst=(await invoke('video-history')).length===before&&!events.some(e=>e.type==='node'&&e.node!==scene.id);if(!report.imageFirst)throw Error('Unexpected video generation during image composition.');
  const video=make('video',700,140,{prompt:'A subtle natural motion of the person with a stable camera. Preserve the architecture and character appearance.',duration:2,resolution:'small',audio:false});p.nodes.push(video);p.edges.push({from:scene.id,to:video.id,port:'image'});await invoke('canvas-save',p);
  const handed=await invoke('video-choose',file);if(handed.width!==768||handed.height!==432)throw Error('The image cannot be handed to video.');report.videoPreparedNotRun=true;report.passed=true;
 }catch(e){report.passed=false;report.error=e.stack;}
 report.finished=new Date().toISOString();report.events=events;await fs.writeFile(path.join(root,'setup/compose-runtime-results.json'),JSON.stringify(report,null,2));
};
