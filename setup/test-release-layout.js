'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'..'),app=path.join(root,'App/resources/app'),html=fs.readFileSync(path.join(app,'index.html'),'utf8');
for(const match of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g)){
 const target=match[1];if(/^(?:https?:|data:|#)/.test(target))continue;
 assert(fs.existsSync(path.join(app,target)),`Missing UI dependency: ${target}`);
}
for(const file of fs.readdirSync(app).filter(f=>f.endsWith('.js'))){const source=fs.readFileSync(path.join(app,file),'utf8'),resolve=createRequire(path.join(app,file)).resolve;
 for(const match of source.matchAll(/require\(['"](\.\.?\/[^'"]+)['"]\)/g))assert.doesNotThrow(()=>resolve(match[1]),`${file}: missing ${match[1]}`);
}
assert(html.includes('enhance-workspace.js'));assert(html.includes('post-grading-controls.js'));
assert(!html.includes('F:\\Codex\\PPG-Lab'));
console.log('Release layout passed: renderer scripts/styles, local module dependencies, Enhance sections and colour grading included.');
