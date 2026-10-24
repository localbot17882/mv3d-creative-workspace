'use strict';
const crypto=require('node:crypto'),graph=require('./canvas-graph');
module.exports=function proposal(raw,assets){
 if(!raw||!Array.isArray(raw.nodes)||!Array.isArray(raw.edges)||!raw.nodes.length||raw.nodes.length>20||raw.edges.length>40)throw Error('Ask for a workflow with up to 20 blocks.');
 const ids=new Map(),nodes=raw.nodes.map(n=>{if(!n||typeof n.id!=='string'||ids.has(n.id)||!graph.types[n.type])throw Error('The assistant suggested an unsupported or duplicate node.');const id=crypto.randomUUID();ids.set(n.id,id);const settings=graph.settings(n.type);for(const [key,value] of Object.entries(n.settings||{}))if(Object.hasOwn(settings,key)&&typeof value===typeof settings[key]&&(typeof value!=='number'||Number.isFinite(value)))settings[key]=typeof value==='string'?value.slice(0,4000):value;if(n.type==='lighting')settings.lightingEngine=settings.lightingEngine==='qwen'?'qwen':'klein';const asset=assets.find(a=>a.id===n.asset&&a.kind===graph.types[n.type].output);return {id,type:n.type,x:0,y:0,settings,...(asset&&['image','clip','sound','characterAsset'].includes(n.type)?{asset:asset.id}:{})};});
 const edges=[];
 for(const e of raw.edges){
  const from=nodes.find(n=>n.id===ids.get(e.from)),to=nodes.find(n=>n.id===ids.get(e.to));
  if(!from||!to)throw Error('The assistant referenced a block outside its proposed workflow. Ask it to include the source block.');
  const output=graph.types[from.type].output,spec=graph.types[to.type],ports=spec.inputs;
  let port=typeof e.port==='string'?e.port:'';
  if(edges.some(x=>x.from===from.id&&x.to===to.id&&(x.port===port||!Object.hasOwn(ports,port))))continue;
  const occupied=name=>edges.some(x=>x.to===to.id&&x.port===name);
  if(ports[port]!==output||occupied(port)){
   const available=Object.keys(ports).filter(name=>ports[name]===output&&!occupied(name)),required=available.filter(name=>!spec.optionalInputs?.includes(name));
   if(required.length===1)port=required[0];
   else if(available.length===1)port=available[0];
   else if(available.length&&available.every(name=>/^identity[123]$/.test(name)))port=available[0];
   else throw Error('The proposed '+graph.types[from.type].label+' → '+spec.label+' connection is '+(available.length?'ambiguous. Specify which input to use.':'incompatible. These blocks need different media types.'));
  }
  edges.push({from:from.id,to:to.id,port});
 }
 const plan=graph.validate({nodes,edges}),levels={},rows={};
 for(const n of plan){levels[n.id]=Math.max(0,...edges.filter(e=>e.to===n.id).map(e=>levels[e.from]+1));const col=levels[n.id];n.x=60+col*320;n.y=80+(rows[col]||0)*290;rows[col]=(rows[col]||0)+1;}
 return {nodes,edges,summary:String(raw.summary||'Review the proposed blocks, then add them to your canvas.').slice(0,1000)};
};
