'use strict';
const {app,clipboard,safeStorage}=require('electron'),fs=require('node:fs/promises'),path=require('node:path');
const root=require('./app-root');app.setName('Comfy Lab');app.setPath('userData',path.join(root,'Data'));
app.whenReady().then(async()=>{
 const report={};
 try{
  const raw=await clipboard.readText();report.clipboardType=typeof raw;if(raw&&typeof raw==='object')report.clipboardFields=Object.keys(raw);const text=typeof raw==='string'?raw.trim():'';
  Object.assign(report,{characters:text.length,looksLikeGoogleKey:text.startsWith('AIza'),containsMask:/[•*…]|\.{3}/.test(text),containsWhitespace:/\s/.test(text),formatAccepted:/^[A-Za-z0-9_-]{20,200}$/.test(text)});
  if(!report.formatAccepted)throw Error('The clipboard does not contain a complete API key. Use the Copy button in Google AI Studio.');
  report.connected=false;report.message='Diagnostic only. Validate your key manually in the desktop app.';
 }catch(e){report.connected=false;report.error=e.message;}
 await fs.writeFile(path.join(root,'Data/gemini-clipboard-check.json'),JSON.stringify(report,null,2));
 app.quit();
});
