'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),files=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean))];
const blocked=/^(?:Data|Results|Personajes|ComfyUI|Tools|Python|Backups|node_modules|\.venv|\.cache|\.tools)\//i,binary= /\.(?:safetensors|pt|pth|gguf|bin|mp4|wav|webm|exe|dll|pem|key)$/i;
const issues=[];let scanned=0;
for(const file of files){
 if(blocked.test(file)||binary.test(file)||/(?:^|\/)\.env(?:\.|$)/.test(file)){issues.push({file,reason:'Private/runtime file in source inventory'});continue;}
 if(!fs.existsSync(path.join(root,file))||/\.(?:png|ico)$/i.test(file))continue;
 const text=fs.readFileSync(path.join(root,file),'utf8');scanned++;
 for(const pattern of [/AIza[\w-]{30,}/g,/hf_[A-Za-z0-9]{25,}/g,/github_pat_[A-Za-z0-9_]{30,}/g,/ghp_[A-Za-z0-9]{30,}/g,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g]){
  if(pattern.test(text))issues.push({file,reason:'Potential credential; inspect locally without printing its value'});
 }
}
const report={files_scanned:scanned,source_files:files.length,potential_secret_files:issues,private_directories_excluded:['Data','Results','Personajes','ComfyUI','Tools','Python','Backups','.venv','.cache','.tools','node_modules'],passed:issues.length===0};
fs.writeFileSync(path.join(root,'docs/SOURCE-SCAN.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(issues.length)process.exitCode=1;
