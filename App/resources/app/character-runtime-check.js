'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
module.exports=async function({root,invoke,observe}){
 let pending;const report={started:new Date().toISOString()},events=[];
 observe(e=>{if(!pending)return;if(e.type==='error')pending.reject(Error(e.message));if(e.type==='done'&&e.task==='characters')pending.resolve(e);if(e.type==='progress')events.push({percent:e.percent,stage:e.stage});});
 async function generate(settings){const done=new Promise((resolve,reject)=>pending={resolve,reject});done.catch(()=>{});try{await invoke('characters-generate',settings);return await done;}finally{pending=null;}}
 try{
  const out=path.join(root,'Results/Character-Tests-2026-10-23');await fs.mkdir(out,{recursive:true});
  const portrait=await generate({mode:'new',width:512,height:768,steps:8,seed:9401,name:'Alex · test portrait',prompt:'Photorealistic studio portrait of an adult man in his early thirties, short dark brown hair, brown eyes, light beard, natural skin pores, relaxed neutral expression, plain grey background, soft natural window light. Head and shoulders, realistic proportions, eye-level camera.'});
  await fs.writeFile(path.join(out,'alex-portrait.png'),Buffer.from(portrait.url.split(',')[1],'base64'));
  const list=(await invoke('history-list')).filter(e=>e.settings?.task==='characters');if(!list.length)throw Error('Character was not saved to the library.');
  await invoke('characters-use',list[0].id);
  const variation=await generate({mode:'reference',width:512,height:768,steps:4,seed:9402,name:'Alex · reference variation',prompt:'The same man in a softly lit outdoor garden, wearing a dark blue casual shirt. Preserve the same face, hairstyle, beard and natural proportions. Photorealistic portrait, soft daylight.'});
  await fs.writeFile(path.join(out,'alex-reference-variation.png'),Buffer.from(variation.url.split(',')[1],'base64'));
  const final=(await invoke('history-list')).filter(e=>e.settings?.task==='characters');if(final.length<2)throw Error('Reference variation was not saved.');
  await invoke('characters-use',final[0].id);const video=await invoke('video-current');if(video.width!==512||video.height!==768)throw Error('Video handoff dimensions differ.');
  report.passed=true;report.libraryEntries=final.slice(0,2).map(e=>({id:e.id,name:e.name,width:e.width,height:e.height}));report.videoHandoff=true;report.outputFolder=out;
 }catch(e){report.passed=false;report.error=e.stack;}
 report.finished=new Date().toISOString();report.progressEvents=events;await fs.writeFile(path.join(root,'setup/character-runtime-results.json'),JSON.stringify(report,null,2));
};
