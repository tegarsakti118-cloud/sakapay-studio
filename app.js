import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const employees = [
  {name:'ALDI',role:'Direktur AI',initials:'AL',area:'Ruang Direktur',task:'Mengatur prioritas kerja tim dan menyiapkan ringkasan kondisi bisnis SakaPay.',about:'Memimpin koordinasi delapan personel AI dan menjadi pusat kendali operasional kantor.'},
  {name:'YEGI',role:'Kepala Keuangan',initials:'YE',area:'Ruang Keuangan',task:'Memeriksa catatan kas, omzet, biaya operasional, dan piutang pelanggan.',about:'Membantu menjaga pencatatan keuangan SakaPay tetap rapi dan mudah diperiksa.'},
  {name:'RIKA',role:'Sekretaris',initials:'RI',area:'Administrasi',task:'Merapikan agenda, dokumentasi, dan catatan hasil rapat.',about:'Mengelola dokumentasi dan memastikan keputusan rapat tercatat.'},
  {name:'PUTRA',role:'Kepala Operasional',initials:'PU',area:'Ruang Operasional',task:'Memantau alur transaksi PPOB dan menyusun daftar pemeriksaan operasional.',about:'Membantu memastikan proses operasional berjalan sesuai prosedur.'},
  {name:'MELA',role:'Customer Service',initials:'ME',area:'Layanan Pelanggan',task:'Menyusun draf balasan pelanggan dan mengelompokkan keluhan.',about:'Membantu menyiapkan komunikasi pelanggan yang jelas dan sopan.'},
  {name:'ARYA',role:'Teknisi Sistem',initials:'AR',area:'Ruang Teknologi',task:'Membuat daftar pemeriksaan API, integrasi, dan kendala aplikasi.',about:'Membantu menganalisis masalah teknis dan menyusun langkah pengecekan.'},
  {name:'NONI',role:'Marketing',initials:'NO',area:'Studio Marketing',task:'Menyusun ide konten, promo, dan strategi menarik pelanggan.',about:'Membantu merancang promosi yang sesuai dengan kebutuhan pelanggan SakaPay.'},
  {name:'GITA',role:'Analis Bisnis',initials:'GI',area:'Ruang Analisis',task:'Membaca tren transaksi dan mengidentifikasi peluang pengembangan.',about:'Membantu mengubah data bisnis menjadi insight yang mudah dipahami.'}
];

const teamGrid = document.querySelector('#teamGrid');
const activityList = document.querySelector('#activityList');
const sceneRoot = document.querySelector('#scene');
const loading = document.querySelector('#sceneLoading');
let selectedEmployee = null;
let renderer, scene, camera, controls, raycaster, pointer;
const clickable = [];

function renderTeam(){
  teamGrid.innerHTML = employees.map((e,i)=>`<button class="employee-card" data-employee="${i}"><span class="avatar">${e.initials}</span><span class="employee-info"><strong>${e.name}</strong><small>${e.role}</small></span><i class="employee-status"></i></button>`).join('');
  teamGrid.querySelectorAll('[data-employee]').forEach(btn=>btn.addEventListener('click',()=>openEmployee(Number(btn.dataset.employee))));
}
function renderActivity(){
  const items=[
    ['AL','ALDI','Memulai briefing operasional harian.','Baru saja'],
    ['YE','YEGI','Memeriksa ringkasan keuangan.','2 menit lalu'],
    ['ME','MELA','Menyiapkan draf respons pelanggan.','5 menit lalu'],
    ['AR','ARYA','Meninjau daftar pemeriksaan sistem.','8 menit lalu']
  ];
  activityList.innerHTML=items.map(x=>`<div class="activity-item"><div class="activity-symbol">${x[0]}</div><div class="activity-copy"><strong>${x[1]} · ${x[2]}</strong><small>Aktivitas simulasi kantor</small></div><span class="activity-time">${x[3]}</span></div>`).join('');
}
function openEmployee(index){
  selectedEmployee=employees[index];
  document.querySelector('#modalInitials').textContent=selectedEmployee.initials;
  document.querySelector('#modalName').textContent=selectedEmployee.name;
  document.querySelector('#modalRole').textContent=selectedEmployee.role+' · '+selectedEmployee.area;
  document.querySelector('#modalAbout').textContent=selectedEmployee.about;
  document.querySelector('#modalTask').textContent=selectedEmployee.task;
  document.querySelector('#employeeModal').classList.add('open');
}
function closeEmployee(){document.querySelector('#employeeModal').classList.remove('open')}
function makeMat(color,roughness=.8){return new THREE.MeshStandardMaterial({color,roughness})}
function box(parent,w,h,d,x,y,z,material,cast=true){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=cast;m.receiveShadow=true;parent.add(m);return m}
function cylinder(parent,r1,r2,h,x,y,z,material,segments=16){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),material);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m}
function textSprite(text,color='#d8f5f0'){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#10243a';ctx.fillRect(0,0,512,128);ctx.strokeStyle='#3d7181';ctx.lineWidth=5;ctx.strokeRect(3,3,506,122);
  ctx.font='bold 42px Arial';ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,66);
  const tex=new THREE.CanvasTexture(canvas);const mat=new THREE.SpriteMaterial({map:tex,transparent:false});const s=new THREE.Sprite(mat);s.scale.set(3.1,.78,1);return s;
}
function createEmployee(index,x,z){
  const e=employees[index], group=new THREE.Group();group.position.set(x,0,z);group.userData.employeeIndex=index;
  const palette=[0x168f85,0x426fa9,0xb77d36,0x3c8290,0xa35f79,0x526c9b,0x9b7940,0x477d70];
  const cloth=makeMat(palette[index]), skin=makeMat(0xe8b994), dark=makeMat(0x172437), hair=makeMat(index%2?0x30251f:0x201d20);
  const torso= new THREE.Mesh(new THREE.CapsuleGeometry(.24,.42,4,8),cloth);torso.position.y=.88;torso.castShadow=true;group.add(torso);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.22,16,12),skin);head.position.y=1.42;head.castShadow=true;group.add(head);
  const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.225,16,8,0,Math.PI*2,0,Math.PI*.48),hair);hairCap.position.y=1.48;group.add(hairCap);
  const legMat=dark;for(const side of [-1,1]){const leg=box(group,.13,.42,.15,side*.12,.25,0,legMat);leg.rotation.z=side*.04;}
  const armMat=cloth;for(const side of [-1,1]){const arm=cylinder(group,.075,.085,.42,side*.29,.91,0,armMat,10);arm.rotation.z=side*.35;}
  const badge= new THREE.Mesh(new THREE.BoxGeometry(.15,.075,.025),makeMat(0xe2f7f1));badge.position.set(0,.95,.238);group.add(badge);
  const hit=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,1.9,12),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));hit.position.y=.95;hit.userData.employeeIndex=index;group.add(hit);clickable.push(hit);
  const label=textSprite(e.name);label.position.set(0,2.02,0);group.add(label);
  scene.add(group);return group;
}
function createDesk(x,z,rotation=0){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rotation;const wood=makeMat(0x9b7655),metal=makeMat(0x344a5d),screen=makeMat(0x142d42),glow=makeMat(0x3ccbb6);
  box(g,1.65,.13,.85,0,.82,0,wood);for(const sx of [-.65,.65])for(const sz of [-.3,.3])box(g,.07,.8,.07,sx,.4,sz,metal);
  box(g,.72,.48,.055,0,1.18,-.24,metal);box(g,.64,.39,.025,0,1.19,-.205,screen,false);box(g,.48,.018,.012,0,1.18,-.185,glow,false);
  box(g,.52,.035,.25,0,.91,.17,metal);scene.add(g);
}
function createChair(x,z){const g=new THREE.Group();g.position.set(x,0,z);const m=makeMat(0x263c52);cylinder(g,.28,.28,.12,0,.48,0,m);box(g,.48,.52,.12,0,.8,-.16,m);cylinder(g,.07,.07,.42,0,.22,0,makeMat(0x71869b));scene.add(g)}
function createPlant(x,z){const pot=makeMat(0x9c7657),leaf=makeMat(0x299c78);cylinder(scene,.2,.25,.34,x,.17,z,pot);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const l=new THREE.Mesh(new THREE.ConeGeometry(.12,.65,7),leaf);l.position.set(x+Math.cos(a)*.12,.62,z+Math.sin(a)*.12);l.rotation.z=Math.cos(a)*-.4;l.rotation.x=Math.sin(a)*.4;l.castShadow=true;scene.add(l)}}
function createRoomLabel(text,x,z){const s=textSprite(text,'#d8f5f0');s.position.set(x,2.5,z);s.scale.set(2.6,.65,1);scene.add(s)}
function buildOffice(){
  scene=new THREE.Scene();scene.background=new THREE.Color(0x0d1b2b);scene.fog=new THREE.Fog(0x0d1b2b,18,34);
  camera=new THREE.OrthographicCamera(-10,10,7,-7,.1,100);camera.position.set(11,14,13);camera.lookAt(0,0,0);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setSize(sceneRoot.clientWidth,sceneRoot.clientHeight);sceneRoot.appendChild(renderer.domElement);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.enablePan=true;controls.minZoom=.7;controls.maxZoom=1.65;controls.minPolarAngle=.45;controls.maxPolarAngle=1.25;controls.target.set(0,.2,0);camera.zoom=1;camera.updateProjectionMatrix();
  scene.add(new THREE.HemisphereLight(0xb9d8ff,0x243044,2));const key=new THREE.DirectionalLight(0xffe2bd,2.5);key.position.set(5,12,7);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);
  const floor=box(scene,14,.35,10,0,-.2,0,makeMat(0x23394d),false);floor.receiveShadow=true;
  // Raised platform border and subtle floor divisions
  const edge=makeMat(0x4a6a7d);box(scene,14.2,.18,.14,0,-.05,5.02,edge,false);box(scene,14.2,.18,.14,0,-.05,-5.02,edge,false);box(scene,.14,.18,10,7.02,-.05,0,edge,false);box(scene,.14,.18,10,-7.02,-.05,0,edge,false);
  const wall=makeMat(0x304b60), glass= new THREE.MeshStandardMaterial({color:0x5793a5,transparent:true,opacity:.22,roughness:.25});
  // Low perimeter walls keep the office readable from the isometric camera
  box(scene,14,.9,.13,0,.35,-4.95,wall);box(scene,.13,.9,10,-6.95,.35,0,wall);box(scene,.13,.9,10,6.95,.35,0,wall);
  // Area dividers
  box(scene,.09,.75,3.5,-2.4,.35,-3.1,glass);box(scene,4,.75,.08,-4.4,.35,-1.35,glass);box(scene,.09,.75,3.5,2.25,.35,-3.1,glass);box(scene,4,.75,.08,4.4,.35,-1.35,glass);
  createRoomLabel('DIRECTOR',-4.5,-4.3);createRoomLabel('FINANCE',0,-4.3);createRoomLabel('OPERATIONS',4.5,-4.3);createRoomLabel('TEAM HUB',0,1.1);
  // Director area
  createDesk(-4.5,-2.9);createChair(-4.5,-1.9);createEmployee(0,-4.5,-2.0);
  // Finance + admin desks
  createDesk(-1.1,-2.9);createChair(-1.1,-1.95);createEmployee(1,-1.1,-1.65);
  createDesk(1.2,-2.9);createChair(1.2,-1.95);createEmployee(2,1.3,-1.65);
  // Operations and service
  createDesk(4.5,-2.9);createChair(4.5,-1.95);createEmployee(3,4.5,-1.65);
  // Open collaboration desks
  createDesk(-4.4,2.5,.18);createChair(-4.4,3.5);createEmployee(4,-4.4,3.65);
  createDesk(-1.5,2.5,.18);createChair(-1.5,3.5);createEmployee(5,-1.5,3.65);
  createDesk(1.5,2.5,.18);createChair(1.5,3.5);createEmployee(6,1.5,3.65);
  createDesk(4.4,2.5,.18);createChair(4.4,3.5);createEmployee(7,4.4,3.65);
  // Meeting table, plants, lighting features
  const table=makeMat(0x52748a);cylinder(scene,1.05,1.05,.16,0,.62,.15,table,32);cylinder(scene,.12,.12,.58,0,.29,.15,makeMat(0x31495d));
  for(let i=0;i<4;i++){const a=i*Math.PI/2;const chair=new THREE.Group();chair.position.set(Math.cos(a)*1.35,0,.15+Math.sin(a)*1.35);box(chair,.42,.12,.42,0,.42,0,makeMat(0x31495d));box(chair,.42,.5,.1,0,.7,-.16,makeMat(0x31495d));scene.add(chair)}
  createPlant(-6,4.2);createPlant(6,4.2);createPlant(-6,-4.2);createPlant(6,-4.2);
  raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();renderer.domElement.addEventListener('pointerup',onSceneTap);
  resizeScene();window.addEventListener('resize',resizeScene);animate();loading.classList.add('hide');setTimeout(()=>loading.remove(),500);
}
function onSceneTap(event){const rect=renderer.domElement.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(clickable,false);if(hits.length)openEmployee(hits[0].object.userData.employeeIndex)}
function resizeScene(){if(!renderer)return;const w=sceneRoot.clientWidth,h=sceneRoot.clientHeight;renderer.setSize(w,h);const aspect=w/h;const frustum=7;camera.left=-frustum*aspect/1.4;camera.right=frustum*aspect/1.4;camera.top=frustum;camera.bottom=-frustum;camera.updateProjectionMatrix()}
function animate(){requestAnimationFrame(animate);controls?.update();renderer?.render(scene,camera)}
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1900)}

renderTeam();renderActivity();
const now=new Date();document.querySelector('#todayLabel').textContent=now.toLocaleDateString('id-ID',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
document.querySelector('#modalClose').addEventListener('click',closeEmployee);document.querySelector('#employeeModal').addEventListener('click',e=>{if(e.target.id==='employeeModal')closeEmployee()});
document.querySelector('#resetView').addEventListener('click',()=>{if(!camera)return;camera.position.set(11,14,13);camera.zoom=1;camera.lookAt(0,0,0);camera.updateProjectionMatrix();controls.target.set(0,.2,0);controls.update();toast('Tampilan kantor direset')});
document.querySelector('#zoomIn').addEventListener('click',()=>{if(camera){camera.zoom=Math.min(1.65,camera.zoom+.12);camera.updateProjectionMatrix()}});document.querySelector('#zoomOut').addEventListener('click',()=>{if(camera){camera.zoom=Math.max(.7,camera.zoom-.12);camera.updateProjectionMatrix()}});
document.querySelector('#helpBtn').addEventListener('click',()=>toast('Ketuk karakter untuk membuka profil. Geser denah untuk memutar kantor.'));
document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));btn.classList.add('active');const target=btn.dataset.target;document.querySelector(target==='top'?'.topbar':target==='office'?'.office-section':target==='team'?'.team-section':'.activity-section').scrollIntoView({behavior:'smooth',block:'start'})}));
try{buildOffice()}catch(err){console.error(err);loading.innerHTML='<span>Gagal memuat 3D. Periksa koneksi internet lalu muat ulang.</span>'}

let installPrompt=null;const installBtn=document.querySelector('#installBtn');window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;installBtn.hidden=false});installBtn.addEventListener('click',async()=>{if(!installPrompt){toast('Gunakan menu browser: Add to Home Screen');return}installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;installBtn.hidden=true});
if('serviceWorker' in navigator && location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('PWA service worker:',err)));
