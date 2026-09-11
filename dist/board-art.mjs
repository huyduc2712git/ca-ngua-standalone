import {COLORS,TRACK,HOME,PEN} from './engine.mjs';
import {boardPixel,boardCell} from './motion.mjs';

// One exact playing surface shared by the SVG board and the WebGL texture.
// The cells remain on the original 56-cell cờ cá ngựa route.
export const BOARD_UNITS=720/44;
export const PEN_LABEL_CELLS=PEN.map(([x,y])=>[x+2.5,y+.35]);
export function boardMarkup(){
  const ink='#4a301e',cream='#eddbb8',gold='#edc976';
  let s=`<defs><linearGradient id="timber" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c0925b"/><stop offset=".48" stop-color="#e0bd80"/><stop offset="1" stop-color="#ad7a43"/></linearGradient>${COLORS.map(c=>`<linearGradient id="paint-${c.id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${c.color}"/><stop offset="1" stop-color="${c.deep}"/></linearGradient>`).join('')}</defs>`;
  s+=`<rect width="720" height="720" rx="4" fill="url(#timber)"/><rect x="11" y="11" width="698" height="698" rx="2" fill="${cream}" stroke="${ink}" stroke-width="3"/><rect x="20" y="20" width="680" height="680" fill="none" stroke="#997047" stroke-width="1"/>`;
  COLORS.forEach((c,i)=>{
    const [px,py]=PEN[i],x=30+px*44,y=30+py*44;
    s+=`<rect x="${x}" y="${y}" width="264" height="264" fill="${cream}" stroke="${ink}" stroke-width="1.3"/><rect x="${x+9}" y="${y+9}" width="246" height="246" rx="3" fill="url(#paint-${c.id})"/><rect x="${x+15}" y="${y+15}" width="234" height="234" fill="none" stroke="${gold}" stroke-opacity=".72" stroke-width="1.5"/><rect x="${x+61}" y="${y+66}" width="142" height="152" fill="none" stroke="#f5e2b8" stroke-width="2"/>`;
    for(let n=0;n<4;n++){
      const [hx,hy]=boardPixel(boardCell({color:i,pieces:[-1,-1,-1,-1]},n));
      s+=`<circle cx="${hx}" cy="${hy}" r="24" fill="${c.deep}" fill-opacity=".20" stroke="#f2d9a3" stroke-opacity=".65" stroke-width="1.4"/>`;
    }
    s+=`<text x="${x+132}" y="${y+242}" text-anchor="middle" font-family="Georgia,serif" font-size="17" font-weight="bold" letter-spacing="2" fill="${gold}">${c.name.toUpperCase()}</text>`;
    s+=`<rect id="pen-highlight-${i}" class="pen-highlight" x="${x+5}" y="${y+5}" width="254" height="254" rx="3" fill="none" stroke="#ffe6a8" stroke-width="7" opacity="0"/>`;
  });
  TRACK.forEach((cell,index)=>{
    const [x,y]=boardPixel(cell),start=index%14===0,door=index%14===13,color=start?index/14:door?((index+1)/14)%4:0,c=COLORS[color];
    s+=`<rect x="${x-22}" y="${y-22}" width="44" height="44" fill="${start?c.color:cream}" stroke="${ink}" stroke-width="1.3"/>`;
    if(start){const rot=[0,-90,180,90][color];s+=`<g transform="translate(${x} ${y}) rotate(${rot})" stroke="${gold}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M0 -11 V10 M-7 3 L0 10 L7 3"/></g>`;}
    if(door)s+=`<circle cx="${x}" cy="${y}" r="10" stroke="${c.deep}" stroke-width="2.5" fill="none"/><circle cx="${x}" cy="${y}" r="3" fill="${c.deep}"/>`;
  });
  HOME.forEach((cells,color)=>cells.forEach((cell,i)=>{const [x,y]=boardPixel(cell),c=COLORS[color];s+=`<rect x="${x-22}" y="${y-22}" width="44" height="44" fill="${c.color}" stroke="${ink}" stroke-width="1.3"/><rect x="${x-19}" y="${y-19}" width="38" height="38" fill="none" stroke="${gold}" stroke-opacity=".25"/><text x="${x}" y="${y+7}" text-anchor="middle" font-family="Georgia,serif" font-weight="bold" font-size="22" fill="${gold}">${i+1}</text>`;}));
  // A compact brass centre leaves the last home cells readable and playable.
  s+=`<rect x="338" y="338" width="44" height="44" fill="#614022" stroke="${ink}" stroke-width="1.3"/><text x="360" y="369" text-anchor="middle" font-family="Georgia,serif" font-size="28" fill="${gold}">♛</text>`;
  return s;
}
export function boardSVG(){return `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1440" viewBox="0 0 720 720">${boardMarkup()}</svg>`;}
