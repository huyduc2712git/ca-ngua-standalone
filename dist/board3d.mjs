import {COLORS,PEN,isSettled} from './engine.mjs';
import {boardCell} from './motion.mjs';
import {BOARD_UNITS,PEN_LABEL_CELLS,boardSVG} from './board-art.mjs';
import {modelMatrix,boardCamera,project,extrude,roundRect,plane,billboard,lathe} from './geometry.mjs';

const VERTEX=`attribute vec3 a_position;attribute vec3 a_normal;attribute vec2 a_uv;uniform mat4 u_model;uniform mat4 u_camera;varying vec3 v_normal;varying vec3 v_world;varying vec2 v_uv;void main(){vec4 world=u_model*vec4(a_position,1.0);v_world=world.xyz;v_normal=normalize(mat3(u_model)*a_normal);v_uv=a_uv;gl_Position=u_camera*world;}`;
const FRAGMENT=`precision mediump float;uniform vec4 u_color;uniform sampler2D u_texture;uniform vec3 u_eye;uniform float u_flat;varying vec3 v_normal;varying vec3 v_world;varying vec2 v_uv;void main(){vec4 tex=texture2D(u_texture,v_uv);float alpha=tex.a*u_color.a;if(alpha<0.015)discard;vec3 n=normalize(v_normal);vec3 light=normalize(vec3(-0.6,1.0,0.45));float diffuse=max(dot(n,light),0.0);vec3 viewDir=normalize(u_eye-v_world);float spec=pow(max(dot(n,normalize(light+viewDir)),0.0),45.0)*0.35;vec3 color=tex.rgb*u_color.rgb;vec3 lit=color*(0.46+0.60*diffuse)*vec3(1.0,0.95,0.84)+vec3(1.0,0.86,0.64)*spec;gl_FragColor=vec4(mix(lit,color,u_flat),alpha);}`;
const rgb=(hex,alpha=1)=>{const value=parseInt(hex.replace('#',''),16);return [(value>>16&255)/255,(value>>8&255)/255,(value&255)/255,alpha];};
const SURFACE=.17;
const PAWN_PROFILE=[[0,.012],[.30,.012],[.37,.04],[.38,.09],[.35,.15],[.31,.20],[.29,.23],[.25,.27],[.20,.36],[.16,.49],[.12,.67],[.105,.85],[.12,.93],[.17,.96],[.18,1.0],[.15,1.04],[.18,1.09],[.205,1.16],[.205,1.23],[.17,1.31],[.10,1.37],[0,1.39]];
function ring(inner,outer){const data=[];for(let i=0;i<48;i++){const a=i/48*Math.PI*2,b=(i+1)/48*Math.PI*2;for(const [angle,r]of [[a,inner],[a,outer],[b,outer],[a,inner],[b,outer],[b,inner]])data.push(Math.cos(angle)*r,0,Math.sin(angle)*r,0,1,0,0,0);}return new Float32Array(data);}
function rectangleRing(size,thickness){const o=size/2,i=o-thickness,data=[];const corners=[[-1,-1],[-1,1],[1,1],[1,-1]];for(let k=0;k<4;k++){const a=corners[k],b=corners[(k+1)%4];for(const [c,r]of [[a,i],[a,o],[b,o],[a,i],[b,o],[b,i]])data.push(c[0]*r,0,c[1]*r,0,1,0,0,0);}return new Float32Array(data);}
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Không tải được chất liệu bàn cờ.'));img.src=src;});}

export class Board3D {
  constructor(container,{onSelect,onHover,onUnavailable,onProject}){
    Object.assign(this,{container,onSelect,onHover,onProject,visible:true,yaw:.48,zoom:1,pieces:[],available:new Set(),pose:new Map(),buffers:[],textures:[],scene:[],destroyed:false,context:{},myId:null});
    const canvas=document.createElement('canvas');canvas.className='board-webgl';canvas.hidden=true;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Bàn cờ gỗ 3D. Kéo để xoay. Quân của bạn có vòng trắng; chạm quân có vòng vàng để đi.');this.canvas=canvas;
    const gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'low-power',premultipliedAlpha:false});if(!gl)throw new Error('WebGL không khả dụng');this.gl=gl;
    const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;};
    const program=gl.createProgram(),vs=compile(gl.VERTEX_SHADER,VERTEX),fs=compile(gl.FRAGMENT_SHADER,FRAGMENT);gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));this.program=program;gl.useProgram(program);
    this.attributes={position:gl.getAttribLocation(program,'a_position'),normal:gl.getAttribLocation(program,'a_normal'),uv:gl.getAttribLocation(program,'a_uv')};this.uniforms=Object.fromEntries(['model','camera','color','texture','eye','flat'].map(key=>[key,gl.getUniformLocation(program,'u_'+key)]));
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
    this.white=this.texture(null);this.wood=this.texture(null);this.boardPaint=this.texture(null);
    this.meshes={pawn:this.mesh(lathe(PAWN_PROFILE)),halo:this.mesh(ring(.46,.56)),owner:this.mesh(ring(.39,.46)),shadow:this.mesh(plane(1.2,1.2)),number:this.mesh(billboard(.22,.22)),target:this.mesh(ring(.22,.34)),pen:this.mesh(rectangleRing(5.75,.075))};
    this.shadowTexture=this.makeTexture(ctx=>{const g=ctx.createRadialGradient(64,64,3,64,64,62);g.addColorStop(0,'rgba(18,8,2,.66)');g.addColorStop(1,'rgba(18,8,2,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);});
    this.numberTextures=[1,2,3,4].map(n=>this.textTexture(String(n),'#fff1cf',94));
    this.makeBoard();container.append(canvas);canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.visible=false;onUnavailable?.();});
    this.bindPointers();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);this.resize();
    this.ready=this.loadMaterials();
  }
  mesh(data){const gl=this.gl,buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);this.buffers.push(buffer);return {buffer,count:data.length/8};}
  texture(source){const gl=this.gl,texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);if(source)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));this.textures.push(texture);return texture;}
  updateTexture(texture,source){const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);}
  makeTexture(draw){const c=document.createElement('canvas');c.width=128;c.height=128;draw(c.getContext('2d'));return this.texture(c);}
  textTexture(text,color,size=67){return this.makeTexture(ctx=>{ctx.fillStyle=color;ctx.font=`700 ${size}px "Segoe UI",Arial,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,64,68);});}
  async loadMaterials(){
    const [wood,art]=await Promise.all([loadImage('/assets/walnut.png'),loadImage('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(boardSVG()))]);
    if(this.destroyed)return;this.updateTexture(this.wood,wood);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=2048;const ctx=canvas.getContext('2d');ctx.drawImage(art,0,0,2048,2048);ctx.globalCompositeOperation='soft-light';ctx.globalAlpha=.22;ctx.drawImage(wood,0,0,2048,2048);this.updateTexture(this.boardPaint,canvas);this.render();
  }
  item(mesh,x,y,z,color,texture=null,angle=0,scale=1,flat=0){return {mesh,model:modelMatrix(x,y,z,angle,scale),color:typeof color==='string'?rgb(color):color,texture:texture||this.white,flat};}
  makeBoard(){
    const add=(...args)=>this.scene.push(this.item(...args));
    add(this.mesh(plane(22,22)),0,-.53,0,[1,1,1,.8],this.shadowTexture,0,1,1);
    add(this.mesh(extrude(roundRect(17.25,17.25,.13),.52)),0,-.22,0,'#d6b98d',this.wood);
    add(this.mesh(extrude(roundRect(17.08,17.08,.09),.12)),0,.077,0,'#e0bd85',this.wood);
    add(this.mesh(plane(BOARD_UNITS,BOARD_UNITS)),0,.142,0,'#ffffff',this.boardPaint,0,1,.38);
  }
  update(players,moves,context={}){
    this.pieces=players.filter(p=>!p.forfeited).flatMap(p=>p.pieces.map((progress,piece)=>({key:`${p.id}:${piece}`,playerId:p.id,piece,color:p.color,cell:boardCell(p,piece),settled:isSettled(p,piece)})));
    this.available=new Set(moves.map(m=>`${m.playerId}:${m.piece}`));this.pose.clear();this.target=null;
    if(context.myId&&context.myId!==this.myId){const me=players.find(p=>p.id===context.myId);if(me)this.yaw=this.homeAngle(me.color);}
    this.myId=context.myId;this.context=context;this.render();
  }
  homeAngle(color){const [x,z]=PEN[color];return Math.atan2(x-4.5,z-4.5);}
  setPose(playerId,piece,pose){this.pose.set(`${playerId}:${piece}`,pose);this.render();}
  setDestination(cell,color){if(!cell&&!this.target)return;this.target=cell?{cell,color}:null;this.render();}
  setVisible(value){this.visible=value;this.canvas.hidden=!value;if(value)this.resize();}
  rotate(direction){this.yaw+=direction*Math.PI/4;this.render();}
  resetView(){const me=this.pieces.find(p=>p.playerId===this.myId);this.yaw=me?this.homeAngle(me.color):.48;this.zoom=1;this.render();}
  resize(){if(this.destroyed)return;const width=this.container.clientWidth,height=this.container.clientHeight;if(!width||!height)return;const dpr=Math.min(window.devicePixelRatio||1,1.65);this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);this.render();}
  draw(item){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,item.mesh.buffer);for(const [name,size,offset]of [['position',3,0],['normal',3,12],['uv',2,24]]){gl.enableVertexAttribArray(this.attributes[name]);gl.vertexAttribPointer(this.attributes[name],size,gl.FLOAT,false,32,offset);}gl.uniformMatrix4fv(this.uniforms.model,false,item.model);gl.uniform4fv(this.uniforms.color,item.color);gl.uniform1f(this.uniforms.flat,item.flat);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,item.texture);gl.drawArrays(gl.TRIANGLES,0,item.mesh.count);}
  render(){
    if(!this.visible||this.destroyed)return;const gl=this.gl,canvas=this.canvas;if(!canvas.width||!canvas.height)return;
    gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
    const camera=boardCamera(this.yaw,this.zoom,canvas.width/canvas.height);this.eye=camera.eye;this.camera=camera.matrix;gl.uniformMatrix4fv(this.uniforms.camera,false,this.camera);gl.uniform3fv(this.uniforms.eye,this.eye);gl.uniform1i(this.uniforms.texture,0);
    for(const item of this.scene)this.draw(item);
    const active=this.pieces.find(p=>p.playerId===this.context.activeId);
    if(active){const [x,z]=PEN[active.color];this.draw(this.item(this.meshes.pen,x-4.5,.151,z-4.5,'#ffe4a0',null,0,1,1));}
    for(const p of this.pieces){const pose=this.pose.get(p.key)||{x:p.cell[0],z:p.cell[1],y:0},x=pose.x-7,z=pose.z-7;
      this.draw(this.item(this.meshes.shadow,x,.153,z,[1,1,1,1-Math.min(.7,pose.y*.5)],this.shadowTexture,0,1+pose.y*.2,1));
      if(p.playerId===this.myId)this.draw(this.item(this.meshes.owner,x,.157,z,'#fff5da',null,0,1,1));
      if(this.available.has(p.key)||p.settled)this.draw(this.item(this.meshes.halo,x,.161,z,p.settled?'#eac370':'#ffe4a0',null,0,this.available.has(p.key)?1.12:1,1));
    }
    if(this.target){const {cell,color}=this.target;this.draw(this.item(this.meshes.target,cell[0]-7,.162,cell[1]-7,COLORS[color].deep,null,0,1,1));}
    for(const p of this.pieces){const pose=this.pose.get(p.key)||{x:p.cell[0],z:p.cell[1],y:0},x=pose.x-7,z=pose.z-7,y=SURFACE+pose.y,c=COLORS[p.color];
      this.draw(this.item(this.meshes.pawn,x,y,z,c.color,null,0,pose.squash||1));
      this.draw(this.item(this.meshes.number,x+Math.sin(this.yaw)*.33,y+.20,z+Math.cos(this.yaw)*.33,'#ffffff',this.numberTextures[p.piece],this.yaw,1,1));
    }
    const w=this.container.clientWidth,h=this.container.clientHeight;
    this.onProject?.(PEN_LABEL_CELLS.map(([x,z])=>project(this.camera,[x-7,.20,z-7],w,h).slice(0,2).map((v,i)=>v/(i?h:w)*100)));
  }
  hitTest(clientX,clientY){const rect=this.canvas.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top;let nearest=null,best=Infinity;for(const p of this.pieces){if(!this.available.has(p.key))continue;const point=project(this.camera,[p.cell[0]-7,.91,p.cell[1]-7],rect.width,rect.height),distance=Math.hypot(point[0]-x,point[1]-y);if(distance<Math.max(21,rect.width*.034)&&distance<best){nearest=p;best=distance;}}return nearest;}
  bindPointers(){const canvas=this.canvas;let start=null,moved=false;canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;start={x:e.clientX,y:e.clientY,yaw:this.yaw};moved=false;canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(start){const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.hypot(dx,dy)>7)moved=true;if(moved){this.yaw=start.yaw-dx*.006;this.onHover?.(null);this.render();}}else{const p=this.hitTest(e.clientX,e.clientY);canvas.style.cursor=p?'pointer':'grab';this.onHover?.(p?.piece??null);}});
    canvas.addEventListener('pointerup',e=>{if(start&&!moved){const p=this.hitTest(e.clientX,e.clientY);if(p)this.onSelect?.(p.piece);}start=null;});canvas.addEventListener('pointercancel',()=>{start=null;});canvas.addEventListener('pointerleave',()=>{if(!start)this.onHover?.(null);});
    canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom=Math.max(.85,Math.min(1.06,this.zoom-e.deltaY*.0008));this.render();},{passive:false});
  }
  dispose(){this.destroyed=true;this.observer?.disconnect();for(const buffer of this.buffers)this.gl.deleteBuffer(buffer);for(const texture of this.textures)this.gl.deleteTexture(texture);this.gl.deleteProgram(this.program);this.canvas.remove();}
}
