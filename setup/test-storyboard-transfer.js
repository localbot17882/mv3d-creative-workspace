const assert=require('node:assert/strict'),crypto=require('node:crypto');
const tools=require('../App/resources/app/canvas-graph'),story=require('../App/resources/app/storyboard-model');
const p={nodes:[],edges:[],assets:[],outputs:{},storyboard:{version:1,idea:'Test',aspectRatio:'16:9',shots:[]}};
for(let i=0;i<3;i++)story.append(p,{title:'Shot '+i,imagePrompt:'House '+i,motionPrompt:'Slow pan',duration:2},'16:9',()=>crypto.randomUUID(),tools.settings);
let shots=p.storyboard.shots;assert.equal(shots[1].usePrevious,true);assert(p.edges.some(e=>e.from===shots[0].imageNode&&e.to===shots[1].imageNode&&e.port==='image'));assert.equal(p.nodes.find(n=>n.id===shots[1].imageNode).type,'studioEdit');tools.validate(p,true,shots[2].imageNode);
p.outputs[shots[0].imageNode]={asset:'existing-frame',key:'cache'};story.arrange(p);assert.equal(p.outputs[shots[0].imageNode].asset,'existing-frame');assert.equal(p.nodes.find(n=>n.id===shots[2].videoNode).y,720);
[shots[1],shots[2]]=[shots[2],shots[1]];story.arrange(p);assert(p.edges.some(e=>e.from===shots[1].imageNode&&e.to===shots[2].imageNode));tools.validate(p,true,shots[2].videoNode);
const signature=story.compositionKey(p);p.outputs[shots[1].videoNode]={asset:'new-video'};assert.notEqual(story.compositionKey(p),signature);console.log('Storyboard transfer preserves outputs; ordered layout, preceding-frame references, reordering and composed-video invalidation passed.');
