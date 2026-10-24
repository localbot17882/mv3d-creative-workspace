'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),archiveFactory=require('./character-files');
module.exports=async({root,invoke,observe})=>{
 const report={started:new Date().toISOString()},character='a69ea531-e088-4414-bd20-c380bec9e849',archive=archiveFactory(path.join(root,'Personajes'));let expected=null;
 observe(e=>{if(!expected)return;if(e.type===expected.type)expected.resolve(e);if(['detailsError','error'].includes(e.type))expected.reject(Error(e.message));});
 async function request(type,fn){const done=new Promise((resolve,reject)=>expected={type,resolve,reject});done.catch(()=>{});try{await fn();return await done;}finally{expected=null;}}
 try{
  const before=(await archive.details(character)).images.map(e=>e.id);await request('detailsDone',()=>invoke('characters-details-generate',character));const photos=(await archive.details(character)).images.filter(e=>!before.includes(e.id));if(photos.length!==2||photos.some(e=>e.approved))throw Error('The generated photos must be saved unapproved for user review.');
  const out=path.join(root,'Results/Full-Details-Tests-2026-10-23');await fs.mkdir(out,{recursive:true});for(const photo of photos)await fs.copyFile(photo.path,path.join(out,photo.role+'.png'));report.character=character;report.photos=photos.map(e=>({id:e.id,role:e.role,path:e.path,approved:e.approved}));report.reviewRequired=true;
  const main=(await archive.list()).find(e=>e.id===character);const composed=await request('done',()=>invoke('compose-generate',{background:path.join(root,'Data/image-history/2a4f97fe-a054-4674-9500-59446c6d7be1/result.png'),character:main.file,details:photos.map(e=>e.path),useDetails:true,width:1536,height:864,steps:4,seed:4721,position:'right',subjectSize:'large',prompt:'Place the same woman on the paved poolside terrace on the right. Preserve the orange buildings and the wide camera view. Keep the same face as the close-up identity references, white top, blue jeans and white shoes. Sharp face, realistic skin, coherent sunlight and contact shadows.'}));
  await fs.writeFile(path.join(out,'composed-with-details.png'),Buffer.from(composed.url.split(',')[1],'base64'));report.composition=path.join(out,'composed-with-details.png');report.multiReferenceCount=4;report.detailPhotosRemainUnapproved=(await archive.details(character)).images.filter(e=>photos.some(p=>p.id===e.id)).every(e=>!e.approved);report.passed=true;
 }catch(e){report.passed=false;report.error=e.stack;}
 report.finished=new Date().toISOString();await fs.writeFile(path.join(root,'setup/full-details-runtime-results.json'),JSON.stringify(report,null,2));
};
