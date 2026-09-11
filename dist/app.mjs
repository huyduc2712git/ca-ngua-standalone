import { COLORS, TRACK, HOME, PEN, SEAT_ORDER, createGame, globalCell, settledCount, isSettled, legalMoves, rollDice, movePiece } from './engine.mjs';
import { ICONS } from './icons.mjs';
import { HOP_MS, boardCell, boardPixel as center, coordinate, hopPose, moveRoute, frameAnimation } from './motion.mjs';
import { setupPWA } from './pwa.mjs';
import {boardMarkup,PEN_LABEL_CELLS} from './board-art.mjs';
import {getTurnStatus} from './turn-status.mjs';

const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const readStore=(store,key,fallback)=>{try{return JSON.parse(store.getItem(key))??fallback;}catch{return fallback;}};
const writeStore=(store,key,data)=>{try{data===null?store.removeItem(key):store.setItem(key,JSON.stringify(data));}catch{}};
function persistSession(value){const previous=readStore(sessionStorage,'horse-session',null);writeStore(sessionStorage,'horse-session',value);if(value)writeStore(localStorage,'horse-resume-session',value);else if(readStore(localStorage,'horse-resume-session',null)?.token===previous?.token)writeStore(localStorage,'horse-resume-session',null);}
let board3d=null,viewMode='2d',viewLoading=false,visualLock=false,motionController=null;
let lastTurnNotice=null,turnNoticeTimer,penLabelPositions=null;
let mode='lobby', game=null, room=null, session=null, busy=false, animating=false, connected=false;
let lobbyTab='create', capacity=4, playerName=readStore(localStorage,'horse-name',''), toastTimer, streamController, updateQueue=Promise.resolve(), sound=readStore(localStorage,'horse-sound',false), audioContext, selectedPreview=null;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
function icon(name,cls=''){const nodes=ICONS[name]||ICONS['circle-help'];return `<svg class="${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${nodes.map(([tag,attrs])=>`<${tag} ${Object.entries(attrs).map(([k,v])=>`${k}="${esc(v)}"`).join(' ')}/>`).join('')}</svg>`;}
function hydrate(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function announce(message){$('#live-status').textContent=message;}
function playSound(kind){if(!sound)return;try{audioContext??=new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();const notes=kind==='win'?[523,659,784,1047]:kind==='capture'?[440,294,220]:kind==='roll'?[330,440,590]:kind==='step'?[360]:kind==='turn'?[659,880]:[550,740];notes.forEach((frequency,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain(),t=audioContext.currentTime+i*.075;o.connect(g);g.connect(audioContext.destination);o.type='sine';o.frequency.value=frequency;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.05,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+.14);o.start(t);o.stop(t+.15);});}catch{}}
function pieceSVG(color){const c=COLORS[color];return `<svg class="piece-svg" viewBox="0 0 44 48" aria-hidden="true"><defs><linearGradient id="horse-${color}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${c.color}"/><stop offset="1" stop-color="${c.deep}"/></linearGradient></defs><ellipse cx="22" cy="41" rx="16" ry="5.8" fill="${c.deep}"/><ellipse cx="22" cy="38" rx="16" ry="5.8" fill="${c.color}" stroke="${c.pale}" stroke-width="1"/><g transform="translate(5 0) scale(1.43)" stroke="${c.deep}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">${ICONS['chess-knight'].map(([tag,a],i)=>`<${tag} ${Object.entries(a).map(([k,v])=>`${k}="${esc(v)}"`).join(' ')} fill="${i<2?`url(#horse-${color})`:'none'}"/>`).join('')}</g></svg>`;}
function drawBoard(){$('#board-svg').innerHTML=boardMarkup();}
function boardStatus(){return getTurnStatus({mode,game,room,playerId:session?.playerId,connected,busy,animating});}
function canAct(){return !!game&&game.status==='playing'&&!busy&&!animating&&(mode==='local'||(connected&&game.players[game.current].id===session?.playerId));}
function previewPlayers(){return COLORS.map((c,i)=>({id:`preview-${i}`,name:c.title,color:i,pieces:[-1,-1,-1,-1]}));}
function renderPieces(displayGame=game){
  const players=displayGame?.players??(room?room.members.map(p=>({...p,pieces:[-1,-1,-1,-1]})):previewPlayers()),moves=canAct()?legalMoves(game):[];
  $('#pieces').innerHTML=players.filter(p=>!p.forfeited).map(p=>p.pieces.map((value,i)=>{const [x,y]=coordinate(p,i),move=moves.find(m=>m.playerId===p.id&&m.piece===i),settled=displayGame&&isSettled(p,i),where=value<0?'ở bãi':value>55?`ở chuồng ${value-55}`:`ở ô ${value+1}`;return `<button class="horse ${mode==='online'&&p.id===session?.playerId?'is-mine':''} ${move?'available':''} ${settled?'settled':''}" data-player="${esc(p.id)}" data-piece="${i}" style="left:${x/7.2}%;top:${y/7.2}%;--team:${COLORS[p.color].color}" aria-label="${mode==='online'&&p.id===session?.playerId?'Quân của bạn, ':''}${esc(p.name)}, màu ${esc(COLORS[p.color].name)}, ngựa ${i+1} ${where}${move?', có thể đi':''}" aria-disabled="${!move}" tabindex="${move?'0':'-1'}">${`<span class="horse-visual">${pieceSVG(p.color)}<span class="piece-number">${i+1}</span></span>`}</button>`;}).join('')).join('');
  $('#pieces').querySelectorAll('.available').forEach(el=>{el.addEventListener('click',()=>act('move',{piece:Number(el.dataset.piece)}));el.addEventListener('pointerenter',()=>showDestination(Number(el.dataset.piece)));el.addEventListener('focus',()=>showDestination(Number(el.dataset.piece)));el.addEventListener('pointerleave',clearDestination);el.addEventListener('blur',clearDestination);});
  board3d?.update(players,moves,boardStatus());
  clearDestination();
}
function showDestination(index){const move=legalMoves(game).find(m=>m.piece===index);if(!move)return;const p=game.players[game.current],[x,y]=coordinate(p,index,move.to);$('#destinations').innerHTML=`<div class="destination" style="left:${x/7.2}%;top:${y/7.2}%;--team:${COLORS[p.color].deep}">${icon(move.capture?'swords':'check')}</div>`;selectedPreview=index;board3d?.setDestination(boardCell(p,index,move.to),p.color);}
function clearDestination(){$('#destinations').innerHTML='';selectedPreview=null;board3d?.setDestination(null);}
function positionBoardLabels(positions){
  if(positions)penLabelPositions=positions;
  const points=viewMode==='3d'&&penLabelPositions?penLabelPositions:PEN_LABEL_CELLS.map(cell=>center(cell).map(v=>v/7.2));
  points.forEach(([x,y],i)=>{const label=$(`#board-labels [data-color="${i}"]`);if(label){label.style.left=x+'%';label.style.top=y+'%';}});
}
function renderSeats(){
  const status=boardStatus();let labels='';
  COLORS.forEach((c,i)=>{
    const p=game?.players.find(p=>p.color===i)??room?.members.find(p=>p.color===i),isCurrent=!!p&&status.activeId===p.id,isMe=!!p&&status.myId===p.id;
    const seat=$('#seat-'+i);seat.className=`seat-label ${isCurrent?'active':''} ${isMe?'mine':''}`;seat.style.setProperty('--team',c.color);
    seat.innerHTML=`<span class="seat-avatar">${icon('chess-knight')}</span><span class="seat-copy"><strong>${esc(p?.name??'Chưa có người')}</strong><span>${esc(c.name)}${isMe?' · BẠN':''}</span></span>${p?.forfeited?'<small>ĐÃ RỜI</small>':isCurrent?'<small>ĐẾN LƯỢT</small>':''}`;
    labels+=`<div class="pen-label ${isMe?'mine':''} ${isCurrent?'active':''}" data-color="${i}" style="--team:${c.color}" title="${esc(p?.name??c.name)}"><span>${isMe?'BẠN · ':''}${esc(c.name)}</span>${p?`<strong>${esc(p.name)}</strong>`:''}${isCurrent?'<em>ĐẾN LƯỢT</em>':''}</div>`;
    const pen=$('#pen-highlight-'+i);pen?.classList.toggle('active',isCurrent);pen?.classList.toggle('mine',isMe);
  });
  $('#board-labels').innerHTML=labels;positionBoardLabels();
}
function renderBoardStatus(){
  const status=boardStatus(),surface=$('#table-status');surface.hidden=!status.visible;
  if(!status.visible){surface.innerHTML='';lastTurnNotice=null;return status;}
  if(game?.status!=='playing')lastTurnNotice=null;
  const mine=status.me?COLORS[status.me.color]:null,c=status.color||COLORS[0];
  surface.dataset.tone=status.tone;surface.style.setProperty('--turn-color',c.color);
  const actionText=animating?'Đang đi…':busy?'Đang gửi…':!status.mine?'Chờ lượt':game?.phase==='move'?'Chọn ngựa':'Gieo xúc xắc';
  surface.innerHTML=`<div class="your-team" style="--my-color:${mine?.color||c.color}"><span class="your-piece">${icon('chess-knight')}</span><span><small>${mine?'BẠN CẦM QUÂN':'CHƠI CHUNG MÁY'}</small><strong>${esc((mine?.name||c.name).toUpperCase())}</strong>${mine?`<span>${esc(status.me.name)}</span>`:''}</span></div><div class="turn-message"><strong>${esc(status.title)}</strong><span>${esc(status.detail)}</span></div>${game?.status==='playing'?`<button class="primary-button table-roll" id="table-roll" ${!canAct()||game.phase!=='roll'?'disabled':''}>${icon('dices')}<span>${actionText}</span></button>`:''}`;
  if($('#table-roll'))$('#table-roll').onclick=()=>act('roll');
  if(status.noticeKey&&status.noticeKey!==lastTurnNotice){
    lastTurnNotice=status.noticeKey;surface.classList.remove('turn-start');void surface.offsetWidth;surface.classList.add('turn-start');clearTimeout(turnNoticeTimer);turnNoticeTimer=setTimeout(()=>surface.classList.remove('turn-start'),2200);
    const message=mode==='online'?`Đến lượt bạn — quân ${c.name.toLowerCase()}!`:`Đến lượt ${status.current.name} — quân ${c.name.toLowerCase()}.`;
    announce(message);if(mode==='online')toast(message);playSound('turn');
  }
  return status;
}
function renderHeader(){
  $('#view-3d').disabled=animating||viewLoading;$('#view-2d').disabled=animating||viewLoading;
  const turnStatus=renderBoardStatus();
  document.body.dataset.screen=game?'game':'lobby';
  document.body.classList.toggle('has-mobile-turn',game?.status==='playing');
  $('#mode-pill').innerHTML=icon(mode==='online'?'wifi':mode==='local'?'monitor':'users')+` ${mode==='online'?`Phòng ${room?.code??''}`:mode==='local'?'Chơi chung máy':'2–4 người chơi'}`;
  let hint='Chọn cách chơi để bắt đầu cuộc đua';
  if(room&&!game)hint='Mời bạn bè vào phòng và sẵn sàng';
  if(game?.status==='finished')hint='Một cuộc đua đã khép lại. Hẹn ván tiếp theo!';
  if(game?.status==='playing')hint=game.phase==='move'?(canAct()?'Chạm vào ngựa sáng để đi · Rê chuột để xem ô đến':'Chờ người chơi chọn ngựa'):(mode==='local'?'Chuyển lượt cho '+game.players[game.current].name:canAct()?'Đến lượt bạn gieo xúc xắc':'Chờ '+game.players[game.current].name+' gieo xúc xắc');
  $('#board-hint').textContent=hint;
  const status=$('#connection-status');status.classList.toggle('offline',mode==='online'&&!connected);status.innerHTML=(mode==='online'?(connected?'ĐÃ KẾT NỐI':'ĐANG KẾT NỐI LẠI'):'STANDALONE')+' <i></i>';
  const turnbar=$('#mobile-turnbar');
  if(game?.status==='playing'){
    const p=game.players[game.current];
    turnbar.innerHTML=`<div class="mobile-turn-name" style="--team:${COLORS[p.color].color}"><span class="player-dot"></span><span><small>${turnStatus.me?`BẠN: QUÂN ${esc(COLORS[turnStatus.me.color].name.toUpperCase())}`:'CHƠI CHUNG MÁY'}</small><strong>${animating?'Ngựa đang đi…':mode==='local'?`${esc(p.name)} · ${COLORS[p.color].name}`:turnStatus.mine?'Đến lượt bạn':`Lượt ${esc(p.name)}`}</strong></span></div><button class="primary-button" id="mobile-roll" ${!canAct()||game.phase!=='roll'?'disabled':''}>${icon('dices')}${animating?'Đang đi…':game.phase==='move'?'Chọn ngựa':turnStatus.mine?'Gieo xúc xắc':'Chờ lượt'}</button>`;
    $('#mobile-roll').onclick=()=>act('roll');
  }else turnbar.innerHTML='';
}
function countButtons(value){return [2,3,4].map(n=>`<button type="button" class="count-option ${value===n?'selected':''}" data-count="${n}" aria-pressed="${value===n}">${icon('users')} ${n} người</button>`).join('');}
function renderLobby(){
  $('#control-panel').innerHTML=`<section class="panel"><div class="panel-tag">${icon('sparkles')} SẴN SÀNG CHO MỘT VÁN VUI?</div><h2>Rủ hội bạn.<br>Đua một ván.</h2><p class="intro">Một mã phòng nhỏ, một cuộc đua<br>đầy bất ngờ.</p><div class="tabs" role="tablist" aria-label="Cách tham gia"><button class="tab" id="create-tab" role="tab" aria-selected="${lobbyTab==='create'}">Tạo phòng</button><button class="tab" id="join-tab" role="tab" aria-selected="${lobbyTab==='join'}">Tham gia</button></div><form id="room-form"><div class="field"><label for="player-name">Tên của bạn</label><div class="input-wrap"><span>${icon('user-round')}</span><input id="player-name" name="name" placeholder="Bạn bè gọi bạn là…" value="${esc(playerName)}" maxlength="24" required autocomplete="nickname"></div></div>${lobbyTab==='create'?`<div class="field"><div class="field-title">Số người chơi</div><div class="count-picker" role="group" aria-label="Số người chơi">${countButtons(capacity)}</div></div>`:`<div class="field"><label for="room-code">Mã phòng</label><input id="room-code" class="code-input" name="code" placeholder="ABC123" minlength="6" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" required value="${esc(new URLSearchParams(location.search).get('room')||'')}"></div>`}<div class="form-error" id="form-error" role="alert"></div><button class="primary-button" type="submit" ${busy?'disabled':''}>${busy?'Đang kết nối…':lobbyTab==='create'?'Tạo phòng mới':'Vào phòng'} ${icon('arrow-right')}</button></form><p class="subtle-note">${icon('link')} Cùng host · Không cần tài khoản</p><div class="or-divider">hoặc quây quần bên nhau</div><button class="local-button" id="local-button">${icon('monitor')} Chơi trên máy này</button></section>`;
  $('#create-tab').onclick=()=>switchTab('create');$('#join-tab').onclick=()=>switchTab('join');
  $('#player-name').oninput=e=>{playerName=e.target.value;};
  document.querySelectorAll('[data-count]').forEach(b=>b.onclick=()=>{capacity=Number(b.dataset.count);renderLobby();});
  $('#room-form').onsubmit=submitRoom;$('#local-button').onclick=openLocal;
}
function switchTab(tab){lobbyTab=tab;renderLobby();$('#'+(tab==='create'?'player-name':'room-code')).focus();}
async function api(path,data,token=session?.token){const response=await fetch('/api'+path,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json'}:{}),...(token?{'X-Player-Token':token}:{})},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(10_000)});let result;try{result=await response.json();}catch{throw new Error('Không kết nối được host. Hãy khởi động game rồi mở địa chỉ của host.');}if(!response.ok){if(result.room)enqueueRoom(result.room);const error=new Error(result.error||'Không thể hoàn tất yêu cầu.');error.status=response.status;throw error;}return result;}
async function submitRoom(e){e.preventDefault();if(busy)return;const code=lobbyTab==='join'?$('#room-code').value.trim().toUpperCase():null;playerName=$('#player-name').value.trim();busy=true;$('#form-error').textContent='';const button=$('#room-form button[type=submit]');button.disabled=true;button.textContent='Đang kết nối…';try{const data=await api(lobbyTab==='create'?'/rooms':`/rooms/${encodeURIComponent(code)}/join`,{name:playerName,capacity},null);session={code:data.room.code,playerId:data.playerId,token:data.token};persistSession(session);writeStore(localStorage,'horse-name',playerName);mode='online';room=data.room;game=room.game;history.replaceState(null,'',`?room=${room.code}`);connectStream();renderAll();}catch(error){$('#form-error').textContent=error.message;}finally{busy=false;if(mode==='lobby')renderLobbyWithError($('#form-error')?.textContent);else renderAll();}}
function renderLobbyWithError(error){renderLobby();$('#form-error').textContent=error||'';}
function renderRoom(){
  const host=room.hostId===session.playerId,me=room.members.find(p=>p.id===session.playerId),ready=room.members.length>=2&&room.members.every(p=>p.ready&&p.online);
  $('#control-panel').innerHTML=`<section class="panel"><div class="panel-tag">${icon('radio')} PHÒNG CỦA HỘI BẠN</div><h2>Đủ mặt, lên ngựa!</h2><p class="intro">Gửi mã này cho bạn bè đang mở<br>game trên cùng host.</p><div class="room-code"><strong>${room.code}</strong><button class="copy-button" id="copy-code" aria-label="Sao chép mã phòng">${icon('copy')}</button></div><button class="secondary-button" id="copy-link">${icon('link')} Sao chép link mời</button><div class="game-player-list" style="display:block;padding-top:8px;margin-top:15px;border:0">${room.members.map(p=>`<div class="room-member" style="--team:${COLORS[p.color].color}"><span class="seat-avatar">${esc(p.name.slice(0,1).toUpperCase())}</span><span class="member-name">${esc(p.name)}${p.id===session.playerId?' · Bạn':''}<small>${COLORS[p.color].name}${p.id===room.hostId?' · Chủ phòng':''}</small></span><span class="member-status ${!p.online?'offline':p.ready?'ready':''}">${!p.online?'Kết nối lại':p.ready?'✓ Sẵn sàng':'Đang chờ'}</span>${host&&!p.online&&p.id!==me?.id?`<button class="offline-remove" data-remove="${p.id}" aria-label="Bỏ ghế của ${esc(p.name)}">Bỏ ghế</button>`:''}</div>`).join('')}${Array.from({length:room.capacity-room.members.length},()=>`<div class="room-member"><span class="seat-avatar" style="--team:#71849f">+</span><span class="member-name" style="color:#71849f">Chờ bạn vào hội…</span></div>`).join('')}</div><div class="room-actions">${host?`<button class="primary-button" id="start-game" ${!ready||busy||!connected?'disabled':''}>Bắt đầu cuộc đua ${icon('arrow-right')}</button>`:`<button class="primary-button" id="ready-button" ${busy||!connected?'disabled':''}>${icon(me?.ready?'check':'dices')} ${me?.ready?'Đã sẵn sàng · Hủy':'Tôi đã sẵn sàng'}</button>`}</div><p class="subtle-note">${host?'Cần ít nhất 2 người và tất cả sẵn sàng.':'Chủ phòng sẽ bắt đầu khi mọi người sẵn sàng.'}</p><button class="leave-button" id="leave-room">${icon('log-out')} Rời phòng</button></section>`;
  $('#copy-code').onclick=()=>copyText(room.code,'Đã sao chép mã phòng');$('#copy-link').onclick=copyInvite;
  if(host)$('#start-game').onclick=()=>act('start');else $('#ready-button').onclick=()=>act('ready',{ready:!me.ready});
  $('#leave-room').onclick=confirmLeave;bindRemovals();
}
const PIPS={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
function die(value=1){return `<div class="die ${animating&&game?.event?.type==='roll'?'rolling':''}" role="img" aria-label="Xúc xắc ${value}">${Array.from({length:9},(_,i)=>`<i class="pip ${PIPS[value].includes(i)?'on':''}"></i>`).join('')}</div>`;}
function progressList(){return `<div class="game-player-list">${game.players.map(p=>`<div class="game-player" style="--team:${COLORS[p.color].color}"><span class="player-dot"></span><span class="game-player-name">${esc(p.name)} <small>${esc(COLORS[p.color].name)}${mode==='online'&&p.id===session?.playerId?' · BẠN':''}</small>${p.forfeited?' · Đã rời':''}</span><span class="progress-horses">${[0,1,2,3].map((_,i)=>icon('chess-knight',i<settledCount(p)?'done':'')).join('')}</span><span class="score">${settledCount(p)}/4</span></div>`).join('')}</div>`;}
function renderGame(){
  const p=game.players[game.current],c=COLORS[p.color],myTurn=mode==='local'||p.id===session?.playerId,moves=legalMoves(game),last=game.lastRoll;
  const title=animating?'Ngựa đang di chuyển…':game.phase==='move'?(myTurn?'Chọn ngựa của bạn':`${p.name} đang chọn ngựa`):(myTurn?'Đến lượt bạn!':`Đợi ${p.name}`);
  const help=animating?'Xúc xắc và đường đua đang chuyển động…':game.phase==='move'?`${myTurn?'Chọn':'Đang chọn'} 1 trong ${moves.length} ngựa có thể đi.`:game.event?.type==='roll'&&game.event.noMoves?`Số ${last?.value}: không có nước đi hợp lệ.${game.players[game.current].id===last?.playerId?' Bạn được gieo tiếp.':''}`:game.event?.bonus?'Ra 1 hoặc 6, được thêm một lượt gieo.':'Gieo 1 hoặc 6 để đưa ngựa ra đường đua.';
  $('#control-panel').innerHTML=`<section class="panel game-panel" style="--team:${c.color}"><div class="room-strip"><span>${mode==='local'?'CHƠI CHUNG MÁY':`PHÒNG <code>${room.code}</code>`}</span><span>Lượt ${game.turn}</span></div><div class="turn-header"><span class="turn-avatar">${icon('chess-knight')}</span><div><div class="panel-tag" style="color:${c.color};margin:0 0 5px">${esc(c.title.toUpperCase())} · ${esc(p.name)}</div><h2 style="font-size:22px;margin:0">${esc(title)}</h2></div></div><div class="dice-area">${die(last?.value||1)}</div><p class="turn-help">${esc(help)}</p><button class="primary-button" id="roll-dice" ${!canAct()||game.phase!=='roll'?'disabled':''} title="Phím Space">${icon('dices')} ${animating?'Đang đi…':game.phase==='move'?'Chọn ngựa trên bàn':!myTurn?'Chờ đến lượt':'Gieo xúc xắc'}</button>${mode==='online'&&!connected?'<p class="online-note">Đang nối lại host. Bàn cờ sẽ tự cập nhật khi kết nối trở lại.</p>':''}${progressList()}${mode==='online'&&room.hostId===session.playerId?room.members.filter(m=>!m.online&&m.id!==session.playerId).map(m=>`<p class="online-note">${esc(m.name)} mất kết nối. <button class="offline-remove" data-remove="${m.id}">Bỏ ghế sau 60 giây</button></p>`).join(''):''}<button class="leave-button" id="leave-game">${icon('log-out')} ${mode==='local'?'Kết thúc ván':'Rời ván'}</button></section><section class="activity"><h3>${icon('clock3')} Diễn biến gần đây</h3>${game.log.slice(0,5).map(l=>`<p class="activity-entry" style="--team:${COLORS[l.color??0].color}">${esc(l.text)}</p>`).join('')||'<p class="activity-entry">Bàn cờ đã sẵn sàng. Chúc cả hội may mắn!</p>'}</section>`;
  $('#roll-dice').onclick=()=>act('roll');$('#leave-game').onclick=confirmLeave;bindRemovals();
}
function renderWinner(){const p=game.players.find(p=>p.id===game.winner),host=mode==='local'||room.hostId===session.playerId;
  $('#control-panel').innerHTML=`<section class="panel winner-panel" style="--team:${COLORS[p?.color??0].color}"><div class="panel-tag" style="justify-content:center">CUỘC ĐUA ĐÃ CÓ CHỦ NHÂN</div><div class="winner-symbol">${icon('trophy')}</div><h2>Chúc mừng nhà vô địch!</h2><div class="winner-name">${esc(p?.name??'Cả hội')}</div><p class="intro">${p&&settledCount(p)===4?'Bốn ngựa về chuồng. Một chiến thắng xứng đáng.':'Người chơi cuối cùng ở lại đường đua.'}</p>${progressList()}<div class="room-actions">${host?`<button class="primary-button" id="rematch">${icon('rotate-ccw')} Thêm một ván nữa</button>`:'<p class="subtle-note">Chờ chủ phòng mở ván mới.</p>'}</div><button class="leave-button" id="leave-game">${icon('log-out')} Về màn hình chính</button></section>`;
  if(host)$('#rematch').onclick=()=>mode==='local'?startLocal(game.players.map(p=>({id:p.id,name:p.name,color:p.color}))):act('rematch');$('#leave-game').onclick=confirmLeave;
}
function bindRemovals(){document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{const id=b.dataset.remove,p=room.members.find(p=>p.id===id);confirmDialog('Bỏ ghế mất kết nối?',`Ghế của ${esc(p.name)} sẽ bị bỏ. Nếu ván đã bắt đầu, người này sẽ bỏ cuộc. Chỉ thực hiện được sau 60 giây mất kết nối.`,()=>act('remove',{playerId:id}),'Bỏ ghế');});}
function renderAll(){if(visualLock){renderHeader();return;}renderSeats();renderPieces();renderHeader();if(mode==='lobby')renderLobby();else if(game?.status==='finished')renderWinner();else if(game)renderGame();else renderRoom();}
function openModal(content){$('#modal-content').innerHTML=content;const modal=$('#modal');if(!modal.open)modal.showModal();}
function closeModal(){$('#modal').close();}
function confirmDialog(title,body,confirm,label='Đồng ý'){openModal(`<div class="eyebrow">CÁ NGỰA CLUB</div><h2>${title}</h2><p class="modal-copy">${body}</p><div class="confirm-actions"><button class="secondary-button" id="cancel-confirm">Ở lại</button><button class="primary-button danger-button" id="confirm-action">${label}</button></div>`);$('#cancel-confirm').onclick=closeModal;$('#confirm-action').onclick=()=>{closeModal();confirm();};$('#cancel-confirm').focus();}
function showRules(){openModal(`<div class="panel-tag">${icon('book-open')} LUẬT CỦA BÀN NÀY</div><h2>Gieo một lần.<br>Nhớ một vài điều.</h2><div class="rule-chips"><span>2–4 người</span><span>4 ngựa / người</span><span>1 xúc xắc</span></div><div class="modal-copy"><h3>01 · Ra quân & thêm lượt</h3><p>Gieo <b>1 hoặc 6</b> để xuất một ngựa vào ô mũi tên cùng màu, hoặc đi ngựa đang trên bàn. Sau đó được gieo tiếp, kể cả không có nước đi.</p><h3>02 · Đi & đá ngựa</h3><p>Đi ngược chiều kim đồng hồ, đúng số ô đã gieo. <b>Không vượt bất kỳ ngựa nào</b>. Đáp đúng ô đối phương để đá về bãi. Không chồng lên ngựa mình; không có ô miễn đá.</p><h3>03 · Về cửa chuồng</h3><p>Đi hết vòng và dừng đúng cửa chuồng cùng màu. Không đi quá cửa, không chạy vòng hai. Ngựa ở cửa vẫn bị đá.</p><h3>04 · Lên chuồng</h3><p>Từ cửa, gieo số nào vào ô chuồng đó nếu đường trống. Sau đó lên từng bậc: ở ô 2 cần gieo 3, ở ô 3 cần gieo 4… Không nhảy hoặc vượt ngựa.</p><h3>05 · Chiến thắng</h3><p>Xếp bốn ngựa lần lượt ở <b>6, 5, 4, 3</b>. Ngựa đã xếp xong được khóa. Người hoàn tất đầu tiên thắng ván.</p><h3>06 · Khi không đi được</h3><p>Tự chuyển lượt nếu không có nước hợp lệ. Bàn này không áp dụng phạt ba lần 6, thầu mạ hay sập hầm.</p><p class="sources">Bản một xúc xắc, lên chuồng theo đúng số bậc kế tiếp. Các nhóm có thể chơi biến thể khác. Tham khảo: <a href="https://vi.wikipedia.org/wiki/C%E1%BB%9D_c%C3%A1_ng%E1%BB%B1a" target="_blank" rel="noreferrer">luật cờ cá ngựa</a>.<br>Bàn cờ lấy cảm hứng từ <a href="https://chus.vn/trojan-imperial-city-seahorse-board-game/" target="_blank" rel="noreferrer">bộ cờ Trojan của Maztermind</a> và cách phân màu rõ ràng của <a href="https://ludoking.com/" target="_blank" rel="noreferrer">Ludo King</a>.</p></div>`);}
function openLocal(){let count=4;const saved=readStore(localStorage,'horse-local',null);openModal(`<div class="panel-tag">${icon('monitor')} CHƠI CHUNG MÁY</div><h2>Cùng bàn, cùng vui.</h2><p class="modal-copy">Thay phiên gieo và chọn ngựa trên máy này.</p>${saved?.status==='playing'?'<button class="secondary-button" id="resume-local" style="margin-top:18px">Tiếp tục ván trên máy này</button>':''}<form class="local-form" id="local-form"><div class="field-title">Bao nhiêu người cùng chơi?</div><div class="count-picker" role="group" aria-label="Số người chơi">${countButtons(count)}</div><div class="local-names" id="local-names"></div><button class="primary-button" type="submit">Bắt đầu cuộc đua ${icon('arrow-right')}</button></form>`);const names={};function fields(){const seats=SEAT_ORDER.slice(0,count);$('#local-names').innerHTML=seats.map(color=>`<div><label for="local-name-${color}" style="--team:${COLORS[color].color}"><span class="player-dot"></span>${COLORS[color].title}</label><input id="local-name-${color}" data-color="${color}" maxlength="24" required value="${esc(names[color]??(color===0&&playerName?playerName:COLORS[color].title))}" aria-label="Tên người chơi ${COLORS[color].name}"></div>`).join('');$('#local-names').querySelectorAll('input').forEach(i=>i.oninput=()=>names[i.dataset.color]=i.value);}
  fields();$('#modal').querySelectorAll('[data-count]').forEach(b=>b.onclick=()=>{count=Number(b.dataset.count);$('#modal').querySelectorAll('[data-count]').forEach(o=>{o.classList.toggle('selected',Number(o.dataset.count)===count);o.setAttribute('aria-pressed',String(Number(o.dataset.count)===count));});fields();});
  $('#local-form').onsubmit=e=>{e.preventDefault();const players=[...$('#local-names').querySelectorAll('input')].map(i=>({id:`local-${i.dataset.color}`,color:Number(i.dataset.color),name:i.value.trim()||COLORS[Number(i.dataset.color)].title})).sort((a,b)=>a.color-b.color);startLocal(players);};
  if($('#resume-local'))$('#resume-local').onclick=()=>{try{if(!saved.players?.length||saved.rules!=='vn-one-die-1.0')throw 0;mode='local';game=saved;room=null;session=null;closeModal();renderAll();}catch{toast('Không thể mở ván cũ. Hãy bắt đầu ván mới.');}};
}
function startLocal(players){streamController?.abort();session=null;room=null;mode='local';connected=false;game=createGame(players);busy=false;animating=false;persistSession(null);writeStore(localStorage,'horse-local',game);history.replaceState(null,'',location.pathname);closeModal();renderAll();announce(`Ván bắt đầu. Đến lượt ${game.players[0].name}.`);}
function fairDie(){const bytes=new Uint8Array(1);do{crypto.getRandomValues(bytes);}while(bytes[0]>=252);return bytes[0]%6+1;}
async function act(type,data={}){if(busy||animating)return;if(mode==='online'&&!connected){toast('Đang nối lại host. Chờ một chút nhé.');return;}busy=true;renderAll();try{if(mode==='local'){const previous=structuredClone(game),playerId=game.players[game.current].id;if(type==='roll')rollDice(game,playerId,fairDie());else if(type==='move')movePiece(game,playerId,data.piece);else throw new Error('Thao tác không hợp lệ.');writeStore(localStorage,'horse-local',game);await transitionGame(previous,game);}else{const result=await api(`/rooms/${session.code}/action`,{...data,type,revision:room.revision,actionId:randomId()});if(result.room)await enqueueRoom(result.room);if(result.left)resetLobby();}}catch(e){toast(e.message);}finally{busy=false;renderAll();}}
function randomId(){return Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');}
function enqueueRoom(next){updateQueue=updateQueue.catch(()=>{}).then(async()=>{if(mode!=='online'||next.code!==session?.code||next.revision<(room?.revision??0))return;const previous=game;room=next;game=next.game;await transitionGame(previous,game);renderAll();});return updateQueue;}
async function animateHorse(player,piece,route,{capture=false,signal}={}){
  const moving=document.querySelector(`.horse[data-player="${player.id}"][data-piece="${piece}"]`);
  const visual=moving?.querySelector('.horse-visual');moving?.classList.add('moving');
  for(let i=1;i<route.length;i++){
    const duration=reducedMotion||document.hidden?0:capture?470:HOP_MS;
    await frameAnimation(duration,t=>{
      const pose=hopPose(route[i-1],route[i],t,capture?1.35:.7),[x,y]=center([pose.x,pose.z]);
      if(moving){moving.style.left=x/7.2+'%';moving.style.top=y/7.2+'%';moving.style.setProperty('--jump',String(pose.y));}
      if(visual){const pixels=pose.y*44*$('#board').clientWidth/720;visual.style.transform=`translateY(${-pixels}px) rotate(${pose.tilt}rad) scaleY(${pose.squash})`;}
      board3d?.setPose(player.id,piece,pose);
    },{signal});
    if(!capture&&!document.hidden&&!signal?.aborted)playSound('step');
  }
  moving?.classList.remove('moving');if(visual)visual.style.transform='';
}
async function transitionGame(previous,next){
  const fresh=next?.event&&previous&&next.event.id!==(previous.event?.id??-1);
  if(fresh){
    const event=next.event;animating=true;motionController=new AbortController();
    renderAll();renderPieces(previous);visualLock=true;
    try{
      if(event.type==='roll'){
        playSound('roll');await frameAnimation(reducedMotion||document.hidden?0:560,()=>{},{signal:motionController.signal});
        announce(`${next.players.find(p=>p.id===event.playerId)?.name} gieo ${event.die}.${event.noMoves?' Không có nước đi hợp lệ.':''}`);
      }else if(event.type==='move'){
        const player=previous.players.find(p=>p.id===event.playerId);
        if(player)await animateHorse(player,event.piece,moveRoute(player,event.piece,event),{signal:motionController.signal});
        if(event.capture){
          playSound('capture');const captured=previous.players.find(p=>p.id===event.capture.playerId);
          if(captured)await animateHorse(captured,event.capture.piece,[boardCell(captured,event.capture.piece),boardCell(captured,event.capture.piece,-1)],{capture:true,signal:motionController.signal});
        }
        announce(next.log[0]?.text||'Đã đi ngựa.');
      }
    }finally{visualLock=false;animating=false;motionController=null;}
  }
  if(next?.status==='finished'&&previous?.status!=='finished'){playSound('win');confetti();announce('Chiến thắng: '+next.players.find(p=>p.id===next.winner)?.name);}
  renderAll();
}
async function connectStream(){
  streamController?.abort();const controller=new AbortController();streamController=controller;const currentSession={...session};
  while(!controller.signal.aborted&&mode==='online') {
    try{const response=await fetch(`/api/rooms/${currentSession.code}/events`,{headers:{'X-Player-Token':currentSession.token},signal:controller.signal});if(response.status===401||response.status===404){toast('Phòng đã kết thúc hoặc ghế đã được bỏ.');resetLobby();return;}if(!response.ok)throw new Error('stream');connected=true;renderAll();const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';while(!controller.signal.aborted){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let idx;while((idx=buffer.indexOf('\n\n'))!==-1){const block=buffer.slice(0,idx);buffer=buffer.slice(idx+2);const line=block.split('\n').find(l=>l.startsWith('data: '));if(line)enqueueRoom(JSON.parse(line.slice(6)));}}}catch(error){if(controller.signal.aborted)return;}if(controller.signal.aborted)return;connected=false;renderAll();await delay(1600);
  }
}
async function copyText(value,message){try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(value);else{const input=document.createElement('textarea');input.value=value;input.style.cssText='position:fixed;left:-9999px;top:0';document.body.append(input);input.select();const ok=document.execCommand('copy');input.remove();if(!ok)throw 0;}toast(message);}catch{openModal(`<h2>Sao chép để mời bạn</h2><p class="modal-copy">Chọn và sao chép nội dung bên dưới.</p><input readonly id="copy-fallback" style="margin-top:20px" value="${esc(value)}">`);$('#copy-fallback').select();}}
async function copyInvite(){if(['localhost','127.0.0.1','[::1]'].includes(location.hostname)){openModal(`<h2>Mời bạn cùng mạng</h2><p class="modal-copy">Bạn bè cần mở địa chỉ LAN được hiển thị khi bạn khởi động host, sau đó nhập mã phòng <b>${room.code}</b>. Địa chỉ localhost chỉ hoạt động trên máy của bạn.</p><button class="primary-button" id="copy-in-modal" style="margin-top:22px">${icon('copy')} Sao chép mã phòng</button>`);$('#copy-in-modal').onclick=()=>copyText(room.code,'Đã sao chép mã phòng');return;}await copyText(`${location.origin}/?room=${room.code}`,'Đã sao chép link mời');}
function confirmLeave(){const playing=game?.status==='playing';confirmDialog(playing?'Rời cuộc đua?':'Rời phòng này?',mode==='local'?'Ván hiện tại sẽ kết thúc trên máy này. Bạn có thể tạo một ván mới bất cứ lúc nào.':playing?'Ngựa của bạn sẽ rời bàn và được tính là bỏ cuộc. Những người còn lại vẫn tiếp tục chơi.':'Bạn có thể vào lại bằng mã phòng nếu vẫn còn chỗ.',async()=>{if(mode==='online')await act('leave');else{writeStore(localStorage,'horse-local',null);resetLobby();}},playing?'Rời ván':'Rời phòng');}
function resetLobby(){motionController?.abort();visualLock=false;lastTurnNotice=null;streamController?.abort();session=null;room=null;game=null;mode='lobby';connected=false;animating=false;persistSession(null);history.replaceState(null,'',location.pathname);renderAll();}
function confetti(){if(reducedMotion)return;for(let i=0;i<44;i++){const e=document.createElement('i');e.className='confetti';e.style.cssText=`left:${Math.random()*100}vw;background:${COLORS[i%4].color};animation-delay:${Math.random()*.6}s;--drift:${Math.random()*180-90}px`;document.body.append(e);setTimeout(()=>e.remove(),4000);}}
function registerTools(){const context=document.modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();const tool={name:'read_horse_game',title:'Đọc bàn cờ cá ngựa',description:'Read the current horse board, turn, room, selected one-die rules, and legal moves. Does not change gameplay.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(!input||Object.keys(input).length)throw new Error('Không có tham số.');return {mode,roomCode:room?.code??null,game:game?structuredClone(game):null,legalMoves:game?legalMoves(game):[]};}};try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}catch{}}

async function setBoardView(view){
  if(animating||viewLoading)return;
  viewLoading=true;renderHeader();
  try{
    if(view==='3d'&&!board3d){
      const {Board3D}=await import('./board3d.mjs');
      board3d=new Board3D($('#board'),{onSelect:piece=>{if(canAct())act('move',{piece});},onHover:piece=>piece===null?clearDestination():showDestination(piece),onProject:positionBoardLabels,onUnavailable:()=>{const lost=board3d;board3d=null;lost?.dispose();viewMode='2d';$('#board').classList.remove('view-3d');$('.board-stage').classList.remove('stage-3d');applyViewButtons();toast('Đồ họa 3D tạm ngừng. Đã chuyển sang 2D để tiếp tục chơi.');}});
    }
    if(view==='3d')await board3d.ready;
    while(animating)await delay(50);
    viewMode=view;board3d?.setVisible(view==='3d');$('#board').classList.toggle('view-3d',view==='3d');$('.board-stage').classList.toggle('stage-3d',view==='3d');
    writeStore(localStorage,'horse-view',view);renderPieces();positionBoardLabels();
  }catch(error){board3d?.dispose();board3d=null;viewMode='2d';$('#board').classList.remove('view-3d');$('.board-stage').classList.remove('stage-3d');positionBoardLabels();toast('Chưa tải được bàn 3D. Bạn có thể tiếp tục ở chế độ 2D.');}
  finally{viewLoading=false;applyViewButtons();renderHeader();}
}
function applyViewButtons(){
  $('#view-3d').setAttribute('aria-pressed',String(viewMode==='3d'));$('#view-2d').setAttribute('aria-pressed',String(viewMode==='2d'));
  $('#rotate-board').disabled=viewMode!=='3d';$('#reset-camera').disabled=viewMode!=='3d';$('#view-hint').textContent=viewMode==='3d'?'Kéo bàn để xoay · Chạm ngựa sáng để đi':'Góc nhìn từ trên xuống';
}
hydrate();drawBoard();renderAll();registerTools();
$('#view-3d').onclick=()=>setBoardView('3d');$('#view-2d').onclick=()=>setBoardView('2d');$('#rotate-board').onclick=()=>board3d?.rotate(-1);$('#reset-camera').onclick=()=>board3d?.resetView();
setupPWA({notify:toast,isPlaying:()=>game?.status==='playing'});
document.addEventListener('visibilitychange',()=>{if(document.hidden)motionController?.abort();else if(mode==='online'&&!connected)connectStream();});
setBoardView(readStore(localStorage,'horse-view','3d'));
$('#rules-button').onclick=showRules;$('#all-rules').onclick=showRules;
$('#modal .close-modal').onclick=closeModal;$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const b=$('#modal').getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closeModal();}});
function soundButton(){$('#sound-button').innerHTML=icon(sound?'volume2':'volume-x');$('#sound-button').setAttribute('aria-label',sound?'Tắt âm thanh':'Bật âm thanh');$('#sound-button').setAttribute('aria-pressed',String(sound));}
soundButton();$('#sound-button').onclick=()=>{sound=!sound;writeStore(localStorage,'horse-sound',sound);soundButton();if(sound)playSound('move');toast(sound?'Đã bật âm thanh':'Đã tắt âm thanh');};
$('#fullscreen-button').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Trình duyệt này chưa hỗ trợ toàn màn hình.');}};
document.addEventListener('fullscreenchange',()=>{$('#fullscreen-button').innerHTML=icon(document.fullscreenElement?'minimize':'maximize');});
document.addEventListener('keydown',e=>{if($('#modal').open||$('#install-dialog').open||['INPUT','SELECT','TEXTAREA','BUTTON','A'].includes(document.activeElement?.tagName))return;if(e.code==='Space'&&canAct()&&game.phase==='roll'){e.preventDefault();act('roll');}if(/^[1-4]$/.test(e.key)&&canAct()&&game.phase==='move'){const piece=Number(e.key)-1;if(legalMoves(game).some(m=>m.piece===piece))act('move',{piece});}});
window.addEventListener('pagehide',()=>streamController?.abort());window.addEventListener('pageshow',e=>{if(e.persisted&&mode==='online')connectStream();});
async function restore(){const saved=readStore(sessionStorage,'horse-session',null)||((matchMedia('(display-mode: standalone)').matches||navigator.standalone===true)?readStore(localStorage,'horse-resume-session',null):null);if(saved?.code&&saved?.token&&saved?.playerId){session=saved;try{const data=await api(`/rooms/${saved.code}`);if(mode!=='lobby'||session?.token!==saved.token)return;mode='online';room=data.room;game=room.game;persistSession(saved);renderAll();connectStream();return;}catch(error){if(mode!=='lobby'||session?.token!==saved.token)return;session=null;if(error.status===401||error.status===404){persistSession(null);toast('Phòng cũ đã kết thúc. Bạn có thể tham gia lại.');}else toast('Chưa nối được phòng cũ. Ghế của bạn được giữ để thử lại khi có mạng.');}}if(new URLSearchParams(location.search).has('room')){lobbyTab='join';renderLobby();}}
window.addEventListener('online',()=>{if(mode==='lobby'&&!busy)restore();});
restore();
