import {COLORS} from './engine.mjs';

// Keep ownership independent from the current turn and from connection state.
export function getTurnStatus({mode,game,room,playerId,connected=true,busy=false,animating=false}){
  const players=game?.players||room?.members||[];
  const me=mode==='online'?players.find(p=>p.id===playerId)??null:null;
  const playing=game?.status==='playing';
  const current=playing?game.players[game.current]:null;
  const actor=animating?players.find(p=>p.id===game?.event?.playerId)||current:current;
  const mine=!!current&&(mode==='local'||current.id===me?.id);
  const ready=playing&&mine&&!busy&&!animating&&(mode==='local'||connected);
  const color=actor?COLORS[actor.color]:me?COLORS[me.color]:null;
  let title='',detail='',tone='waiting';
  if(mode==='online'&&!connected){title='Đang nối lại phòng…';detail=me?`Bạn vẫn cầm quân ${COLORS[me.color].name.toLowerCase()}. Chờ kết nối để tiếp tục.`:'Chờ kết nối để tiếp tục.';tone='offline';}
  else if(game?.status==='finished'){const winner=players.find(p=>p.id===game.winner);title=winner?`${winner.name} chiến thắng!`:'Ván đã kết thúc';detail='Cùng nhau chơi thêm một ván nhé.';tone='finished';}
  else if(animating&&actor){title=game.event?.type==='roll'?`${actor.name} đang gieo xúc xắc`:`${actor.name} đang đi ngựa`;detail=`Quân ${color.name.toLowerCase()} · Chờ ngựa đi xong`;}
  else if(playing){
    title=mode==='local'?`Đến lượt ${current.name}`:mine?'ĐẾN LƯỢT BẠN!':`Đang chờ ${current.name}`;
    detail=mine?(game.phase==='move'?`Xúc xắc ${game.dice} · Chạm ngựa ${color.name.toLowerCase()} có vòng sáng`:`Quân ${color.name.toLowerCase()} · Gieo xúc xắc để bắt đầu`):`Quân ${color.name.toLowerCase()} đang ${game.phase==='move'?'chọn ngựa':'gieo xúc xắc'}`;
    if(mine)tone='yours';
  }else if(me){title=`Bạn cầm quân ${COLORS[me.color].name.toLowerCase()}`;detail=room?.hostId===me.id?'Chờ mọi người sẵn sàng rồi bắt đầu.':'Bấm sẵn sàng để chủ phòng bắt đầu.';}
  return {me,current,actor,mine,ready,color,title,detail,tone,visible:!!game||!!room,
    noticeKey:ready?`${mode}:${game.turn}:${current.id}`:null,
    myId:me?.id??null,activeId:actor?.id??null};
}
