import * as THREE from 'three';
import './style.css';

const viewport = document.getElementById('viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03070d);

const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 1000);
camera.position.set(5, 4, 7);

const renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.appendChild(renderer.domElement);

const root = new THREE.Group();
scene.add(root);

const grid = new THREE.GridHelper(20, 40, 0x1b5360, 0x10252c);
grid.position.y = -1.2;
scene.add(grid);

const ambient = new THREE.HemisphereLight(0x9beaff, 0x071019, 0.8);
scene.add(ambient);

const key = new THREE.DirectionalLight(0xffffff, 2);
key.position.set(4,7,5);
scene.add(key);

const fill = new THREE.PointLight(0x37dfff, 2, 30);
fill.position.set(-4,3,2);
scene.add(fill);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let selected = null;
let tool = 'move';
let unit = 'cm';
let orbitEnabled = true;
let dragging = false;
let lastX = 0, lastY = 0;
let orbitYaw = 0.65, orbitPitch = 0.42, orbitRadius = 8;

const objects = [];

function makeMaterial(){
  return new THREE.MeshStandardMaterial({
    color: document.getElementById('color').value,
    metalness: +document.getElementById('metallic').value,
    roughness: +document.getElementById('roughness').value
  });
}

function addObject(type){
  let geometry;
  if(type==='box') geometry=new THREE.BoxGeometry(2,2,2);
  if(type==='sphere') geometry=new THREE.SphereGeometry(1.25,48,32);
  if(type==='cylinder') geometry=new THREE.CylinderGeometry(1,1,2.2,48);
  if(type==='plane') geometry=new THREE.PlaneGeometry(3,3);
  const mesh=new THREE.Mesh(geometry,makeMaterial());
  mesh.position.y = type==='plane' ? 0 : 0;
  mesh.userData.name = type[0].toUpperCase()+type.slice(1);
  mesh.userData.id = crypto.randomUUID?.() ?? String(Date.now()+Math.random());
  root.add(mesh);
  objects.push(mesh);
  select(mesh);
}

function select(obj){
  selected=obj;
  if(obj){
    obj.material.emissive?.set(0x124a5b);
    obj.material.emissiveIntensity = 0.35;
    document.getElementById('selectionText').textContent=`Selected: ${obj.userData.name}`;
    updateDimensions();
  }else{
    document.getElementById('selectionText').textContent='Nothing selected';
    document.getElementById('dimensions').textContent='W — H — D —';
  }
}

function deselectMaterial(obj){
  if(obj?.material?.emissive){
    obj.material.emissive.set(0x000000);
    obj.material.emissiveIntensity=0;
  }
}

function deleteSelected(){
  if(!selected) return;
  deselectMaterial(selected);
  root.remove(selected);
  const i=objects.indexOf(selected);
  if(i>=0) objects.splice(i,1);
  selected=null;
  select(null);
}

function bounds(obj){
  const box=new THREE.Box3().setFromObject(obj);
  const size=box.getSize(new THREE.Vector3());
  return size;
}

function unitValue(v){
  if(unit==='mm') return v*10;
  if(unit==='cm') return v;
  if(unit==='m') return v/100;
  if(unit==='in') return v/2.54;
  if(unit==='ft') return v/30.48;
}
function unitLabel(){return unit==='in'?'in':unit}

function updateDimensions(){
  if(!selected) return;
  const s=bounds(selected);
  document.getElementById('dimensions').textContent =
    `W ${unitValue(s.x).toFixed(2)} ${unitLabel()}\nH ${unitValue(s.y).toFixed(2)} ${unitLabel()}\nD ${unitValue(s.z).toFixed(2)} ${unitLabel()}`;
}

function fitView(){
  if(!selected){camera.position.set(5,4,7); orbitRadius=8; return;}
  const s=bounds(selected);
  const max=Math.max(s.x,s.y,s.z,1);
  orbitRadius=Math.max(4,max*3.2);
}

function setTool(t){
  tool=t;
  document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));
}

document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addObject(b.dataset.add));
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
document.getElementById('deleteBtn').onclick=deleteSelected;
document.getElementById('fitBtn').onclick=fitView;
document.getElementById('resetBtn').onclick=()=>{
  [...objects].forEach(o=>root.remove(o)); objects.length=0; selected=null; select(null);
};
document.getElementById('orbitBtn').onclick=()=>{
  orbitEnabled=!orbitEnabled;
  document.getElementById('orbitBtn').textContent=`360° Orbit: ${orbitEnabled?'ON':'OFF'}`;
};

document.querySelectorAll('[data-unit]').forEach(b=>b.onclick=()=>{
  unit=b.dataset.unit;
  document.querySelectorAll('[data-unit]').forEach(x=>x.classList.toggle('active',x===b));
  updateDimensions();
});

['color','metallic','roughness'].forEach(id=>document.getElementById(id).oninput=()=>{
  if(selected) selected.material=makeMaterial();
});

document.getElementById('lightIntensity').oninput=e=>key.intensity=+e.target.value;
document.getElementById('envIntensity').oninput=e=>ambient.intensity=+e.target.value;

renderer.domElement.addEventListener('pointerdown',e=>{
  dragging=true; lastX=e.clientX; lastY=e.clientY;
  if(e.shiftKey || !selected) return;
  pointer.x=(e.clientX/renderer.domElement.clientWidth)*2-1;
  pointer.y=-(e.clientY/renderer.domElement.clientHeight)*2+1;
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(objects,false);
  if(hits.length) select(hits[0].object);
});
renderer.domElement.addEventListener('pointermove',e=>{
  const dx=e.clientX-lastX, dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY;
  if(!dragging) return;
  if(e.shiftKey || !selected){
    orbitYaw-=dx*0.008; orbitPitch=Math.max(-1.2,Math.min(1.2,orbitPitch-dy*0.008)); return;
  }
  if(tool==='move'){
    selected.position.x += dx*0.012;
    selected.position.y -= dy*0.012;
  }else if(tool==='rotate'){
    selected.rotation.y += dx*0.01;
    selected.rotation.x += dy*0.01;
  }else if(tool==='scale'){
    const f=Math.max(0.05,1+(-dy)*0.01);
    selected.scale.multiplyScalar(f);
  }
  updateDimensions();
});
renderer.domElement.addEventListener('pointerup',()=>dragging=false);
renderer.domElement.addEventListener('pointerleave',()=>dragging=false);
renderer.domElement.addEventListener('wheel',e=>{
  orbitRadius=Math.max(2,Math.min(50,orbitRadius+e.deltaY*0.01));
},{passive:true});

window.addEventListener('keydown',e=>{
  if(e.key.toLowerCase()==='m')setTool('move');
  if(e.key.toLowerCase()==='r')setTool('rotate');
  if(e.key.toLowerCase()==='s')setTool('scale');
  if(e.key==='Delete')deleteSelected();
});

function serialize(){
  return {
    studio:'ALL IN MY DAY 3D STUDIO',
    version:1,
    units:unit,
    objects:objects.map(o=>({
      id:o.userData.id,name:o.userData.name,
      type:o.geometry.type,
      position:o.position.toArray(),rotation:o.rotation.toArray(),scale:o.scale.toArray(),
      color:o.material.color.getHex(),metalness:o.material.metalness,roughness:o.material.roughness
    }))
  };
}

function geometryFrom(type){
  if(type==='BoxGeometry')return new THREE.BoxGeometry(2,2,2);
  if(type==='SphereGeometry')return new THREE.SphereGeometry(1.25,48,32);
  if(type==='CylinderGeometry')return new THREE.CylinderGeometry(1,1,2.2,48);
  if(type==='PlaneGeometry')return new THREE.PlaneGeometry(3,3);
  return new THREE.BoxGeometry(2,2,2);
}

function loadProject(data){
  [...objects].forEach(o=>root.remove(o)); objects.length=0; selected=null;
  unit=data.units||'cm';
  for(const d of data.objects||[]){
    const m=new THREE.Mesh(geometryFrom(d.type),new THREE.MeshStandardMaterial({
      color:d.color??0x39d9ff,metalness:d.metalness??0.15,roughness:d.roughness??0.35
    }));
    m.userData.name=d.name||'Object'; m.userData.id=d.id||String(Math.random());
    m.position.fromArray(d.position||[0,0,0]); m.rotation.fromArray(d.rotation||[0,0,0]); m.scale.fromArray(d.scale||[1,1,1]);
    root.add(m); objects.push(m);
  }
  select(null); fitView();
}

function downloadJSON(){
  const blob=new Blob([JSON.stringify(serialize(),null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='allinmyday-3d-project.json'; a.click();
  URL.revokeObjectURL(a.href);
}

document.getElementById('downloadProjectBtn').onclick=downloadJSON;
document.getElementById('saveBtn').onclick=downloadJSON;
document.getElementById('loadBtn').onclick=()=>document.getElementById('loadInput').click();
document.getElementById('loadInput').onchange=e=>{
  const f=e.target.files[0]; if(!f)return;
  const r=new FileReader(); r.onload=()=>loadProject(JSON.parse(r.result)); r.readAsText(f);
};
document.getElementById('exportBtn').onclick=()=>{
  renderer.render(scene,camera);
  const a=document.createElement('a'); a.download='allinmyday-3d-preview.png'; a.href=renderer.domElement.toDataURL('image/png'); a.click();
};

function resize(){
  const w=viewport.clientWidth,h=viewport.clientHeight;
  camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h);
}
window.addEventListener('resize',resize);

function animate(){
  requestAnimationFrame(animate);
  if(orbitEnabled){
    orbitYaw += 0.0025;
  }
  camera.position.set(
    Math.cos(orbitYaw)*orbitRadius,
    Math.sin(orbitPitch)*orbitRadius,
    Math.sin(orbitYaw)*orbitRadius
  );
  camera.lookAt(0,0,0);
  renderer.render(scene,camera);
}
resize(); addObject('box'); animate();
