import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const vehicleSpecs = {
 skyline:{length:4.35,width:1.76,height:1.35,roof:[[-1.35,.78],[-.72,1.27],[.48,1.27],[1.12,.78]],hood:.77,wing:true,nose:'square'},
 porsche:{length:4.12,width:1.84,height:1.24,roof:[[-1.5,.7],[-.75,1.21],[.15,1.23],[.92,.69]],hood:.64,wing:true,nose:'round'},
 supra:{length:4.35,width:1.84,height:1.27,roof:[[-1.5,.74],[-.52,1.24],[.3,1.24],[.95,.72]],hood:.7,wing:true,nose:'round'},
 mustang:{length:4.7,width:1.9,height:1.33,roof:[[-1.6,.76],[-.85,1.26],[.18,1.26],[.85,.77]],hood:.76,wing:false,nose:'square'},
 civic:{length:3.95,width:1.72,height:1.37,roof:[[-1.5,.78],[-1.15,1.3],[.38,1.3],[1.07,.76]],hood:.73,wing:false,nose:'square'},
 defender:{length:3.9,width:1.91,height:1.88,roof:[[-1.64,.9],[-1.55,1.82],[.65,1.82],[.99,.96]],hood:.94,wing:false,nose:'square'}
};
const black=()=>new THREE.MeshStandardMaterial({color:0x111619,roughness:.75});
function rounded(w,h,d,r,mat){return new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,r),mat);}
function poly(points,mat){const g=new THREE.BufferGeometry();let a=[];for(let i=1;i<points.length-1;i++)a.push(...points[0],...points[i],...points[i+1]);g.setAttribute('position',new THREE.Float32BufferAttribute(a,3));g.computeVertexNormals();return new THREE.Mesh(g,mat);}
function loft(sections,mat){
 const vertices=[],indices=[];
 const curve=new THREE.CatmullRomCurve3(sections.map(([x,w,y])=>new THREE.Vector3(x,w,y)),false,'centripetal');
 sections=curve.getPoints(52).map(v=>[v.x,v.y,v.z]);
 for(const [x,w,y] of sections){const contour=[[-w*.92,.33],[-w,.46],[-w,y-.075],[-w*.86,y],[w*.86,y],[w,y-.075],[w,.46],[w*.92,.33]];for(const [z,h] of contour)vertices.push(x,h,z);}
 for(let s=0;s<sections.length-1;s++)for(let j=0;j<8;j++){const a=s*8+j,b=s*8+(j+1)%8,c=(s+1)*8+j,d=(s+1)*8+(j+1)%8;indices.push(a,b,d,a,d,c);}
 for(let j=1;j<7;j++){indices.push(0,j+1,j);let t=(sections.length-1)*8;indices.push(t,t+j,t+j+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return new THREE.Mesh(g,mat);
}
function line(points,color=0x263237){const g=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));return new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:true,opacity:.65}));}

export function buildCar(product){
 const s=vehicleSpecs[product.id]||vehicleSpecs.skyline;const car=new THREE.Group();car.name=product.id;car.userData.productId=product.id;car.userData.color=product.color;
 const paint=new THREE.MeshPhysicalMaterial({color:product.color,metalness:.62,roughness:.19,clearcoat:1,clearcoatRoughness:.09});
 const trim=black(),chrome=new THREE.MeshStandardMaterial({color:0xb9c3c8,metalness:.88,roughness:.23});
 const glass=new THREE.MeshPhysicalMaterial({color:0x0b1b24,metalness:.18,roughness:.045,clearcoat:1,clearcoatRoughness:.035,transmission:.12,thickness:.06,ior:1.52,side:THREE.DoubleSide});
 const rubber=new THREE.MeshStandardMaterial({color:0x141719,roughness:.94});
 const lamps=new THREE.MeshStandardMaterial({color:0xece8d8,emissive:0xffdeb0,emissiveIntensity:.35,roughness:.18});
 const tail=new THREE.MeshStandardMaterial({color:0xb92620,emissive:0xff2510,emissiveIntensity:.22,roughness:.2});
 const L=s.length/2,W=s.width/2,round=s.nose==='round';
 const body=loft([[-L,W*(round?.7:.91),s.hood-.035],[-L+.18,W*.95,s.hood],[-L+.65,W,s.hood+.06],[L-.8,W,s.hood+.04],[L-.25,W*.96,s.hood-.025],[L,W*(round?.68:.93),s.hood-.075]],paint);car.add(body);
 const chassis=rounded(s.length-.2,.15,s.width-.18,.06,trim);chassis.position.y=.31;car.add(chassis);
 const roof=s.roof;const cabin=new THREE.Group();
 // Continuous roof + pillars; glass is placed slightly outward, not floating over a box.
 const cabinSections=roof.map(([x,y])=>[x,W*(product.id==='defender'?.91:.77),y]);
 const cabinGeo=new THREE.BufferGeometry();const cv=[],ci=[];
 cabinSections.forEach(([x,w,y])=>cv.push(x,s.hood,-W*.89,x,y-.06,-w,x,y,-w*.85,x,y,w*.85,x,y-.06,w,x,s.hood,W*.89));
 for(let i=0;i<3;i++)for(let j=0;j<5;j++){let a=i*6+j,b=a+1,c=a+6,d=b+6;ci.push(a,b,c,b,d,c);}
 cabinGeo.setAttribute('position',new THREE.Float32BufferAttribute(cv,3));cabinGeo.setIndex(ci);cabinGeo.computeVertexNormals();const cabinSkin=new THREE.Mesh(cabinGeo,paint);cabinSkin.name='cabin-skin';cabin.add(cabinSkin);
 const [rear,rr,rf,front]=roof;const gw=W*(product.id==='defender'?.915:.775);
 cabin.add(poly([[rr[0]+.04,rr[1]-.065,-gw],[rr[0]+.04,rr[1]-.065,gw],[rear[0]-.008,rear[1]+.025,W*.85],[rear[0]-.008,rear[1]+.025,-W*.85]],glass));
 cabin.add(poly([[rf[0]-.04,rf[1]-.065,gw],[rf[0]-.04,rf[1]-.065,-gw],[front[0]+.018,front[1]+.027,-W*.85],[front[0]+.018,front[1]+.027,W*.85]],glass));
 for(const side of [-1,1]){
 const bottom=s.hood+.09;const z=side*W*.891,zt=side*(gw+.006);
 cabin.add(poly([[rear[0]+.15,bottom,z],[rr[0]+.12,rr[1]-.12,zt],[rf[0]-.12,rf[1]-.12,zt],[front[0]-.15,bottom,z]],glass));
 const pillar=rounded(.08,.42,.07,.018,paint);pillar.position.set(-.45,(bottom+rf[1]-.12)/2,side*(W*.85));pillar.rotation.z=.12;cabin.add(pillar);
 const mirror=rounded(.23,.14,.19,.035,paint);mirror.position.set(.6,s.hood+.24,side*(W+.07));car.add(mirror);
 car.add(line([[-.6,s.hood-.07,side*(W+.008)],[-.68,.47,side*(W+.008)],[.58,.47,side*(W+.008)],[.63,s.hood-.07,side*(W+.008)]]));
 const handle=rounded(.21,.035,.035,.01,chrome);handle.position.set(-.33,s.hood-.08,side*(W+.02));car.add(handle);
 const sill=rounded(s.length-1,.1,.085,.02,paint);sill.position.set(0,.32,side*(W-.015));car.add(sill);
 }
 car.add(cabin);
 // A dark interior behind tinted glazing gives the glass actual depth.
 const upholstery=new THREE.MeshStandardMaterial({color:0x12181b,roughness:.9});
 for(const side of [-1,1]){const seat=rounded(.36,.34,.35,.07,upholstery);seat.position.set(-.15,s.hood+.17,side*.33);car.add(seat);const back=rounded(.11,.4,.35,.055,upholstery);back.position.set(-.34,s.hood+.33,side*.33);back.rotation.z=-.16;car.add(back);}
 const dash=rounded(.26,.15,s.width*.67,.035,upholstery);dash.position.set(.67,s.hood+.16,0);car.add(dash);
 const axle=s.length*.315;const wheelRadius=product.id==='defender'?.44:.365;
 const wheels=[];
 for(const x of [-axle,axle])for(const side of [-1,1]){
 const wheel=new THREE.Group();wheel.position.set(x,wheelRadius,side*(W-.035));
 const tire=new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius,wheelRadius,.245,64,1),rubber);tire.rotation.x=Math.PI/2;wheel.add(tire);
 const rim=new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius*.72,wheelRadius*.72,.252,36),trim);rim.rotation.x=Math.PI/2;wheel.add(rim);
 for(const face of [-1,1]){
 const ring=new THREE.Mesh(new THREE.TorusGeometry(wheelRadius*.71,.023,8,36),chrome);ring.position.z=face*.131;wheel.add(ring);
 const hub=new THREE.Mesh(new THREE.CylinderGeometry(.073,.073,.265,16),chrome);hub.rotation.x=Math.PI/2;wheel.add(hub);
 for(let i=0;i<5;i++){const spoke=rounded(.046,wheelRadius*.58,.019,.006,chrome);let angle=i*Math.PI*2/5;spoke.position.set(Math.sin(angle)*wheelRadius*.32,Math.cos(angle)*wheelRadius*.32,face*.135);spoke.rotation.z=-angle;wheel.add(spoke);}
 }
 const fender=new THREE.Mesh(new THREE.TorusGeometry(wheelRadius+.065,.036,8,36,Math.PI),paint);fender.position.set(x,wheelRadius,side*(W+.005));fender.rotation.z=0;car.add(fender);
 car.add(wheel);wheels.push(wheel);
 }
 car.userData.wheels=wheels;
 const bumper=rounded(.12,.2,s.width*.91,.04,trim);bumper.position.set(L,.44,0);car.add(bumper);
 const grille=rounded(.018,.11,s.width*.46,.012,trim);grille.position.set(L+.065,.56,0);car.add(grille);
 for(const side of [-1,1]){
 if(product.id==='porsche'){
 const lamp=new THREE.Mesh(new THREE.SphereGeometry(.155,24,12),lamps);lamp.scale.set(.38,.55,1);lamp.position.set(L-.1,s.hood-.025,side*W*.64);car.add(lamp);
 }else{const lamp=rounded(.045,.12,s.width*.25,.025,lamps);lamp.position.set(L+.025,s.hood-.17,side*W*.65);car.add(lamp);}
 if(product.id==='skyline')for(const delta of [-.115,.115]){const lamp=new THREE.Mesh(new THREE.CylinderGeometry(.085,.085,.024,20),tail);lamp.rotation.z=Math.PI/2;lamp.position.set(-L-.005,.65,side*W*.61+delta);car.add(lamp);}
 else{const lamp=rounded(.025,.11,s.width*.3,.02,tail);lamp.position.set(-L-.008,s.hood-.12,side*W*.61);car.add(lamp);}
 const exhaust=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.17,12),chrome);exhaust.rotation.z=Math.PI/2;exhaust.position.set(-L,.33,side*W*.55);car.add(exhaust);
 }
 if(s.wing){for(const side of [-1,1]){const stem=rounded(.13,.23,.07,.01,trim);stem.position.set(-L+.36,s.hood+.14,side*W*.62);car.add(stem);}const wing=rounded(.3,.065,s.width*1.02,.028,paint);wing.position.set(-L+.35,s.hood+.27,0);car.add(wing);}
 if(product.id==='mustang'){const stripes=new THREE.MeshStandardMaterial({color:0xece5d3,roughness:.4});for(const side of [-1,1]){const strip=rounded(1.24,.012,.15,.002,stripes);strip.position.set(1.12,s.hood+.035,side*.16);car.add(strip);}}
 if(product.id==='defender'){const rack=rounded(2.1,.1,s.width*.81,.02,trim);rack.position.set(-.48,1.9,0);car.add(rack);const spare=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,.19,28),rubber);spare.rotation.z=Math.PI/2;spare.position.set(-L-.12,.87,0);car.add(spare);}
 const plate=rounded(.023,.09,.3,.008,new THREE.MeshStandardMaterial({color:0xf3efe4}));plate.position.set(L+.07,.4,0);car.add(plate);
 car.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return car;
}

export function studio(renderer,{dark=false}={}){
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();const pmrem=new THREE.PMREMGenerator(renderer);const env=new RoomEnvironment();scene.environment=pmrem.fromScene(env,.04).texture;scene.environmentIntensity=.65;env.dispose();pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xd8e5ed,0x6b5643,1.3));
 const key=new THREE.DirectionalLight(0xfff4df,3.5);key.position.set(3,6,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=5;key.shadow.camera.bottom=-5;key.shadow.bias=-.0003;key.shadow.normalBias=.025;scene.add(key);
 const rim=new THREE.DirectionalLight(0xc6e3ff,2);rim.position.set(-4,3,-3);scene.add(rim);
 const camera=new THREE.PerspectiveCamera(34,1,.1,100);camera.position.set(6.4,3.3,6.6);camera.lookAt(0,.65,0);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.ShadowMaterial({opacity:dark?.5:.2}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.position.y=-.01;scene.add(floor);
 return {scene,camera,floor};
}
export function disposeCar(car){car.traverse(o=>{if(o.isMesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});}

export function createGarage(canvas){
 let renderer;try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});}catch{return {setProduct(){},rotate(){},ready:false};}
 const {scene,camera}=studio(renderer,{dark:true});let car;let yaw=-.12,targetYaw=-.12,drag=false,last=0,visible=true,destroyed=false;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const podium=new THREE.Mesh(new THREE.CylinderGeometry(3.05,3.12,.12,96),new THREE.MeshStandardMaterial({color:0x34393a,metalness:.45,roughness:.55}));podium.position.y=-.075;podium.receiveShadow=true;scene.add(podium);
 // Authored orange racetrack loops behind the display, not a background image.
 const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-8,-.12,-2),new THREE.Vector3(-4,-.12,-3.5),new THREE.Vector3(0,.3,-4),new THREE.Vector3(3.5,3.8,-4),new THREE.Vector3(5.7,1.5,-4),new THREE.Vector3(4,-.12,-3),new THREE.Vector3(8,-.12,-1)]);
 const trackMat=new THREE.MeshStandardMaterial({color:0xf46423,roughness:.53,metalness:.08});
 for(const d of [-.37,.37]){const rail=new THREE.CatmullRomCurve3(curve.getPoints(100).map(v=>v.clone().add(new THREE.Vector3(0,0,d))));scene.add(new THREE.Mesh(new THREE.TubeGeometry(rail,120,.08,6,false),trackMat));}
 const points=curve.getPoints(120),verts=[],idx=[];points.forEach(p=>verts.push(p.x,p.y,p.z-.37,p.x,p.y,p.z+.37));for(let i=0;i<120;i++){let a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(idx);g.computeVertexNormals();const mat=trackMat.clone();mat.side=THREE.DoubleSide;scene.add(new THREE.Mesh(g,mat));
 camera.position.set(7,3.4,7.4);camera.zoom=1.16;camera.lookAt(0,.8,0);
 for(const p of points.filter((p,i)=>i%12===0&&p.y>.4)){const support=new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,p.y,8),new THREE.MeshStandardMaterial({color:0x4b5446,roughness:.8}));support.position.set(p.x,p.y/2,p.z);scene.add(support);}
 function resize(){const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
 const observer=new ResizeObserver(resize);observer.observe(canvas);
 canvas.addEventListener('pointerdown',e=>{drag=true;last=e.clientX;canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(drag){targetYaw+=(e.clientX-last)*.008;last=e.clientX;}});canvas.addEventListener('pointerup',()=>drag=false);canvas.addEventListener('pointercancel',()=>drag=false);
 const visibilityObserver=new IntersectionObserver(entries=>visible=entries[0].isIntersecting);visibilityObserver.observe(canvas);
 function frame(){if(destroyed)return;requestAnimationFrame(frame);if(!visible||document.hidden)return;yaw=reduced.matches?targetYaw:THREE.MathUtils.lerp(yaw,targetYaw,.12);if(car)car.rotation.y=yaw;renderer.render(scene,camera);}
 resize();frame();return {ready:true,renderer,scene,camera,setProduct(p){if(car){scene.remove(car);disposeCar(car);}car=buildCar(p);car.position.y=.005;scene.add(car);canvas.dataset.product=p.id;},rotate(){targetYaw+=Math.PI*.45;},getCar:()=>car,dispose(){destroyed=true;observer.disconnect();visibilityObserver.disconnect();if(car)disposeCar(car);scene.traverse(o=>{if(o.isMesh&&o!==car){o.geometry?.dispose();if(o.material&&!Array.isArray(o.material))o.material.dispose();}});scene.environment?.dispose();renderer.dispose();}};
}

export function createThumbnails(products){
 const result={};let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});}catch{return result;}
 const {scene,camera}=studio(renderer);renderer.setPixelRatio(1);renderer.setSize(680,410);camera.aspect=680/410;camera.position.set(6.4,3.4,6.6);camera.updateProjectionMatrix();
 for(const product of products){const car=buildCar(product);car.rotation.y=-.12;scene.add(car);renderer.render(scene,camera);result[product.id]=renderer.domElement.toDataURL('image/png');scene.remove(car);disposeCar(car);}
 scene.environment.dispose();renderer.dispose();return result;
}

export class CartDrive {
 constructor(canvas){this.canvas=canvas;this.queue=Promise.resolve();this.history=[];this.reduced=matchMedia('(prefers-reduced-motion: reduce)');}
 drive(product,source,target){this.queue=this.queue.catch(()=>{}).then(()=>this.run(product,source,target));return this.queue;}
 async run(product,source,target){
 const record={id:product.id,color:product.color,started:performance.now(),frames:0,completed:false,reduced:this.reduced.matches};this.history.push(record);
 if(this.reduced.matches){record.completed=true;return;}
 let renderer;if(!this.renderer){try{this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,alpha:true});this.base=studio(this.renderer);}catch{record.fallback=true;record.completed=true;return;}}renderer=this.renderer;
 const w=innerWidth,h=innerHeight;renderer.setSize(w,h);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));const scene=this.base.scene;const camera=new THREE.OrthographicCamera(-w/2,w/2,h/2,-h/2,.1,3000);camera.position.set(0,0,1200);camera.lookAt(0,0,0);
 const car=buildCar(product);scene.add(car);car.rotation.set(.48,-.3,0);const carScale=Math.min(w*.06,48);car.scale.setScalar(carScale);
 const a={x:Math.max(80,Math.min(w-80,source.x)),y:Math.max(120,Math.min(h-70,source.y))},b={x:target.x,y:target.y};
 const curve=new THREE.CubicBezierCurve3(new THREE.Vector3(a.x-w/2,h/2-a.y,150),new THREE.Vector3(w*.25,h/2-a.y-100,150),new THREE.Vector3(w*.45,h*.2,150),new THREE.Vector3(b.x-w/2,h/2-b.y,150));
 const route=new THREE.Mesh(new THREE.TubeGeometry(curve,80,2.2,6,false),new THREE.MeshBasicMaterial({color:0xf36b28,transparent:true,opacity:.8,depthTest:false}));scene.add(route);this.canvas.classList.add('driving');this.canvas.dataset.product=product.id;this.canvas.dataset.color=product.color;
 const start=performance.now();await new Promise(resolve=>{
 const frame=now=>{const t=Math.min(1,(now-start)/1700),e=1-Math.pow(1-t,2);const p=curve.getPoint(e);car.position.copy(p);const direction=curve.getTangent(e);car.rotation.z=Math.atan2(direction.y,direction.x);car.rotation.y=-.28+Math.sin(t*Math.PI)*.7;car.scale.setScalar(carScale*(1-.84*Math.pow(t,5)));car.userData.wheels.forEach(o=>o.rotation.z=-t*26);route.material.opacity=.6*(1-Math.pow(t,3));record.frames++;record.progress=t;renderer.render(scene,camera);if(t<1)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);
 });scene.remove(car,route);disposeCar(car);route.geometry.dispose();route.material.dispose();renderer.clear();this.canvas.classList.remove('driving');record.completed=true;record.finished=performance.now();
 }
}
