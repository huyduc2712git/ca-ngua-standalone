import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

test('A single host.mjs in an otherwise empty directory serves every embedded asset and creates rooms',async t=>{
  const dir=mkdtempSync(fileURLToPath(new URL('../.test-host-',import.meta.url)));
  writeFileSync(join(dir,'host.mjs'),readFileSync(new URL('../render-host/host.mjs',import.meta.url)));
  assert.deepEqual(readdirSync(dir),['host.mjs']);
  const child=spawn(process.execPath,['host.mjs'],{cwd:dir,env:{...process.env,HOST:'127.0.0.1',PORT:'0',ROOMS_FILE:'',TRUST_PROXY:''},stdio:['ignore','pipe','pipe']});
  t.after(async()=>{if(child.exitCode===null&&child.signalCode===null){const stopped=once(child,'exit');child.kill('SIGTERM');await stopped;}rmSync(dir,{recursive:true,force:true});});
  let output='',errors='';child.stderr.on('data',chunk=>errors+=chunk);
  const port=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Embedded startup timed out: '+errors)),5000);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Embedded host exited ${code}: ${errors}`));});
    child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/Máy host: http:\/\/localhost:(\d+)/);if(match){clearTimeout(timer);resolve(Number(match[1]));}});
  });
  const origin=`http://127.0.0.1:${port}`,health=await fetch(origin+'/api/health');
  assert.deepEqual(await health.json(),{ok:true,version:'2.1.0',persistence:false});
  const dist=fileURLToPath(new URL('../dist/',import.meta.url));
  for(const asset of readdirSync(dist,{recursive:true}).filter(path=>/\.(html|mjs|js|css|webmanifest|svg|png)$/.test(path))){
    const path=asset==='index.html'?'/':'/'+asset.replaceAll('\\','/'),response=await fetch(origin+path);
    assert.equal(response.status,200,path);assert.deepEqual(Buffer.from(await response.arrayBuffer()),readFileSync(join(dist,asset)),path);
    if(asset==='sw.js')assert.equal(response.headers.get('service-worker-allowed'),'/');
    if(asset==='manifest.webmanifest')assert.ok(response.headers.get('content-type').includes('application/manifest+json'));
  }
  const created=await fetch(origin+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Host Render',capacity:2})});
  assert.equal(created.status,201);assert.equal((await created.json()).room.members[0].name,'Host Render');
  assert.equal((await fetch(origin+'/host.mjs')).status,404);assert.equal(errors,'');
});
