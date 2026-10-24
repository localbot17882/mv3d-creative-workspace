(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CanvasGraph=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){

 'use strict';

 const types={draftHQ:{label:'Draft to High Quality',description:'Deterministic Lanczos resampling of existing video frames; preserves timing, motion and audio. No generative model or newly invented detail.',output:'video',inputs:{clip:'video'}},studioCreate:{label:'Create image · Qwen',output:'image',inputs:{}},studioEdit:{label:'Edit image · Qwen',output:'image',inputs:{image:'image',identity1:'image',identity2:'image',identity3:'image'},optionalInputs:['identity1','identity2','identity3']},compose:{label:'Compose scene',output:'image',inputs:{background:'image',character:'image'}},characterAsset:{label:'Character element',output:'image',inputs:{}},character:{label:'Create character',output:'image',inputs:{}},characterEdit:{label:'Character reference',output:'image',inputs:{image:'image'}},

  image:{label:'Image',output:'image',inputs:{}},clip:{label:'Video file',output:'video',inputs:{}},sound:{label:'Audio file',output:'audio',inputs:{}},

  enhance:{label:'Enhance image',output:'image',inputs:{image:'image'}},lighting:{label:'Lighting',output:'image',inputs:{image:'image'}},people:{label:'Enhance people',output:'image',inputs:{image:'image'}},

  video:{label:'Image to video',output:'video',inputs:{image:'image'}},layout:{label:'3D Blocking',output:'video',inputs:{clip:'video',reference:'image'}},refine:{label:'Refine video',output:'video',inputs:{clip:'video'}},

  soundtrack:{label:'Soundtrack a video',output:'video',inputs:{clip:'video',narration:'audio'},optionalInputs:['narration']},speech:{label:'Speech · Qwen',output:'audio',inputs:{}},voiceClone:{label:'Clone voice · Qwen',output:'audio',inputs:{voice:'audio'}},audio:{label:'Ambience and effects · LTX',output:'audio',inputs:{}},mux:{label:'Add audio to video',output:'video',inputs:{video:'video',audio:'audio'}}

 };

 const defaults={soundtrack:{prompt:"Natural ambience matching the scene, no speech or music.",ambientLevel:0.35,voiceLevel:1,keepOriginal:false},speech:{engine:'qwen',voiceMode:'preset',voice:'Ryan',language:'Auto',speed:1,prompt:'Write the words to speak here.'},voiceClone:{engine:'qwen',voiceMode:'clone',voice:'Ryan',language:'Auto',speed:1,refText:'',prompt:'Write the words to speak here.'},draftHQ:{scale:2},studioCreate:{aspectRatio:'1:1',width:1024,height:1024,prompt:'A cinematic photograph of a modern house in a pine forest, natural materials, soft morning light.',negative:'',memory:'balanced'},studioEdit:{aspectRatio:'source',width:1024,height:1024,prompt:'Change the scene to warm afternoon sunlight while preserving the main subject and composition.',negative:'',memory:'balanced',fit:'contain'},compose:{aspectRatio:'16:9',width:1536,height:864,steps:4,useDetails:true,position:'center',subjectSize:'medium',prompt:'Place the person naturally on the ground in this environment. Preserve the background composition and the character identity. Photorealistic integration, coherent lighting and contact shadows.'},character:{aspectRatio:'3:4',mode:'new',name:'Character',width:768,height:1024,steps:8,prompt:'Photorealistic portrait of an adult person, natural skin detail, soft daylight, neutral background.'},characterEdit:{aspectRatio:'3:4',mode:'reference',name:'Character variation',width:768,height:1024,steps:4,prompt:'The same person with the same face and proportions, in a new natural setting.'},enhance:{mode:'klein',scale:2,steps:4,prompt:'Enhance realistic materials, foliage and fine detail. Preserve the original architecture, geometry, camera and composition.'},lighting:{lightingEngine:'klein',lightingPreset:'sunset',scale:1,steps:4,prompt:'Warm late afternoon sunlight, coherent shadows and natural exposure. Preserve the original materials, architecture, objects and camera.'},people:{scale:1,steps:30,peopleDenoise:0.4,peopleConfidence:0.35,prompt:'Photorealistic people, natural anatomy, realistic faces, hands and fabric. Preserve identity, pose, clothing and scale.',negative:'illustration, plastic skin, malformed hands, duplicate people'},video:{autoPrompt:true,duration:2,resolution:'small',quality:'draft',audio:false,prompt:'A slow cinematic camera push. Gentle movement in the trees. Preserve the architecture and straight lines.'},layout:{duration:2,resolution:'test',strength:1,guideStrength:1,preserveAudio:true,prompt:'Photorealistic architectural materials and natural light. Follow the source camera motion and match the reference image.'},refine:{fullDuration:true,duration:2,resolution:'test',strength:1,guideStrength:1,tile:'trained',window:25,overlap:0.5,preserveAudio:true,prompt:'Sharp photographic detail, crisp edges and realistic surface texture. Preserve motion, architecture and composition.'},audio:{duration:4,prompt:'Natural outdoor ambience, gentle wind in trees and distant birds. No music or speech.',negative:'noise, distortion, music, speech'},mux:{}};

 function settings(type){return {seed:42,seedLocked:true,...defaults[type]};}

 function validate(graph,complete=false,target=null){

  if(!graph||!Array.isArray(graph.nodes)||!Array.isArray(graph.edges)||graph.nodes.length>100||graph.edges.length>200)throw Error('Use up to 100 blocks and 200 connections.');

  const nodes=new Map();for(const n of graph.nodes){if(!n||!/^[a-zA-Z0-9-]{1,80}$/.test(n.id)||nodes.has(n.id)||!types[n.type])throw Error('Invalid or duplicate block.');if(!Number.isFinite(n.x)||!Number.isFinite(n.y)||Math.abs(n.x)>100000||Math.abs(n.y)>100000)throw Error('Invalid block position.');if(n.settings&&JSON.stringify(n.settings).length>16000)throw Error('Block settings are too large.');nodes.set(n.id,n);}

  const used=new Set(),parents=new Map(graph.nodes.map(n=>[n.id,[]]));

  for(const e of graph.edges){const a=nodes.get(e.from),b=nodes.get(e.to);if(!a||!b||types[b.type].inputs[e.port]!==types[a.type].output||used.has(e.to+':'+e.port))throw Error('Connect matching media types to one input at a time.');used.add(e.to+':'+e.port);parents.get(e.to).push(e.from);}

  const visiting=new Set(),visited=new Set(),all=[];

  function visit(id){if(visiting.has(id))throw Error('A workflow cannot contain a loop.');if(visited.has(id))return;visiting.add(id);for(const p of parents.get(id))visit(p);visiting.delete(id);visited.add(id);all.push(nodes.get(id));}

  for(const n of graph.nodes)visit(n.id);

  let plan=all;

  if(target){if(!nodes.has(target))throw Error('Select a block first.');const needed=new Set();function collect(id){needed.add(id);for(const p of parents.get(id))if(!needed.has(p))collect(p);}collect(target);plan=all.filter(n=>needed.has(n.id));}

  if(complete)for(const n of plan){for(const port of Object.keys(types[n.type].inputs))if(!types[n.type].optionalInputs?.includes(port)&&!used.has(n.id+':'+port))throw Error(types[n.type].label+' needs its '+port+' input.');if(['image','clip','sound','characterAsset'].includes(n.type)&&!n.asset)throw Error(types[n.type].label+' needs a file.');}

  return plan;

 }

 function descendants(graph,id){const found=new Set([id]);let change=true;while(change){change=false;for(const e of graph.edges)if(found.has(e.from)&&!found.has(e.to)){found.add(e.to);change=true;}}return found;}

 function removeNodes(graph,ids){const removed=new Set(ids),invalidated=new Set();for(const id of removed)for(const child of descendants(graph,id))invalidated.add(child);return {...graph,nodes:graph.nodes.filter(n=>!removed.has(n.id)),edges:graph.edges.filter(e=>!removed.has(e.from)&&!removed.has(e.to)),outputs:Object.fromEntries(Object.entries(graph.outputs||{}).filter(([id])=>!invalidated.has(id)))};}

 return {types,settings,validate,descendants,removeNodes};

});
