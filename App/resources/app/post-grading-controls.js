'use strict';
(()=>{
 const side=document.querySelector('.postLayout aside'),anchor=document.querySelectorAll('.postColourGroup')[2];let state=normalizePostColour(),selected=0,dragging=false;
 const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
 function section(title){const node=el('details'),heading=el('summary',title);node.className='postColourGroup';node.append(heading);side.insertBefore(node,anchor);return node;}
 const curves=section('RGB curves'),channel=el('select');channel.id='postCurveChannel';channel.setAttribute('aria-label','Curve channel');
 for(const [value,text] of [['master','RGB'],['red','Red'],['green','Green'],['blue','Blue']]){const option=el('option',text);option.value=value;channel.append(option);}curves.append(channel);
 const canvas=el('canvas');canvas.id='postCurveCanvas';canvas.width=320;canvas.height=220;canvas.style.cssText='width:100%;height:auto;touch-action:none;border-radius:8px;background:#211927;cursor:crosshair';canvas.setAttribute('aria-label','RGB curve editor. Click to add a point and drag to adjust.');curves.append(canvas);
 curves.append(el('p','Click to add points. Drag to adjust. Double-click a point to remove it.'));
 const reset=el('button','Reset this curve');reset.id='postCurveReset';curves.append(reset);
 const levelGroup=section('Levels'),levelInputs={};
 for(const [key,title,min,max,step] of [['inputBlack','Input black',0,254,1],['gamma','Midtones / gamma',.1,3,.01],['inputWhite','Input white',1,255,1],['outputBlack','Output black',0,255,1],['outputWhite','Output white',0,255,1]]){
  const row=el('div'),label=el('label',title),output=el('output'),input=el('input');row.className='slider';input.type='range';input.id='postLevel_'+key;label.htmlFor=input.id;input.min=min;input.max=max;input.step=step;label.append(output);row.append(label,input);levelGroup.append(row);levelInputs[key]={input,output};
  input.oninput=()=>{let v=Number(input.value);if(key==='inputBlack')v=Math.min(v,state.levels.inputWhite-1);if(key==='inputWhite')v=Math.max(v,state.levels.inputBlack+1);if(key==='outputBlack')v=Math.min(v,state.levels.outputWhite);if(key==='outputWhite')v=Math.max(v,state.levels.outputBlack);state.levels[key]=v;input.value=v;output.textContent=v;renderPost();};
 }
 const lutGroup=section('Creative LUT'),file=el('input');file.type='file';file.accept='.cube';file.hidden=true;file.id='postLUTFile';
 const load=el('button','Load .cube LUT'),remove=el('button','Remove LUT'),name=el('p','No LUT loaded'),amount=el('input'),amountLabel=el('label','LUT intensity'),amountValue=el('output');
 load.id='postLUTLoad';remove.id='postLUTRemove';name.id='postLUTName';amount.type='range';amount.min=0;amount.max=100;amount.value=100;amount.id='postLUTAmount';amountLabel.htmlFor=amount.id;amountLabel.append(amountValue);lutGroup.append(load,file,name,amountLabel,amount,remove);
 load.onclick=()=>file.click();file.onchange=async()=>{try{const chosen=file.files?.[0];if(!chosen)return;if(chosen.size>16*1024*1024)throw Error('Choose a .cube file smaller than 16 MB.');state.lut=parseCubeLUT(await chosen.text(),chosen.name);state.lutAmount=100;refresh();renderPost();}catch(e){name.textContent=e.message;}finally{file.value='';}};
 remove.onclick=()=>{state.lut=null;refresh();renderPost();};amount.oninput=()=>{state.lutAmount=Number(amount.value);amountValue.textContent=amount.value+'%';renderPost();};
 const points=()=>state.curves[channel.value];
 function draw(){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,320,220);ctx.strokeStyle='#53465e';ctx.lineWidth=1;for(let i=0;i<=4;i++){const x=12+296*i/4,y=12+196*i/4;ctx.beginPath();ctx.moveTo(x,12);ctx.lineTo(x,208);ctx.moveTo(12,y);ctx.lineTo(308,y);ctx.stroke();}ctx.strokeStyle={master:'#edff4b',red:'#ff7979',green:'#91e898',blue:'#8eb6ff'}[channel.value];ctx.lineWidth=2;ctx.beginPath();points().forEach((p,i)=>ctx[i?'lineTo':'moveTo'](12+p[0]*296,208-p[1]*196));ctx.stroke();points().forEach((p,i)=>{ctx.beginPath();ctx.arc(12+p[0]*296,208-p[1]*196,i===selected?5:4,0,Math.PI*2);ctx.fillStyle=i===selected?'white':ctx.strokeStyle;ctx.fill();});}
 function coords(e){const r=canvas.getBoundingClientRect();return [Math.max(0,Math.min(1,((e.clientX-r.left)*320/r.width-12)/296)),Math.max(0,Math.min(1,(208-(e.clientY-r.top)*220/r.height)/196))];}
 canvas.onpointerdown=e=>{const p=coords(e),list=points();selected=list.findIndex(a=>Math.hypot((p[0]-a[0])*296,(p[1]-a[1])*196)<13);if(selected<0){if(list.length>=16)return;selected=list.findIndex(a=>a[0]>p[0]);if(selected<1)return;list.splice(selected,0,p);}dragging=true;canvas.setPointerCapture(e.pointerId);draw();renderPost();};
 canvas.onpointermove=e=>{if(!dragging)return;const p=coords(e),list=points();p[0]=selected===0?0:selected===list.length-1?1:Math.max(list[selected-1][0]+.005,Math.min(list[selected+1][0]-.005,p[0]));list[selected]=p;draw();renderPost();};
 canvas.onpointerup=canvas.onpointercancel=()=>{dragging=false;};canvas.ondblclick=()=>{if(selected>0&&selected<points().length-1){points().splice(selected,1);selected=0;draw();renderPost();}};
 channel.onchange=()=>{selected=0;draw();};reset.onclick=()=>{state.curves[channel.value]=[[0,0],[1,1]];selected=0;draw();renderPost();};
 function refresh(){for(const [key,{input,output}] of Object.entries(levelInputs)){input.value=state.levels[key];output.textContent=input.value;}amount.value=state.lutAmount;amountValue.textContent=state.lutAmount+'%';name.textContent=state.lut?state.lut.name+' · '+state.lut.type+' · '+state.lut.size:'No LUT loaded';remove.disabled=!state.lut;amount.disabled=!state.lut;draw();}
 window.postGrading={get:()=>structuredClone(state),set:input=>{state=normalizePostColour(input);selected=0;refresh();}};refresh();
})();
