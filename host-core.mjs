import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { networkInterfaces } from 'node:os';
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { createRoomStore } from './room-store.mjs';
import { createGame, rollDice, movePiece, forfeit, SEAT_ORDER, COLORS } from './dist/engine.mjs';

const ROOT=fileURLToPath(new URL('./dist/',import.meta.url));
const MAX_BODY=8192, MAX_ROOMS=200, ROOM_TTL=24*60*60*1000;
const CONTENT_TYPES={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'};
// LAN discovery is only a convenience. Restricted hosts may deny this OS call.
export function getLanUrls(port,inspect=networkInterfaces) {
  try {
    return [...new Set(Object.values(inspect()).flatMap(addresses=>(addresses||[])
      .filter(address=>address.family==='IPv4'&&!address.internal)
      .map(address=>`http://${address.address}:${port}`)))];
  } catch { return []; }
}
export function createApp({dice=()=>randomInt(1,7),now=()=>Date.now(),assets=null,storeFile=null,trustProxy=false}={}) {
  const store=createRoomStore(storeFile,now),rooms=new Map(),limits=new Map();
  const persist=()=>store?.write(rooms);
  const restored=store?.read()||[];
  for(const room of restored)if(now()-room.updatedAt<=ROOM_TTL)rooms.set(room.code,room);
  if(restored.length!==rooms.size)persist();
  function fail(status,message){const e=new Error(message);e.status=status;throw e;}
  function publicRoom(room){return {code:room.code,capacity:room.capacity,hostId:room.hostId,revision:room.revision,phase:room.game?.status??'lobby',members:room.members.map(p=>({id:p.id,name:p.name,color:p.color,ready:p.ready,online:p.streams.size>0,disconnectedAt:p.disconnectedAt})),game:room.game};}
  function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
  function emit(room){const data=`event: state\ndata: ${JSON.stringify(publicRoom(room))}\n\n`;for(const member of room.members)for(const res of member.streams) {if(res.writableLength>1024*1024) res.destroy();else res.write(data);} }
  function checkRate(req){const forwarded=trustProxy?String(req.headers['x-forwarded-for']||'').split(',')[0].trim():'';const key=forwarded||req.socket.remoteAddress;const time=now();let e=limits.get(key);if(!e||e.until<time){e={count:0,until:time+60_000};limits.set(key,e);}if(++e.count>180) fail(429,'Bạn thao tác quá nhanh. Chờ một chút rồi thử lại.');}
  async function body(req){let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>MAX_BODY) fail(413,'Yêu cầu quá lớn.');}try {const obj=JSON.parse(data||'{}');if(!obj||Array.isArray(obj)||typeof obj!=='object') throw 0;return obj;}catch{fail(400,'Dữ liệu không hợp lệ.');}}
  function nameOf(value){if(typeof value!=='string')fail(400,'Hãy nhập tên của bạn.');const name=value.normalize('NFC').trim();if(!name||name.length>24||/[\p{C}<>]/u.test(name)) fail(400,'Tên cần có 1–24 ký tự, không chứa ký tự đặc biệt.');return name;}
  function memberOf(req,room){const token=req.headers['x-player-token'];if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))fail(401,'Không có quyền vào ghế này.');const p=room.members.find(p=>timingSafeEqual(Buffer.from(p.token),Buffer.from(token)));if(!p)fail(401,'Phiên chơi đã hết. Hãy tham gia lại.');return p;}
  function newMember(name,color){return {id:randomBytes(12).toString('hex'),token:randomBytes(32).toString('hex'),name,color,ready:false,streams:new Set(),disconnectedAt:now()};}
  function roomOf(code){const room=rooms.get(code);if(!room)fail(404,'Không tìm thấy phòng. Kiểm tra mã và địa chỉ host.');return room;}
  function disconnect(room,p,res){p.streams.delete(res);if(!p.streams.size)p.disconnectedAt=now();emit(room);}
  function removeMember(room,p){if(room.game?.status==='playing')forfeit(room.game,p.id);room.members=room.members.filter(m=>m.id!==p.id);for(const stream of p.streams)stream.end();p.streams.clear();if(!room.members.length){rooms.delete(room.code);persist();return;}if(room.hostId===p.id)room.hostId=room.members[0].id;room.revision++;room.updatedAt=now();persist();emit(room);}
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','SAMEORIGIN');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'");
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname.startsWith('/api/')) {
        if(req.method==='OPTIONS')fail(405,'Chỉ truy cập từ trang của host.');
        if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host) fail(403,'Hãy mở game từ cùng địa chỉ host.');
        if(req.method==='POST'&&!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'Yêu cầu phải có định dạng JSON.');
        if(req.method==='POST')checkRate(req);
        if(url.pathname==='/api/health'&&req.method==='GET') return send(res,200,{ok:true,version:'2.1.0',persistence:!!store});
        if(url.pathname==='/api/rooms'&&req.method==='POST') {
          if(rooms.size>=MAX_ROOMS)fail(503,'Host đã đầy phòng. Hãy thử lại sau.');
          const input=await body(req), name=nameOf(input.name), capacity=input.capacity??4;
          if(![2,3,4].includes(capacity)) fail(400,'Số người chơi phải từ 2 đến 4.');
          const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code;
          do {code=Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');}while(rooms.has(code));
          const p=newMember(name,0);p.ready=true;
          const room={code,capacity,hostId:p.id,members:[p],game:null,revision:1,updatedAt:now(),receipts:new Map()};rooms.set(code,room);persist();
          return send(res,201,{token:p.token,playerId:p.id,room:publicRoom(room)});
        }
        const match=url.pathname.match(/^\/api\/rooms\/([A-Z2-9]{6})(?:\/(join|events|action))?$/);
        if(!match)fail(404,'Không tìm thấy địa chỉ này.');
        const room=roomOf(match[1]), endpoint=match[2];
        if(endpoint==='join'&&req.method==='POST') {
          const input=await body(req), name=nameOf(input.name);
          if(room.game)fail(409,'Phòng đã bắt đầu ván. Hãy chờ ván mới.');
          if(room.members.length>=room.capacity)fail(409,'Phòng đã đủ người.');
          const color=SEAT_ORDER.find(c=>!room.members.some(p=>p.color===c));
          const p=newMember(name,color);room.members.push(p);room.revision++;room.updatedAt=now();persist();emit(room);
          return send(res,200,{token:p.token,playerId:p.id,room:publicRoom(room)});
        }
        const player=memberOf(req,room);
        if(!endpoint&&req.method==='GET')return send(res,200,{room:publicRoom(room)});
        if(endpoint==='events'&&req.method==='GET') {
          if(player.streams.size>=3)fail(429,'Ghế này đang mở quá nhiều kết nối.');
          res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();
          player.streams.add(res);player.disconnectedAt=null;emit(room);
          const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),15_000);heartbeat.unref();
          res.on('close',()=>{clearInterval(heartbeat);disconnect(room,player,res);});return;
        }
        if(endpoint==='action'&&req.method==='POST') {
          const input=await body(req);
          if(typeof input.actionId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(input.actionId))fail(400,'Mã thao tác không hợp lệ.');
          const receiptKey=`${player.id}:${input.actionId}`;
          if(room.receipts.has(receiptKey))return send(res,200,{room:publicRoom(room),duplicate:true});
          if(input.revision!==room.revision)return send(res,409,{error:'Bàn cờ vừa thay đổi. Hãy thử lại.',room:publicRoom(room)});
          const isHost=room.hostId===player.id;
          switch(input.type) {
            case 'ready':
              if(room.game)fail(409,'Ván đã bắt đầu.');
              if(typeof input.ready!=='boolean')fail(400,'Trạng thái không hợp lệ.');
              player.ready=input.ready;break;
            case 'start': {
              if(!isHost)fail(403,'Chỉ chủ phòng có thể bắt đầu.');
              if(room.game)fail(409,'Ván đã bắt đầu.');
              if(room.members.length<2)fail(409,'Cần ít nhất 2 người để bắt đầu.');
              if(room.members.some(p=>!p.ready))fail(409,'Chờ mọi người sẵn sàng.');
              if(room.members.some(p=>!p.streams.size))fail(409,'Chờ mọi người kết nối lại.');
              room.game=createGame([...room.members].sort((a,b)=>a.color-b.color));break;
            }
            case 'roll':
              if(!room.game)fail(409,'Ván chưa bắt đầu.');
              if(room.game.status!=='playing'||room.game.phase!=='roll'||room.game.players[room.game.current].id!==player.id)fail(409,'Chưa đến lượt gieo của bạn.');
              rollDice(room.game,player.id,dice());break;
            case 'move':
              if(!room.game)fail(409,'Ván chưa bắt đầu.');
              try{movePiece(room.game,player.id,input.piece);}catch(error){fail(409,error.message);}break;
            case 'rematch':
              if(!isHost)fail(403,'Chỉ chủ phòng có thể mở ván mới.');
              if(room.game?.status!=='finished')fail(409,'Ván hiện tại chưa kết thúc.');
              room.game=null;for(const p of room.members)p.ready=p.id===room.hostId;break;
            case 'remove': {
              if(!isHost)fail(403,'Chỉ chủ phòng có thể bỏ ghế mất kết nối.');
              const target=room.members.find(p=>p.id===input.playerId);
              if(!target||target.id===player.id)fail(400,'Ghế không hợp lệ.');
              if(target.streams.size||!target.disconnectedAt||now()-target.disconnectedAt<60_000)fail(409,'Chỉ bỏ ghế đã mất kết nối ít nhất 60 giây.');
              removeMember(room,target);return send(res,200,{room:publicRoom(room)});
            }
            case 'leave':removeMember(room,player);return send(res,200,{left:true});
            default:fail(400,'Thao tác không hợp lệ.');
          }
          room.revision++;room.updatedAt=now();room.receipts.set(receiptKey,true);
          if(room.receipts.size>200)room.receipts.delete(room.receipts.keys().next().value);
          persist();emit(room);return send(res,200,{room:publicRoom(room)});
        }
        fail(405,'Phương thức không được hỗ trợ.');
      }
      if(req.method!=='GET'&&req.method!=='HEAD')fail(405,'Phương thức không được hỗ trợ.');
      const pathname=decodeURIComponent(url.pathname);
      const asset=pathname==='/'?'index.html':pathname.slice(1);
      if(asset.includes('..')||asset.includes('\\')||asset.includes('\0')||!CONTENT_TYPES[extname(asset)])fail(404,'Không tìm thấy tệp.');
      const file=assets?(Object.hasOwn(assets,asset)?Buffer.from(assets[asset],'base64'):fail(404,'Không tìm thấy tệp.')):await readFile(resolve(ROOT,asset)).catch(()=>fail(404,'Không tìm thấy tệp.'));
      if(asset==='sw.js')res.setHeader('Service-Worker-Allowed','/');
      res.writeHead(200,{'Content-Type':CONTENT_TYPES[extname(asset)],'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:file);
    } catch(error) {if(!res.headersSent)send(res,error.status??500,{error:error.status?error.message:'Host gặp sự cố. Hãy thử lại.'});else res.end();}
  });
  const cleanup=setInterval(()=>{let changed=false;for(const [code,room]of rooms)if(now()-room.updatedAt>ROOM_TTL&&!room.members.some(p=>p.streams.size)){rooms.delete(code);changed=true;}if(changed)try{persist();}catch(error){console.error('Không lưu được danh sách phòng:',error.message);}for(const [ip,limit]of limits)if(limit.until<now())limits.delete(ip);},60_000);cleanup.unref();
  server.on('close',()=>{clearInterval(cleanup);});
  return {server,rooms};
}

export function startHost(options={}) {
  const port=Number(process.env.PORT||3000),host=process.env.HOST||'0.0.0.0';
  const {server}=createApp({...options,storeFile:process.env.ROOMS_FILE||null,trustProxy:process.env.TRUST_PROXY==='1'});
  server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Cổng ${port} đang được sử dụng. Hãy đổi PORT.`:e.message);process.exitCode=1;});
  server.listen(port,host,()=>{
    const boundPort=server.address().port;
    console.log(`\n  CÁ NGỰA CLUB\n  Máy host: http://localhost:${boundPort}\n`);
    const lanUrls=getLanUrls(boundPort);
    for(const url of lanUrls)console.log(`  Bạn bè cùng mạng mở: ${url}`);
    if(!lanUrls.length)console.log(`  Chưa tự lấy được địa chỉ LAN. Bạn bè có thể mở http://<IP-của-host>:${boundPort}.`);
    console.log('\n  Tạo phòng và chia sẻ mã 6 ký tự. Nhấn Ctrl+C để dừng.\n');
  });
  const stop=()=>{server.closeAllConnections();server.close(()=>process.exit(0));};
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
  return server;
}
