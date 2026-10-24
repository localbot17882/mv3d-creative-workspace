(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PhotoAspect=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const presets={'1:1':[1,1],'4:3':[4,3],'3:4':[3,4],'16:9':[16,9],'9:16':[9,16],'3:2':[3,2],'2:3':[2,3]};
 function name(width,height){return Object.keys(presets).find(key=>Math.abs(presets[key][0]/presets[key][1]-width/height)<0.001)||'custom';}
 function fit(width,height,longEdge=1024,maxPixels=1600000){
  if(![width,height,longEdge,maxPixels].every(n=>Number.isFinite(n)&&n>0))throw Error('Invalid aspect ratio.');const ratio=width/height,target=Math.min(1536,Math.max(256,longEdge));let best=null,score=Infinity;
  for(let w=256;w<=1536;w+=16)for(let h=256;h<=1536;h+=16){if(w*h>maxPixels)continue;const error=Math.abs(Math.log((w/h)/ratio))*100+Math.abs(Math.max(w,h)-target)/target;if(error<score){score=error;best={width:w,height:h};}}
  if(!best)throw Error('This aspect ratio exceeds the resolution limit.');return best;
 }
 function resize(aspect,source,current,edge,value,maxPixels=1600000){if(aspect==='custom')return {...current,[edge]:value};const pair=aspect==='source'?[source?.width||current.width,source?.height||current.height]:presets[aspect];if(!pair)throw Error('Choose an aspect ratio.');const [w,h]=pair;return fit(w,h,Number(value)*Math.max(w,h)/(edge==='width'?w:h),maxPixels);}
 function label(w,h){const gcd=(a,b)=>b?gcd(b,a%b):a,g=gcd(w,h);return w/g+':'+h/g;}
 return {presets,name,fit,resize,label};
});
