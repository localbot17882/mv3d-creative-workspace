'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
module.exports=function(folder){
 async function save(id,bytes,settings,graph){
  if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid character identifier.');
  const name=String(settings.name||'Character').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,70)||'Character';
  await fs.mkdir(folder,{recursive:true});
  const file=path.join(folder,name+'-'+id+'.png');
  async function writeOnce(dest,data){try{await fs.writeFile(dest,data,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}}
  await writeOnce(file,bytes);
  await writeOnce(file.slice(0,-4)+'.json',JSON.stringify({id,settings,graph},null,2));
  return file;
 }
 async function list(){
  await fs.mkdir(folder,{recursive:true});const entries=[];
  for(const file of await fs.readdir(folder)){if(!file.endsWith('.json'))continue;try{
   const meta=JSON.parse(await fs.readFile(path.join(folder,file),'utf8'));
   if(!/^[a-f0-9-]{36}$/.test(meta.id)||meta.settings?.task!=='characters')continue;
   const image=path.join(folder,file.slice(0,-5)+'.png'),stat=await fs.stat(image);
   if(!stat.isFile()||stat.size>60e6)continue;
   entries.push({id:meta.id,name:String(meta.settings.name||'Character').slice(0,80),prompt:String(meta.settings.prompt||'').slice(0,4000),file:image,updated:stat.mtime.toISOString()});
  }catch{}}
  return entries.sort((a,b)=>b.updated.localeCompare(a.updated));
 }
 const checked=id=>{if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid character identifier.');return id;};
 const detailFolder=id=>path.join(folder,checked(id),'full-details');
 async function details(id){try{const manifest=JSON.parse(await fs.readFile(path.join(detailFolder(id),'manifest.json'),'utf8'));return {images:(manifest.images||[]).filter(e=>/^[a-f0-9-]{36}$/.test(e.id)&&e.file===e.id+'.png').map(e=>({...e,path:path.join(detailFolder(id),e.file)}))};}catch(e){if(e.code==='ENOENT')return {images:[]};throw e;}}
 let detailQueue=Promise.resolve();
 function updateDetails(id,fn){const action=detailQueue.catch(()=>{}).then(async()=>{const manifest=await details(id);const result=await fn(manifest);const dir=detailFolder(id);await fs.mkdir(dir,{recursive:true});const file=path.join(dir,'manifest.json');await fs.writeFile(file+'.tmp',JSON.stringify({images:manifest.images.map(({path,...e})=>e)},null,2));await fs.rename(file+'.tmp',file);return result;});detailQueue=action;return action;}
 async function saveDetail(character,bytes,meta={}){return updateDetails(character,async m=>{if(m.images.length>=12)throw Error('Use up to twelve detail photos per character.');const id=require('node:crypto').randomUUID(),file=id+'.png',dir=detailFolder(character);await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,file),bytes,{flag:'wx'});const entry={id,file,label:String(meta.label||'Reference photo').slice(0,80),role:String(meta.role||'reference').slice(0,40),origin:meta.origin==='generated'?'generated':'imported',approved:false,created:new Date().toISOString()};m.images.push(entry);return entry;});}
 async function approveDetail(character,id,approved){checked(id);return updateDetails(character,async m=>{const image=m.images.find(e=>e.id===id);if(!image)throw Error('This reference photo is unavailable.');if(approved&&!image.approved&&m.images.filter(e=>e.approved).length>=2)throw Error('Choose up to two detail photos for identity. Disable one before choosing another.');image.approved=!!approved;return {id,approved:image.approved};});}
 return {save,list,folder,details,saveDetail,approveDetail};
};
