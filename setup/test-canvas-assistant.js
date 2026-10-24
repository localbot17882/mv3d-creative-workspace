'use strict';
const assert=require('node:assert/strict'),proposal=require('../App/resources/app/canvas-assistant'),graph=require('../App/resources/app/canvas-graph');
const assets=[{id:'asset-image',kind:'image'}];
const p=proposal({nodes:[{id:'a',type:'image',asset:'asset-image'},{id:'b',type:'lighting',settings:{lightingEngine:'nano'}},{id:'c',type:'video'}],edges:[{from:'a',to:'b',port:'image'},{from:'b',to:'c',port:'image'}]},assets);
assert.equal(p.nodes[0].asset,'asset-image');assert.equal(p.nodes[1].settings.lightingEngine,'klein');assert.equal(graph.validate(p,true).length,3);assert(p.nodes[2].x>p.nodes[0].x);
assert.throws(()=>proposal({nodes:[{id:'x',type:'unsupported'}],edges:[]},assets));
assert.throws(()=>proposal({nodes:[{id:'a',type:'enhance'},{id:'b',type:'enhance'}],edges:[{from:'a',to:'b',port:'image'},{from:'b',to:'a',port:'image'}]},assets),/loop/);
const c=proposal({nodes:[{id:'person',type:'character'},{id:'video',type:'video'}],edges:[{from:'person',to:'video',port:'image'}]},assets);assert.equal(graph.validate(c,true).length,2);
console.log('Canvas assistant passed: allowed nodes, typed ports, characters, layout, valid DAG, source binding and local-only lighting.');

const repaired=proposal({nodes:[{id:'i',type:'image',asset:'asset-image'},{id:'v',type:'video'},{id:'hq',type:'draftHQ'}],edges:[{from:'i',to:'v',port:'video'},{from:'i',to:'v',port:'video'},{from:'v',to:'hq',port:'video'}]},assets);assert.equal(repaired.edges.length,2);assert.equal(repaired.edges[0].port,'image');assert.equal(repaired.edges[1].port,'clip');assert.equal(graph.validate(repaired,true).length,3);
assert.throws(()=>proposal({nodes:[{id:'i',type:'image'},{id:'v',type:'compose'}],edges:[{from:'i',to:'v',port:'image'}]},assets),/ambiguous/);
assert.throws(()=>proposal({nodes:[{id:'a',type:'audio'},{id:'v',type:'video'}],edges:[{from:'a',to:'v',port:'image'}]},assets),/incompatible/);
assert.throws(()=>proposal({nodes:[{id:'v',type:'video'}],edges:[{from:'outside',to:'v',port:'image'}]},assets),/outside/);
console.log('Assistant repairs unambiguous media-port aliases and duplicates; ambiguous, incompatible and external-node connections remain rejected.');
