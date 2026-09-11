import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {COLORS,createGame,rollDice,movePiece} from '../dist/engine.mjs';
import {getTurnStatus} from '../dist/turn-status.mjs';
import {hopPose,moveRoute,boardCell,frameAnimation} from '../dist/motion.mjs';
import {HORSE_CONTOURS} from '../dist/horse-geometry.mjs';
import {triangulate,signedArea,extrude,boardCamera,project} from '../dist/geometry.mjs';

test('Horse jumps lift above the board and land at every intermediate cell',()=>{
  const p=createGame([{id:'a',name:'A',color:0},{id:'b',name:'B',color:2}]).players[0];p.pieces[0]=4;
  const route=moveRoute(p,0,{from:4,path:[5,6,7,8,9,10]});assert.equal(route.length,7);
  for(let i=1;i<route.length;i++){
    const a=route[i-1],b=route[i];assert.equal(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]),1);
    const start=hopPose(a,b,0),middle=hopPose(a,b,.5),end=hopPose(a,b,1);
    assert.equal(start.x,a[0]);assert.equal(start.z,a[1]);assert.equal(start.y,0);assert.ok(middle.y>.6);
    assert.equal(end.x,b[0]);assert.equal(end.z,b[1]);assert.ok(Math.abs(end.y)<1e-10);
  }
  assert.deepEqual(boardCell(p,0,55),[7,0]);assert.deepEqual(boardCell(p,0,56),[7,1]);
});
test('Animation uses intermediate frames and completes immediately when backgrounded/aborted',async()=>{
  const frames=[],ticks=[],controller=new AbortController();
  const animation=frameAnimation(260,t=>frames.push(t),{signal:controller.signal,clock:()=>0,requestFrame:fn=>ticks.push(fn)});
  ticks.shift()(130);assert.ok(frames.includes(.5));controller.abort();await animation;assert.equal(frames.at(-1),1);
  ticks.shift()?.(260);assert.equal(frames.at(-1),1);
});
test('Extruded horse geometry preserves silhouette area and creates finite 3D surfaces',()=>{
  for(const contour of HORSE_CONTOURS){const faces=triangulate(contour);let sum=0;for(let i=0;i<faces.length;i+=3)sum+=Math.abs(signedArea([contour[faces[i]],contour[faces[i+1]],contour[faces[i+2]]]));assert.ok(Math.abs(sum-Math.abs(signedArea(contour)))<1e-8);const mesh=extrude(contour,.24,true);assert.ok(mesh.length>0);assert.ok(mesh.every(Number.isFinite));for(let i=3;i<mesh.length;i+=8)assert.ok(Math.abs(Math.hypot(mesh[i],mesh[i+1],mesh[i+2])-1)<1e-6);}
});
test('3D camera projection keeps the board in view through rotation',()=>{
  for(const zoom of [.85,1,1.06])for(let yaw=0;yaw<Math.PI*2;yaw+=Math.PI/32){const {matrix}=boardCamera(yaw,zoom);for(const x of [-8.6,8.6])for(const z of [-8.6,8.6])for(const y of [-.4,1.8]){const point=project(matrix,[x,y,z],640,640);assert.ok(point.every(Number.isFinite));assert.ok(point[0]>=0&&point[0]<=640&&point[1]>=0&&point[1]<=640,JSON.stringify({yaw,zoom,point}));}}
});
test('PWA manifest has install dimensions, standalone display and local icons',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../dist/manifest.webmanifest',import.meta.url),'utf8'));
  assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'/');assert.ok(manifest.icons.some(i=>i.sizes==='192x192'));assert.ok(manifest.icons.some(i=>i.sizes==='512x512'&&i.purpose==='maskable'));
  for(const icon of manifest.icons){const png=readFileSync(new URL('../dist'+icon.src,import.meta.url));assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');const size=Number(icon.sizes.split('x')[0]);assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);}
});
test('Service worker caches a complete offline game and never intercepts room APIs or writes',async()=>{
  const handlers={},cached=[],deleted=[],root={offline:true};let claimed=false;
  const cache={addAll:async assets=>cached.push(...assets),match:async path=>path==='/'?root:null};
  const context={URL,Promise,caches:{open:async()=>cache,keys:async()=>['ca-ngua-static-v1','unrelated-app','ca-ngua-static-v2.1.1'],delete:async key=>deleted.push(key)},fetch:async()=>{throw new Error('offline');},self:{location:{origin:'https://game.example'},addEventListener:(name,handler)=>handlers[name]=handler,clients:{claim:async()=>{claimed=true;}},skipWaiting:()=>{}}};
  vm.runInNewContext(readFileSync(new URL('../dist/sw.js',import.meta.url),'utf8'),context);
  const wait=async handler=>{let pending;handler({waitUntil:p=>pending=p});await pending;};
  await wait(handlers.install);for(const path of ['/','/app.mjs','/board3d.mjs','/horse-geometry.mjs','/engine.mjs','/board-art.mjs','/turn-status.mjs','/assets/walnut.png'])assert.ok(cached.includes(path));
  await wait(handlers.activate);assert.deepEqual(deleted,['ca-ngua-static-v1']);assert.equal(claimed,true);
  for(const [url,method]of [['https://game.example/api/rooms/ABCDEF/events','GET'],['https://game.example/api/rooms','POST'],['https://other.example/','GET']]){let intercepted=false;handlers.fetch({request:{url,method,mode:'cors'},respondWith:()=>{intercepted=true;}});assert.equal(intercepted,false);}
  let navigation;handlers.fetch({request:{url:'https://game.example/?source=pwa',method:'GET',mode:'navigate'},respondWith:p=>navigation=p});assert.equal(await navigation,root);
});

test('Every viewer keeps their own colour while the active player changes',()=>{
  const players=[{id:'red-seat',name:'An',color:0},{id:'yellow-seat',name:'Bình',color:2},{id:'green-seat',name:'Chi',color:1},{id:'blue-seat',name:'Dũng',color:3}];
  const game=createGame([...players].sort((a,b)=>a.color-b.color));
  for(let current=0;current<4;current++){
    game.current=current;
    for(const viewer of players){const status=getTurnStatus({mode:'online',game,playerId:viewer.id,connected:true});assert.equal(status.me.color,viewer.color);assert.equal(status.myId,viewer.id);assert.equal(status.current.id,game.players[current].id);assert.equal(status.mine,viewer.id===game.players[current].id);assert.equal(status.ready,status.mine);assert.ok(status.detail.toLowerCase().includes(COLORS[game.players[current].color].name.toLowerCase()));}
  }
});

test('Lobby and reconnect messages preserve seat identity and do not invite offline actions',()=>{
  const members=[{id:'a',name:'An',color:0},{id:'b',name:'Bình',color:2}],room={members,hostId:'a'};
  const lobby=getTurnStatus({mode:'online',room,playerId:'b',connected:true});assert.equal(lobby.me.color,2);assert.match(lobby.title,/vàng/);assert.equal(lobby.ready,false);
  const game=createGame(members);game.current=1;
  const offline=getTurnStatus({mode:'online',room,game,playerId:'b',connected:false});assert.equal(offline.me.color,2);assert.equal(offline.tone,'offline');assert.equal(offline.ready,false);assert.equal(offline.noticeKey,null);
  const online=getTurnStatus({mode:'online',room,game,playerId:'b',connected:true});assert.equal(online.ready,true);assert.equal(online.title,'ĐẾN LƯỢT BẠN!');
});

test('Turn notices are stable across presence updates and wait for the moving horse to land',()=>{
  const game=createGame([{id:'a',name:'An',color:0},{id:'b',name:'Bình',color:2}]);
  const read=(playerId,extra={})=>getTurnStatus({mode:'online',game,playerId,connected:true,...extra});
  const initial=read('a').noticeKey;assert.equal(read('a').noticeKey,initial);assert.equal(read('a',{busy:true}).noticeKey,null);
  rollDice(game,'a',6);assert.equal(read('a').noticeKey,initial);movePiece(game,'a',0);
  assert.notEqual(read('a').noticeKey,initial);assert.equal(read('a',{animating:true}).noticeKey,null);
  rollDice(game,'a',2);movePiece(game,'a',0);
  const during=read('b',{animating:true});assert.equal(during.activeId,'a');assert.equal(during.current.id,'b');assert.equal(during.noticeKey,null);
  const landed=read('b');assert.equal(landed.activeId,'b');assert.equal(landed.ready,true);assert.ok(landed.noticeKey);
});

test('Pass-and-play names the current person and does not claim a fixed personal colour',()=>{
  const game=createGame([{id:'a',name:'An',color:0},{id:'b',name:'Bình',color:2}]);game.current=1;
  const status=getTurnStatus({mode:'local',game,connected:false});assert.equal(status.me,null);assert.equal(status.myId,null);assert.equal(status.title,'Đến lượt Bình');assert.equal(status.color.name,'Vàng');assert.equal(status.ready,true);
});
