(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CanvasCharacters=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function mention(text,caret){const match=text.slice(0,caret).match(/(?:^|\s)@([^@\n]{0,80})$/);return match?{start:caret-match[1].length-1,end:caret,query:match[1]}:null;}
 function attach(graph,asset,targetId,id){
  let element=graph.nodes.find(n=>n.type==='characterAsset'&&graph.assets.find(a=>a.id===n.asset)?.character?.id===asset.character.id);
  const updated=!!element&&element.asset!==asset.id;if(updated)element.asset=asset.id;
  const target=graph.nodes.find(n=>n.id===targetId);let connected=false;
  if(!element){if(target&&target.x<320)target.x=340;element={id,type:'characterAsset',asset:asset.id,settings:{},x:Math.max(20,(target?.x||400)-300),y:target?.y||100};graph.nodes.push(element);}
  if(target&&target!==element){
   const port=target.type==='compose'?'character':target.type==='layout'?'reference':['character','characterEdit','enhance','lighting','people','video'].includes(target.type)?'image':null;
   if(port&&!graph.edges.some(e=>e.to===target.id&&e.port===port)){
    if(target.type==='character'){target.type='characterEdit';target.settings={...target.settings,mode:'reference',steps:4};}
    graph.edges.push({from:element.id,to:target.id,port});connected=true;
   }
  }
  return {element,connected,updated};
 }
 return {mention,attach};
});
