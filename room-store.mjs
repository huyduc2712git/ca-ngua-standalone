import { existsSync, readFileSync, mkdirSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';

export function createRoomStore(file,now=()=>Date.now()){
  if(!file)return null;
  function read(){
    if(!existsSync(file))return [];
    const input=JSON.parse(readFileSync(file,'utf8'));
    if(input.schema!==1||!Array.isArray(input.rooms)||input.rooms.length>200)throw new Error('Tệp lưu phòng không hợp lệ. Giữ bản sao trước khi khôi phục.');
    for(const r of input.rooms){
      if(!/^[A-Z2-9]{6}$/.test(r.code)||!Number.isInteger(r.revision)||r.revision<1||![2,3,4].includes(r.capacity)||!Array.isArray(r.members)||r.members.length<1||r.members.length>r.capacity||!Number.isFinite(r.updatedAt))throw new Error('Dữ liệu phòng bị hỏng.');
      for(const p of r.members)if(!/^[a-f0-9]{24}$/.test(p.id)||!/^[a-f0-9]{64}$/.test(p.token)||typeof p.name!=='string'||p.name.length>24||!Number.isInteger(p.color)||p.color<0||p.color>3)throw new Error('Dữ liệu ghế bị hỏng.');
      if(!r.members.some(p=>p.id===r.hostId))throw new Error('Phòng không có chủ.');
      if(r.game){const g=r.game;if(g.rules!=='vn-one-die-1.0'||!Array.isArray(g.players)||g.players.length<2||g.players.length>4||!Number.isInteger(g.current)||g.current<0||g.current>=g.players.length||!['playing','finished'].includes(g.status)||!['roll','move','finished'].includes(g.phase))throw new Error('Ván đã lưu không tương thích.');for(const p of g.players)if(!Array.isArray(p.pieces)||p.pieces.length!==4||p.pieces.some(v=>!Number.isInteger(v)||v< -1||v>61))throw new Error('Vị trí ngựa đã lưu không hợp lệ.');}
    }
    return input.rooms.map(r=>({...r,members:r.members.map(p=>({...p,streams:new Set(),disconnectedAt:now()})),receipts:new Map(r.receipts||[])}));
  }
  function write(rooms){
    const data=JSON.stringify({schema:1,savedAt:now(),rooms:[...rooms.values()].map(r=>({code:r.code,capacity:r.capacity,hostId:r.hostId,revision:r.revision,updatedAt:r.updatedAt,game:r.game,members:r.members.map(({streams,...member})=>member),receipts:[...r.receipts]}))});
    mkdirSync(dirname(file),{recursive:true,mode:0o700});
    const temp=file+'.tmp',fd=openSync(temp,'w',0o600);
    try{writeFileSync(fd,data);fsyncSync(fd);}finally{closeSync(fd);}
    renameSync(temp,file);
  }
  return {read,write};
}
