import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OFFICE_SUPABASE_URL = 'https://nvmnbrsvybtviqwgmikc.supabase.co';
const OFFICE_SUPABASE_ANON_KEY = 'sb_publishable_bD5fNZ-Km0GF4ktAbd1LDg_nS1FSh3L';
const officeDb = createClient(OFFICE_SUPABASE_URL, OFFICE_SUPABASE_ANON_KEY);

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
const employeeAnimations = [];
const employeeGroups = [];
const monitorAnimations = [];
const officeClock = new THREE.Clock();

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
function openDirector(){
  document.querySelector('#modalInitials').textContent='DR';
  document.querySelector('#modalName').textContent='DIREKTUR SAKAPAY';
  document.querySelector('#modalRole').textContent='Pemilik bisnis · Ruang Direktur';
  document.querySelector('#modalAbout').textContent='Avatar direktur yang mewakili pemilik SakaPay. Penampilan dan nama dapat disesuaikan nanti.';
  document.querySelector('#modalTask').textContent='Mengawasi seluruh tim, menyetujui keputusan penting, dan menentukan arah bisnis SakaPay.';
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

function makeWood(color=0xc28b5c){return new THREE.MeshStandardMaterial({color,roughness:.88})}
function createWindow(x,y,z,w,h){
  const frame=makeMat(0x65442e), pane=new THREE.MeshStandardMaterial({color:0x8ed8f2,roughness:.25,metalness:.05,emissive:0x17394a,emissiveIntensity:.18});
  box(scene,w+.12,h+.12,.13,x,y,z,frame);
  box(scene,w,h,.06,x,y,z+.075,pane,false);
  box(scene,.045,h,.08,x,y,z+.12,frame,false);
  box(scene,w,.045,.08,x,y,z+.12,frame,false);
}
function createDesk(x,z,rotation=0,accent=0xc58c5a){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rotation;
  const wood=makeWood(accent), legs=makeMat(0x76543b), monitorFrame=makeMat(0x202a40);
  const screen=new THREE.MeshStandardMaterial({color:0x152d42,roughness:.35,emissive:0x1b8792,emissiveIntensity:.5});
  box(g,1.55,.14,.82,0,.83,0,wood);
  for(const sx of [-.64,.64])for(const sz of [-.29,.29])box(g,.075,.8,.075,sx,.4,sz,legs);
  box(g,.68,.47,.075,0,1.18,-.25,monitorFrame);
  box(g,.59,.36,.025,0,1.19,-.205,screen,false);
  monitorAnimations.push({material:screen,phase:monitorAnimations.length*.63});
  box(g,.42,.018,.012,0,1.18,-.185,makeMat(0x5ce0c6),false);
  box(g,.48,.035,.24,0,.93,.18,makeMat(0x343b4d));
  // Keyboard and a small desk accessory
  box(g,.48,.025,.16,0,.92,.32,makeMat(0x303a4c),false);
  const cup=cylinder(g,.065,.075,.14,.57,.97,.2,makeMat(0xd46f4e),12);
  scene.add(g);
}
function createChair(x,z,rotation=0){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rotation;
  const chair=makeMat(0x42375f), metal=makeMat(0x39495c);
  box(g,.58,.16,.55,0,.53,0,chair);
  box(g,.58,.68,.14,0,.88,-.22,chair);
  cylinder(g,.075,.075,.38,0,.25,0,metal,10);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;box(g,.42,.055,.07,Math.cos(a)*.19,.08,Math.sin(a)*.19,metal).rotation.y=a}
  scene.add(g);return g;
}
function createPerson(index,x,z,options={}){
  const isDirector=!!options.director;
  const group=new THREE.Group();group.position.set(x,0,z);
  group.userData.employeeIndex=index;group.userData.isDirector=isDirector;
  const palette=[0x168f85,0x426fa9,0xb77d36,0x3c8290,0xa35f79,0x526c9b,0x9b7940,0x477d70];
  const cloth=makeMat(options.color ?? palette[index] ?? 0x19a999);
  const skin=makeMat(0xe8b994), dark=makeMat(0x263047), hair=makeMat(isDirector?0x171b25:(index%2?0x30251f:0x201d20));
  // Seated low-poly body
  const hips=box(group,.42,.24,.34,0,.59,.04,dark);
  const torso=box(group,.48,.57,.34,0,.96,0,cloth);
  torso.rotation.x=-.08;
  const neck=cylinder(group,.095,.095,.13,0,1.27,0,skin,8);
  const headPivot=new THREE.Group();headPivot.position.set(0,1.34,0);group.add(headPivot);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.235,12,9),skin);head.position.y=.17;head.castShadow=true;headPivot.add(head);
  const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.24,12,7,0,Math.PI*2,0,Math.PI*.48),hair);hairCap.position.y=.23;headPivot.add(hairCap);
  // Seated legs point toward the desk
  const legs=[];
  for(const side of [-1,1]){
    const thigh=box(group,.17,.17,.43,side*.13,.48,.34,dark);thigh.rotation.x=-.08;
    const shoe=box(group,.18,.13,.25,side*.13,.35,.56,makeMat(0x1a2232));
    legs.push(thigh);
  }
  // Arms reach forward to keyboard; pivots animate a typing motion
  const arms=[];
  for(const side of [-1,1]){
    const pivot=new THREE.Group();pivot.position.set(side*.29,1.12,.02);group.add(pivot);
    const upper=cylinder(pivot,.085,.095,.34,0,-.14,.08,cloth,8);upper.rotation.x=-1.0;upper.rotation.z=side*.12;
    const hand=new THREE.Mesh(new THREE.SphereGeometry(.075,8,6),skin);hand.position.set(0,-.29,.24);pivot.add(hand);
    arms.push(pivot);
  }
  const hit=new THREE.Mesh(new THREE.CylinderGeometry(.52,.52,1.9,12),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
  hit.position.y=.95;hit.userData.employeeIndex=index;hit.userData.isDirector=isDirector;group.add(hit);clickable.push(hit);
  const label=textSprite(isDirector?'DIREKTUR':employees[index].name,isDirector?'#fff0bd':'#e8f7ff');
  label.position.set(0,2.12,0);label.scale.set(isDirector?2.5:2.0,.52,1);group.add(label);
  const status=textSprite(isDirector?'PEMILIK SAKAPAY':'SEDANG BEKERJA','#d4fff4');
  status.position.set(0,2.52,0);status.scale.set(isDirector?2.7:2.15,.38,1);group.add(status);
  scene.add(group);
  group.userData.home = new THREE.Vector3(x,0,z);
  group.userData.moveFrom = null;
  group.userData.moveTo = null;
  group.userData.moveProgress = 1;
  if(!isDirector) employeeGroups[index] = group;
  employeeAnimations.push({group,torso,headPivot,arms,legs,phase:(isDirector?2.4:index*.83),isDirector});
  return group;
}
function createPlant(x,z){
  const pot=makeMat(0x9c7657),leaf=makeMat(0x299c78);
  cylinder(scene,.2,.25,.34,x,.17,z,pot);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const l=new THREE.Mesh(new THREE.ConeGeometry(.12,.65,6),leaf);l.position.set(x+Math.cos(a)*.12,.62,z+Math.sin(a)*.12);l.rotation.z=Math.cos(a)*-.4;l.rotation.x=Math.sin(a)*.4;l.castShadow=true;scene.add(l)}
}
function createRoomLabel(text,x,z,color='#fff0c7'){
  const s=textSprite(text,color);s.position.set(x,2.1,z);s.scale.set(2.35,.52,1);scene.add(s);
}
function buildOffice(){
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x101a2b);
  scene.fog=new THREE.Fog(0x101a2b,22,38);
  camera=new THREE.OrthographicCamera(-10,10,7,-7,.1,100);
  camera.position.set(12,16,14);camera.lookAt(0,.2,0);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.6));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.setSize(sceneRoot.clientWidth,sceneRoot.clientHeight);sceneRoot.appendChild(renderer.domElement);
  controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.075;controls.enablePan=true;
  controls.minZoom=.68;controls.maxZoom=1.8;controls.minPolarAngle=.48;controls.maxPolarAngle=1.28;
  controls.target.set(0,.35,0);camera.zoom=1;camera.updateProjectionMatrix();
  scene.add(new THREE.HemisphereLight(0xfff0d8,0x536176,2.15));
  const key=new THREE.DirectionalLight(0xffe4c4,2.6);key.position.set(-5,13,8);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);
  const fill=new THREE.DirectionalLight(0x8ecbff,.8);fill.position.set(8,8,-5);scene.add(fill);

  // Warm wood floor with visible plank seams
  box(scene,16,.32,11.5,0,-.2,0,makeWood(0xd7b987),false);
  const seam=makeMat(0xb58d61);
  for(let z=-5;z<=5;z+=1.05)box(scene,15.8,.012,.018,0,-.028,z,seam,false);
  for(let x=-7;x<=7;x+=2.4)box(scene,.018,.012,11.2,x,-.027,0,seam,false);

  // Colored rugs define work zones
  box(scene,5.1,.035,3.2,-4.8,.0,-2.8,makeMat(0xd76b39),false);
  box(scene,9.5,.035,3.1,1.8,.0,2.7,makeMat(0xe9aa37),false);
  box(scene,3.4,.035,2.4,-5.6,.0,2.6,makeMat(0x3d9b91),false);

  // Cutaway walls, wooden trims and windows
  const wall=makeMat(0xd5c4aa), trim=makeMat(0x8b5d3c), glass=makeMat(0x6b9cb4);
  box(scene,16,.22,.18,0,.95,-5.68,trim);
  box(scene,16,1.85,.14,0,1.85,-5.72,wall);
  box(scene,.16,2.0,11.5,-7.92,.9,0,wall);
  box(scene,.16,2.0,11.5,7.92,.9,0,wall);
  box(scene,16,.16,.16,0,.1,5.68,trim);
  // Three broad windows along the back wall
  createWindow(-5.2,1.95,-5.60,2.2,1.25);
  createWindow(-1.7,1.95,-5.60,2.2,1.25);
  createWindow(1.8,1.95,-5.60,2.2,1.25);
  createWindow(5.25,1.95,-5.60,2.2,1.25);
  // Side windows
  createWindow(-7.78,1.85,-2.7,.06,1.25);
  createWindow(7.78,1.85,2.4,.06,1.25);

  // Low partitions make separate departments while keeping the room visible
  const partition=makeMat(0xe2d3bd), partitionTop=makeMat(0x956443);
  function halfWall(w,d,x,z){box(scene,w,1.05,d,x,.53,z,partition);box(scene,w+.06,.09,d+.06,x,1.1,z,partitionTop)}
  halfWall(4.7,.14,-4.8,-.25);
  halfWall(.14,3.1,-2.35,-3.7);
  halfWall(4.2,.14,3.1,-.35);
  halfWall(.14,3.0,1.0,-3.9);
  halfWall(4.4,.14,-4.8,4.35);
  createRoomLabel('DIREKTUR',-5.1,-4.8);
  createRoomLabel('FINANCE & ADMIN',-0.7,-4.8);
  createRoomLabel('OPERASIONAL',4.7,-4.8);
  createRoomLabel('TEAM WORKSPACE',2.1,4.9);

  // Director's dedicated office and desk
  createDesk(-5.65,-2.8,0,0xd3a06d);
  createChair(-5.65,-1.85);
  createPerson(-1,-5.65,-1.72,{director:true,color:0x159f91});

  // Eight AI employees in two rows of four
  const xs=[-4.6,-1.55,1.55,4.6];
  const backZ=-2.65, frontZ=2.0;
  let n=0;
  for(const x of xs){
    createDesk(x,backZ,0,[0xc99562,0xd0a06c,0xc18d5d,0xd4a777][n%4]);
    createChair(x,backZ+.92);
    createPerson(n,x,backZ+.98);n++;
  }
  for(const x of xs){
    createDesk(x,frontZ,0,[0xc99562,0xd0a06c,0xc18d5d,0xd4a777][n%4]);
    createChair(x,frontZ+.92);
    createPerson(n,x,frontZ+.98);n++;
  }

  // Meeting table, seats, wall board and office details
  cylinder(scene,.95,.95,.16,0,.62,.15,makeMat(0x8b5c43),24);
  cylinder(scene,.12,.12,.58,0,.29,.15,makeMat(0x76543b),12);
  for(let i=0;i<4;i++){const a=i*Math.PI/2;const chair=new THREE.Group();chair.position.set(Math.cos(a)*1.25,0,.15+Math.sin(a)*1.25);box(chair,.42,.14,.42,0,.43,0,makeMat(0x49395f));box(chair,.42,.5,.1,0,.7,-.16,makeMat(0x49395f));scene.add(chair)}
  // Wall-mounted status board
  box(scene,2.1,1.0,.12,5.8,1.45,-5.48,makeMat(0x51443a));
  box(scene,1.9,.8,.035,5.8,1.45,-5.39,makeMat(0x244f58),false);
  createPlant(-7,4.6);createPlant(7,4.6);createPlant(-7,-4.8);createPlant(7,-4.8);
  raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();
  renderer.domElement.addEventListener('pointerup',onSceneTap);
  resizeScene();window.addEventListener('resize',resizeScene);
  animate();loading.classList.add('hide');setTimeout(()=>loading.remove(),500);
}
function onSceneTap(event){const rect=renderer.domElement.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(clickable,false);if(hits.length){const hit=hits[0].object;if(hit.userData.isDirector)openDirector();else openEmployee(hit.userData.employeeIndex)}}
function resizeScene(){if(!renderer)return;const w=sceneRoot.clientWidth,h=sceneRoot.clientHeight;renderer.setSize(w,h);const aspect=w/h;const frustum=8.2;camera.left=-frustum*aspect/1.4;camera.right=frustum*aspect/1.4;camera.top=frustum;camera.bottom=-frustum;camera.updateProjectionMatrix()}
function animate(){
  requestAnimationFrame(animate);
  const t=officeClock.getElapsedTime();
  for(const a of employeeAnimations){
    const wave=t*1.45+a.phase;
    if(a.group.userData.moveTo && a.group.userData.moveProgress < 1){
      a.group.userData.moveProgress = Math.min(1,a.group.userData.moveProgress + 0.012);
      const p = a.group.userData.moveProgress;
      const eased = p < .5 ? 2*p*p : 1-Math.pow(-2*p+2,2)/2;
      a.group.position.lerpVectors(a.group.userData.moveFrom,a.group.userData.moveTo,eased);
      if(p >= 1){
        a.group.position.copy(a.group.userData.moveTo);
        a.group.userData.moveTo = null;
        a.group.userData.moveFrom = null;
      }
      a.group.position.y = Math.abs(Math.sin(p*Math.PI*8))*.045;
    } else {
      a.group.position.y=Math.sin(wave)*.012;
    }
    a.torso.rotation.z=Math.sin(wave*.7)*.025;
    a.headPivot.rotation.x=Math.sin(wave*.8)*.055;
    a.headPivot.rotation.y=Math.sin(wave*.43)*.09;
    a.arms[0].rotation.x=-.12+Math.sin(wave*3.1)*.20;
    a.arms[1].rotation.x=-.12+Math.sin(wave*3.1+1.3)*.20;
    a.arms[0].rotation.z=-.08+Math.sin(wave*1.2)*.045;
    a.arms[1].rotation.z=.08-Math.sin(wave*1.2)*.045;
  }
  for(const m of monitorAnimations)m.material.emissiveIntensity=.42+((Math.sin(t*2+m.phase)+1)*.22);
  controls?.update();renderer?.render(scene,camera);
}
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1900)}


// FASE 5E.4: shared task management engine (Supabase Project A).
// Legacy local tasks are migrated once; Supabase is the source of truth after login.
const taskStoreKey = 'sakapay-ai-office-tasks-v1';
const orderTaskMapKey = 'sakapay-ai-office-order-task-map-v1';
const migrationFlagKey = 'sakapay-ai-office-tasks-migrated-v1';
let officeTasks = [];
let orderTaskMap = {};
let taskDbReady = false;
let taskDbLoading = false;

const employeeNames = ['ALDI','YEGI','RIKA','PUTRA','MELA','ARYA','NONI','GITA'];
const employeeIndex = (name) => Math.max(0, employeeNames.indexOf(String(name || '').toUpperCase()));
const dbStatus = (status) => ({
  'Menunggu':'pending', 'Dikerjakan':'in_progress', 'Selesai':'completed',
  'Tertunda':'pending', 'pending':'pending', 'in_progress':'in_progress',
  'completed':'completed', 'cancelled':'cancelled'
}[String(status || '')] || 'pending');
const uiStatus = (status) => ({
  pending:'Menunggu', in_progress:'Dikerjakan', completed:'Selesai',
  cancelled:'Dibatalkan'
}[status] || 'Menunggu');
const dbPriority = (priority) => ({
  'Normal':'normal', 'Tinggi':'high', 'Mendesak':'urgent',
  normal:'normal', high:'high', urgent:'urgent', low:'low'
}[String(priority || '')] || 'normal');

function safeCreatedAt(value) {
  if (!value) return new Date().toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
}
function mapDbTask(row) {
  const metadata = row.metadata || {};
  return {
    id: row.id,
    dbId: row.id,
    title: row.title,
    description: row.description || '',
    assignee: employeeIndex(row.assigned_to),
    priority: ({low:'Rendah',normal:'Normal',high:'Tinggi',urgent:'Mendesak'})[row.priority] || 'Normal',
    status: uiStatus(row.status),
    result: metadata.result || row.description || '',
    createdAt: safeCreatedAt(row.created_at),
    createdAtRaw: row.created_at,
    source: metadata.source || (row.task_type === 'website_order' ? 'website' : row.task_type === 'aldi_followup' ? 'aldi-coordination' : 'director'),
    orderId: row.source_order_id || metadata.order_id || null,
    orderStatus: row.source_order_status || metadata.website_status || null,
    idempotencyKey: row.idempotency_key,
    metadata
  };
}
async function currentOfficeSession() {
  const { data, error } = await officeDb.auth.getSession();
  if (error) throw error;
  return data.session;
}
function setTaskSyncNote(message, error=false) {
  const disclaimer = document.querySelector('.task-disclaimer');
  if (disclaimer) disclaimer.textContent = message;
  if (disclaimer) disclaimer.dataset.state = error ? 'error' : 'success';
}
async function loadSharedTasks() {
  if (taskDbLoading) return;
  taskDbLoading = true;
  try {
    const session = await currentOfficeSession();
    if (!session) {
      taskDbReady = false;
      setTaskSyncNote('Login admin pada bagian Pesanan Website untuk menghubungkan Task Center ke database bersama. Tugas lokal lama tetap tersimpan di perangkat.');
      return;
    }
    const { data, error } = await officeDb.from('office_tasks')
      .select('*').order('created_at', { ascending:false }).limit(500);
    if (error) throw error;
    officeTasks = (data || []).map(mapDbTask);
    taskDbReady = true;
    await migrateLegacyTasks();
    // Reload after migration so local migrated records are reflected from server.
    const { data: refreshed, error: refreshError } = await officeDb.from('office_tasks')
      .select('*').order('created_at', { ascending:false }).limit(500);
    if (refreshError) throw refreshError;
    officeTasks = (refreshed || []).map(mapDbTask);
    renderTaskBoard();
    setTaskSyncNote('Task Center tersambung ke Supabase Project A. Data bersama aktif; riwayat perubahan disimpan di database.');
  } catch (error) {
    taskDbReady = false;
    setTaskSyncNote(`Sinkronisasi Task Center gagal: ${error.message}. Data lokal belum dihapus.`, true);
    console.error('Shared task load failed:', error);
  } finally {
    taskDbLoading = false;
  }
}
async function writeTaskEvent(taskId, eventType, description, actor, metadata={}) {
  const { error } = await officeDb.from('office_task_events').insert({
    task_id: taskId, event_type:eventType, description, actor,
    metadata
  });
  if (error) console.error('Task event insert failed:', error);
}
async function migrateLegacyTasks() {
  if (localStorage.getItem(migrationFlagKey) === 'true') return;
  let legacy = [];
  try {
    legacy = JSON.parse(localStorage.getItem(taskStoreKey) || '[]');
    if (!Array.isArray(legacy)) legacy = [];
  } catch { legacy = []; }
  let migrated = 0;
  for (const task of legacy) {
    const legacyId = String(task.id ?? migrated);
    const key = `legacy-local:${legacyId}`;
    const { data: exists, error: findError } = await officeDb.from('office_tasks')
      .select('id').eq('idempotency_key', key).maybeSingle();
    if (findError) throw findError;
    if (exists) continue;
    const employee = employees[Number(task.assignee)] || employees[0];
    const { data: inserted, error } = await officeDb.from('office_tasks').insert({
      title: String(task.title || 'Tugas lama').slice(0,120),
      description: task.result || null,
      assigned_to: employee.name,
      task_type: task.source === 'website' ? 'website_order' : task.source === 'aldi-coordination' ? 'aldi_followup' : 'director',
      status: dbStatus(task.status),
      priority: dbPriority(task.priority),
      source_order_id: task.orderId || null,
      source_order_status: task.orderStatus || null,
      idempotency_key: key,
      metadata: {
        source: task.source || 'legacy-local',
        result: task.result || '',
        legacy_local_id: legacyId,
        legacy_created_at: task.createdAt || null
      }
    }).select('id').single();
    if (error) {
      if (error.code === '23505') continue;
      throw error;
    }
    await writeTaskEvent(inserted.id, 'legacy_migrated', 'Tugas lama dari browser dimigrasikan ke database bersama.', 'SYSTEM', {legacy_local_id:legacyId});
    migrated++;
  }
  localStorage.setItem(migrationFlagKey, 'true');
  if (migrated) toast(`${migrated} tugas lama dipindahkan ke database`);
}
function saveOfficeTasks() {
  // Intentionally no local write after FASE 5E.4; Supabase is authoritative.
}
function saveOrderTaskMap() {
  try { localStorage.setItem(orderTaskMapKey, JSON.stringify(orderTaskMap)); } catch {}
}
async function syncWebsiteOrders(orders) {
  // Server worker now owns website order task creation. This client method is retained
  // for compatibility with office-integration.js and never creates duplicate tasks.
  if (taskDbReady) await loadSharedTasks();
  return { created:0, updated:0 };
}
async function runAldiCoordination(options = {}) {
  const silent = options.silent === true;
  if (!taskDbReady) {
    if (!silent) toast('Login admin dahulu untuk memuat tugas bersama');
    return {created:0, skipped:0, checked:0};
  }
  await loadSharedTasks();
  const summary = document.querySelector('#coordinationSummary');
  if (summary) summary.textContent = 'Koordinasi tindak lanjut pesanan dijalankan oleh backend server.';
  if (!silent) toast('Koordinasi backend aktif; tidak membuat tugas duplikat dari browser');
  return {created:0, skipped:0, checked:officeTasks.filter(t=>t.orderId).length};
}
document.querySelector('#runCoordination')?.addEventListener('click', runAldiCoordination);
window.SakaOfficeTasks = { syncWebsiteOrders, runAldiCoordination, loadSharedTasks };

function renderTaskBoard() {
  const list = document.querySelector('#taskList');
  const summary = document.querySelector('#taskSummary');
  if(!list || !summary) return;
  const counts = {
    'Menunggu': officeTasks.filter(t=>t.status==='Menunggu').length,
    'Dikerjakan': officeTasks.filter(t=>t.status==='Dikerjakan').length,
    'Selesai': officeTasks.filter(t=>t.status==='Selesai').length
  };
  summary.innerHTML = `<span>${counts.Menunggu} Menunggu</span><span>${counts.Dikerjakan} Dikerjakan</span><span>${counts.Selesai} Selesai</span>`;
  if(!officeTasks.length){
    list.innerHTML = '<div class="task-empty">Belum ada tugas. Berikan tugas pertama kepada tim.</div>';
    return;
  }
  list.innerHTML = officeTasks.slice().sort((a,b)=>new Date(b.createdAtRaw || 0)-new Date(a.createdAtRaw || 0)).map(task=>{
    const person = employees[task.assignee] || employees[0];
    const nextAction = task.status === 'Menunggu'
      ? `<button type="button" data-task-action="start" data-task-id="${task.id}">Mulai</button>`
      : task.status === 'Dikerjakan'
        ? `<button type="button" data-task-action="done" data-task-id="${task.id}">Selesaikan</button><button type="button" data-task-action="hold" data-task-id="${task.id}" class="quiet">Tunda</button>`
        : task.status === 'Tertunda'
          ? `<button type="button" data-task-action="start" data-task-id="${task.id}">Lanjutkan</button>`
          : '';
    return `<article class="task-card">
      <div class="task-card-top"><span class="task-status status-${task.status.toLowerCase()}">${task.status}</span><span class="task-priority priority-${task.priority.toLowerCase()}">${task.priority}</span></div>
      <strong class="task-title">${escapeTaskText(task.title)}</strong>
      <div class="task-meta"><span>${person.name} · ${person.role}</span><span>${escapeTaskText(task.createdAt)}</span></div>
      ${task.orderId ? `<p class="task-result">Sumber: ${task.source === 'website' ? 'Website' : task.source === 'aldi-coordination' ? 'Koordinasi ALDI' : 'Pesanan'} · Order ${escapeTaskText(task.orderId)}</p>` : ''}
      ${task.result ? `<p class="task-result">${escapeTaskText(task.result)}</p>` : ''}
      <div class="task-actions">${nextAction}</div>
    </article>`;
  }).join('');
}
function escapeTaskText(value){
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
async function updateTaskStatus(id, status) {
  if (!taskDbReady) { toast('Login admin dahulu untuk mengubah tugas bersama'); return; }
  const task = officeTasks.find(item=>String(item.id)===String(id));
  if(!task) return;
  const { error } = await officeDb.from('office_tasks').update({
    status:dbStatus(status),
    metadata:{...(task.metadata || {}), result: status === 'Selesai' ? 'Tugas ditandai selesai oleh Direktur. Hasil perlu diperiksa secara manual.' : task.result || '', source:task.source || 'director'}
  }).eq('id', task.id);
  if(error){toast(`Gagal menyimpan: ${error.message}`);return;}
  await writeTaskEvent(task.id,'status_changed',`Status tugas "${task.title}" diubah menjadi ${status}.`,'DIREKTUR',{status});
  await loadSharedTasks();
  toast(`Status tugas: ${status}`);
}
function logTaskActivity(name, initials, message) {
  const item = {initials,name,message,time:'Baru saja'};
  const container = document.querySelector('#activityList');
  if(!container) return;
  const row = document.createElement('div');
  row.className = 'activity-item';
  row.innerHTML = `<div class="activity-symbol">${escapeTaskText(initials)}</div><div class="activity-copy"><strong>${escapeTaskText(name)} · ${escapeTaskText(message)}</strong><small>Catatan aktivitas kantor</small></div><span class="activity-time">Baru saja</span>`;
  container.prepend(row);
}
document.querySelector('#taskForm')?.addEventListener('submit', async event=>{
  event.preventDefault();
  const title = document.querySelector('#taskTitle').value.trim();
  const assignee = Number(document.querySelector('#taskAssignee').value);
  const priority = document.querySelector('#taskPriority').value;
  if(!title){ toast('Isi deskripsi tugas terlebih dahulu'); return; }
  if(!taskDbReady){toast('Login admin dahulu pada bagian Pesanan Website');return;}
  const employee = employees[assignee] || employees[0];
  const key = `director:${crypto.randomUUID()}`;
  const {data, error} = await officeDb.from('office_tasks').insert({
    title, description:null, assigned_to:employee.name, task_type:'director',
    status:'pending', priority:dbPriority(priority), idempotency_key:key,
    metadata:{source:'director',result:''}
  }).select('id').single();
  if(error){toast(`Gagal menyimpan tugas: ${error.message}`);return;}
  await writeTaskEvent(data.id,'task_created',`Tugas baru diberikan kepada ${employee.name}: ${title}`,'DIREKTUR',{priority});
  document.querySelector('#taskTitle').value='';
  await loadSharedTasks();
  toast(`Tugas diberikan kepada ${employee.name}`);
});
document.querySelector('#taskList')?.addEventListener('click', event=>{
  const button = event.target.closest('button[data-task-action]');
  if(!button) return;
  const id = button.dataset.taskId;
  const action = button.dataset.taskAction;
  if(action==='start') updateTaskStatus(id,'Dikerjakan');
  else if(action==='done') updateTaskStatus(id,'Selesai');
  else if(action==='hold') updateTaskStatus(id,'Tertunda');
});
renderTaskBoard();
window.addEventListener('sakapay-office-session-changed', () => setTimeout(loadSharedTasks, 0));
officeDb.auth.onAuthStateChange((_event, session) => {
  if (session) setTimeout(loadSharedTasks, 0);
  else {
    taskDbReady = false;
    officeTasks = [];
    renderTaskBoard();
    setTaskSyncNote('Belum login. Task Center menunggu sesi admin Supabase.');
  }
});
setTimeout(loadSharedTasks, 500);


renderTeam();renderActivity();
const now=new Date();document.querySelector('#todayLabel').textContent=now.toLocaleDateString('id-ID',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
document.querySelector('#modalClose').addEventListener('click',closeEmployee);document.querySelector('#employeeModal').addEventListener('click',e=>{if(e.target.id==='employeeModal')closeEmployee()});
document.querySelector('#resetView').addEventListener('click',()=>{if(!camera)return;camera.position.set(12,16,14);camera.zoom=1;camera.lookAt(0,0,0);camera.updateProjectionMatrix();controls.target.set(0,.2,0);controls.update();toast('Tampilan kantor direset')});
document.querySelector('#zoomIn').addEventListener('click',()=>{if(camera){camera.zoom=Math.min(1.65,camera.zoom+.12);camera.updateProjectionMatrix()}});document.querySelector('#zoomOut').addEventListener('click',()=>{if(camera){camera.zoom=Math.max(.7,camera.zoom-.12);camera.updateProjectionMatrix()}});
function moveEmployee(group,target){
  if(!group) return;
  group.userData.moveFrom = group.position.clone();
  group.userData.moveTo = new THREE.Vector3(target.x,0,target.z);
  group.userData.moveProgress = 0;
}
function teamMeeting(){
  const seats=[
    {x:-1.35,z:-.95},{x:1.35,z:-.95},
    {x:-1.35,z:1.15},{x:1.35,z:1.15},
    {x:-2.35,z:.1},{x:2.35,z:.1},
    {x:-3,z:1.7},{x:3,z:1.7}
  ];
  employeeGroups.forEach((group,i)=>moveEmployee(group,seats[i]));
  toast('Tim dipanggil ke ruang rapat');
}
function teamReturn(){
  employeeGroups.forEach(group=>{
    if(group && group.userData.home) moveEmployee(group,group.userData.home);
  });
  toast('Tim kembali ke meja kerja');
}
document.querySelector('#meetingBtn')?.addEventListener('click',teamMeeting);
document.querySelector('#returnBtn')?.addEventListener('click',teamReturn);
document.querySelector('#helpBtn').addEventListener('click',()=>toast('Ketuk karakter untuk membuka profil. Geser denah untuk memutar kantor.'));
document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));btn.classList.add('active');const target=btn.dataset.target;document.querySelector(target==='top'?'.topbar':target==='office'?'.office-section':target==='team'?'.team-section':'.activity-section').scrollIntoView({behavior:'smooth',block:'start'})}));
try{buildOffice()}catch(err){console.error(err);loading.innerHTML='<span>Gagal memuat 3D. Periksa koneksi internet lalu muat ulang.</span>'}

let installPrompt=null;const installBtn=document.querySelector('#installBtn');window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;installBtn.hidden=false});installBtn.addEventListener('click',async()=>{if(!installPrompt){toast('Gunakan menu browser: Add to Home Screen');return}installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;installBtn.hidden=true});
if('serviceWorker' in navigator && location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('PWA service worker:',err)));
