'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements={},calls=[];
function element(){return {events:{},after(){},focus(){},dataset:{},value:'',disabled:false,open:false,textContent:'',maxLength:4000,addEventListener(name,fn){this.events[name]=fn;},scrollIntoView(){},dispatchEvent(){},showModal(){this.open=true;},close(){this.open=false;},querySelectorAll(){return [];},querySelector(){return {textContent:''};},set innerHTML(html){for(const [,id] of html.matchAll(/id="([^"]+)"/g))elements[id]=element();}};}
const field=Object.assign(element(),{id:'prompt',value:'Una casa con luz natural',after(button){elements.assistantButton=button;}});
let connected=false;
const context={setTimeout,URLSearchParams,window:{location:{search:''}},document:{createElement:()=>element(),body:{append(){}},querySelectorAll:()=>[field],querySelector:()=>({textContent:'Prompt'})},$:id=>elements[id],task:'enhance',Event:class{},api:{assistantPasteKey:async()=> 'FAKE_TEST_KEY_NOT_A_REAL_CREDENTIAL',assistantStatus:async()=>({connected}),assistantConnect:async()=>{calls.push('connect');connected=true;},assistantGenerate:async()=>{calls.push('generate');return {text:'A house in natural daylight.'};},assistantDisconnect:async()=>{connected=false;}}};
vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../App/resources/app/prompt-assistant.js','utf8'),context);context.initializePromptAssistant();
(async()=>{
 await elements.assistantButton.onclick();elements.assistantModel.value='gemini-3.5-flash-lite';elements.assistantKey.value='FAKE_TEST_KEY_NOT_A_REAL_CREDENTIAL';
 await elements.assistantPasteKey.onclick();assert.equal(elements.assistantKey.value,'FAKE_TEST_KEY_NOT_A_REAL_CREDENTIAL');assert.deepEqual(calls,[]);await elements.assistantGenerate.onclick();assert.deepEqual(calls,['connect','generate']);assert.equal(elements.assistantKey.value,'');assert.equal(field.value,'Una casa con luz natural');assert.equal(elements.assistantOutput.value,'A house in natural daylight.');assert.equal(elements.assistantApply.disabled,false);
 elements.assistantApply.onclick();assert.equal(field.value,'A house in natural daylight.');
 console.log('Paste button passed: key remains in the field until Generate; connection, generation and Apply complete.');
})().catch(e=>{console.error(e);process.exitCode=1;});
