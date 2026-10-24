'use strict';
const assert=require('node:assert/strict'),aspect=require('../App/resources/app/photo-aspect'),{buildCompose}=require('../App/resources/app/compose-workflow'),{buildCharacter}=require('../App/resources/app/character-workflow');
assert.deepEqual(aspect.fit(16,9,1536),{width:1536,height:864});assert.deepEqual(aspect.fit(9,16,1536),{width:864,height:1536});
assert.deepEqual(aspect.resize('16:9',null,{width:1536,height:864},'width',1024),{width:1024,height:576});
const original=aspect.resize('source',{width:5280,height:2934},{width:1536,height:864},'width',1536);assert(Math.abs(original.width/original.height-5280/2934)<0.01);
for(const pair of Object.values(aspect.presets)){const d=aspect.fit(...pair,1536);assert(d.width%16===0&&d.height%16===0);assert(d.width*d.height<=1600000);assert.equal(d.width/d.height,pair[0]/pair[1]);}
assert.equal(aspect.label(768,1344),'4:7');assert.throws(()=>aspect.fit(0,9));
const dims=aspect.fit(9,16,1280),scene=buildCompose('b.png','p.png',{...dims,prompt:'Same person in the scene'});assert(Object.values(scene.graph).some(n=>n.class_type==='EmptyFlux2LatentImage'&&n.inputs.width===dims.width&&n.inputs.height===dims.height));
const photo=buildCharacter({...dims,prompt:'An adult person'});assert(Object.values(photo.graph).some(n=>n.class_type==='EmptySD3LatentImage'&&n.inputs.width===dims.width&&n.inputs.height===dims.height));
console.log('Aspect ratios: original image, exact presets, linked resizing, model grid, pixel budget and image workflow dimensions passed.');
