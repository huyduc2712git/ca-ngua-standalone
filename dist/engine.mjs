// Shared, deterministic rules. The server alone supplies dice in network games.
export const COLORS = [
  { id: 'red', name: 'Đỏ', color: '#bd383c', deep: '#731c28', pale: '#f5d1c0', title: 'Quân đỏ' },
  { id: 'green', name: 'Xanh lá', color: '#277951', deep: '#10442d', pale: '#d3e0bd', title: 'Quân xanh lá' },
  { id: 'yellow', name: 'Vàng', color: '#d79c28', deep: '#885512', pale: '#f9e4ad', title: 'Quân vàng' },
  { id: 'blue', name: 'Xanh dương', color: '#246f96', deep: '#143e59', pale: '#c7dee4', title: 'Quân xanh dương' },
];
// 56 unique cells, anticlockwise. Every colour starts 14 cells apart.
export const TRACK = [];
for (let y = 0; y <= 6; y++) TRACK.push([6, y]);
for (let x = 5; x >= 0; x--) TRACK.push([x, 6]);
TRACK.push([0, 7], [0, 8]);
for (let x = 1; x <= 6; x++) TRACK.push([x, 8]);
for (let y = 9; y <= 14; y++) TRACK.push([6, y]);
TRACK.push([7, 14], [8, 14]);
for (let y = 13; y >= 8; y--) TRACK.push([8, y]);
for (let x = 9; x <= 14; x++) TRACK.push([x, 8]);
TRACK.push([14, 7], [14, 6]);
for (let x = 13; x >= 8; x--) TRACK.push([x, 6]);
for (let y = 5; y >= 0; y--) TRACK.push([8, y]);
TRACK.push([7, 0]);
export const HOME = [
  Array.from({length:6},(_,i)=>[7,i+1]),
  Array.from({length:6},(_,i)=>[i+1,7]),
  Array.from({length:6},(_,i)=>[7,13-i]),
  Array.from({length:6},(_,i)=>[13-i,7]),
];
export const PEN = [ [0,0], [0,9], [9,9], [9,0] ];
export const SEAT_ORDER = [0,2,1,3];
export const RULES = Object.freeze({ version:'vn-one-die-1.0', trackLength:56, entry:[1,6], extraTurn:[1,6], blockJumping:true, home:'exact-next', finish:[6,5,4,3] });
export function createGame(players) {
  if (players.length < 2 || players.length > 4 || new Set(players.map(p=>p.color)).size !== players.length) throw new Error('Cần từ 2 đến 4 người với màu khác nhau.');
  if(players.some(p=>!Number.isInteger(p.color)||p.color<0||p.color>3)||new Set(players.map(p=>p.id)).size!==players.length) throw new Error('Người chơi không hợp lệ.');
  return { rules:RULES.version, status:'playing', phase:'roll', players:players.map(p=>({id:p.id,name:p.name,color:p.color,pieces:[-1,-1,-1,-1],forfeited:false})), current:0, dice:null, lastRoll:null, turn:1, winner:null, log:[], event:null, sequence:0 };
}
export function globalCell(player,progress) { return progress >= 0 && progress <= 55 ? (player.color*14+progress)%56 : null; }
export function settledCount(player) {
  let count=0;
  for(let n=61;n>=58;n--) { if(player.pieces.includes(n)) count++; else break; }
  return count;
}
export function isSettled(player,index) { return player.pieces[index] >= 62-settledCount(player); }
function occupant(game,cell,excludeId,excludePiece) {
  for(const p of game.players) {
    if(p.forfeited) continue;
    for(let i=0;i<4;i++) if(!(p.id===excludeId&&i===excludePiece)&&globalCell(p,p.pieces[i])===cell) return {playerId:p.id,piece:i};
  }
  return null;
}
export function getMove(game,playerId,piece,die=game.dice) {
  if(game.status!=='playing'||!Number.isInteger(die)||die<1||die>6||!Number.isInteger(piece)||piece<0||piece>3) return null;
  const p=game.players.find(p=>p.id===playerId);
  if(!p||p.forfeited||isSettled(p,piece)) return null;
  const from=p.pieces[piece]; let to; const path=[];
  if(from===-1) {
    if(!RULES.entry.includes(die)) return null;
    to=0; path.push(0);
  } else if(from<55) {
    to=from+die;
    if(to>55) return null; // Must land at the door; no overshoot, no second lap.
    for(let n=from+1;n<=to;n++) path.push(n);
  } else if(from===55) {
    to=55+die;
    if(die>6-settledCount(p)) return null;
    for(let n=56;n<=to;n++) path.push(n);
  } else {
    const nextHome=from-55+1;
    if(die!==nextHome||nextHome>6-settledCount(p)) return null;
    to=from+1; path.push(to);
  }
  let capture=null;
  for(const n of path) {
    if(n>=56) { if(p.pieces.some((v,i)=>i!==piece&&v===n)) return null; }
    else {
      const hit=occupant(game,globalCell(p,n),p.id,piece);
      if(hit) {
        if(n!==to||hit.playerId===p.id) return null;
        capture=hit;
      }
    }
  }
  return {playerId,piece,from,to,path,capture,kind:from===-1?'enter':to>=56?'home':capture?'capture':'move'};
}
export function legalMoves(game) {
  if(game.status!=='playing'||game.phase!=='move') return [];
  return [0,1,2,3].map(i=>getMove(game,game.players[game.current].id,i)).filter(Boolean);
}
function addLog(game,text,type='move',color=game.players[game.current]?.color) {
  game.log.unshift({id:++game.sequence,text,type,color,turn:game.turn}); game.log=game.log.slice(0,50);
}
function endTurn(game,die) {
  const bonus=RULES.extraTurn.includes(die);
  if(!bonus) { do { game.current=(game.current+1)%game.players.length; } while(game.players[game.current].forfeited); }
  game.phase='roll'; game.dice=null; game.turn++;
  return bonus;
}
export function rollDice(game,playerId,die) {
  if(game.status!=='playing'||game.phase!=='roll'||game.players[game.current].id!==playerId) throw new Error('Chưa đến lượt gieo của bạn.');
  if(!Number.isInteger(die)||die<1||die>6) throw new Error('Xúc xắc không hợp lệ.');
  const p=game.players[game.current];
  game.dice=die; game.lastRoll={value:die,playerId,color:p.color}; game.phase='move';
  addLog(game,`${p.name} gieo được ${die}.`,'roll');
  const moves=legalMoves(game);
  game.event={id:game.sequence,type:'roll',playerId,die,noMoves:moves.length===0};
  if(!moves.length) { addLog(game,`${p.name} không có nước đi hợp lệ.`, 'blocked'); endTurn(game,die); }
  return game;
}
export function movePiece(game,playerId,piece) {
  if(game.status!=='playing'||game.phase!=='move'||game.players[game.current].id!==playerId) throw new Error('Chưa đến lượt đi của bạn.');
  const move=getMove(game,playerId,piece);
  if(!move) throw new Error('Quân này không có nước đi hợp lệ.');
  const p=game.players[game.current], die=game.dice;
  if(move.capture) game.players.find(q=>q.id===move.capture.playerId).pieces[move.capture.piece]=-1;
  p.pieces[piece]=move.to;
  const label=move.kind==='enter'?'xuất quân':move.to>=56?`vào chuồng ${move.to-55}`:move.capture?'đá ngựa đối phương':`đi ${die} ô`;
  addLog(game,`${p.name}: ngựa ${piece+1} ${label}.`,move.kind);
  game.event={...move,id:game.sequence,type:'move',die};
  if(settledCount(p)===4) { game.status='finished'; game.phase='finished'; game.winner=p.id; addLog(game,`${p.name} chiến thắng!`,'win'); }
  else game.event.bonus=endTurn(game,die);
  return game;
}
export function forfeit(game,playerId) {
  const p=game.players.find(p=>p.id===playerId);
  if(!p||p.forfeited||game.status!=='playing') return game;
  p.forfeited=true; p.pieces=[-1,-1,-1,-1]; addLog(game,`${p.name} đã rời ván.`,'leave',p.color);
  const remaining=game.players.filter(p=>!p.forfeited);
  if(remaining.length<=1) { game.status='finished'; game.phase='finished'; game.winner=remaining[0]?.id??null; }
  else if(game.players[game.current].id===playerId) { do { game.current=(game.current+1)%game.players.length; } while(game.players[game.current].forfeited); game.phase='roll';game.dice=null;game.turn++; }
  game.event={id:game.sequence,type:'leave',playerId};
  return game;
}
