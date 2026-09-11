import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createApp, getLanUrls } from '../server.mjs';

test('Denied network interface discovery never prevents server startup',()=>{
  assert.deepEqual(getLanUrls(3000,()=>{throw new Error('uv_interface_addresses denied');}),[]);
  assert.deepEqual(getLanUrls(3000,()=>({lo:[{family:'IPv4',internal:true,address:'127.0.0.1'}],eth0:[{family:'IPv4',internal:false,address:'192.168.1.2'},{family:'IPv6',internal:false,address:'::1'}]})),['http://192.168.1.2:3000']);
});

test('Production startup command stays alive and serves the game and health endpoint',async t=>{
  const child=spawn(process.execPath,['server.mjs'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,HOST:'127.0.0.1',PORT:'0'},stdio:['ignore','pipe','pipe']});
  t.after(async()=>{if(child.exitCode!==null||child.signalCode!==null)return;const stopped=once(child,'exit');child.kill('SIGTERM');await stopped;});
  let output='',errors='';child.stderr.on('data',chunk=>{errors+=chunk;});
  const port=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Startup timed out: '+errors)),5000);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Server exited ${code}: ${errors}`));});
    child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/Máy host: http:\/\/localhost:(\d+)/);if(match){clearTimeout(timer);resolve(Number(match[1]));}});
  });
  const health=await fetch(`http://127.0.0.1:${port}/api/health`);assert.equal(health.status,200);assert.equal((await health.json()).ok,true);
  const page=await fetch(`http://127.0.0.1:${port}/`);assert.equal(page.status,200);assert.match(await page.text(),/Cá Ngựa Club/);assert.equal(child.exitCode,null);assert.equal(errors,'');
});

async function fixture(t,options={}){
  const {server,rooms}=createApp(options);server.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;const controllers=[];
  let stopped=false;const stop=async()=>{if(stopped)return;stopped=true;controllers.forEach(c=>c.abort());server.closeAllConnections();await new Promise(r=>server.close(r));};t.after(stop);
  async function call(path,data,token,extra={}){const r=await fetch(origin+'/api'+path,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json'}:{}),...(token?{'X-Player-Token':token}:{}),...extra},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,...await r.json()};}
  let actionIndex=0;const action=(person,room,type,data={})=>call(`/rooms/${room.code}/action`,{type,revision:room.revision,actionId:`test-action-${++actionIndex}`,...data},person.token);
  async function stream(person){const controller=new AbortController();controllers.push(controller);const response=await fetch(origin+`/api/rooms/${person.room.code}/events`,{headers:{'X-Player-Token':person.token},signal:controller.signal});assert.equal(response.status,200);const states=[];const decoder=new TextDecoder(),reader=response.body.getReader();let buffer='';const running=(async()=>{try{while(true){const r=await reader.read();if(r.done)break;buffer+=decoder.decode(r.value,{stream:true});let i;while((i=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,i);buffer=buffer.slice(i+2);const line=block.split('\n').find(s=>s.startsWith('data: '));if(line)states.push(JSON.parse(line.slice(6)));}}}catch{}})();return {states,controller,running};}
  async function pair(){const a=await call('/rooms',{name:'Người A',capacity:2});const b=await call(`/rooms/${a.room.code}/join`,{name:'Người B'});const sa=await stream(a),sb=await stream(b);const ready=await action(b,b.room,'ready',{ready:true});assert.equal(ready.status,200);const started=await action(a,ready.room,'start');assert.equal(started.status,200);return {a,b,room:started.room,sa,sb};}
  return {origin,server,rooms,call,action,stream,pair,stop};
}
test('LAN room works across two independent authenticated streams; dice is host-authoritative',async t=>{
  const f=await fixture(t,{dice:()=>6}),{a,b,room,sa,sb}=await f.pair();
  const invalid=await f.action(b,room,'roll');assert.notEqual(invalid.status,200);
  const rolled=await f.action(a,room,'roll',{die:2,playerId:b.playerId});assert.equal(rolled.status,200);assert.equal(rolled.room.game.dice,6);
  const moved=await f.action(a,rolled.room,'move',{piece:0});assert.equal(moved.status,200);assert.equal(moved.room.game.players[0].pieces[0],0);
  await new Promise(r=>setTimeout(r,30));assert.deepEqual(sa.states.at(-1),sb.states.at(-1));assert.equal(sa.states.at(-1).revision,moved.room.revision);
  assert.ok(!JSON.stringify(moved.room).includes(a.token));assert.ok(!JSON.stringify(moved.room).includes(b.token));
  const restored=await f.call(`/rooms/${room.code}`,null,b.token);assert.deepEqual(restored.room.game,moved.room.game);
});
test('Simultaneous dice requests are serialized; action IDs prevent duplicate execution',async t=>{
  let rolls=0;const f=await fixture(t,{dice:()=>{rolls++;return 1;}}),{a,room}=await f.pair();
  const results=await Promise.all([f.action(a,room,'roll'),f.action(a,room,'roll')]);assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);assert.equal(rolls,1);
  const latest=results.find(r=>r.status===200).room;const payload={type:'move',piece:0,revision:latest.revision,actionId:'retry-same-action'};
  const first=await f.call(`/rooms/${room.code}/action`,payload,a.token);const retry=await f.call(`/rooms/${room.code}/action`,payload,a.token);assert.equal(retry.duplicate,true);assert.equal(first.room.revision,retry.room.revision);assert.equal(retry.room.game.players[0].pieces[0],0);
});
test('Room capacity, readiness, identity, and cross-origin boundaries are enforced',async t=>{
  const f=await fixture(t),a=await f.call('/rooms',{name:'Host',capacity:2});
  const alone=await f.action(a,a.room,'start');assert.equal(alone.status,409);
  const b=await f.call(`/rooms/${a.room.code}/join`,{name:'Bạn'});assert.equal(b.status,200);
  const full=await f.call(`/rooms/${a.room.code}/join`,{name:'Thêm'});assert.equal(full.status,409);
  const wrong=await f.call(`/rooms/${a.room.code}`,null,'a'.repeat(64));assert.equal(wrong.status,401);
  const unready=await f.action(a,b.room,'start');assert.equal(unready.status,409);
  const nonhost=await f.action(b,b.room,'start');assert.equal(nonhost.status,403);
  const foreign=await f.call('/rooms',{name:'X'},null,{Origin:'https://example.com'});assert.equal(foreign.status,403);
  const badName=await f.call('/rooms',{name:'<script>',capacity:2});assert.equal(badName.status,400);
  const get=await f.call(`/rooms/${a.room.code}`,null,a.token);assert.equal(get.room.phase,'lobby');
});
test('Leaving host transfers ownership and ends a two-player game by forfeit; rematch resets readiness',async t=>{
  const f=await fixture(t),{a,b,room}=await f.pair();const left=await f.action(a,room,'leave');assert.equal(left.status,200);const state=await f.call(`/rooms/${room.code}`,null,b.token);assert.equal(state.room.hostId,b.playerId);assert.equal(state.room.game.winner,b.playerId);assert.equal(state.room.game.status,'finished');const rematch=await f.action(b,state.room,'rematch');assert.equal(rematch.room.game,null);assert.equal(rematch.room.members.length,1);assert.equal(rematch.room.members[0].ready,true);
});
test('Disconnected seat can reconnect with its token, or be removed only after the grace period',async t=>{
  let time=10000;const f=await fixture(t,{now:()=>time}),{a,b,room,sa,sb}=await f.pair();sb.controller.abort();await sb.running;await new Promise(r=>setTimeout(r,20));
  const early=await f.action(a,room,'remove',{playerId:b.playerId});assert.equal(early.status,409);
  const reconnected=await f.stream(b);assert.equal(reconnected.controller.signal.aborted,false);reconnected.controller.abort();await reconnected.running;await new Promise(r=>setTimeout(r,20));time+=61_000;
  const removed=await f.action(a,room,'remove',{playerId:b.playerId});assert.equal(removed.status,200);assert.equal(removed.room.game.winner,a.playerId);const expired=await f.call(`/rooms/${room.code}`,null,b.token);assert.equal(expired.status,401);
});
test('All standalone assets load, scripts use local dependencies and unknown files stay private',async t=>{
  const f=await fixture(t);for(const [path,mime]of [['/','text/html'],['/app.mjs','text/javascript'],['/engine.mjs','text/javascript'],['/icons.mjs','text/javascript'],['/style.css','text/css'],['/favicon.svg','image/svg+xml']]){const r=await fetch(f.origin+path);assert.equal(r.status,200,path);assert.ok(r.headers.get('content-type').includes(mime));const text=await r.text();assert.ok(text.length>40);if(path==='/')assert.ok(!/<(?:script|link)[^>]+(?:src|href)="https?:/.test(text));}
  const hidden=await fetch(f.origin+'/server.mjs');assert.equal(hidden.status,404);const traversal=await fetch(f.origin+'/%2e%2e%2fserver.mjs');assert.equal(traversal.status,404);
});

function temporaryDirectory(t){const dir=mkdtempSync(fileURLToPath(new URL('../.test-data-',import.meta.url)));t.after(()=>rmSync(dir,{recursive:true,force:true}));return dir;}

test('Persistent rooms survive a host restart with the same seats, board and deduplication receipts',async t=>{
  const dir=temporaryDirectory(t),storeFile=join(dir,'rooms.json'),f=await fixture(t,{storeFile,dice:()=>6}),{a,b,room}=await f.pair();
  const rolled=await f.action(a,room,'roll'),payload={type:'move',piece:0,revision:rolled.room.revision,actionId:'durable-move-action'};
  const moved=await f.call(`/rooms/${room.code}/action`,payload,a.token);assert.equal(moved.status,200);
  const disk=JSON.parse(readFileSync(storeFile,'utf8'));assert.equal(disk.schema,1);assert.equal(disk.rooms[0].game.players[0].pieces[0],0);if(process.platform!=='win32')assert.equal(statSync(storeFile).mode&0o077,0);
  assert.equal((await fetch(f.origin+'/rooms.json')).status,404);
  await f.stop();
  const restarted=await fixture(t,{storeFile,dice:()=>{throw new Error('Retry must not roll again');}});
  const state=await restarted.call(`/rooms/${room.code}`,null,b.token);assert.equal(state.status,200);assert.deepEqual(state.room.game,moved.room.game);assert.equal(state.room.revision,moved.room.revision);assert.ok(state.room.members.every(p=>!p.online));
  const retry=await restarted.call(`/rooms/${room.code}/action`,payload,a.token);assert.equal(retry.duplicate,true);assert.equal(retry.room.revision,moved.room.revision);
  const stream=await restarted.stream(b);await new Promise(r=>setTimeout(r,20));assert.equal(stream.states.at(-1).members.find(p=>p.id===b.playerId).online,true);
  const health=await restarted.call('/health');assert.equal(health.persistence,true);
});

test('Corrupt saved rooms fail startup without replacing the original data',t=>{
  const file=join(temporaryDirectory(t),'rooms.json'),content='{"schema":999,"rooms":[]}';writeFileSync(file,content);
  assert.throws(()=>createApp({storeFile:file}),/không hợp lệ/);assert.equal(readFileSync(file,'utf8'),content);
});

test('Expired rooms are removed from both memory and the snapshot on restart',async t=>{
  const storeFile=join(temporaryDirectory(t),'rooms.json');let time=10000;
  const f=await fixture(t,{storeFile,now:()=>time}),room=await f.call('/rooms',{name:'Host'});await f.stop();time+=25*60*60*1000;
  const restarted=await fixture(t,{storeFile,now:()=>time});assert.equal((await restarted.call(`/rooms/${room.room.code}`,null,room.token)).status,404);assert.equal(JSON.parse(readFileSync(storeFile,'utf8')).rooms.length,0);
});
