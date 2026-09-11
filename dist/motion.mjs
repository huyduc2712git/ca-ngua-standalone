import { TRACK, HOME, PEN, globalCell } from './engine.mjs';
export const HOP_MS=260;
export function boardCell(player,piece,progress=player.pieces[piece]) {
  if(progress<0){const [x,y]=PEN[player.color];return [x+1.5+(piece%2)*2,y+1.9+Math.floor(piece/2)*1.95];}
  return progress<56?TRACK[globalCell(player,progress)]:HOME[player.color][progress-56];
}
export const boardPixel=cell=>[52+cell[0]*44,52+cell[1]*44];
export const coordinate=(player,piece,progress=player.pieces[piece])=>boardPixel(boardCell(player,piece,progress));
export function hopPose(from,to,progress,height=.7){
  const t=Math.max(0,Math.min(1,progress)),ease=t*t*(3-2*t),jump=Math.sin(Math.PI*t);
  return {x:from[0]+(to[0]-from[0])*ease,z:from[1]+(to[1]-from[1])*ease,y:jump*height,tilt:Math.sin(Math.PI*2*t)*.1,squash:1-.1*Math.sin(Math.PI*t)**6};
}
export function moveRoute(player,piece,event){
  return [boardCell(player,piece,event.from),...event.path.map(progress=>boardCell(player,piece,progress))];
}
export function frameAnimation(duration,paint,{signal,requestFrame=cb=>requestAnimationFrame(cb),clock=()=>performance.now()}={}){
  return new Promise(resolve=>{
    if(signal?.aborted||duration===0){paint(1);resolve();return;}
    let finished=false;const start=clock();
    const done=()=>{if(finished)return;finished=true;paint(1);signal?.removeEventListener('abort',done);resolve();};
    signal?.addEventListener('abort',done,{once:true});
    const frame=now=>{if(finished)return;const t=Math.min(1,Math.max(0,(now-start)/duration));paint(t);if(t===1)done();else requestFrame(frame);};
    paint(0);requestFrame(frame);
  });
}
