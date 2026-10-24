'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {buildGuided,checkedGuided,guidedModels}=require('../App/resources/app/guided-workflow');
const {tracker}=require('../App/resources/app/job-progress');
const graphs={};for(const task of ['layout','refine'])for(const resolution of ['test','hd','full']){
 const w=buildGuided('comfy-lab-clip-test.mp4','comfy-lab-test.png',{task,resolution,prompt:'Sharp architectural detail.',duration:2});
 const ns=Object.values(w.graph);assert(ns.some(n=>n.class_type==='LTXICLoRALoaderModelOnly'));assert(ns.some(n=>n.class_type==='ComfyLabLoadClip'));
 assert.equal(ns.filter(n=>n.class_type==='SamplerCustomAdvanced').length,task==='layout'?2:0);
 assert.equal(ns.filter(n=>n.class_type==='LTXVTiledFusionSampler').length,task==='refine'?1:0);
 assert.equal(ns.some(n=>n.class_type==='LoadImage'),task==='layout');
 const clipGuide=ns.find(n=>n.class_type==='LTXAddVideoICLoRAGuide'&&n.inputs.frame_idx===0);
 assert.equal(clipGuide.inputs.use_streaming,task==='refine');
 assert.equal(clipGuide.inputs.use_tiled_encode,task!=='refine','Streaming guide windows cannot use spatially tiled VAE encoding.');
 assert(guidedModels(task).some(m=>m.mode===task));assert(!guidedModels(task).some(m=>m.mode&&m.mode!==task));
 graphs[task+'-'+resolution]=w.graph;
}
assert.throws(()=>checkedGuided({task:'refine',prompt:'test',overlap:0.2}));assert.throws(()=>checkedGuided({task:'layout',prompt:'test',resolution:'uhd'}));
fs.mkdirSync(path.join(__dirname,'../Data/tests/guided'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../Data/tests/guided/graphs.json'),JSON.stringify(graphs,null,2));
let time=0;const updates=[],p=tracker(graphs['refine-test'],e=>updates.push(e),{now:()=>time});
const sampler=Object.entries(graphs['refine-test']).find(([,n])=>n.class_type==='LTXVTiledFusionSampler')[0];
p.event('executing',{node:sampler});p.event('progress',{node:sampler,value:1,max:8});time=10000;p.event('progress',{node:sampler,value:2,max:8});
assert(updates.at(-1).percent>0&&updates.at(-1).percent<100);assert(updates.at(-1).etaSeconds>0);
const old=updates.at(-1).percent;p.event('progress',{node:sampler,value:1,max:8});assert(updates.at(-1).percent>=old);p.finish();assert.equal(updates.at(-1).percent,99);
console.log('Guided workflows, LoRA isolation, parameter limits and progress/ETA calculations passed.');

const full=buildGuided('comfy-lab-clip-test.mp4','',{task:'refine',prompt:'Sharp details',fullDuration:true,sourceDuration:13.375});
assert.equal(full.settings.duration,13.375);
assert.equal(Object.values(full.graph).find(n=>n.class_type==='ComfyLabLoadClip').inputs.duration,0);
assert.equal(Object.values(full.graph).find(n=>n.class_type==='ComfyLabTrimClip').inputs.duration,13.375);
assert.throws(()=>checkedGuided({task:'refine',prompt:'test',fullDuration:true}));
console.log('Full source duration beyond ten seconds and model-padding trim passed.');

const checkedVideo=require('../App/resources/app/video-workflow').checkedVideo;
assert.deepEqual([checkedVideo({prompt:'test',frameRatio:'9:16'}).width,checkedVideo({prompt:'test',frameRatio:'9:16'}).height],[288,512]);
assert.deepEqual([checkedVideo({prompt:'test',frameRatio:'16:9'}).width,checkedVideo({prompt:'test',frameRatio:'16:9'}).height],[512,288]);
assert.equal(checkedVideo({prompt:'test',frameRatio:'1:1'}).height,512);
assert.equal(checkedVideo({prompt:'test',frameRatio:'9:16',quality:'refined'}).width%64,0);
