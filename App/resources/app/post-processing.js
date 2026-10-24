'use strict';
const postColourMath=typeof module!=='undefined'?require('./post-colour-math'):{normalizePostColour,postCurveValue,postLUTValue};
const POST_RANGES={exposure:[-2,2],contrast:[-50,50],highlights:[-100,100],shadows:[-100,100],whites:[-100,100],blacks:[-100,100],temperature:[-100,100],tint:[-100,100],saturation:[-100,100],vibrance:[-100,100],sharpness:[0,100],fade:[0,100],vignette:[0,100]};
function normalizePostSettings(input={}){const out={};for(const [key,[lo,hi]] of Object.entries(POST_RANGES)){const value=Number(input[key]??0);if(!Number.isFinite(value)||value<lo||value>hi)throw Error('Invalid setting: '+key);out[key]=value;}return {...out,...postColourMath.normalizePostColour(input)};}
function applyPostPixels(input,width,height,settings){
 const s=normalizePostSettings(settings),out=new Uint8ClampedArray(input.length),gain=2**s.exposure,c=1+s.contrast/100,temp=s.temperature/100,tint=s.tint/100;
 const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4;let r=(input[i]*gain-127.5)*c+127.5,g=(input[i+1]*gain-127.5)*c+127.5,b=(input[i+2]*gain-127.5)*c+127.5;
  const luma=Math.max(0,Math.min(1,(.2126*r+.7152*g+.0722*b)/255));
  const lift=255*(s.shadows/100*.35*(1-smooth(0,.65,luma))+s.highlights/100*.35*smooth(.35,1,luma)+s.whites/100*.25*smooth(.65,1,luma)+s.blacks/100*.25*(1-smooth(0,.35,luma)));
  r=(r+lift)*(1+temp*.18)*(1+tint*.08);g=(g+lift)*(1-tint*.08);b=(b+lift)*(1-temp*.18)*(1+tint*.08);
  const l=.2126*r+.7152*g+.0722*b,max=Math.max(r,g,b),min=Math.min(r,g,b),chroma=(max-min)/Math.max(255,max),sat=1+s.saturation/100+s.vibrance/100*(1-Math.min(1,chroma));
  r=l+(r-l)*sat;g=l+(g-l)*sat;b=l+(b-l)*sat;
  const level=v=>s.levels.outputBlack+(s.levels.outputWhite-s.levels.outputBlack)*Math.max(0,Math.min(1,(v-s.levels.inputBlack)/(s.levels.inputWhite-s.levels.inputBlack)))**(1/s.levels.gamma);
  r=postColourMath.postCurveValue(s.curves.red,postColourMath.postCurveValue(s.curves.master,level(r)/255))*255;
  g=postColourMath.postCurveValue(s.curves.green,postColourMath.postCurveValue(s.curves.master,level(g)/255))*255;
  b=postColourMath.postCurveValue(s.curves.blue,postColourMath.postCurveValue(s.curves.master,level(b)/255))*255;
  if(s.lut&&s.lutAmount){const mapped=postColourMath.postLUTValue(s.lut,r/255,g/255,b/255),mix=s.lutAmount/100;r+=(mapped[0]*255-r)*mix;g+=(mapped[1]*255-g)*mix;b+=(mapped[2]*255-b)*mix;}
  const faded=s.fade/100*.45;r=r*(1-faded)+35*faded;g=g*(1-faded)+35*faded;b=b*(1-faded)+35*faded;
  const nx=(x-(width-1)/2)/Math.max(1,(width-1)/2),ny=(y-(height-1)/2)/Math.max(1,(height-1)/2),v=1-s.vignette/100*.75*smooth(.2,1,(nx*nx+ny*ny)/2);
  out[i]=r*v;out[i+1]=g*v;out[i+2]=b*v;out[i+3]=input[i+3];
 }
 if(s.sharpness>0){const base=new Uint8ClampedArray(out),a=s.sharpness/100;for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const i=(y*width+x)*4;for(let k=0;k<3;k++)out[i+k]=base[i+k]+a*(base[i+k]-(base[i-4+k]+base[i+4+k]+base[i-width*4+k]+base[i+width*4+k])/4);}}
 return out;
}
if(typeof module!=='undefined')module.exports={applyPostPixels,POST_RANGES,normalizePostSettings};
