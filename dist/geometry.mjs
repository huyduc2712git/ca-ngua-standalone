// Tiny geometry toolkit for the board renderer. No CDN or runtime dependency.
export const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
export function multiply(a,b){const out=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];return out;}
export function modelMatrix(x=0,y=0,z=0,angle=0,scale=1){const c=Math.cos(angle)*scale,s=Math.sin(angle)*scale;return [c,0,-s,0,0,scale,0,0,s,0,c,0,x,y,z,1];}
export function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return [f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0];}
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n);};
export function lookAt(eye,target=[0,0,0]){const z=unit(eye.map((v,i)=>v-target[i])),x=unit(cross([0,1,0],z)),y=cross(z,x);return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];}
export function project(matrix,point,width,height){const p=[...point,1],v=[0,0,0,0];for(let r=0;r<4;r++)for(let k=0;k<4;k++)v[r]+=matrix[k*4+r]*p[k];return [(v[0]/v[3]+1)*width/2,(1-v[1]/v[3])*height/2,v[2]/v[3]];}
export function boardCamera(yaw,zoom=1,aspect=1){const distance=36/Math.max(.75,Math.min(1.45,zoom))*Math.max(1,1/aspect),eye=[Math.sin(yaw)*distance*.67,distance*.8,Math.cos(yaw)*distance*.67];return {eye,matrix:multiply(perspective(.72,aspect,.1,120),lookAt(eye,[0,.05,0]))};}
const cross2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export function signedArea(points){return points.reduce((s,a,i)=>{const b=points[(i+1)%points.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;}
export function triangulate(points){
  const ids=points.map((_,i)=>i);if(signedArea(points)<0)ids.reverse();const triangles=[];let guard=points.length**2;
  while(ids.length>3&&guard--){let clipped=false;for(let n=0;n<ids.length;n++){
    const a=ids[(n+ids.length-1)%ids.length],b=ids[n],c=ids[(n+1)%ids.length];if(cross2(points[a],points[b],points[c])<=1e-10)continue;
    const inside=ids.some(j=>j!==a&&j!==b&&j!==c&&cross2(points[a],points[b],points[j])>=-1e-10&&cross2(points[b],points[c],points[j])>=-1e-10&&cross2(points[c],points[a],points[j])>=-1e-10);
    if(inside)continue;triangles.push(a,b,c);ids.splice(n,1);clipped=true;break;
  }if(!clipped)throw new Error('Cannot triangulate contour');}
  if(ids.length===3)triangles.push(...ids);return triangles;
}
function vertex(out,p,n,uv=[0,0]){out.push(...p,...n,...uv);}
export function extrude(points,depth=.2,vertical=false){
  const out=[],faces=triangulate(points),p=points;const map=(v,h)=>vertical?[v[0],v[1],h]:[v[0],h,v[1]];
  const minX=Math.min(...p.map(v=>v[0])),minY=Math.min(...p.map(v=>v[1])),width=Math.max(...p.map(v=>v[0]))-minX||1,height=Math.max(...p.map(v=>v[1]))-minY||1,uv=v=>[(v[0]-minX)/width,(v[1]-minY)/height];
  for(let n=0;n<faces.length;n+=3){for(const i of [faces[n],faces[n+1],faces[n+2]])vertex(out,map(p[i],depth/2),vertical?[0,0,1]:[0,1,0],uv(p[i]));for(const i of [faces[n+2],faces[n+1],faces[n]])vertex(out,map(p[i],-depth/2),vertical?[0,0,-1]:[0,-1,0],uv(p[i]));}
  const sign=signedArea(points)>0?1:-1;
  for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],nx=(b[1]-a[1])*sign,ny=(a[0]-b[0])*sign,normal=unit(vertical?[nx,ny,0]:[nx,0,ny]);const aa=map(a,-depth/2),ab=map(b,-depth/2),ba=map(a,depth/2),bb=map(b,depth/2);for(const v of [aa,ab,bb,aa,bb,ba])vertex(out,v,normal);}
  return new Float32Array(out);
}
export function roundRect(w,d,r=.12){const out=[];for(const [x,z,start]of [[w/2-r,d/2-r,0],[-w/2+r,d/2-r,Math.PI/2],[-w/2+r,-d/2+r,Math.PI],[w/2-r,-d/2+r,Math.PI*1.5]])for(let i=0;i<=4;i++){const a=start+i*Math.PI/8;out.push([x+Math.cos(a)*r,z+Math.sin(a)*r]);}return out;}
export function circle(radius,segments=32){return Array.from({length:segments},(_,i)=>[Math.cos(i/segments*Math.PI*2)*radius,Math.sin(i/segments*Math.PI*2)*radius]);}
export function plane(w,d){const out=[];for(const [x,z,u,v]of [[-w/2,-d/2,0,0],[-w/2,d/2,0,1],[w/2,d/2,1,1],[-w/2,-d/2,0,0],[w/2,d/2,1,1],[w/2,-d/2,1,0]])vertex(out,[x,0,z],[0,1,0],[u,v]);return new Float32Array(out);}
export function billboard(w,h){const data=plane(w,h);for(let i=0;i<data.length;i+=8){data[i+1]=-data[i+2];data[i+2]=0;data[i+4]=0;data[i+5]=1;}return data;}
// Turned wooden playing piece: radius/height profile, with smooth radial normals.
export function lathe(profile,segments=40){
  const out=[],normals=profile.map((p,i)=>{const a=profile[Math.max(0,i-1)],b=profile[Math.min(profile.length-1,i+1)],length=Math.hypot(b[1]-a[1],b[0]-a[0])||1;return [(b[1]-a[1])/length,-(b[0]-a[0])/length];});
  const add=(i,j)=>{const a=j/segments*Math.PI*2,[r,y]=profile[i],[nr,ny]=normals[i];vertex(out,[Math.cos(a)*r,y,Math.sin(a)*r],[Math.cos(a)*nr,ny,Math.sin(a)*nr],[j/segments,y/1.5]);};
  for(let i=0;i<profile.length-1;i++)for(let j=0;j<segments;j++)for(const [pi,si]of [[i,j],[i+1,j],[i+1,j+1],[i,j],[i+1,j+1],[i,j+1]])add(pi,si);
  return new Float32Array(out);
}
