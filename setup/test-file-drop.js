'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const callbacks={},calls=[],elements={};
for(const id of ['videoTool','postDialog','postStatus','videoMessage','status','videoChoose','videoChooseClip','videoEmpty','tabPost'])elements[id]={value:'image',open:false,title:'',querySelector:()=>null};
const body={classList:{add(){},remove(){}},dataset:{}};
const context={document:{body,addEventListener:(n,fn)=>callbacks[n]=fn,querySelector:()=>null},window:{addEventListener(){}},Array,Error,console,task:'enhance',canvasBusy:false,busy:false,videoBusy:false,downloading:false,restartingUI:false,postBusy:false,$:id=>elements[id],message:text=>calls.push(['error',text]),setImageSource:s=>calls.push(['image',s]),videoSetSource:s=>calls.push(['videoImage',s]),videoSetClip:s=>calls.push(['clip',s]),openPost:async(_,f)=>calls.push(['post',f.name]),api:{dropFile:async(f,kind)=>{calls.push(['import',kind,f.name]);return f.name;}}};
vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../App/resources/app/file-drop.js','utf8'),context);context.initializeFileDrop();
async function drop(name,target=null){let prevented=false;await callbacks.drop({target:target||{closest:()=>null},preventDefault(){prevented=true;},dataTransfer:{types:['Files'],files:[{name}]}});assert(prevented);}
(async()=>{
 for(const task of ['enhance','lighting','people']){context.task=task;await drop('render.PNG');assert.equal(calls.at(-1)[0],'image');}
 context.task='video';elements.videoTool.value='image';await drop('render.jpg');assert.equal(calls.at(-1)[0],'videoImage');
 elements.videoTool.value='layout';await drop('render.webp');assert.equal(calls.at(-1)[0],'videoImage');await drop('blocking.mp4');assert.equal(calls.at(-1)[0],'clip');
 elements.videoTool.value='refine';await drop('video.mov');assert.equal(calls.at(-1)[0],'clip');await drop('render.png');assert.equal(elements.videoMessage.textContent,'Drop an MP4, MOV, MKV or WebM video.');
 await drop('render.png',{closest:()=>true});assert.equal(calls.at(-1)[0],'post');
 context.task='enhance';context.busy=true;const imports=calls.filter(c=>c[0]==='import').length;await drop('other.png');assert.equal(calls.filter(c=>c[0]==='import').length,imports);context.busy=false;
 await drop('bad.txt');assert.equal(calls.at(-1)[0],'error');
 const readImage=require('../App/resources/app/image-input');const nativeImage={createFromBuffer:bytes=>({isEmpty:()=>bytes.subarray(1,4).toString()!=='PNG',getSize:()=>({width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)})})};
 const img=await readImage('F:/Codex/PPG-Lab/ComfyUI/input/comfy-lab-layout-reference.png',nativeImage);assert.equal(img.width,512);assert.equal(img.height,320);
 await assert.rejects(()=>readImage('relative.png',nativeImage));await assert.rejects(()=>readImage('F:/Codex/PPG-Lab/App/resources/app/main.js',nativeImage));
 console.log('File drop passed: image modes, video reference, layout clip, refine clip, post-production, busy guard and invalid file rejection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
