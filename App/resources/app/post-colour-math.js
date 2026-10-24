'use strict';
function normalizePostColour(input={}){
 const finite=(v,lo,hi)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw Error('Invalid colour settings.');return v;};
 const levels={inputBlack:0,inputWhite:255,gamma:1,outputBlack:0,outputWhite:255,...input.levels};
 for(const key of ['inputBlack','inputWhite','outputBlack','outputWhite'])finite(levels[key],0,255);finite(levels.gamma,.1,3);
 if(levels.inputBlack>=levels.inputWhite||levels.outputBlack>levels.outputWhite)throw Error('Black level must be below white level.');
 const curves={};for(const key of ['master','red','green','blue']){
  const points=input.curves?.[key]??[[0,0],[1,1]];
  if(!Array.isArray(points)||points.length<2||points.length>16)throw Error('Invalid curve.');
  curves[key]=points.map(p=>{if(!Array.isArray(p)||p.length!==2)throw Error('Invalid curve point.');return [finite(p[0],0,1),finite(p[1],0,1)];});
  if(curves[key][0][0]!==0||curves[key].at(-1)[0]!==1||curves[key].some((p,i)=>i&&p[0]<=curves[key][i-1][0]))throw Error('Curve points must be ordered with endpoints at 0 and 1.');
 }
 let lut=null;if(input.lut){
  const source=input.lut,size=source.size,type=source.type||'3D';if(!['1D','3D'].includes(type)||!Number.isInteger(size)||size<2||size>(type==='3D'?65:65536))throw Error('Unsupported LUT size.');
  const domainMin=source.domainMin??[0,0,0],domainMax=source.domainMax??[1,1,1];
  if(domainMin.length!==3||domainMax.length!==3)throw Error('Invalid LUT domain.');
  for(let k=0;k<3;k++){finite(domainMin[k],-65536,65536);finite(domainMax[k],-65536,65536);if(domainMin[k]>=domainMax[k])throw Error('Invalid LUT domain.');}
  if(!Array.isArray(source.data)||source.data.length!==(type==='3D'?size**3:size)*3)throw Error('Incomplete LUT data.');
  for(const v of source.data)finite(v,-65536,65536);
  lut={name:String(source.name||'Custom LUT').slice(0,160),type,size,domainMin:[...domainMin],domainMax:[...domainMax],data:source.data.slice()};
 }
 return {levels,curves,lut,lutAmount:finite(input.lutAmount??100,0,100)};
}
function parseCubeLUT(text,name='Custom LUT'){
 if(typeof text!=='string'||text.length>16*1024*1024)throw Error('Choose a .cube file smaller than 16 MB.');
 let size,type,domainMin=[0,0,0],domainMax=[1,1,1],title=name;const data=[];
 for(const raw of text.replace(/^\uFEFF/,'').split(/\r?\n/)){
  const line=raw.split('#')[0].trim();if(!line)continue;
  const fields=line.split(/\s+/),key=fields[0];
  if(key==='TITLE'){title=line.slice(5).trim().replace(/^"|"$/g,'');continue;}
  if(key==='LUT_3D_SIZE'||key==='LUT_1D_SIZE'){if(size)throw Error('Combined shaper and 3D LUTs are not supported.');size=Number(fields[1]);type=key==='LUT_3D_SIZE'?'3D':'1D';continue;}
  if(key==='DOMAIN_MIN'||key==='DOMAIN_MAX'){if(fields.length!==4)throw Error('Invalid LUT domain.');if(key==='DOMAIN_MIN')domainMin=fields.slice(1).map(Number);else domainMax=fields.slice(1).map(Number);continue;}
  if(fields.length!==3||fields.some(v=>!Number.isFinite(Number(v))))throw Error('Unsupported or invalid .cube line: '+key);
  data.push(...fields.map(Number));
 }
 if(!size)throw Error('No LUT_3D_SIZE or LUT_1D_SIZE found in the .cube file.');
 return normalizePostColour({lut:{name:title,type,size,domainMin,domainMax,data}}).lut;
}
function postCurveValue(points,x){x=Math.max(0,Math.min(1,x));for(let i=1;i<points.length;i++)if(x<=points[i][0]){const a=points[i-1],b=points[i];return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}return points.at(-1)[1];}
function postLUTValue(lut,r,g,b){
 const values=[r,g,b].map((v,k)=>Math.max(0,Math.min(lut.size-1,(v-lut.domainMin[k])/(lut.domainMax[k]-lut.domainMin[k])*(lut.size-1))));
 const lo=values.map(Math.floor),hi=lo.map(v=>Math.min(v+1,lut.size-1)),f=values.map((v,k)=>v-lo[k]),out=[0,0,0];
 if(lut.type==='1D'){for(let k=0;k<3;k++)out[k]=lut.data[lo[k]*3+k]*(1-f[k])+lut.data[hi[k]*3+k]*f[k];return out;}
 for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++){
  const index=((z?hi[2]:lo[2])*lut.size*lut.size+(y?hi[1]:lo[1])*lut.size+(x?hi[0]:lo[0]))*3,weight=(x?f[0]:1-f[0])*(y?f[1]:1-f[1])*(z?f[2]:1-f[2]);
  for(let k=0;k<3;k++)out[k]+=lut.data[index+k]*weight;
 }return out;
}
if(typeof module!=='undefined')module.exports={normalizePostColour,parseCubeLUT,postCurveValue,postLUTValue};
