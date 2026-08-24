/* ============================================================
   Phathand Tech — Certificate Verification Terminal
   3D avatar built from primitives (no external model files).
   ============================================================ */

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- DOM refs ---------- */
const speechBubble = document.getElementById('speech-bubble');
const speechText = document.getElementById('speech-text');
const resultCard = document.getElementById('result-card');
const resultName = document.getElementById('result-name');
const resultCourse = document.getElementById('result-course');
const resultSkillRow = document.getElementById('result-skill-row');
const resultSkill = document.getElementById('result-skill');
const resultStatus = document.getElementById('result-status');
const form = document.getElementById('search-form');
const input = document.getElementById('name-input');
const hint = document.getElementById('search-hint');
const verifyBtn = document.getElementById('verify-btn');

/* ---------- Data ---------- */
let DATA = { course: 'Phathand Tech Summer Coaching', motto: 'Innovation · Service · Excellence', trainer: 'Phathand Tech', students: [] };
let RECORDS = []; // parsed { name, skill } entries

// Accepts each entry in students.json as either:
//   "Full Name | Skill Trained On"   (preferred — skill shown on verification)
//   "Full Name"                       (still works — skill just omitted)
function parseRecords(rawStudents) {
  return (rawStudents || []).map(entry => {
    const [namePart, skillPart] = String(entry).split('|');
    return {
      name: (namePart || '').trim(),
      skill: (skillPart || '').trim() // '' if no pipe/skill given
    };
  }).filter(r => r.name.length > 0);
}

async function loadData() {
  try {
    const res = await fetch('students.json', { cache: 'no-store' });
    DATA = await res.json();
  } catch (e) {
    console.error('Could not load students.json — verification will fail until this file is reachable.', e);
  } finally {
    RECORDS = parseRecords(DATA.students);
  }
}

/* ---------- Name matching ---------- */
function normalize(str) {
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function findMatch(rawInput) {
  const query = normalize(rawInput);
  if (!query) return { status: 'empty' };

  // 1. Exact normalized match
  const exact = RECORDS.find(r => normalize(r.name) === query);
  if (exact) return { status: 'match', name: exact.name, skill: exact.skill };

  // 2. Unique substring match (typing a first/last name that only fits one record)
  const substringHits = RECORDS.filter(r => normalize(r.name).includes(query));
  if (substringHits.length === 1) return { status: 'match', name: substringHits[0].name, skill: substringHits[0].skill };

  // 3. Fuzzy nearest-neighbor suggestion (not a valid match, just a hint)
  let best = null, bestDist = Infinity;
  for (const r of RECORDS) {
    const d = levenshtein(normalize(r.name), query);
    if (d < bestDist) { bestDist = d; best = r.name; }
  }
  const closeEnough = best && bestDist <= Math.max(2, Math.floor(query.length * 0.3));
  return { status: 'none', suggestion: closeEnough ? best : null };
}

/* ---------- Typewriter ---------- */
let typeToken = 0;
function typeText(el, text, speed = 22) {
  const myToken = ++typeToken;
  el.textContent = '';
  let i = 0;
  return new Promise(resolve => {
    function step() {
      if (myToken !== typeToken) return resolve();
      if (i <= text.length) {
        el.textContent = text.slice(0, i);
        i++;
        setTimeout(step, speed);
      } else {
        resolve();
      }
    }
    step();
  });
}

/* ============================================================
   THREE.JS SCENE
   ============================================================ */
const canvas = document.getElementById('scene-canvas');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0b1220, 0.045);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

/* ---------- Responsive framing ----------
   The UI overlay (speech bubble + search form) is pinned to the bottom of
   the screen and takes up proportionally more vertical space on phones.
   So on narrow/short screens we pull the camera back, widen the FOV a
   touch, and lift the avatar higher in frame so it stays fully visible
   above the overlay instead of getting cropped or hidden behind it. */
function getBreakpoint() {
  const w = window.innerWidth;
  if (w < 640) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

function applyResponsiveFraming() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const bp = getBreakpoint();
  const aspect = w / h;
  const isShortLandscape = aspect > 1.3 && h < 560;

  let fov, camZ, camY, avatarLift;

  if (bp === 'mobile') {
    fov = isShortLandscape ? 42 : 46;
    camZ = isShortLandscape ? 6.4 : 7.4;
    camY = isShortLandscape ? 1.35 : 1.75;
    avatarLift = isShortLandscape ? 0.55 : 0.95;
  } else if (bp === 'tablet') {
    fov = 40;
    camZ = 6.7;
    camY = 1.6;
    avatarLift = 0.55;
  } else {
    fov = 38;
    camZ = 6.2;
    camY = 1.55;
    avatarLift = 0.35;
  }

  camera.fov = fov;
  camera.aspect = aspect;
  camera.position.set(0, camY, camZ);
  camera.lookAt(0, camY - 0.35, 0);
  camera.updateProjectionMatrix();

  avatarBaseY = -0.35 + avatarLift;
  daisGroup.position.y = avatarLift;
}

let avatarBaseY = -0.35;

/* Lighting */
const ambient = new THREE.AmbientLight(0x3b4a6b, 0.9);
scene.add(ambient);

const rimLight = new THREE.PointLight(0xffb648, 6, 12, 2);
rimLight.position.set(-2.4, 3, 2.5);
scene.add(rimLight);

const fillLight = new THREE.PointLight(0x6fb7ff, 2.2, 12, 2);
fillLight.position.set(2.6, 1.5, 2);
scene.add(fillLight);

const topLight = new THREE.DirectionalLight(0xffffff, 0.6);
topLight.position.set(0, 5, 3);
scene.add(topLight);

/* ---------- Dais (hologram platform) ---------- */
const daisGroup = new THREE.Group();
scene.add(daisGroup);

const ringGeo = new THREE.TorusGeometry(1.35, 0.03, 16, 100);
const ringMat = new THREE.MeshBasicMaterial({ color: 0xffb648, transparent: true, opacity: 0.85 });
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.rotation.x = Math.PI / 2;
ring.position.y = -1.35;
daisGroup.add(ring);

const ring2Geo = new THREE.TorusGeometry(1.05, 0.012, 16, 100);
const ring2Mat = new THREE.MeshBasicMaterial({ color: 0xffe3b0, transparent: true, opacity: 0.5 });
const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
ring2.rotation.x = Math.PI / 2;
ring2.position.y = -1.33;
daisGroup.add(ring2);

const glowDiscGeo = new THREE.CircleGeometry(1.35, 64);
const glowDiscMat = new THREE.MeshBasicMaterial({ color: 0xffb648, transparent: true, opacity: 0.06 });
const glowDisc = new THREE.Mesh(glowDiscGeo, glowDiscMat);
glowDisc.rotation.x = -Math.PI / 2;
glowDisc.position.y = -1.36;
daisGroup.add(glowDisc);

/* ---------- Avatar ---------- */
const avatar = new THREE.Group();
scene.add(avatar);

const skinColor = 0xe3a878;
const shirtColor = 0x2e3f63;
const shirtAccent = 0xffb648;

const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6, metalness: 0.05 });
const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7, metalness: 0.05 });
const accentMat = new THREE.MeshStandardMaterial({ color: shirtAccent, roughness: 0.4, metalness: 0.15, emissive: 0x552f00, emissiveIntensity: 0.15 });
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x11141c, roughness: 0.3 });
const mouthMat = new THREE.MeshStandardMaterial({ color: 0x7a3b2e, roughness: 0.5 });

// Torso
const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 0.78, 8, 16), shirtMat);
torso.position.y = 0.05;
avatar.add(torso);

// Collar accent
const collar = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 24), accentMat);
collar.rotation.x = Math.PI / 2;
collar.position.y = 0.62;
avatar.add(collar);

// Neck
const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.22, 16), skinMat);
neck.position.y = 0.78;
avatar.add(neck);

// Head group (for nodding/shaking)
const headGroup = new THREE.Group();
headGroup.position.y = 1.12;
avatar.add(headGroup);

const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 32, 32), skinMat);
headGroup.add(head);

// Hair (simple cap)
const hair = new THREE.Mesh(
  new THREE.SphereGeometry(0.475, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.52),
  new THREE.MeshStandardMaterial({ color: 0x241a14, roughness: 0.8 })
);
hair.position.y = 0.06;
headGroup.add(hair);

// Eyes
const eyeGeo = new THREE.SphereGeometry(0.045, 16, 16);
const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
eyeL.position.set(-0.16, 0.03, 0.41);
const eyeR = eyeL.clone();
eyeR.position.x = 0.16;
headGroup.add(eyeL, eyeR);

// Eyebrows (thin boxes) for extra expressiveness
const browGeo = new THREE.BoxGeometry(0.14, 0.03, 0.03);
const browMat = new THREE.MeshStandardMaterial({ color: 0x241a14 });
const browL = new THREE.Mesh(browGeo, browMat);
browL.position.set(-0.16, 0.14, 0.43);
const browR = browL.clone();
browR.position.x = 0.16;
headGroup.add(browL, browR);

// Mouth (curved via torus segment)
const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 8, 24, Math.PI), mouthMat);
mouth.position.set(0, -0.14, 0.42);
mouth.rotation.z = Math.PI;
headGroup.add(mouth);

// Ears
const earGeo = new THREE.SphereGeometry(0.07, 12, 12);
const earL = new THREE.Mesh(earGeo, skinMat);
earL.position.set(-0.45, 0, 0);
const earR = earL.clone();
earR.position.x = 0.45;
headGroup.add(earL, earR);

/* Arms: shoulder pivot -> upper arm -> elbow pivot -> forearm+hand */
function buildArm(side) {
  const sign = side === 'L' ? -1 : 1;
  const shoulderPivot = new THREE.Group();
  shoulderPivot.position.set(sign * 0.62, 0.42, 0);

  const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.42, 6, 12), shirtMat);
  upperArm.position.y = -0.24;
  shoulderPivot.add(upperArm);

  const elbowPivot = new THREE.Group();
  elbowPivot.position.y = -0.46;
  shoulderPivot.add(elbowPivot);

  const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.38, 6, 12), skinMat);
  forearm.position.y = -0.21;
  elbowPivot.add(forearm);

  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), skinMat);
  hand.position.y = -0.42;
  elbowPivot.add(hand);

  // slight default inward rotation so arms rest against body
  shoulderPivot.rotation.z = sign * -0.08;
  elbowPivot.rotation.x = 0.05;

  avatar.add(shoulderPivot);
  return { shoulderPivot, elbowPivot };
}

const armL = buildArm('L');
const armR = buildArm('R');

// store rest rotations
const rest = {
  L: { shoulder: armL.shoulderPivot.rotation.clone(), elbow: armL.elbowPivot.rotation.clone() },
  R: { shoulder: armR.shoulderPivot.rotation.clone(), elbow: armR.elbowPivot.rotation.clone() },
  head: headGroup.rotation.clone(),
  avatarY: 0
};

avatar.position.y = avatarBaseY;
applyResponsiveFraming();

/* ---------- Particle burst (celebration) ---------- */
let particleSystem = null;
function spawnConfetti() {
  const count = 90;
  const positions = new Float32Array(count * 3);
  const velocities = [];
  const colors = new Float32Array(count * 3);
  const palette = [new THREE.Color(0xffb648), new THREE.Color(0x8fd14f), new THREE.Color(0xffe3b0), new THREE.Color(0x6fb7ff)];

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 0.4;
    positions[i * 3 + 1] = 1.1 + Math.random() * 0.3;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    const c = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    velocities.push(new THREE.Vector3(
      (Math.random() - 0.5) * 2.6,
      Math.random() * 2.6 + 1.2,
      (Math.random() - 0.5) * 2.6
    ));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({ size: 0.07, vertexColors: true, transparent: true, opacity: 1 });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  particleSystem = { points, velocities, geo, mat, age: 0 };
}

/* ============================================================
   AVATAR STATE MACHINE
   ============================================================ */
let currentTimeline = null;

function killTimeline() {
  if (currentTimeline) { currentTimeline.kill(); currentTimeline = null; }
}

function resetPose(duration = 0.5) {
  if (REDUCED_MOTION) {
    armL.shoulderPivot.rotation.copy(rest.L.shoulder);
    armR.shoulderPivot.rotation.copy(rest.R.shoulder);
    armL.elbowPivot.rotation.copy(rest.L.elbow);
    armR.elbowPivot.rotation.copy(rest.R.elbow);
    headGroup.rotation.copy(rest.head);
    return;
  }
  gsap.to(armL.shoulderPivot.rotation, { x: rest.L.shoulder.x, y: rest.L.shoulder.y, z: rest.L.shoulder.z, duration, ease: 'power2.out' });
  gsap.to(armR.shoulderPivot.rotation, { x: rest.R.shoulder.x, y: rest.R.shoulder.y, z: rest.R.shoulder.z, duration, ease: 'power2.out' });
  gsap.to(armL.elbowPivot.rotation, { x: rest.L.elbow.x, y: rest.L.elbow.y, z: rest.L.elbow.z, duration, ease: 'power2.out' });
  gsap.to(armR.elbowPivot.rotation, { x: rest.R.elbow.x, y: rest.R.elbow.y, z: rest.R.elbow.z, duration, ease: 'power2.out' });
  gsap.to(headGroup.rotation, { x: rest.head.x, y: rest.head.y, z: rest.head.z, duration, ease: 'power2.out' });
}

function playWave() {
  killTimeline();
  resetPose(0.01);
  if (REDUCED_MOTION) return;
  const tl = gsap.timeline();
  tl.to(armR.shoulderPivot.rotation, { z: 2.6, x: -0.3, duration: 0.45, ease: 'power2.out' }, 0);
  tl.to(armR.elbowPivot.rotation, { x: -0.4, duration: 0.4, ease: 'power2.out' }, 0);
  for (let i = 0; i < 3; i++) {
    tl.to(armR.elbowPivot.rotation, { z: 0.5, duration: 0.18, ease: 'sine.inOut' });
    tl.to(armR.elbowPivot.rotation, { z: -0.1, duration: 0.18, ease: 'sine.inOut' });
  }
  tl.to(headGroup.rotation, { z: 0.08, duration: 0.3 }, 0.2);
  tl.to([armR.shoulderPivot.rotation, armR.elbowPivot.rotation], { x: rest.R.shoulder.x, y: rest.R.shoulder.y, z: rest.R.shoulder.z, duration: 0.4, ease: 'power2.inOut' }, '+=0.1');
  tl.to(headGroup.rotation, { z: 0, duration: 0.3 }, '<');
  currentTimeline = tl;
}

function playThinking() {
  killTimeline();
  if (REDUCED_MOTION) return;
  const tl = gsap.timeline({ repeat: -1 });
  tl.to(armR.shoulderPivot.rotation, { z: 2.1, x: -0.5, duration: 0.5, ease: 'power2.out' }, 0);
  tl.to(armR.elbowPivot.rotation, { x: -1.9, duration: 0.5, ease: 'power2.out' }, 0);
  tl.to(headGroup.rotation, { z: 0.18, y: 0.12, duration: 0.9, ease: 'sine.inOut' }, 0.3);
  tl.to(headGroup.rotation, { z: -0.1, y: -0.12, duration: 0.9, ease: 'sine.inOut' }, 1.2);
  tl.to(headGroup.rotation, { z: 0.18, y: 0.12, duration: 0.9, ease: 'sine.inOut' }, 2.1);
  currentTimeline = tl;
}

function playSuccess() {
  killTimeline();
  resetPose(0.01);
  spawnConfetti();
  if (REDUCED_MOTION) return;
  const tl = gsap.timeline();
  tl.to(armL.shoulderPivot.rotation, { z: -2.7, duration: 0.4, ease: 'back.out(1.7)' }, 0);
  tl.to(armR.shoulderPivot.rotation, { z: 2.7, duration: 0.4, ease: 'back.out(1.7)' }, 0);
  tl.to(armL.elbowPivot.rotation, { x: 0, duration: 0.3 }, 0);
  tl.to(armR.elbowPivot.rotation, { x: 0, duration: 0.3 }, 0);
  tl.to(avatar.position, { y: avatarBaseY + 0.2, duration: 0.35, ease: 'power2.out', yoyo: true, repeat: 3 }, 0);
  tl.to(headGroup.rotation, { x: -0.15, duration: 0.35, yoyo: true, repeat: 3 }, 0);
  tl.to([armL.shoulderPivot.rotation, armR.shoulderPivot.rotation], { z: (i) => i === 0 ? rest.L.shoulder.z : rest.R.shoulder.z, duration: 0.5, ease: 'power2.inOut' }, '+=0.3');
  tl.to(avatar.position, { y: avatarBaseY, duration: 0.4 }, '<');
  tl.to(headGroup.rotation, { x: 0, duration: 0.4 }, '<');
  currentTimeline = tl;
}

function playFail() {
  killTimeline();
  resetPose(0.01);
  if (REDUCED_MOTION) return;
  const tl = gsap.timeline();
  // shrug
  tl.to(armL.shoulderPivot.rotation, { z: -1.1, x: -0.2, duration: 0.35, ease: 'power2.out' }, 0);
  tl.to(armR.shoulderPivot.rotation, { z: 1.1, x: -0.2, duration: 0.35, ease: 'power2.out' }, 0);
  tl.to(armL.elbowPivot.rotation, { x: -0.6, duration: 0.35 }, 0);
  tl.to(armR.elbowPivot.rotation, { x: -0.6, duration: 0.35 }, 0);
  // head shake
  tl.to(headGroup.rotation, { y: 0.35, duration: 0.22, ease: 'sine.inOut' }, 0.4);
  tl.to(headGroup.rotation, { y: -0.35, duration: 0.22, ease: 'sine.inOut' });
  tl.to(headGroup.rotation, { y: 0.25, duration: 0.2, ease: 'sine.inOut' });
  tl.to(headGroup.rotation, { y: 0, duration: 0.2, ease: 'sine.inOut' });
  tl.to([armL.shoulderPivot.rotation, armL.elbowPivot.rotation, armR.shoulderPivot.rotation, armR.elbowPivot.rotation], { duration: 0.001 }, '+=0.1');
  tl.add(() => resetPose(0.5));
  currentTimeline = tl;
}

/* ---------- Ring color feedback ---------- */
function setRingState(state) {
  const colors = { idle: 0xffb648, success: 0x8fd14f, fail: 0xff6b5e };
  const target = new THREE.Color(colors[state] || colors.idle);
  gsap.to(ringMat.color, { r: target.r, g: target.g, b: target.b, duration: 0.5 });
  gsap.to(ring2Mat.color, { r: target.r, g: target.g, b: target.b, duration: 0.5 });
}

/* ============================================================
   RENDER LOOP
   ============================================================ */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // idle bob + breathing
  if (!REDUCED_MOTION) {
    avatar.position.y = avatarBaseY + Math.sin(t * 1.4) * 0.025;
    torso.scale.y = 1 + Math.sin(t * 1.4) * 0.01;
    daisGroup.rotation.y = t * 0.15;
  }

  if (particleSystem) {
    particleSystem.age += 1 / 60;
    const pos = particleSystem.geo.attributes.position.array;
    for (let i = 0; i < particleSystem.velocities.length; i++) {
      const v = particleSystem.velocities[i];
      v.y -= 0.06; // gravity
      pos[i * 3] += v.x * 0.016;
      pos[i * 3 + 1] += v.y * 0.016;
      pos[i * 3 + 2] += v.z * 0.016;
    }
    particleSystem.geo.attributes.position.needsUpdate = true;
    particleSystem.mat.opacity = Math.max(0, 1 - particleSystem.age / 1.6);
    if (particleSystem.age > 1.6) {
      scene.remove(particleSystem.points);
      particleSystem.geo.dispose();
      particleSystem.mat.dispose();
      particleSystem = null;
    }
  }

  renderer.render(scene, camera);
}
animate();

let resizeRAF = null;
function handleViewportChange() {
  if (resizeRAF) cancelAnimationFrame(resizeRAF);
  resizeRAF = requestAnimationFrame(() => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    applyResponsiveFraming();
  });
}

window.addEventListener('resize', handleViewportChange);
window.addEventListener('orientationchange', handleViewportChange);

// iOS/Android virtual keyboards resize the *visual* viewport without firing
// a full 'resize' in some browsers — listen separately so the 3D framing
// and canvas stay correct while the keyboard is open.
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', handleViewportChange);
}

/* ============================================================
   CONVERSATION FLOW
   ============================================================ */
async function greet() {
  speechBubble.classList.remove('state-success', 'state-fail');
  playWave();
  await typeText(speechText, `Hi, I'm Sabimosh 👋 — training assistant for ${DATA.course}. Type the full name on your certificate and I'll check it for you.`, 18);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const value = input.value;
  if (!value.trim()) {
    hint.textContent = 'Type a name first — I need something to search for.';
    hint.className = 'search-hint hint-fail';
    return;
  }

  verifyBtn.disabled = true;
  input.disabled = true;
  resultCard.classList.add('hidden');
  speechBubble.classList.remove('state-success', 'state-fail');
  hint.textContent = '';
  hint.className = 'search-hint';

  playThinking();
  await typeText(speechText, 'Let me check that against the training records…', 16);

  const searchStart = performance.now();
  const result = findMatch(value);
  // keep a minimum "thinking" beat so it reads as deliberate, not instant
  const elapsed = performance.now() - searchStart;
  await new Promise(r => setTimeout(r, Math.max(0, 850 - elapsed)));

  if (result.status === 'match') {
    playSuccess();
    setRingState('success');
    speechBubble.classList.add('state-success');
    const firstName = result.name.split(' ')[0];
    const skillLine = result.skill
      ? `Confirmed! ${firstName}'s certificate checks out, verified in ${result.skill}. ✅`
      : `Confirmed! ${firstName}'s certificate checks out. ✅`;
    await typeText(speechText, skillLine, 20);
    resultName.textContent = result.name;
    resultCourse.textContent = DATA.course;
    resultStatus.textContent = 'Verified ✓';
    resultSkillRow.classList.toggle('hidden', !result.skill);
    if (result.skill) resultSkill.textContent = result.skill;
    resultCard.classList.remove('hidden');
    hint.textContent = 'This certificate is genuine and on record. It is a testament to the hard work and dedication of the student who has display all the criteria needed to be given this certificate.';
    hint.className = 'search-hint hint-success';
  } else {
    playFail();
    setRingState('fail');
    speechBubble.classList.add('state-fail');
    if (result.suggestion) {
      await typeText(speechText, `I couldn't find an exact match for that. Did you mean "${result.suggestion}"? Try that spelling.`, 18);
    } else {
      await typeText(speechText, `I couldn't find that name in the ${DATA.course} records. Double-check the spelling on your certificate and try again.`, 18);
    }
    resultCard.classList.add('hidden');
    hint.textContent = 'No match found — this name is not on the verified list.';
    hint.className = 'search-hint hint-fail';
  }

  setTimeout(() => setRingState('idle'), 4000);
  verifyBtn.disabled = false;
  input.disabled = false;
});

/* ---------- Boot ---------- */
(async function init() {
  await loadData();
  setTimeout(greet, 500);
})();
