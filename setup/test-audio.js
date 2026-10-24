'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {buildAudio,checkedAudio,audioModels}=require('../App/resources/app/audio-workflow');
assert.equal(audioModels.length,3);assert(!audioModels.some(m=>m.file.includes('video-vae')||m.optional));
const graphs={};for(const duration of [2,4,10,20,30]){
 const w=buildAudio({prompt:'Wind in a forest. No speech.',duration,seed:42});
 assert.equal(w.settings.frames%8,1);assert.equal(w.settings.frames,duration*24+1);
 const nodes=Object.values(w.graph);assert(nodes.some(n=>n.class_type==='LTXVAudioOnlyModel'));assert(nodes.some(n=>n.class_type==='LTXVAudioOnlyEmptyVideoLatent'));
 assert.equal(nodes.filter(n=>n.class_type==='VAELoader').length,1);assert(!nodes.some(n=>['CreateVideo','VAEDecodeTiled','LoadImage'].includes(n.class_type)));
 assert.equal(w.graph[w.output].class_type,'ComfyLabSaveAudioWAV');graphs['audio-'+duration]=w.graph;
}
assert.throws(()=>checkedAudio({prompt:'',duration:4}));assert.throws(()=>checkedAudio({prompt:'test',duration:120}));
fs.writeFileSync(path.join(__dirname,'audio-test-graphs.json'),JSON.stringify(graphs,null,2));console.log('Audio graphs, shared model selection, durations and audio-only routing passed.');
