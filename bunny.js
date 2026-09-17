import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {eyePositions,presets} from './bunny-math.js';

const $=id=>document.getElementById(id);
const state={distance:2,scale:.5,ipd:64,yaw:0,simulate:false,stereo:true};
let session=null,mode='',busy=false,modelReady=false,placement=true,nativeIPD=null,lastError='';
const support={vr:false,ar:false};
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.xr.enabled=true;renderer.xr.cameraAutoUpdate=false;
renderer.xr.setReferenceSpaceType('local');
$('view').append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x101b2b);
const camera=new THREE.PerspectiveCamera(60,1,.03,100);
const leftCamera=camera.clone(),rightCamera=camera.clone();
scene.add(new THREE.HemisphereLight(0xffffff,0x7286a2,2));
const sun=new THREE.DirectionalLight(0xffebd4,3);sun.position.set(3,5,4);scene.add(sun);
const root=new THREE.Group();scene.add(root);
const object=new THREE.Group();root.add(object);
const ground=new THREE.GridHelper(40,40,0x6b8797,0x34495e);ground.position.y=-1.2;root.add(ground);
let model;
const fmt=(v,n=2)=>v.toLocaleString('de-DE',{minimumFractionDigits:n,maximumFractionDigits:n});
function sync(){
  for(const key of ['distance','scale','ipd','yaw']) $(key).value=state[key];
  $('distance-value').textContent=fmt(state.distance,1)+' m';
  $('scale-value').textContent=fmt(state.scale)+'×';
  $('ipd-value').textContent=fmt(state.ipd,0)+' mm';
  $('yaw-value').textContent=fmt(state.yaw,0)+'°';
  $('simulate').checked=state.simulate;$('stereo').checked=state.stereo;
  $('simulate').disabled=mode==='ar';$('ipd').disabled=mode==='ar';
  $('stereo').disabled=!!session;
  object.position.set(0,-1.2,-state.distance);object.scale.setScalar(state.scale);object.rotation.y=THREE.MathUtils.degToRad(state.yaw);
  $('metrics').textContent=`Modellhöhe: ${fmt(state.scale)} m · Entfernung: ${fmt(state.distance,1)} m · Höhe / Entfernung: ${fmt(state.scale/state.distance,3)}`;
  $('eyes').hidden=!!session||!state.stereo;
  drawPanel();
}
function diagnose(){
  $('diagnostics').textContent=[`Sicherer Kontext: ${isSecureContext}`,`WebXR: ${!!navigator.xr}`,`Modell: ${modelReady?'geladen (GLB, Referenzhöhe 1 m)':'wird geladen'}`,`VR: ${support.vr} · AR: ${support.ar}`,`Modus: ${mode||'Desktop'}`,`Headset-Stereobasis: ${nativeIPD===null?'noch nicht ermittelt':fmt(nativeIPD*1000,1)+' mm'}`,`Simulation: ${mode==='vr'&&state.simulate?'aktiv':'in VR ausgeschaltet'}`,`Virtuelle Basis: ${state.ipd} mm`,lastError?`Fehler: ${lastError}`:''].filter(Boolean).join('\n');
  $('vr').disabled=!support.vr||!modelReady||busy||!!session;
  $('ar').disabled=!support.ar||!modelReady||busy||!!session;
  $('end').hidden=!session;
}
// The in-world panel has the same values as the HTML sliders, and works without DOM Overlay.
const panelCanvas=document.createElement('canvas');panelCanvas.width=1024;panelCanvas.height=720;
const ctx=panelCanvas.getContext('2d');const panelTexture=new THREE.CanvasTexture(panelCanvas);panelTexture.colorSpace=THREE.SRGBColorSpace;
const panel=new THREE.Mesh(new THREE.PlaneGeometry(1.12,.7875),new THREE.MeshBasicMaterial({map:panelTexture,side:THREE.DoubleSide,depthTest:false}));
panel.renderOrder=1000;panel.visible=false;scene.add(panel);
const controls=[{key:'distance',label:'Entfernung',min:.5,max:12,step:.1,unit:'m'}, {key:'scale',label:'Skalierung / Höhe',min:.1,max:4,step:.05,unit:'m'}, {key:'ipd',label:'Virtuelle Stereobasis',min:0,max:130,step:1,unit:'mm'}];
function drawPanel(){
  ctx.fillStyle='#14283b';ctx.fillRect(0,0,1024,720);ctx.fillStyle='#fff';ctx.font='bold 38px system-ui';ctx.fillText('Spielzeug oder Maschine?',35,53);
  ctx.font='25px system-ui';ctx.fillStyle='#b9d0df';ctx.fillText('Mit dem Controller zeigen und Trigger halten',35,91);
  controls.forEach((c,i)=>{const y=145+i*130;ctx.font='30px system-ui';ctx.fillStyle=mode==='ar'&&c.key==='ipd'?'#8393a0':'#fff';ctx.fillText(c.label,35,y);ctx.fillText(fmt(state[c.key],c.key==='ipd'?0:2)+' '+c.unit,770,y);ctx.strokeStyle='#698195';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(65,y+43);ctx.lineTo(950,y+43);ctx.stroke();ctx.fillStyle='#71e5cd';ctx.beginPath();ctx.arc(65+(state[c.key]-c.min)/(c.max-c.min)*885,y+43,18,0,Math.PI*2);ctx.fill();});
  ctx.fillStyle='#26465e';ctx.fillRect(25,520,974,66);ctx.fillStyle='#fff';ctx.font='28px system-ui';ctx.fillText(mode==='ar'?'AR: Headset-Stereobasis bleibt erhalten':`Stereobasis simulieren: ${state.simulate?'AN':'AUS (Headset)'}`,45,563);
  ['Spielzeug','Maschine','Reset','Beenden'].forEach((label,i)=>{ctx.fillStyle='#26465e';ctx.fillRect(25+i*245,611,233,70);ctx.fillStyle='#fff';ctx.fillText(label,43+i*245,656);});
  panelTexture.needsUpdate=true;
}
function reset(){Object.assign(state,{distance:2,scale:.5,ipd:64,yaw:0,simulate:false});sync();diagnose();}
function preset(name){Object.assign(state,presets[name]);sync();}
for(const c of [...controls,{key:'yaw'}]) $(c.key).addEventListener('input',()=>{state[c.key]=Number($(c.key).value);sync();diagnose();});
for(const key of ['simulate','stereo']) $(key).addEventListener('change',()=>{state[key]=$(key).checked;sync();diagnose();});
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>preset(b.dataset.preset));$('reset').onclick=reset;
$('copy').onclick=async()=>{diagnose();try{await navigator.clipboard.writeText($('diagnostics').textContent);$('status').textContent='Diagnose kopiert.';}catch{$('status').textContent='Diagnosetext bitte manuell markieren und kopieren.';}};
const raycaster=new THREE.Raycaster(),rotation=new THREE.Matrix4();
const controllers=[];
for(let i=0;i<2;i++){
  const controller=renderer.xr.getController(i);scene.add(controller);
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-1)]),new THREE.LineBasicMaterial({color:0x71e5cd,depthTest:false}));line.scale.z=3;line.renderOrder=1001;controller.add(line);controller.userData.line=line;
  controller.addEventListener('selectstart',()=>{controller.userData.down=true;interact(controller,true);});
  controller.addEventListener('selectend',()=>{controller.userData.down=false;});
  controller.addEventListener('disconnected',()=>{controller.userData.down=false;});controllers.push(controller);
}
function interact(controller,clicked=false){
  if(!session||!panel.visible)return;
  controller.updateWorldMatrix(true,false);panel.updateWorldMatrix(true,false);
  rotation.extractRotation(controller.matrixWorld);raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);raycaster.ray.direction.set(0,0,-1).applyMatrix4(rotation);
  const hit=raycaster.intersectObject(panel,false)[0];controller.userData.line.scale.z=hit?hit.distance:3;
  if(!hit||(!clicked&&!controller.userData.down))return;
  const x=hit.uv.x*1024,y=(1-hit.uv.y)*720;
  for(let i=0;i<controls.length;i++){
    const c=controls[i];if(y>115+i*130&&y<240+i*130&&x>=35&&x<=980){
      if(c.key==='ipd'&&mode==='ar')return;
      state[c.key]=Math.max(c.min,Math.min(c.max,Math.round((c.min+THREE.MathUtils.clamp((x-65)/885,0,1)*(c.max-c.min))/c.step)*c.step));sync();return;
    }
  }
  if(!clicked)return;
  if(y>=520&&y<=586&&mode==='vr'){state.simulate=!state.simulate;sync();diagnose();}
  if(y>=611&&y<=681){const n=Math.floor((x-25)/245);if(n===0)preset('toy');if(n===1)preset('machine');if(n===2)reset();if(n===3)session.end();}
}
function resize(){if(session)return;const w=$('view').clientWidth,h=$('view').clientHeight;renderer.setSize(w,h);}
new ResizeObserver(resize).observe($('view'));
async function start(nextMode){
  if(busy||session||!modelReady)return;busy=true;diagnose();let next;
  try{
    next=await navigator.xr.requestSession('immersive-'+nextMode);
    session=next;mode=nextMode;placement=true;
    next.addEventListener('end',()=>{session=null;mode='';panel.visible=false;controllers.forEach(c=>c.userData.down=false);scene.background=new THREE.Color(0x101b2b);ground.visible=true;root.position.set(0,0,0);root.quaternion.identity();camera.position.set(0,0,0);camera.quaternion.identity();resize();sync();diagnose();$('status').textContent='XR beendet. Du kannst einen anderen Modus starten.';},{once:true});
    scene.background=mode==='ar'?null:new THREE.Color(0x101b2b);ground.visible=mode!=='ar';
    renderer.setScissorTest(false);await renderer.xr.setSession(next);sync();
    $('status').textContent='XR aktiv. Die Regler vor dir lassen sich mit dem Controller bedienen.';
  }catch(e){lastError=e.name+': '+e.message;if(next)await next.end().catch(()=>{});$('status').textContent='XR-Start fehlgeschlagen: '+lastError;}
  finally{busy=false;diagnose();}
}
$('vr').onclick=()=>start('vr');$('ar').onclick=()=>start('ar');$('end').onclick=()=>session?.end();
const forward=new THREE.Vector3();
function place(frame){const pose=frame.getViewerPose(renderer.xr.getReferenceSpace());if(!pose)return;const {position:p,orientation:q}=pose.transform;root.position.set(p.x,p.y,p.z);forward.set(0,0,-1).applyQuaternion(new THREE.Quaternion(q.x,q.y,q.z,q.w));const yaw=Math.atan2(-forward.x,-forward.z);root.rotation.set(0,yaw,0);panel.position.set(.95,-.38,-1.4).applyAxisAngle(new THREE.Vector3(0,1,0),yaw).add(root.position);panel.rotation.set(0,yaw-.48,0);panel.visible=true;placement=false;}
renderer.setAnimationLoop((time,frame)=>{
  if(session&&frame){
    if(placement)place(frame);
    renderer.xr.updateCamera(camera);
    const eyes=renderer.xr.getCamera().cameras;
    if(eyes.length===2){
      const points=eyes.map(c=>new THREE.Vector3().setFromMatrixPosition(c.matrixWorld).toArray());
      const adjusted=eyePositions(points[0],points[1],state.ipd/1000);
      if(nativeIPD===null||Math.abs(nativeIPD-adjusted.native)>.0001){nativeIPD=adjusted.native;diagnose();}
      if(mode==='vr'&&state.simulate){
        eyes.forEach((c,i)=>{c.matrixWorld.setPosition(...(i===0?adjusted.left:adjusted.right));c.matrixWorldInverse.copy(c.matrixWorld).invert();});
      }
    }
    controllers.forEach(c=>interact(c));renderer.render(scene,camera);
  }else{
    const w=$('view').clientWidth,h=$('view').clientHeight;
    renderer.setScissorTest(true);
    const count=state.stereo?2:1;
    for(let i=0;i<count;i++){
      const cam=i===0?leftCamera:rightCamera;
      cam.aspect=(w/count)/h;cam.updateProjectionMatrix();cam.position.set(state.stereo?(i===0?-.5:.5)*state.ipd/1000:0,0,0);
      // Both desktop cameras tilt together: parallel stereo, never toe-in.
      cam.rotation.set(Math.atan2(-1.2+state.scale/2,state.distance),0,0);
      renderer.setViewport(i*w/count,0,w/count,h);renderer.setScissor(i*w/count,0,w/count,h);renderer.render(scene,cam);
    }
    renderer.setScissorTest(false);
  }
});
sync();resize();
for(const m of ['vr','ar']){try{support[m]=!!navigator.xr&&await navigator.xr.isSessionSupported('immersive-'+m);}catch(e){lastError=String(e);}}
diagnose();
try{
  const gltf=await new GLTFLoader().loadAsync('./assets/stanford_bunny_pbr.glb');
  model=gltf.scene;model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  if(!Number.isFinite(size.y)||size.y<=0)throw new Error('Modell hat keine gültige Höhe.');
  const normalizer=new THREE.Group();normalizer.scale.setScalar(1/size.y);
  model.position.sub(new THREE.Vector3(center.x,box.min.y,center.z));normalizer.add(model);object.add(normalizer);
  // Custom eye matrices need per-eye visibility; do not cull using the original XR union frustum.
  model.traverse(o=>{if(o.isMesh)o.frustumCulled=false;});
  modelReady=true;sync();diagnose();$('status').textContent='Bunny bereit. Wähle ein Preset oder starte VR / AR.';
}catch(e){lastError=String(e);$('status').textContent='Bunny konnte nicht geladen werden: '+e.message;diagnose();}
