const assert=require('node:assert/strict');
const {applyPostPixels:apply,normalizePostSettings:normalize,POST_RANGES}=require('../App/resources/app/post-processing');
const ramp=new Uint8ClampedArray(Array.from({length:256},(_,i)=>[i,i,i,i]).flat());
assert.deepEqual(apply(ramp,256,1,{}),ramp);
const shadows=apply(ramp,256,1,{shadows:40}),highlights=apply(ramp,256,1,{highlights:-40});
assert(shadows[32*4]-32>shadows[220*4]-220);
assert(220-highlights[220*4]>32-highlights[32*4]);
const solid=new Uint8ClampedArray(9*9*4).fill(180),vignette=apply(solid,9,9,{vignette:100});
assert(vignette[0]<vignette[(4*9+4)*4]);
for(const [key,[min,max]] of Object.entries(POST_RANGES))for(const value of [min,max]){
 const result=apply(ramp,256,1,{[key]:value});
 for(let i=3;i<result.length;i+=4)assert.equal(result[i],ramp[i]);
}
assert.throws(()=>normalize({tint:Infinity}));assert.throws(()=>normalize({shadows:101}));
assert.equal(normalize({exposure:1}).tint,0);
console.log('Neutral pixels, tonal isolation, vignette, alpha, ranges and old presets passed.');
const {parseCubeLUT,postLUTValue}=require('../App/resources/app/post-colour-math');
let cube='TITLE "Identity"\nLUT_3D_SIZE 2\n';for(let b=0;b<2;b++)for(let g=0;g<2;g++)for(let r=0;r<2;r++)cube+=`${r} ${g} ${b}\n`;
const lut=parseCubeLUT(cube);const sample=postLUTValue(lut,.2,.4,.8);sample.forEach((v,i)=>assert(Math.abs(v-[.2,.4,.8][i])<1e-8));
assert.deepEqual(apply(ramp,256,1,{lut}),ramp);
assert.throws(()=>parseCubeLUT('LUT_3D_SIZE 33\n0 0 0'));
assert.throws(()=>parseCubeLUT('LUT_3D_SIZE 2\nLUT_1D_SIZE 2'));
const identity1d=parseCubeLUT('LUT_1D_SIZE 2\n0 0 0\n1 1 1');assert.deepEqual(apply(ramp,256,1,{lut:identity1d}),ramp);
const curve=apply(ramp,256,1,{curves:{master:[[0,0],[.5,.7],[1,1]]}});assert(curve[128*4]>ramp[128*4]);
const levels=apply(ramp,256,1,{levels:{inputBlack:32,inputWhite:220,gamma:1,outputBlack:0,outputWhite:255}});assert.equal(levels[32*4],0);assert.equal(levels[220*4],255);
const roundtrip=JSON.parse(JSON.stringify(normalize({lut,curves:{red:[[0,0],[.5,.4],[1,1]]},levels:{gamma:1.2}})));assert.deepEqual(normalize(roundtrip),roundtrip);
console.log('Curves, levels, identity 1D/3D LUT interpolation, invalid files and preset roundtrip passed.');
