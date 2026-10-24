(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.StoryboardModel=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const sizes={'16:9':[1024,576],'9:16':[576,1024],'1:1':[768,768]};
 function plan(raw,count){
  if(!raw||!Array.isArray(raw.shots)||!raw.shots.length||raw.shots.length>12||(count&&raw.shots.length!==count))throw Error('Use between 1 and 12 shots.');
  const text=(v,max)=>String(v||'').trim().slice(0,max);
  return {title:text(raw.title,100)||'Untitled storyboard',shots:raw.shots.map((s,i)=>{const imagePrompt=text(s.imagePrompt,4000),motionPrompt=text(s.motionPrompt,4000);if(!imagePrompt||!motionPrompt)throw Error('Each shot needs an image prompt and a motion prompt.');return {title:text(s.title,100)||'Shot '+(i+1),description:text(s.description,1000),imagePrompt,motionPrompt,duration:[2,4,6,8,10].includes(Number(s.duration))?Number(s.duration):2};})};
 }
 function dimensions(aspect,edge=1024){if(!sizes[aspect]||![512,768,1024,1536,2048].includes(Number(edge)))throw Error('Choose a storyboard ratio and image size.');const short=aspect==='1:1'?Number(edge):Math.max(256,Math.round(Number(edge)*9/16/32)*32);return aspect==='9:16'?{width:short,height:Number(edge)}:{width:Number(edge),height:short};}
 function append(p,shot,aspect,id,defaults){
  const {width,height}=dimensions(aspect,p.storyboard.imageSize||1024),imageNode=id(),videoNode=id(),row=p.storyboard.shots.length;
  p.nodes.push({id:imageNode,type:'studioCreate',x:60,y:80+row*320,settings:{...defaults('studioCreate'),width,height,aspectRatio:aspect,prompt:shot.imagePrompt}}, {id:videoNode,type:'video',x:420,y:80+row*320,settings:{...defaults('video'),autoPrompt:false,frameRatio:aspect,prompt:shot.motionPrompt,duration:shot.duration}});
  p.edges.push({from:imageNode,to:videoNode,port:'image'});
  p.storyboard.shots.push({id:id(),title:shot.title,description:shot.description,imageNode,videoNode,approvedAsset:null,usePrevious:row>0});syncContinuity(p);syncIdentity(p);return p;
 }
 function syncContinuity(p){for(const [i,shot] of p.storyboard.shots.entries()){const n=p.nodes.find(n=>n.id===shot.imageNode);if(!n)continue;if(shot.usePrevious){p.edges=p.edges.filter(e=>!(e.to===n.id&&e.port==='image'));if(i){n.type='studioEdit';p.edges.push({from:p.storyboard.shots[i-1].imageNode,to:n.id,port:'image'});}else{shot.usePrevious=false;n.type='studioCreate';}}}return p;}
 function syncIdentity(p){const identity=p.storyboard.identity,enabled=identity?.enabled&&identity.references?.length;for(const shot of p.storyboard.shots){const n=p.nodes.find(n=>n.id===shot.imageNode);if(!n)continue;p.edges=p.edges.filter(e=>!(e.to===n.id&&/^identity[123]$/.test(e.port)));const refs=identity?.references||[],source=p.edges.find(e=>e.to===n.id&&e.port==='image');if(source&&refs.some(r=>r.node===source.from)&&(!enabled||shot.keepIdentity===false||shot.usePrevious))p.edges=p.edges.filter(e=>e!==source);if(enabled&&shot.keepIdentity!==false){n.type='studioEdit';if(!p.edges.some(e=>e.to===n.id&&e.port==='image'))p.edges.push({from:refs[0].node,to:n.id,port:'image'});const base=p.edges.find(e=>e.to===n.id&&e.port==='image').from;let slot=1;for(const r of refs)if(r.node!==base)p.edges.push({from:r.node,to:n.id,port:'identity'+slot++});n.settings.identityHint=identity.kind+' reference: '+identity.name;}else{delete n.settings.identityHint;if(!p.edges.some(e=>e.to===n.id&&e.port==='image'))n.type='studioCreate';}}return p;}
 function arrange(p){syncContinuity(p);syncIdentity(p);for(const [i,s] of p.storyboard.shots.entries()){const image=p.nodes.find(n=>n.id===s.imageNode),video=p.nodes.find(n=>n.id===s.videoNode);Object.assign(image,{x:380,y:80+i*320});Object.assign(video,{x:740,y:80+i*320});for(const e of p.edges.filter(e=>e.to===image.id&&e.port==='image')){const source=p.nodes.find(n=>n.id===e.from);if(source?.type==='image')Object.assign(source,{x:60,y:image.y});}}return p;}
 function compositionKey(p){return JSON.stringify((p.storyboard?.shots||[]).map(s=>[s.id,p.outputs?.[s.videoNode]?.asset||null]));}
 function validate(p){
  if(!p.storyboard)return null;const b=p.storyboard;
  if(b.version!==1||!sizes[b.aspectRatio]||!Array.isArray(b.shots)||b.shots.length>12)throw Error('Invalid storyboard.');
  const ids=new Set(),used=new Set();
  const shots=b.shots.filter(s=>p.nodes.some(n=>n.id===s.imageNode)&&p.nodes.some(n=>n.id===s.videoNode)).map(s=>{const image=p.nodes.find(n=>n.id===s.imageNode),video=p.nodes.find(n=>n.id===s.videoNode);
   if(!/^[a-zA-Z0-9-]{1,80}$/.test(s.id)||ids.has(s.id)||used.has(s.imageNode)||used.has(s.videoNode)||!image||!['studioCreate','studioEdit'].includes(image.type)||video?.type!=='video'||!p.edges.some(e=>e.from===image.id&&e.to===video.id&&e.port==='image'))throw Error('A storyboard shot needs its own connected image and video blocks.');
   ids.add(s.id);used.add(s.imageNode);used.add(s.videoNode);
   return {keepIdentity:s.keepIdentity!==false,usePrevious:s.usePrevious===true,id:s.id,title:String(s.title||'Shot').slice(0,100),description:String(s.description||'').slice(0,1000),imageNode:s.imageNode,videoNode:s.videoNode,approvedAsset:s.approvedAsset&&s.approvedAsset===p.outputs?.[s.imageNode]?.asset?s.approvedAsset:null};
  });
  let identity=null;if(b.identity){const value=b.identity;if(!['character','product'].includes(value.kind)||!Array.isArray(value.references)||value.references.length>3)throw Error('Use up to three identity reference images.');const references=value.references.map(r=>{const node=p.nodes.find(n=>n.id===r.node&&n.type==='image'&&n.asset===r.asset),asset=p.assets.find(a=>a.id===r.asset&&a.kind==='image');if(!node||!asset)throw Error('An identity reference is missing from the project.');return {node:node.id,asset:asset.id};});identity={enabled:value.enabled===true,kind:value.kind,name:String(value.name||'Identity reference').slice(0,100),references};}
  const composition=b.composition&&b.composition.key===compositionKey(p)&&p.assets.some(a=>a.id===b.composition.asset&&a.kind==='video')?{asset:b.composition.asset,key:b.composition.key}:null;
  return {identity,imageSize:[512,768,1024,1536,2048].includes(b.imageSize)?b.imageSize:1024,composition,version:1,idea:String(b.idea||'').slice(0,4000),aspectRatio:b.aspectRatio,shots};
 }
 function checkRun(p,target){if(!p.storyboard)return;const needed=new Set();function visit(id){if(needed.has(id))return;needed.add(id);for(const e of p.edges.filter(e=>e.to===id))visit(e.from);}if(target)visit(target);for(const s of p.storyboard.shots)if((!target||needed.has(s.videoNode))&&(!s.approvedAsset||s.approvedAsset!==p.outputs?.[s.imageNode]?.asset))throw Error('Approve the current image for '+s.title+' before generating its video.');}
 return {sizes,dimensions,plan,append,validate,checkRun,syncContinuity,arrange,compositionKey,syncIdentity};
});
