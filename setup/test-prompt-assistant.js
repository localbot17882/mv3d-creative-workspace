'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const root=path.join(__dirname,'prompt-assistant-test'),handlers={},calls=[];
const token='TEST.GEMINI/KEY+WITH=PUNCTUATION_FOR_FIXTURE_ONLY_12345';let http=200,answer='Natural daylight, crisp architectural detail.';
const safeStorage={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s.split('').reverse().join('')),decryptString:b=>b.toString().split('').reverse().join('')};
require('../App/resources/app/prompt-assistant-main')({root,safeStorage,nativeImage:{createFromBuffer:()=>({isEmpty:()=>false,getSize:()=>({width:2048,height:1024}),resize:size=>({toJPEG:()=>{assert.equal(size.width,1280);return Buffer.from('jpeg-fixture');}})})},clipboard:{readText:async()=>token},ipcMain:{handle:(k,fn)=>handlers[k]=fn},shell:{openExternal:async()=>{}},request:async(url,options)=>{calls.push({url,options});return {ok:http===200,status:http,json:async()=>options.method==='GET'?{name:'models/gemini-3.5-flash-lite'}:{candidates:[{finishReason:'STOP',content:{parts:[{text:answer}]}}]}};}});
const call=(name,arg)=>handlers['assistant-'+name](null,arg);
(async()=>{
 await fs.rm(path.join(root,'Data/gemini-prompt-key.enc'),{force:true});
 assert.equal((await call('status')).connected,false);assert.equal(await call('paste-key'),token);
 await assert.rejects(()=>call('connect',{key:'short',model:'gemini-3.5-flash-lite'}));
 await call('connect',{key:token,model:'gemini-3.5-flash-lite'});
 assert.equal(calls.at(-1).url,'https://generativelanguage.googleapis.com/v1beta/models','Validate credentials independently of model availability.');
 assert.equal((await call('status')).connected,true);
 assert(!(await fs.readFile(path.join(root,'Data/gemini-prompt-key.enc'))).includes(token));
 for(const field of ['prompt','peopleNegative','videoPrompt','audioPrompt','audioNegative','studioPrompt','studioNegative']){
  const result=await call('generate',{model:'gemini-3.5-flash-lite',field,current:'Luz natural',idea:'Translate to English',tool:'refine'});assert.equal(result.text,answer);
  const body=JSON.parse(calls.at(-1).options.body);assert.equal(body.contents[0].parts.length,1);assert(!body.tools);
  if(field.endsWith('Negative'))assert(body.systemInstruction.parts[0].text.includes('comma-separated'));
 }

 const vision=await call('video-image',{image:'data:image/png;base64,c291cmNl',tool:'image'});assert.equal(vision.text,answer);const parts=JSON.parse(calls.at(-1).options.body).contents[0].parts;assert.equal(parts[1].inlineData.mimeType,'image/jpeg');assert.equal(Buffer.from(parts[1].inlineData.data,'base64').toString(),'jpeg-fixture');await assert.rejects(()=>call('video-image',{image:'file:///private'}),/reference image/);
 const project='12345678-1234-1234-1234-123456789012',folder=path.join(root,'Data/canvas-projects',project);await fs.mkdir(folder,{recursive:true});await fs.writeFile(path.join(folder,'project.json'),JSON.stringify({name:'Test',nodes:[],edges:[],assets:[]}));answer=JSON.stringify({reply:'You can connect an image to video.',workflow:null});const chat=await call('canvas-chat',{project,message:'How do I animate an image?',history:[{role:'user',text:'Hello'}]});assert.equal(chat.proposal,null);assert(chat.reply.includes('image'));answer='Natural daylight, crisp architectural detail.';
 answer=JSON.stringify({title:'Forest house',shots:[{title:'Approach',description:'Exterior',imagePrompt:'A modern house in a pine forest.',motionPrompt:'Slow dolly in.',duration:2},{title:'Interior',description:'Living room',imagePrompt:'A calm living room with timber walls.',motionPrompt:'Gentle pan.',duration:2}]});const story=await call('storyboard',{idea:'A quiet house film',count:2,aspectRatio:'16:9'});assert.equal(story.shots.length,2);await assert.rejects(()=>call('storyboard',{idea:'test',count:100}),/1 to 12/);answer=JSON.stringify({title:'Invalid',shots:[{}]});await assert.rejects(()=>call('storyboard',{idea:'test',count:1}),/prompt/);answer='Natural daylight.';
 const improvedStory=await call('generate',{model:'gemini-3.5-flash-lite',field:'storyboardIdea',current:'A house in a forest',idea:'Add a clear ending'});assert(improvedStory.text);assert(JSON.parse(calls.at(-1).options.body).systemInstruction.parts[0].text.includes('beginning, middle and ending'));
 const before=calls.length;http=429;
 await assert.rejects(()=>call('generate',{model:'gemini-3.5-flash-lite',field:'prompt',current:'A house'}),/quota reached/);
 assert.equal(calls.length,before+1,'Quota error must not retry or switch models');assert.equal((await call('status')).running,false);
 assert(calls.every(c=>!c.url.includes(token)&&c.options.headers['x-goog-api-key']===token));
 await assert.rejects(()=>call('generate',{model:'paid-model',field:'prompt',current:'A house'}),/Unsupported/);
 await call('disconnect');assert.equal((await call('status')).connected,false);
 console.log('Assistant passed: all prompt fields, encrypted storage flow, key isolation, quota stop, no fallback and disconnect. Mock API only.');
})().catch(e=>{console.error(e);process.exitCode=1;});
