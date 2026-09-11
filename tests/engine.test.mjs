import test from 'node:test';
import assert from 'node:assert/strict';
import { COLORS, TRACK, HOME, createGame, getMove, legalMoves, rollDice, movePiece, settledCount, isSettled, globalCell, forfeit } from '../dist/engine.mjs';
const setup=()=>createGame([{id:'red',name:'Đỏ',color:0},{id:'yellow',name:'Vàng',color:2}]);
test('Board is a 56-cell continuous anticlockwise loop with four distinct six-cell homes',()=>{
  assert.equal(TRACK.length,56);assert.equal(new Set(TRACK.map(String)).size,56);
  let area=0;for(let i=0;i<56;i++){const a=TRACK[i],b=TRACK[(i+1)%56];assert.equal(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]),1);area+=a[0]*b[1]-b[0]*a[1];}assert.ok(area<0,'counterclockwise in screen coordinates');
  const homes=HOME.flat();assert.equal(homes.length,24);assert.equal(new Set(homes.map(String)).size,24);assert.ok(homes.every(c=>!TRACK.some(t=>String(t)===String(c))));
  for(let c=0;c<4;c++){const door=TRACK[(c*14+55)%56],first=HOME[c][0];assert.equal(Math.abs(door[0]-first[0])+Math.abs(door[1]-first[1]),1);}
});
test('Only 1 or 6 can launch; launches consume the die and grant another roll',()=>{
  for(let d=1;d<=6;d++){const g=setup();rollDice(g,'red',d);if([1,6].includes(d)){assert.equal(legalMoves(g).length,4);movePiece(g,'red',0);assert.equal(g.players[0].pieces[0],0);assert.equal(g.current,0);assert.equal(g.phase,'roll');}else{assert.equal(g.current,1);assert.equal(g.phase,'roll');}}
});
test('Own and opponent pieces block jumping; exact enemy landing captures, including a launch square',()=>{
  const g=setup(),r=g.players[0],y=g.players[1];r.pieces=[0,-1,-1,-1];y.pieces=[30,-1,-1,-1]; // yellow offset28+30 = global2
  assert.equal(getMove(g,'red',0,3),null);assert.equal(getMove(g,'red',0,2).capture.playerId,'yellow');
  rollDice(g,'red',2);movePiece(g,'red',0);assert.equal(y.pieces[0],-1);assert.equal(r.pieces[0],2);
  const h=setup();h.players[0].pieces=[0,2,-1,-1];assert.equal(getMove(h,'red',0,2),null);assert.equal(getMove(h,'red',0,3),null);assert.equal(getMove(h,'red',2,6),null);
  const j=setup();j.players[1].pieces=[28,-1,-1,-1];assert.ok(getMove(j,'red',0,1).capture);rollDice(j,'red',1);movePiece(j,'red',0);assert.equal(j.players[1].pieces[0],-1);
});
test('Each colour wraps correctly and must land exactly on its own door',()=>{
  for(let color=0;color<4;color++){const g=createGame([{id:'a',name:'A',color},{id:'b',name:'B',color:(color+2)%4}]);const p=g.players[0];p.pieces[0]=52;assert.equal(getMove(g,'a',0,4),null);assert.equal(getMove(g,'a',0,3).to,55);assert.equal(globalCell(p,55),(14*color+55)%56);p.pieces[0]=55;assert.equal(getMove(g,'a',0,6).to,61);}
});
test('Door is vulnerable, horses inside home are safe',()=>{
  const g=setup();g.players[0].pieces=[55,-1,-1,-1];g.players[1].pieces=[26,-1,-1,-1];assert.equal(getMove(g,'yellow',0,1).capture.playerId,'red');g.players[0].pieces[0]=56;assert.equal(getMove(g,'yellow',0,1).capture,null);
});
test('Home entry uses exact die; later climbing requires the exact next rank',()=>{
  const g=setup(),p=g.players[0];p.pieces=[55,-1,-1,-1];assert.equal(getMove(g,'red',0,2).to,57);p.pieces[0]=57;assert.equal(getMove(g,'red',0,2),null);assert.equal(getMove(g,'red',0,4),null);assert.equal(getMove(g,'red',0,3).to,58);
  p.pieces=[55,58,-1,-1];assert.equal(getMove(g,'red',0,6),null);assert.equal(getMove(g,'red',0,3),null);assert.equal(getMove(g,'red',0,2).to,57);
});
test('Finishing parks exactly at 6,5,4,3; no overlapping or moving parked horses',()=>{
  const g=setup(),p=g.players[0];p.pieces=[61,60,59,55];assert.equal(settledCount(p),3);assert.equal(isSettled(p,0),true);assert.equal(getMove(g,'red',0,6),null);assert.equal(getMove(g,'red',3,4),null);rollDice(g,'red',3);movePiece(g,'red',3);assert.equal(g.status,'finished');assert.equal(g.winner,'red');assert.equal(settledCount(p),4);assert.throws(()=>rollDice(g,'red',6));
});
test('No arbitrary pass, no double roll, and no action by the wrong player',()=>{
  const g=setup();assert.throws(()=>rollDice(g,'yellow',6));rollDice(g,'red',6);const before=JSON.stringify(g);assert.throws(()=>rollDice(g,'red',6));assert.throws(()=>movePiece(g,'yellow',0));assert.throws(()=>movePiece(g,'red',8));assert.equal(JSON.stringify(g),before);
});
test('Blocked non-bonus moves skip the turn, while blocked 1/6 retains it',()=>{
  const g=setup();g.players[0].pieces=[0,1,2,3];rollDice(g,'red',6); // last horse can move, so use a door blockade instead
  assert.equal(g.phase,'move');
  const h=setup();h.players[0].pieces=[61,60,59,57];rollDice(h,'red',6);assert.equal(h.current,0);assert.equal(h.phase,'roll');assert.equal(h.event.noMoves,true);rollDice(h,'red',2);assert.equal(h.current,1);
});
test('Forfeit removes pieces, releases a pending turn and resolves last remaining player',()=>{
  const g=createGame(COLORS.slice(0,3).map((c,i)=>({id:c.id,name:c.name,color:i})));rollDice(g,'red',6);forfeit(g,'red');assert.equal(g.phase,'roll');assert.equal(g.current,1);assert.ok(g.players[0].forfeited);forfeit(g,'green');assert.equal(g.status,'finished');assert.equal(g.winner,'yellow');
});
test('Seeded full games preserve occupancy and eventually reach legal victory',()=>{
  let seed=123456789;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let round=0;round<12;round++){
    const g=createGame(COLORS.slice(0,round%3+2).map((c,i)=>({id:c.id,name:c.name,color:i})));
    for(let n=0;n<18000&&g.status==='playing';n++){
      const p=g.players[g.current];if(g.phase==='roll')rollDice(g,p.id,1+Math.floor(rand()*6));else {const moves=legalMoves(g);assert.ok(moves.length);const weighted=moves.sort((a,b)=>(b.to>=56?200+b.to:b.capture?110:b.to)-(a.to>=56?200+a.to:a.capture?110:a.to));const selected=rand()<.8?weighted[0]:moves[Math.floor(rand()*moves.length)];movePiece(g,p.id,selected.piece);}
      const occupied=g.players.flatMap(p=>p.pieces.map(v=>globalCell(p,v)).filter(v=>v!==null));assert.equal(new Set(occupied).size,occupied.length);
      for(const player of g.players){const home=player.pieces.filter(v=>v>=56);assert.equal(new Set(home).size,home.length);assert.ok(player.pieces.every(v=>Number.isInteger(v)&&v>=-1&&v<=61));}
    }
    assert.equal(g.status,'finished',`round ${round} did not finish`);assert.equal(settledCount(g.players.find(p=>p.id===g.winner)),4);
  }
});
