'use strict';
(()=>{
 const sidebar=document.querySelector('.postLayout aside'),reset=document.getElementById('postReset');
 sidebar.querySelector('p').textContent='Colour, light and finishing controls. Compare with the original and export at full resolution.';
 const groups=[['Light',['exposure','contrast','highlights','shadows','whites','blacks']],['Colour',['temperature','tint','saturation','vibrance']],['Finishing',['sharpness','fade','vignette']]];
 for(const [title,keys] of groups){
  const section=document.createElement('details');section.className='postColourGroup';section.open=title==='Light';const heading=document.createElement('summary');heading.textContent=title;section.append(heading);
  for(const key of keys){let control=document.getElementById('post_'+key)?.closest('.slider');
   if(!control){control=document.createElement('div');control.className='slider';const label=document.createElement('label');label.htmlFor='post_'+key;label.textContent=key[0].toUpperCase()+key.slice(1);const output=document.createElement('output');output.id='post_'+key+'Val';output.textContent='0';label.append(output);const input=document.createElement('input');input.id='post_'+key;input.type='range';[input.min,input.max]=POST_RANGES[key];input.step=key==='exposure'?.05:1;input.value=0;control.append(label,input);}
   section.append(control);
  }
  sidebar.insertBefore(section,reset);
 }
})();
