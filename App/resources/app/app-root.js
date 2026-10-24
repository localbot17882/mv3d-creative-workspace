'use strict';
const path=require('node:path'),fs=require('node:fs');
const portable=path.resolve(__dirname,'../../..');
module.exports=path.resolve(process.env.COMFY_LAB_ROOT||(fs.existsSync(path.join(portable,'ComfyUI'))?portable:path.join(__dirname,'..')));
