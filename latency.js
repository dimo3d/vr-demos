import * as THREE from './vendor/three.module.js';
import {Trial,bracket} from './latency-state.js';
const $=id=>document.getElementById(id),trial=new Trial();
let session=null,busy=false,supported=false,delay=20,heading=0,placePending=false,lastFrame=null,lastTick='',limited=false,lastError='';
const history=[];
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local');$('view').append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x111e2e);
const camera=new THREE.PerspectiveCamera(65,1,.05,50);
const room=new THREE.Group();scene.add(room);
const anchor=new THREE.Group();room.add(anchor);
const floor=new THREE.GridHelper(12,12,0x87b8ba,0x3b5464);floor.position.y=-1.25;anchor.add(floor);
const lineMaterial=new THREE.LineBasicMaterial({color:0x678997});
const roomBox=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(10,5,10)),lineMaterial);roomBox.position.set(0,1.25,0);anchor.add(roomBox);
for(let i=0;i<12;i++){
  const angle=i*Math.PI/6;
  const pillar=new THREE.Mesh(new THREE.BoxGeometry(.16,3,.16),new THREE.MeshBasicMaterial({color:i%2?0x66cfc2:0xe8b96b}));pillar.position.set(Math.sin(angle)*4,.25,Math.cos(angle)*4);anchor.add(pillar);
}
for(let i=-2;i<=2;i++){
  const frame=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(.9,1.4,.08)),new THREE.LineBasicMaterial({color:i===0?0xffd084:0xa2c1d3}));frame.position.set(i*1.4,.25,-4);anchor.add(frame);
}
const target=new THREE.Mesh(new THREE.TorusGeometry(.22,.025,8,40),new THREE.MeshBasicMaterial({color:0xffd084}));target.position.set(0,.25,-3.8);anchor.add(target);
const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=660;
const ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
const panel=new THREE.Mesh(new THREE.PlaneGeometry(1.15,.741),new THREE.MeshBasicMaterial({map:texture,depthTest:false,side:THREE.DoubleSide}));panel.renderOrder=100;panel.visible=false;scene.add(panel);
function drawPanel(now=performance.now()){
  const active=trial.active(now),remaining=Math.ceil(trial.remaining(now)/1000);
  ctx.fillStyle='#14283b';ctx.fillRect(0,0,1024,660);ctx.fillStyle='#fff';ctx.font='bold 40px system-ui';ctx.fillText('Wenn die Welt nachzieht',35,58);
  ctx.font='29px system-ui';ctx.fillStyle=active?'#ffd084':'#8ee8d9';ctx.fillText(active?`Versuch: ${trial.delay} ms · noch ${remaining} s`:'Normalbetrieb: kein zusätzlicher Effekt',35,109);
  ctx.fillStyle='#fff';ctx.fillText(`Zusätzliche Verzögerung: ${delay} ms`,35,175);
  ctx.strokeStyle='#738ba0';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(65,220);ctx.lineTo(960,220);ctx.stroke();ctx.fillStyle='#8ee8d9';ctx.beginPath();ctx.arc(65+delay/100*895,220,18,0,Math.PI*2);ctx.fill();
  [0,20,40,80].forEach((ms,i)=>{ctx.fillStyle='#294a60';ctx.fillRect(25+i*245,270,233,65);ctx.fillStyle='#fff';ctx.fillText(ms+' ms',80+i*245,314);});
  ctx.fillStyle=active?'#853d31':'#176e64';ctx.fillRect(25,365,974,90);ctx.fillStyle='#fff';ctx.font='bold 34px system-ui';ctx.fillText(active?'SOFORT STOPPEN':'8-Sekunden-Versuch starten',55,421);
  ctx.font='27px system-ui';ctx.fillStyle='#ffd084';ctx.fillText('Abbruch: Trigger oder Griff-Taste drücken.',35,505);
  ctx.fillStyle='#bccbd8';ctx.fillText('Nur langsam drehen. Bei Unbehagen absetzen.',35,548);
  ctx.fillStyle='#294a60';ctx.fillRect(25,580,974,60);ctx.fillStyle='#fff';ctx.fillText('VR beenden',410,621);texture.needsUpdate=true;
}
function ui(now=performance.now()){
  const active=trial.active(now);$('delay').disabled=active;$('start').disabled=active;$('stop').disabled=!active;
  document.querySelectorAll('[data-delay]').forEach(b=>b.disabled=active);
  $('heading').disabled=!!session;$('vr').disabled=busy||!!session||!supported;$('end').hidden=!session;
  $('delay-value').textContent=delay+' ms';$('delay').value=delay;
  $('readout').textContent=active?`${trial.delay} ms zusätzliche Verzögerung · noch ${Math.ceil(trial.remaining(now)/1000)} s${limited?' · Winkelbegrenzung aktiv':''}`:'Normalbetrieb · keine zusätzliche Verzögerung';
  $('diagnostics').textContent=[`Sicherer Kontext: ${isSecureContext}`,`VR unterstützt: ${supported}`,`Modus: ${session?'VR':'Desktop-Modell'}`,`Zusatzverzögerung: ${active?trial.delay:0} ms`,`Winkelbegrenzung: ${limited}`,`Gesamtlatenz: nicht gemessen`,`Letzter Fehler: ${lastError||'keiner'}`].join('\n');drawPanel(now);
}
function stop(message='Versuch beendet. Die Umgebung wird wieder normal nachgeführt.'){
  trial.stop();room.position.set(0,0,0);room.quaternion.identity();limited=false;lastTick='';$('status').textContent=message;ui();
}
function startTrial(){
  if(trial.active(performance.now()))return;
  trial.start(performance.now(),delay);$('status').textContent='Kurzversuch aktiv. Langsam drehen; bei Unbehagen sofort stoppen.';ui();
}
function setDelay(value){if(trial.active(performance.now()))return;delay=Math.max(0,Math.min(100,Math.round(value/5)*5));ui();}
$('delay').oninput=()=>setDelay(Number($('delay').value));
document.querySelectorAll('[data-delay]').forEach(b=>b.onclick=()=>setDelay(Number(b.dataset.delay)));
$('heading').oninput=()=>{heading=Number($('heading').value);$('heading-value').textContent=heading+'°';};
$('start').onclick=startTrial;$('stop').onclick=()=>stop('Abgebrochen. Normalbetrieb ist wieder aktiv.');
document.addEventListener('keydown',e=>{if(e.key==='Escape')stop('Mit Escape abgebrochen.');});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop('Bei Wechsel der Ansicht abgebrochen.');});
window.addEventListener('blur',()=>{if(!session)stop('Bei Fokusverlust abgebrochen.');});
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('diagnostics').textContent);$('status').textContent='Diagnose kopiert.';}catch{$('status').textContent='Diagnosetext bitte manuell markieren und kopieren.';}};
const controllers=[],raycaster=new THREE.Raycaster(),rotation=new THREE.Matrix4();
for(let i=0;i<2;i++){
  const c=renderer.xr.getController(i);scene.add(c);const ray=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-1)]),new THREE.LineBasicMaterial({color:0x8ee8d9,depthTest:false}));ray.scale.z=3;ray.renderOrder=101;c.add(ray);c.userData.ray=ray;
  c.addEventListener('selectstart',()=>{if(trial.active(performance.now())){stop('Mit Trigger abgebrochen.');c.userData.drag=false;return;}click(c);});
  c.addEventListener('selectend',()=>{c.userData.drag=false;});
  c.addEventListener('squeezestart',()=>stop('Mit Griff-Taste abgebrochen.'));
  c.addEventListener('disconnected',()=>{c.userData.drag=false;stop('Controller getrennt.');});controllers.push(c);
}
function hit(c){if(!panel.visible)return null;c.updateWorldMatrix(true,false);panel.updateWorldMatrix(true,false);rotation.extractRotation(c.matrixWorld);raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);raycaster.ray.direction.set(0,0,-1).applyMatrix4(rotation);const h=raycaster.intersectObject(panel,false)[0];c.userData.ray.scale.z=h?h.distance:3;return h?{x:h.uv.x*1024,y:(1-h.uv.y)*660}:null;}
function click(c){const p=hit(c);if(!p)return;if(p.y>=180&&p.y<=250){c.userData.drag=true;setDelay((p.x-65)/895*100);}else if(p.y>=270&&p.y<=335){const i=Math.floor((p.x-25)/245);if(i>=0&&i<4)setDelay([0,20,40,80][i]);}else if(p.y>=365&&p.y<=455){startTrial();}else if(p.y>=580&&p.y<=640){session?.end();}}
function resize(){if(session)return;const w=$('view').clientWidth,h=$('view').clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe($('view'));
const headPosition=new THREE.Vector3(),headRotation=new THREE.Quaternion(),pastRotation=new THREE.Quaternion(),correction=new THREE.Quaternion(),identity=new THREE.Quaternion();
const forward=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
async function startVR(){
  if(session||busy)return;busy=true;stop();ui();let next;
  try{
    next=await navigator.xr.requestSession('immersive-vr');session=next;history.length=0;placePending=true;lastFrame=null;
    next.addEventListener('visibilitychange',()=>{if(next.visibilityState!=='visible')stop('VR-Ansicht unterbrochen.');});
    next.addEventListener('end',()=>{stop();session=null;panel.visible=false;history.length=0;lastFrame=null;anchor.position.set(0,0,0);anchor.quaternion.identity();camera.position.set(0,0,0);resize();ui();$('status').textContent='VR beendet. Kein Verzögerungseffekt aktiv.';},{once:true});
    await renderer.xr.setSession(next);
    renderer.xr.getReferenceSpace().addEventListener('reset',()=>{stop('Tracking-Ursprung zurückgesetzt.');history.length=0;placePending=true;});
    $('status').textContent='VR bereit. Im Bedienfeld zuerst eine Verzögerung wählen, dann den Kurzversuch starten.';
  }catch(e){lastError=String(e);if(next)await next.end().catch(()=>{});$('status').textContent='VR konnte nicht starten: '+e.message;}finally{busy=false;ui();}
}
$('vr').onclick=startVR;$('end').onclick=()=>session?.end();
renderer.setAnimationLoop((time,frame)=>{
  const now=performance.now();
  if(lastFrame!==null&&now-lastFrame>250){history.length=0;if(trial.active(now)||trial.until)stop('Nach einer Bildunterbrechung abgebrochen.');}lastFrame=now;
  if(trial.until&&!trial.active(now))stop('8 Sekunden beendet. Erst in Ruhe vergleichen, dann bei Bedarf neu starten.');
  if(session&&frame){
    const pose=frame.getViewerPose(renderer.xr.getReferenceSpace());
    if(!pose){if(trial.until)stop('Tracking nicht verfügbar.');history.length=0;return;}
    const {position:p,orientation:q}=pose.transform;headPosition.set(p.x,p.y,p.z);headRotation.set(q.x,q.y,q.z,q.w);
    if(placePending){anchor.position.copy(headPosition);forward.set(0,0,-1).applyQuaternion(headRotation);const yaw=Math.atan2(-forward.x,-forward.z);anchor.rotation.set(0,yaw,0);panel.position.set(1,-.35,-1.5).applyAxisAngle(up,yaw).add(headPosition);panel.rotation.set(0,yaw-.5,0);panel.visible=true;placePending=false;}
  }else{camera.position.set(0,0,0);camera.rotation.set(0,THREE.MathUtils.degToRad(heading),0);headPosition.set(0,0,0);headRotation.copy(camera.quaternion);}
  // WebXR pose timestamps and the render callback use the same frame time domain.
  history.push({time,rotation:headRotation.clone()});while(history.length>2&&history[1].time<time-250)history.shift();
  room.quaternion.identity();room.position.set(0,0,0);limited=false;
  if(trial.active(now)&&trial.delay>0){
    const sample=bracket(history,time-trial.delay);pastRotation.copy(sample.a.rotation).slerp(sample.b.rotation,sample.t);
    correction.copy(headRotation).multiply(pastRotation.clone().invert());
    const angle=identity.angleTo(correction),maxAngle=THREE.MathUtils.degToRad(8);
    if(angle>maxAngle){correction.slerp(identity,1-maxAngle/angle);limited=true;}
    room.quaternion.copy(correction);
    // Rotate only the environment about the current head centre; never move XR cameras.
    room.position.copy(headPosition).sub(headPosition.clone().applyQuaternion(correction));
  }
  for(const c of controllers){const p=hit(c);if(c.userData.drag&&p&&!trial.active(now))setDelay((p.x-65)/895*100);}
  const tick=`${trial.active(now)}:${Math.ceil(trial.remaining(now)/1000)}:${limited}`;if(tick!==lastTick){lastTick=tick;ui(now);}
  renderer.render(scene,camera);
});
resize();ui();
try{supported=!!navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr');}catch(e){lastError=String(e);}
$('status').textContent='Bereit. Ohne gestarteten Versuch wird keine zusätzliche Verzögerung angewendet.';ui();
