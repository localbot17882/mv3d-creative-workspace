'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
module.exports=async function readImage(file,nativeImage){
 if(typeof file!=='string'||!path.isAbsolute(file)||!['.png','.jpg','.jpeg','.webp'].includes(path.extname(file).toLowerCase()))throw Error('Choose a PNG, JPG or WebP image from your computer.');
 const stat=await fs.stat(file);if(!stat.isFile())throw Error('Choose an image file.');if(stat.size>60e6)throw Error('File exceeds 60 MB.');
 const bytes=await fs.readFile(file),image=nativeImage.createFromBuffer(bytes);if(image.isEmpty())throw Error('Cannot read this image.');
 const size=image.getSize();if(size.width*size.height>24e6)throw Error('Use a render up to 24 megapixels.');
 return {file,bytes,...size};
};
