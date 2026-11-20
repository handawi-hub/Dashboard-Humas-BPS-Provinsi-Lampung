// =========================================================================
// 3D EXPANDED GREEN CAMPUS + JAPANESE BRIDGE + STREAM + AURORA + 2D AGENTS
// =========================================================================
let scene, camera, renderer, controls;
let ambientLight, sunLight, warmLampLight, pondLight, expansionLampLight;
let lightingModeIndex = 0; // 0: Pagi, 1: Golden Hour, 2: Malam Aurora Norwegia
let seasonModeIndex = 0;

const cartoonAgents = {};
const clickableObjects = [];
const monitorScreens = [];
const koiFishes = [];
const streamFishes = [];
const streamRipples = [];
const rabbits = [];
const cats = [];

let grassFloorMesh = null;
let summerGrassTex = null;
let winterSnowTex = null;
let pondWaterMesh = null;
let streamWaterMesh = null;
const treeFoliageMeshes = [];
let rainParticles = null;
let snowParticles = null;

let auroraMesh = null;
let auroraUniforms = null;
let nightStars = null;

let targetCamPos = new THREE.Vector3(4.5, 11.8, 17.8);
let targetLookAt = new THREE.Vector3(1.5, 0.8, -0.5);
let isCameraTransitioning = false;

function init3DOffice() {
  const container = document.getElementById('canvasContainer');
  if (!container) return;
  const width = container.clientWidth || 640;
  const height = container.clientHeight || 550;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe6f2e8);
  scene.fog = new THREE.FogExp2(0xe6f2e8, 0.009);

  camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 180);
  camera.position.copy(targetCamPos);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.minDistance = 3.5;
  controls.maxDistance = 36;
  controls.target.copy(targetLookAt);
  controls.addEventListener('start', () => { isCameraTransitioning = false; });

  ambientLight = new THREE.AmbientLight(0xfffaf0, 0.82);
  scene.add(ambientLight);

  sunLight = new THREE.DirectionalLight(0xfff5e4, 0.98);
  sunLight.position.set(-10, 18, 12);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 55;
  const d = 22;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);

  warmLampLight = new THREE.PointLight(0xffb74d, 0.45, 18);
  warmLampLight.position.set(-4.5, 4.2, -1.5);
  scene.add(warmLampLight);

  expansionLampLight = new THREE.PointLight(0xffb74d, 0.45, 18);
  expansionLampLight.position.set(11.5, 4.2, -1.5);
  scene.add(expansionLampLight);

  pondLight = new THREE.PointLight(0x38bdf8, 0.4, 12);
  pondLight.position.set(3.2, 0.9, -1.0);
  scene.add(pondLight);

  buildExpandedCampusArchitecture();
  buildJapaneseStreamAndBridge();
  buildAuroraBorealisSky();
  buildGardenTreesAndPond();
  buildLivingAnimals();
  buildWeatherSystems();
  buildAllWorkstations();
  buildAllCartoonCharacters();

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let downX = 0, downY = 0;

  renderer.domElement.addEventListener('pointerdown', (e) => {
    downX = e.clientX;
    downY = e.clientY;
  });

  renderer.domElement.addEventListener('pointerup', (e) => {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(clickableObjects, true);
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj && !obj.userData.agentId) obj = obj.parent;
      if (obj && obj.userData.agentId) {
        selectAgentCard(obj.userData.agentId);
        focusCamera(obj.userData.agentId);
      }
    }
  });

  window.addEventListener('resize', onWindowResize);
  animate3D();
}

function onWindowResize() {
  const container = document.getElementById('canvasContainer');
  if (!container || !camera || !renderer) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function buildAuroraBorealisSky() {
  const starCount = 850;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const radius = 34 + Math.random() * 26;
    starPos[i * 3] = Math.cos(theta) * radius;
    starPos[i * 3 + 1] = 5.5 + Math.random() * 26;
    starPos[i * 3 + 2] = Math.sin(theta) * radius;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xf8fafc,
    size: 0.28,
    transparent: true,
    opacity: 0.88,
    fog: false
  });
  nightStars = new THREE.Points(starGeo, starMat);
  nightStars.visible = false;
  scene.add(nightStars);

  auroraUniforms = {
    uTime: { value: 0.0 },
    uOpacity: { value: 0.92 }
  };

  const auroraMat = new THREE.ShaderMaterial({
    uniforms: auroraUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: false,
    vertexShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        vUv = uv;
        vec3 pos = position;
        float wave1 = sin(uv.x * 16.0 + uTime * 0.65) * 1.6;
        float wave2 = cos(uv.x * 28.0 - uTime * 0.45) * 0.85;
        pos.z += (wave1 + wave2) * sin(uv.y * 3.14159);
        pos.x += cos(uv.x * 12.0 + uTime * 0.4) * 0.9;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uOpacity;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }
      void main() {
        float streaks = noise(vec2(vUv.x * 38.0 + uTime * 0.35, vUv.y * 2.2 - uTime * 0.15));
        float fineRays = noise(vec2(vUv.x * 88.0 - uTime * 0.5, vUv.y * 3.5));
        float curtain = smoothstep(0.24, 0.88, streaks * 0.68 + fineRays * 0.42);
        float vFade = smoothstep(0.0, 0.28, vUv.y) * smoothstep(1.0, 0.35, vUv.y);
        float hFade = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
        vec3 emerald = vec3(0.08, 0.98, 0.52);
        vec3 cyan = vec3(0.10, 0.85, 0.95);
        vec3 violet = vec3(0.68, 0.25, 0.95);
        vec3 col = mix(emerald, cyan, smoothstep(0.15, 0.55, vUv.y + sin(vUv.x * 10.0 + uTime) * 0.08));
        col = mix(col, violet, smoothstep(0.55, 0.95, vUv.y));
        float alpha = curtain * vFade * hFade * uOpacity;
        gl_FragColor = vec4(col * 1.35, alpha);
      }
    `
  });

  const auroraGeo = new THREE.CylinderGeometry(48, 48, 18, 96, 16, true, Math.PI * 0.55, Math.PI * 1.45);
  auroraMesh = new THREE.Mesh(auroraGeo, auroraMat);
  auroraMesh.position.set(1.5, 13.5, -2);
  auroraMesh.visible = false;
  scene.add(auroraMesh);
}

function buildJapaneseStreamAndBridge() {
  const streamX = 3.15;
  const streamWidth = 2.65;
  const streamLength = 28.0;

  const streamBed = new THREE.Mesh(
    new THREE.PlaneGeometry(streamWidth, streamLength),
    new THREE.MeshStandardMaterial({ color: 0x16384a, roughness: 0.9 })
  );
  streamBed.rotation.x = -Math.PI / 2;
  streamBed.position.set(streamX, 0.02, 0.5);
  scene.add(streamBed);

  const riverStoneMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });
  for (let i = 0; i < 65; i++) {
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14 + (i % 3) * 0.05, 1), riverStoneMat);
    st.scale.set(1.3, 0.55, 1.1);
    st.position.set(streamX + ((i * 17) % 10 - 5) * 0.21, 0.04, -12.5 + (i / 65) * 26.0);
    scene.add(st);
  }

  streamWaterMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(streamWidth - 0.08, streamLength),
    new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.64,
      roughness: 0.1,
      metalness: 0.08
    })
  );
  streamWaterMesh.rotation.x = -Math.PI / 2;
  streamWaterMesh.position.set(streamX, 0.14, 0.5);
  scene.add(streamWaterMesh);

  const rippleMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.45 });
  for (let r = 0; r < 24; r++) {
    const ripple = new THREE.Mesh(new THREE.PlaneGeometry(0.45 + (r % 3) * 0.2, 0.06), rippleMat);
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.set(streamX + ((r % 3) - 1) * 0.58, 0.155, -12 + r * 1.1);
    scene.add(ripple);
    streamRipples.push({ mesh: ripple, speed: 0.9 + (r % 3) * 0.25 });
  }

  const koiColors = [0xf97316, 0xffffff, 0xef4444, 0xfacc15];
  for (let f = 0; f < 4; f++) {
    const fishGroup = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: koiColors[f], roughness: 0.3 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.10, 10, 8), bodyMat);
    body.scale.set(0.65, 0.55, 1.85);
    fishGroup.add(body);

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.16, 4), bodyMat);
    tail.rotation.x = -Math.PI / 2;
    tail.position.z = -0.20;
    fishGroup.add(tail);

    const laneX = streamX + (f % 2 === 0 ? -0.45 : 0.45);
    fishGroup.position.set(laneX, 0.09, -8 + f * 4);
    scene.add(fishGroup);

    streamFishes.push({
      mesh: fishGroup,
      tail,
      baseX: laneX,
      speed: (f % 2 === 0 ? 1 : -1) * (0.85 + f * 0.15),
      phase: f * 1.4
    });
  }

  const bankRockMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.85 });
  for (let z = -12.8; z <= 13.8; z += 0.55) {
    if (Math.abs(z - (-1.6)) < 0.75) continue;
    for (let side of [-1, 1]) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.26, 1), bankRockMat);
      rock.scale.set(1.25, 0.75, 1.1);
      rock.position.set(streamX + side * (streamWidth / 2 + 0.12), 0.16, z);
      rock.castShadow = true;
      rock.receiveShadow = true;
      scene.add(rock);
    }
  }

  const bambooMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.5 });
  [
    [streamX - 1.75, -5.8], [streamX - 1.85, 2.2], [streamX - 1.75, 6.5],
    [streamX + 1.75, -6.2], [streamX + 1.85, 2.4], [streamX + 1.75, 5.8]
  ].forEach(([bx, bz]) => {
    const clump = new THREE.Group();
    clump.position.set(bx, 0, bz);
    for (let b = 0; b < 4; b++) {
      const h = 1.6 + (b % 3) * 0.45;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.048, h, 8), bambooMat);
      stalk.position.set((b - 1.5) * 0.11, h / 2, ((b % 2) - 0.5) * 0.12);
      stalk.castShadow = true;
      clump.add(stalk);
    }
    scene.add(clump);
  });

  // Jembatan Lengkung Jepang (Taiko-bashi)
  const bridgeGroup = new THREE.Group();
  bridgeGroup.position.set(streamX, 0.12, -1.6);

  const bridgeSpan = 3.85;
  const bridgeWidth = 1.65;
  const archHeight = 0.58;

  const woodPlankMat = new THREE.MeshStandardMaterial({ color: 0x9a5b2c, roughness: 0.65 });
  const vermilionMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.45 });
  const darkCapMat = new THREE.MeshStandardMaterial({ color: 0x1e1b18, roughness: 0.4 });
  const goldFinialMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.6, roughness: 0.3 });

  const plankCount = 24;
  for (let i = 0; i <= plankCount; i++) {
    const u = (i / plankCount) * 2 - 1;
    const px = u * (bridgeSpan / 2);
    const py = Math.cos(u * Math.PI * 0.5) * archHeight;
    const slopeAngle = -Math.sin(u * Math.PI * 0.5) * (archHeight / (bridgeSpan / 2)) * 1.35;

    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(bridgeSpan / plankCount + 0.04, 0.08, bridgeWidth),
      woodPlankMat
    );
    plank.position.set(px, py, 0);
    plank.rotation.z = slopeAngle;
    plank.castShadow = true;
    plank.receiveShadow = true;
    bridgeGroup.add(plank);
  }

  for (let side of [-1, 1]) {
    const zRail = side * (bridgeWidth / 2 - 0.07);
    const segs = 18;
    for (let s = 0; s < segs; s++) {
      const u1 = (s / segs) * 2 - 1;
      const u2 = ((s + 1) / segs) * 2 - 1;
      const x1 = u1 * (bridgeSpan / 2);
      const y1 = Math.cos(u1 * Math.PI * 0.5) * archHeight;
      const x2 = u2 * (bridgeSpan / 2);
      const y2 = Math.cos(u2 * Math.PI * 0.5) * archHeight;

      const segLen = Math.hypot(x2 - x1, y2 - y1) + 0.03;
      const segAng = Math.atan2(y2 - y1, x2 - x1);

      const beam = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.14, 0.10), vermilionMat);
      beam.position.set((x1 + x2) / 2, (y1 + y2) / 2 - 0.03, zRail);
      beam.rotation.z = segAng;
      beam.castShadow = true;
      bridgeGroup.add(beam);

      const topRail = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.09, 0.11), vermilionMat);
      topRail.position.set((x1 + x2) / 2, (y1 + y2) / 2 + 0.62, zRail);
      topRail.rotation.z = segAng;
      topRail.castShadow = true;
      bridgeGroup.add(topRail);

      const midRail = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.06, 0.07), vermilionMat);
      midRail.position.set((x1 + x2) / 2, (y1 + y2) / 2 + 0.34, zRail);
      midRail.rotation.z = segAng;
      bridgeGroup.add(midRail);
    }

    [-1, -0.5, 0, 0.5, 1].forEach((uPos) => {
      const tx = uPos * (bridgeSpan / 2);
      const ty = Math.cos(uPos * Math.PI * 0.5) * archHeight;
      const isEndPost = Math.abs(uPos) === 1;
      const postH = isEndPost ? 0.78 : 0.64;

      const post = new THREE.Mesh(
        new THREE.BoxGeometry(isEndPost ? 0.13 : 0.09, postH, isEndPost ? 0.13 : 0.09),
        vermilionMat
      );
      post.position.set(tx, ty + postH / 2 - 0.04, zRail);
      post.castShadow = true;
      bridgeGroup.add(post);

      if (isEndPost) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.06, 12), darkCapMat);
        cap.position.set(tx, ty + postH - 0.01, zRail);
        const finial = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), goldFinialMat);
        finial.position.set(tx, ty + postH + 0.06, zRail);
        bridgeGroup.add(cap, finial);
      }
    });
  }

  scene.add(bridgeGroup);

  const buildStoneLantern = (lx, lz) => {
    const lantern = new THREE.Group();
    lantern.position.set(lx, 0, lz);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.85 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.30, 0.18, 6), stoneMat);
    base.position.y = 0.09;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.52, 8), stoneMat);
    shaft.position.y = 0.44;
    const firebox = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.28), stoneMat);
    firebox.position.y = 0.80;
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.16, 0.22),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    glow.position.y = 0.80;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.24, 6), stoneMat);
    roof.position.y = 1.03;

    lantern.add(base, shaft, firebox, glow, roof);
    lantern.traverse(m => { if (m.isMesh) m.castShadow = true; });
    scene.add(lantern);
  };
  buildStoneLantern(streamX - 1.95, -0.45);
  buildStoneLantern(streamX + 1.95, -2.75);

  const stepMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.85 });
  [[0.45, -1.6], [1.05, -1.6], [5.25, -1.6], [5.85, -1.6]].forEach(([sx, sz]) => {
    const step = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.40, 0.07, 12), stepMat);
    step.position.set(sx, 0.035, sz);
    step.receiveShadow = true;
    scene.add(step);
  });
}

function createMonsteraLeafTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 320;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 320);

  ctx.strokeStyle = '#2d6a4f';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(128, 315);
  ctx.quadraticCurveTo(124, 240, 128, 175);
  ctx.stroke();

  const grad = ctx.createLinearGradient(40, 30, 210, 230);
  grad.addColorStop(0, '#40916c');
  grad.addColorStop(0.5, '#2d6a4f');
  grad.addColorStop(1, '#1b4332');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(128, 32);
  ctx.bezierCurveTo(215, 36, 236, 130, 206, 205);
  ctx.bezierCurveTo(185, 248, 145, 240, 128, 212);
  ctx.bezierCurveTo(111, 240, 71, 248, 50, 205);
  ctx.bezierCurveTo(20, 130, 41, 36, 128, 32);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#74c69d';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(128, 45);
  ctx.lineTo(128, 215);
  ctx.stroke();

  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000000';
  [
    [44, 92, 52, 11, -0.25], [38, 132, 58, 12, -0.15], [46, 172, 50, 11, 0.05],
    [212, 92, 52, 11, 0.25], [218, 132, 58, 12, 0.15], [210, 172, 50, 11, -0.05],
    [98, 108, 13, 8, -0.2], [94, 145, 15, 9, -0.1], [158, 108, 13, 8, 0.2], [162, 145, 15, 9, 0.1]
  ].forEach(([sx, sy, rw, rh, rot]) => {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, rw / 2, rh / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  ctx.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

let sharedMonsteraTex = null;

function createMonsteraCluster(x, yBase, z, scale = 1, leafCount = 7) {
  if (!sharedMonsteraTex) sharedMonsteraTex = createMonsteraLeafTexture();
  const cluster = new THREE.Group();
  cluster.position.set(x, yBase, z);
  cluster.scale.setScalar(scale);

  const leafMat = new THREE.MeshStandardMaterial({
    map: sharedMonsteraTex,
    transparent: true,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    roughness: 0.45
  });

  for (let i = 0; i < leafCount; i++) {
    const angle = (i / leafCount) * Math.PI * 2 + (i % 2) * 0.25;
    const h = 0.72 + (i % 3) * 0.26;
    const leafPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.85), leafMat);
    const leafPivot = new THREE.Group();
    leafPivot.rotation.y = angle;
    leafPivot.rotation.x = 0.38 + (i % 3) * 0.14;
    leafPlane.position.set(0, h * 0.55, 0.18);
    leafPlane.castShadow = true;
    leafPivot.add(leafPlane);
    cluster.add(leafPivot);
  }
  return cluster;
}

function createFernCluster(x, yBase, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, yBase, z);
  group.scale.setScalar(scale);

  const frondMat = new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.6, side: THREE.DoubleSide });
  for (let i = 0; i < 11; i++) {
    const ang = (i / 11) * Math.PI * 2;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.58, 4), frondMat);
    frond.scale.set(1.2, 1, 0.22);
    frond.position.set(Math.cos(ang) * 0.16, 0.24, Math.sin(ang) * 0.16);
    frond.rotation.y = -ang;
    frond.rotation.z = -0.58;
    frond.castShadow = true;
    group.add(frond);
  }
  return group;
}

function createPottedPlant(type, x, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0.12, z);
  group.scale.setScalar(scale);

  const potColor = type === 'monstera' ? 0xc86d51 : 0xf8fafc;
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.26, 0.52, 16),
    new THREE.MeshStandardMaterial({ color: potColor, roughness: 0.7 })
  );
  pot.position.y = 0.26;
  pot.castShadow = true;
  group.add(pot);

  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.33, 0.33, 0.04, 14),
    new THREE.MeshStandardMaterial({ color: 0x2b1d14 })
  );
  soil.position.y = 0.51;
  group.add(soil);

  if (type === 'monstera') {
    group.add(createMonsteraCluster(0, 0.48, 0, 1.05, 8));
  }
  scene.add(group);
}

function buildBiophilicWallPlanterBed(offsetX = 0, deckWidth = 11.2) {
  const borderWoodMat = new THREE.MeshStandardMaterial({ color: 0x8d5b3c, roughness: 0.7 });
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x291d16, roughness: 0.95 });
  const pebbleColors = [0xd6d3d1, 0xa8a29e, 0xe7e5e4, 0x78716c, 0xf5f5f4];

  const backSoil = new THREE.Mesh(new THREE.BoxGeometry(deckWidth - 0.6, 0.09, 0.72), soilMat);
  backSoil.position.set(offsetX, 0.16, -6.28);
  backSoil.receiveShadow = true;
  scene.add(backSoil);

  const backTrim = new THREE.Mesh(new THREE.BoxGeometry(deckWidth - 0.55, 0.12, 0.06), borderWoodMat);
  backTrim.position.set(offsetX, 0.18, -5.91);
  scene.add(backTrim);

  for (let i = 0; i < 80; i++) {
    const pMat = new THREE.MeshStandardMaterial({ color: pebbleColors[i % pebbleColors.length], roughness: 0.65 });
    const pebble = new THREE.Mesh(new THREE.SphereGeometry(0.065 + (i % 3) * 0.02, 8, 6), pMat);
    pebble.scale.set(1.25, 0.65, 1.0);
    const px = (offsetX - (deckWidth - 1.2) / 2) + (i / 80) * (deckWidth - 1.2);
    const pz = -6.48 + ((i * 7) % 10) * 0.048;
    pebble.position.set(px, 0.21, pz);
    pebble.receiveShadow = true;
    scene.add(pebble);
  }

  const relOffsets = [-0.42, -0.22, 0.0, 0.22, 0.42];
  relOffsets.forEach((rel, idx) => {
    const mx = offsetX + rel * (deckWidth - 1.4);
    scene.add(createMonsteraCluster(mx, 0.20, -6.25, 1.1 + (idx % 2) * 0.15, 7 + (idx % 2)));
    if (idx < relOffsets.length - 1) {
      const fx = mx + 0.11 * (deckWidth - 1.4);
      scene.add(createFernCluster(fx, 0.20, -6.12, 0.88));
    }
  });
}

function createWoodFloorTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d9b38c';
  ctx.fillRect(0, 0, 512, 512);
  const plankH = 64;
  const shades = ['#d4aa80', '#deb892', '#cfa376', '#e2be98'];
  for (let y = 0; y < 512; y += plankH) {
    ctx.fillStyle = shades[(y / plankH) % shades.length];
    ctx.fillRect(0, y, 512, plankH - 2);
    ctx.fillStyle = 'rgba(139, 90, 43, 0.14)';
    ctx.fillRect((y * 3) % 512, y, 2, plankH);
    ctx.fillRect(0, y + plankH - 2, 512, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

function createIndustrialConcreteTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3f444c';
  ctx.fillRect(0, 0, 512, 512);
  const tones = ['rgba(30, 34, 40, 0.14)', 'rgba(95, 102, 112, 0.12)', 'rgba(24, 27, 32, 0.10)'];
  for (let i = 0; i < 2800; i++) {
    ctx.fillStyle = tones[i % tones.length];
    ctx.beginPath();
    ctx.arc(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 14, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

function createGrassTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#65a30d';
  ctx.fillRect(0, 0, 512, 512);
  const greens = ['#4d7c0f', '#84cc16', '#3f6212', '#a3e635'];
  for (let i = 0; i < 4200; i++) {
    ctx.fillStyle = greens[i % greens.length];
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 6);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 10);
  return tex;
}

function createSnowGroundTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, 512, 512);
  const shades = ['#ffffff', '#e2e8f0', '#cbd5e1', '#f8fafc'];
  for (let i = 0; i < 3200; i++) {
    ctx.fillStyle = shades[i % shades.length];
    ctx.beginPath();
    ctx.arc(Math.random() * 512, Math.random() * 512, 3 + Math.random() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 8);
  return tex;
}

function createFallbackBandPoster(title1, title2, subtitle, accentColor) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 360;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#181a1f';
  ctx.fillRect(0, 0, 256, 360);
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 26px Impact, sans-serif';
  ctx.fillText(title1, 20, 48);
  ctx.fillText(title2, 20, 78);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 96, 220, 210);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(subtitle, 24, 336);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function createExpansionBannerCanvas() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 192;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#06182E';
  ctx.fillRect(0, 0, 512, 192);
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 492, 172);
  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CREATIVE & MULTIMEDIA WING', 256, 58);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('ZONA EKSPANSI AGEN AI', 256, 105);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 17px monospace';
  ctx.fillText('Slot Siap: Content Creator & Reels Studio', 256, 146);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function buildExpandedCampusArchitecture() {
  summerGrassTex = createGrassTexture();
  winterSnowTex = createSnowGroundTexture();

  grassFloorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(38, 28),
    new THREE.MeshStandardMaterial({ map: summerGrassTex, roughness: 0.9 })
  );
  grassFloorMesh.rotation.x = -Math.PI / 2;
  grassFloorMesh.position.set(1.5, 0, 0.5);
  grassFloorMesh.receiveShadow = true;
  scene.add(grassFloorMesh);

  const woodTex = createWoodFloorTexture();
  const wallMat = new THREE.MeshStandardMaterial({
    map: createIndustrialConcreteTexture(),
    color: 0xd1d5db,
    roughness: 0.88,
    metalness: 0.08
  });
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 });
  const slatMat = new THREE.MeshStandardMaterial({ color: 0xc28e5c, roughness: 0.65 });

  // A. STUDIO UTAMA (SISI KIRI SUNGAI)
  const mainCenterX = -4.6;
  const mainW = 11.2;

  const deckBase = new THREE.Mesh(
    new THREE.BoxGeometry(mainW, 0.12, 8.8),
    new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.6 })
  );
  deckBase.position.set(mainCenterX, 0.06, -2.5);
  deckBase.receiveShadow = true;
  scene.add(deckBase);

  const addRug = (w, d, color, x, z) => {
    const rug = new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, d), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    rug.position.set(x, 0.13, z);
    rug.receiveShadow = true;
    scene.add(rug);
  };
  addRug(3.4, 3.0, 0xe0f2fe, -8.6, -2.5);
  addRug(3.6, 3.0, 0xdcfce7, -4.5, -3.9);
  addRug(3.6, 3.2, 0xfef3c7, -1.4, -0.3);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(mainW, 4.2, 0.25), wallMat);
  backWall.position.set(mainCenterX, 2.1, -6.8);
  backWall.receiveShadow = true;
  scene.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.2, 5.2), wallMat);
  leftWall.position.set(-10.1, 2.1, -4.2);
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  [[-10.0, -6.6], [-10.0, 1.7], [0.85, -6.6], [0.85, 1.7]].forEach(([px, pz]) => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.20, 4.1, 0.20), pillarMat);
    pillar.position.set(px, 2.05, pz);
    pillar.castShadow = true;
    scene.add(pillar);
  });

  for (let sx = -9.8; sx <= 0.6; sx += 0.65) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 8.45), slatMat);
    slat.position.set(sx, 4.05, -2.45);
    slat.castShadow = true;
    scene.add(slat);
  }

  const glassRoof1 = new THREE.Mesh(
    new THREE.BoxGeometry(mainW - 0.15, 0.05, 8.55),
    new THREE.MeshPhysicalMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.18, roughness: 0.08, depthWrite: false })
  );
  glassRoof1.position.set(mainCenterX, 4.14, -2.45);
  scene.add(glassRoof1);

  const addCustomPoster = (candidateFiles, xPos, fallbackTex) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.48, 2.02, 0.06), new THREE.MeshStandardMaterial({ color: 0x0f1115, roughness: 0.7 }));
    frame.position.set(xPos, 2.65, -6.64);
    scene.add(frame);

    const posterMat = new THREE.MeshBasicMaterial({ map: fallbackTex });
    const canvasMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 1.90), posterMat);
    canvasMesh.position.set(xPos, 2.65, -6.59);
    scene.add(canvasMesh);

    const tryLoad = (idx) => {
      if (idx >= candidateFiles.length) return;
      new THREE.TextureLoader().load(
        candidateFiles[idx],
        (tex) => { tex.encoding = THREE.sRGBEncoding; posterMat.map = tex; posterMat.needsUpdate = true; },
        undefined,
        () => tryLoad(idx + 1)
      );
    };
    tryLoad(0);
  };

  addCustomPoster(['adtr_poster.webp', 'a Day To Remember.webp'], -7.2, createFallbackBandPoster('A DAY TO', 'REMEMBER', 'WHAT SEPARATES ME FROM YOU', '#2dd4bf'));
  addCustomPoster(['suicide_silence_poster.jpg', 'suicide_silence_poster.jpg.jpg'], -1.8, createFallbackBandPoster('SUICIDE', 'SILENCE', 'THE CLEANSING', '#a3a380'));

  buildBiophilicWallPlanterBed(mainCenterX, mainW);
  createPottedPlant('monstera', -9.4, -1.2, 1.1);
  createPottedPlant('monstera', 0.2, 1.1, 1.15);

  // B. PAVILIUN EKSPANSI AGEN BARU (SISI KANAN SUNGAI)
  const expCenterX = 11.4;
  const expW = 10.2;

  const expDeck = new THREE.Mesh(
    new THREE.BoxGeometry(expW, 0.12, 8.8),
    new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.6 })
  );
  expDeck.position.set(expCenterX, 0.06, -2.5);
  expDeck.receiveShadow = true;
  scene.add(expDeck);

  addRug(3.6, 3.0, 0xf3e8ff, 9.2, -3.4);
  addRug(3.6, 3.0, 0xe0f2fe, 13.8, -2.2);

  const expBackWall = new THREE.Mesh(new THREE.BoxGeometry(expW, 4.2, 0.25), wallMat);
  expBackWall.position.set(expCenterX, 2.1, -6.8);
  expBackWall.receiveShadow = true;
  scene.add(expBackWall);

  const expRightWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.2, 5.2), wallMat);
  expRightWall.position.set(16.4, 2.1, -4.2);
  expRightWall.receiveShadow = true;
  scene.add(expRightWall);

  [[6.45, -6.6], [6.45, 1.7], [16.3, -6.6], [16.3, 1.7]].forEach(([px, pz]) => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.20, 4.1, 0.20), pillarMat);
    pillar.position.set(px, 2.05, pz);
    pillar.castShadow = true;
    scene.add(pillar);
  });

  for (let sx = 6.7; sx <= 16.0; sx += 0.65) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 8.45), slatMat);
    slat.position.set(sx, 4.05, -2.45);
    slat.castShadow = true;
    scene.add(slat);
  }

  const glassRoof2 = new THREE.Mesh(
    new THREE.BoxGeometry(expW - 0.15, 0.05, 8.55),
    new THREE.MeshPhysicalMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.18, roughness: 0.08, depthWrite: false })
  );
  glassRoof2.position.set(expCenterX, 4.14, -2.45);
  scene.add(glassRoof2);

  const bannerFrame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.3, 0.08), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
  bannerFrame.position.set(expCenterX, 2.85, -6.63);
  scene.add(bannerFrame);

  const bannerScreen = new THREE.Mesh(new THREE.PlaneGeometry(3.25, 1.18), new THREE.MeshBasicMaterial({ map: createExpansionBannerCanvas() }));
  bannerScreen.position.set(expCenterX, 2.85, -6.58);
  scene.add(bannerScreen);

  buildBiophilicWallPlanterBed(expCenterX, expW);
  createPottedPlant('monstera', 7.1, 1.1, 1.1);
  createPottedPlant('monstera', 15.6, 1.1, 1.15);

  buildDeskSetup(9.2, -3.8, Math.PI / 8, 0xc084fc);
  buildDeskSetup(13.8, -2.8, -Math.PI / 6, 0x38bdf8);

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.85 });
  [[-8.2, 2.4], [-9.1, 3.0], [-10.1, 3.4]].forEach(([sx, sz]) => {
    const step = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.48, 0.08, 12), stoneMat);
    step.position.set(sx, 0.04, sz);
    step.receiveShadow = true;
    scene.add(step);
  });
}

function createGardenTree(x, z, scale = 1) {
  const tree = new THREE.Group();
  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 2.3, 10), new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 }));
  trunk.position.y = 1.15;
  trunk.castShadow = true;
  tree.add(trunk);

  const foliageColors = [0x2d6a4f, 0x40916c, 0x52b788];
  [[0, 3.0, 0, 1.35], [-0.85, 2.5, 0.45, 0.95], [0.85, 2.55, -0.35, 1.0], [0.2, 2.6, 0.85, 0.92], [-0.3, 3.6, -0.2, 0.95]].forEach(([px, py, pz, r], idx) => {
    const baseHex = foliageColors[idx % foliageColors.length];
    const mat = new THREE.MeshStandardMaterial({ color: baseHex, roughness: 0.75 });
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), mat);
    crown.position.set(px, py, pz);
    crown.castShadow = true;
    crown.receiveShadow = true;
    tree.add(crown);
    treeFoliageMeshes.push({ mesh: crown, summerColor: new THREE.Color(baseHex) });
  });
  scene.add(tree);
}

function buildGardenTreesAndPond() {
  createGardenTree(-14.2, -5.2, 1.25);
  createGardenTree(-14.8, 0.8, 1.1);
  createGardenTree(-13.8, 7.2, 1.3);
  createGardenTree(-6.5, 8.6, 1.15);
  createGardenTree(-0.5, 8.2, 1.1);
  createGardenTree(7.8, 8.2, 1.2);
  createGardenTree(15.2, 7.2, 1.25);
  createGardenTree(18.5, -3.5, 1.2);

  // Pohon Sakura
  const sakura = new THREE.Group();
  sakura.position.set(5.4, 0, -4.6);
  const sTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.1, 10), new THREE.MeshStandardMaterial({ color: 0x5c3a21 }));
  sTrunk.position.y = 1.05;
  sTrunk.castShadow = true;
  sakura.add(sTrunk);
  [[0, 2.7, 0, 1.25], [-0.75, 2.35, 0.4, 0.9], [0.75, 2.4, -0.35, 0.95]].forEach(([px, py, pz, r]) => {
    const blossomCrown = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.7 }));
    blossomCrown.position.set(px, py, pz);
    blossomCrown.castShadow = true;
    sakura.add(blossomCrown);
  });
  scene.add(sakura);

  const flowerColors = [0xf43f5e, 0xfbbf24, 0xc084fc, 0xfb923c];
  [[-13.2, -4.2], [-12.2, -2.6], [-13.6, -1.0], [-12.4, 1.2], [-13.8, 3.2], [-13.5, 5.4], [-9.2, 6.8], [-3.2, 6.8], [7.2, 5.2], [11.5, 5.8], [14.8, 4.6]].forEach(([fx, fz], i) => {
    const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 1), new THREE.MeshStandardMaterial({ color: 0x3f6212 }));
    bush.position.set(fx, 0.22, fz);
    bush.castShadow = true;
    scene.add(bush);
    treeFoliageMeshes.push({ mesh: bush, summerColor: new THREE.Color(0x3f6212) });

    const blossom = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), new THREE.MeshBasicMaterial({ color: flowerColors[i % flowerColors.length] }));
    blossom.position.set(fx, 0.48, fz);
    scene.add(blossom);
  });

  const pondX = -11.2, pondZ = 4.6, pondRadius = 2.15;
  const pondBed = new THREE.Mesh(new THREE.CircleGeometry(pondRadius, 32), new THREE.MeshStandardMaterial({ color: 0x0f293a, roughness: 0.9 }));
  pondBed.rotation.x = -Math.PI / 2;
  pondBed.position.set(pondX, 0.03, pondZ);
  scene.add(pondBed);

  pondWaterMesh = new THREE.Mesh(
    new THREE.CircleGeometry(pondRadius - 0.05, 32),
    new THREE.MeshPhysicalMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.62, roughness: 0.12, metalness: 0.1 })
  );
  pondWaterMesh.rotation.x = -Math.PI / 2;
  pondWaterMesh.position.set(pondX, 0.18, pondZ);
  scene.add(pondWaterMesh);

  const rockMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.85 });
  for (let i = 0; i < 22; i++) {
    const ang = (i / 22) * Math.PI * 2;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24 + (i % 3) * 0.07, 1), rockMat);
    rock.scale.set(1.2, 0.75, 1.0);
    rock.position.set(pondX + Math.cos(ang) * (pondRadius + 0.05), 0.14, pondZ + Math.sin(ang) * (pondRadius + 0.05));
    rock.castShadow = true;
    scene.add(rock);
  }

  const koiColors = [0xf97316, 0xffffff, 0xef4444, 0xfacc15, 0xfb923c];
  for (let i = 0; i < 5; i++) {
    const fishGroup = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: koiColors[i], roughness: 0.3 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), bodyMat);
    body.scale.set(0.65, 0.55, 1.85);
    fishGroup.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 4), bodyMat);
    tail.rotation.x = -Math.PI / 2;
    tail.position.z = -0.22;
    fishGroup.add(tail);
    fishGroup.position.set(pondX, 0.11, pondZ);
    scene.add(fishGroup);
    koiFishes.push({
      mesh: fishGroup, tail, centerX: pondX, centerZ: pondZ,
      orbitRadius: 0.55 + i * 0.25, speed: (i % 2 === 0 ? 1 : -1) * (0.55 + i * 0.12), angle: (i / 5) * Math.PI * 2
    });
  }
}

function buildWeatherSystems() {
  const rainCount = 1600;
  const rainGeo = new THREE.BufferGeometry();
  const rainPositions = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainPositions[i * 3] = (Math.random() - 0.5) * 38 + 1.5;
    rainPositions[i * 3 + 1] = Math.random() * 14;
    rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 28;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  rainParticles = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xbae6fd, size: 0.14, transparent: true, opacity: 0.75 }));
  rainParticles.visible = false;
  scene.add(rainParticles);

  const snowCount = 1300;
  const snowGeo = new THREE.BufferGeometry();
  const snowPositions = new Float32Array(snowCount * 3);
  for (let i = 0; i < snowCount; i++) {
    snowPositions[i * 3] = (Math.random() - 0.5) * 38 + 1.5;
    snowPositions[i * 3 + 1] = Math.random() * 14;
    snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 28;
  }
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
  snowParticles = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, opacity: 0.92 }));
  snowParticles.visible = false;
  scene.add(snowParticles);
}

function createRabbit(x, z, furColor) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const furMat = new THREE.MeshStandardMaterial({ color: furColor, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.20, 14, 12), furMat);
  body.scale.set(0.95, 0.9, 1.25);
  body.position.y = 0.20;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), furMat);
  head.position.set(0, 0.34, 0.18);
  head.castShadow = true;
  group.add(head);

  for (let side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.24, 8), furMat);
    ear.position.set(side * 0.055, 0.51, 0.15);
    ear.rotation.z = side * -0.14;
    group.add(ear);
  }
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  tail.position.set(0, 0.20, -0.24);
  group.add(tail);
  scene.add(group);
  return group;
}

function createCat(x, z, furColor, stripeColor) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const furMat = new THREE.MeshStandardMaterial({ color: furColor, roughness: 0.7 });
  const accentMat = new THREE.MeshStandardMaterial({ color: stripeColor, roughness: 0.7 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.44, 12), furMat);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.24;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), furMat);
  head.position.set(0, 0.36, 0.24);
  head.castShadow = true;
  group.add(head);

  for (let side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.11, 4), accentMat);
    ear.position.set(side * 0.09, 0.50, 0.23);
    group.add(ear);
  }
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.28, -0.20);
  const tailMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.34, 8), accentMat);
  tailMesh.position.set(0, 0.15, -0.06);
  tailMesh.rotation.x = -0.45;
  tailPivot.add(tailMesh);
  group.add(tailPivot);
  scene.add(group);
  return { group, tailPivot };
}

function buildLivingAnimals() {
  rabbits.push({ mesh: createRabbit(-7.8, 4.8, 0xffffff), centerX: -7.8, centerZ: 4.8, radius: 1.15, speed: 0.75, angle: 0 });
  rabbits.push({ mesh: createRabbit(9.5, 4.2, 0xd6b899), centerX: 9.5, centerZ: 4.2, radius: 1.25, speed: -0.65, angle: 2.1 });
  cats.push({ ...createCat(-4.2, 3.4, 0xf97316, 0xc2410c), centerX: -4.2, centerZ: 3.4, radius: 1.5, speed: 0.42, angle: 0.5, baseY: 0 });
  cats.push({ ...createCat(11.4, -0.4, 0xf8fafc, 0x334155), centerX: 11.4, centerZ: -0.4, radius: 1.3, speed: -0.38, angle: 3.0, baseY: 0.12 });
}

function buildDeskSetup(x, z, rotY, accentColor) {
  const desk = new THREE.Group();
  desk.position.set(x, 0.12, z);
  desk.rotation.y = rotY;

  const topMat = new THREE.MeshStandardMaterial({ color: 0xe6ccb2, roughness: 0.5 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.4, roughness: 0.5 });

  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 1.05), topMat);
  tableTop.position.y = 0.88;
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  desk.add(tableTop);

  for (let lx of [-0.92, 0.92]) {
    for (let lz of [-0.42, 0.42]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.88, 8), legMat);
      leg.position.set(lx, 0.44, lz);
      leg.castShadow = true;
      desk.add(leg);
    }
  }

  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.1), legMat);
  stand.position.set(0, 1.02, -0.25);
  desk.add(stand);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.58, 0.05), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
  frame.position.set(0, 1.32, -0.24);
  frame.castShadow = true;
  desk.add(frame);

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.07, 0.50), new THREE.MeshBasicMaterial({ color: accentColor }));
  screen.position.set(0, 1.32, -0.21);
  desk.add(screen);
  monitorScreens.push({ mesh: screen, baseColor: new THREE.Color(accentColor) });

  scene.add(desk);
}

function buildAllWorkstations() {
  buildDeskSetup(-8.8, -3.1, Math.PI / 5, 0x38bdf8);
  buildDeskSetup(-4.5, -4.6, 0, 0x34d399);
  buildDeskSetup(-1.2, -0.8, -Math.PI / 4, 0xfbbf24);
}

function createRoundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCultOfTheLambAgent(ctx, id, state) {
  const W = 512, H = 640;
  ctx.clearRect(0, 0, W, H);
  const { status = 'IDLE', walkPhase = 0, armWave = 0, headTilt = 0, isMoshing = false, isChatting = false, isHandshaking = false, facingDir = 1 } = state;
  const INK = '#161114';
  ctx.save();
  if (facingDir < 0) { ctx.translate(W, 0); ctx.scale(-1, 1); }

  ctx.fillStyle = 'rgba(22, 17, 20, 0.28)';
  ctx.beginPath();
  ctx.ellipse(256, 610, 96, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  const drawFoot = (fx, fy) => {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(fx, fy, 26, 36, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  drawFoot(214, 552 + Math.sin(walkPhase) * 14);
  drawFoot(298, 552 - Math.sin(walkPhase) * 14);

  if (id === 'crawler') {
    ctx.fillStyle = '#1f1b1e';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.roundRect(128, 175, 256, 225, 85);
    ctx.fill();
    ctx.stroke();
  } else if (id === 'drafter') {
    ctx.fillStyle = '#3b2319';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(136, 180);
    ctx.bezierCurveTo(102, 270, 112, 375, 134, 445);
    ctx.quadraticCurveTo(256, 475, 378, 445);
    ctx.bezierCurveTo(400, 375, 410, 270, 376, 180);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    const hairGrad = ctx.createLinearGradient(0, 170, 0, 445);
    hairGrad.addColorStop(0, '#f4e3b2');
    hairGrad.addColorStop(0.65, '#e8d08e');
    hairGrad.addColorStop(1, '#0d9488');
    ctx.fillStyle = hairGrad;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(132, 175);
    ctx.bezierCurveTo(96, 265, 108, 370, 130, 442);
    ctx.quadraticCurveTo(256, 468, 382, 442);
    ctx.bezierCurveTo(404, 370, 416, 265, 380, 175);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(192, 370);
  ctx.bezierCurveTo(156, 425, 142, 505, 148, 558);
  ctx.quadraticCurveTo(256, 582, 364, 558);
  ctx.bezierCurveTo(370, 505, 356, 425, 320, 370);
  ctx.closePath();
  ctx.fillStyle = id === 'crawler' ? '#1e2430' : (id === 'drafter' ? '#10b981' : '#faf6ee');
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 11;
  ctx.stroke();

  if (id === 'auditor') {
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(156, 440, 200, 32);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(156, 440, 200, 6);
    ctx.fillRect(156, 466, 200, 6);
  }

  const drawArm = (isRight) => {
    ctx.save();
    ctx.translate(isRight ? 332 : 180, 408);
    let angle = isRight ? -0.25 : 0.25;
    if (status === 'WORKING') angle = (isRight ? -0.85 : 0.85) + Math.sin(armWave * 2.5) * 0.28;
    else if (status === 'DONE' || isMoshing) angle = (isRight ? -2.35 : 2.35) + Math.sin(armWave * 1.8) * 0.35;
    else if (isHandshaking && isRight) angle = -1.25 + Math.sin(armWave * 2) * 0.22;
    else if (isChatting && isRight) angle = -0.75 + Math.sin(armWave * 1.5) * 0.3;
    ctx.rotate(angle);
    createRoundRectPath(ctx, -18, -10, 36, 74, 18);
    ctx.fillStyle = id === 'crawler' ? '#1e2430' : (id === 'drafter' ? '#10b981' : '#faf6ee');
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.restore();
  };
  drawArm(false);
  drawArm(true);

  ctx.save();
  ctx.translate(256, 246);
  ctx.rotate(headTilt);
  ctx.beginPath();
  ctx.ellipse(0, 0, 128, 108, 0, 0, Math.PI * 2);
  ctx.fillStyle = id === 'crawler' ? '#f5cfb6' : '#fde2cf';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 11;
  ctx.stroke();

  [-52, 52].forEach((ex) => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.ellipse(ex, 4, 27, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#181216';
    ctx.beginPath();
    ctx.ellipse(ex, 6, 18, 21, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex - 6, -3, 7, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(-10, 45, 10, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(10, 45, 10, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();

  ctx.fillStyle = id === 'crawler' ? '#1f1b1e' : (id === 'drafter' ? '#3b2319' : '#f4e3b2');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(-124, -14);
  ctx.bezierCurveTo(-132, -118, 132, -118, 124, -14);
  ctx.quadraticCurveTo(0, -48, -124, -14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  if (status === 'WORKING' || status === 'DONE') {
    createRoundRectPath(ctx, 166, 28, 180, 44, 22);
    ctx.fillStyle = status === 'WORKING' ? '#0284c7' : '#059669';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 21px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(status === 'WORKING' ? '⚡ WORKING' : '✨ DONE!', 256, 51);
  }
  ctx.restore();
}

function createCartoonPaperAgent(config) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  drawCultOfTheLambAgent(ctx, config.id, { status: 'IDLE' });
  texture.needsUpdate = true;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.75, 2.18),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide })
  );
  mesh.position.set(0, 1.09, 0);
  mesh.userData.agentId = config.id;

  const root = new THREE.Group();
  root.position.set(config.x, 0.12, config.z);
  root.userData.agentId = config.id;
  root.add(mesh);

  scene.add(root);
  clickableObjects.push(root);

  cartoonAgents[config.id] = {
    id: config.id, root, mesh, canvas, ctx, texture,
    basePos: new THREE.Vector3(config.x, 0.12, config.z),
    phase: Math.random() * Math.PI * 2, workStartTime: 0, lastStatus: 'IDLE', facingDir: 1, lastRedrawTime: 0
  };
}

function buildAllCartoonCharacters() {
  createCartoonPaperAgent({ id: 'crawler', x: -8.2, z: -2.3 });
  createCartoonPaperAgent({ id: 'drafter', x: -4.5, z: -3.6 });
  createCartoonPaperAgent({ id: 'auditor', x: -1.9, z: -0.1 });
}

const clock = new THREE.Clock();

function moveCartoonAgentTo(av, targetVec, speed, t) {
  const dx = targetVec.x - av.root.position.x;
  const dz = targetVec.z - av.root.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 0.08) {
    const step = Math.min(dist, speed);
    av.root.position.x += (dx / dist) * step;
    av.root.position.z += (dz / dist) * step;
    if (Math.abs(dx) > 0.01) av.facingDir = dx >= 0 ? 1 : -1;
    av.root.position.y = 0.12 + Math.abs(Math.sin(t * 12)) * 0.11;
    return false;
  }
  return true;
}

function animate3D() {
  requestAnimationFrame(animate3D);
  const t = clock.getElapsedTime();

  if (auroraUniforms && auroraMesh && auroraMesh.visible) {
    auroraUniforms.uTime.value = t;
  }

  if (isCameraTransitioning) {
    camera.position.lerp(targetCamPos, 0.06);
    controls.target.lerp(targetLookAt, 0.06);
    if (camera.position.distanceTo(targetCamPos) < 0.05) isCameraTransitioning = false;
  }

  Object.keys(cartoonAgents).forEach((id) => {
    const av = cartoonAgents[id];
    const status = (AGENT_META[id].status || 'IDLE').toUpperCase();
    const p = t + av.phase;
    av.root.rotation.y = Math.atan2(camera.position.x - av.root.position.x, camera.position.z - av.root.position.z);

    let animState = {
      status, walkPhase: 0, armWave: p * 2.5, headTilt: Math.sin(p * 1.6) * 0.04,
      isMoshing: isMoshPitActive, isChatting: false, isHandshaking: false, facingDir: av.facingDir
    };

    if (status === 'WORKING') {
      moveCartoonAgentTo(av, av.basePos, 0.05, t);
      av.root.position.y = 0.12 + Math.abs(Math.sin(p * 8)) * 0.04;
      animState.armWave = p * 6;
    } else if (status === 'DONE' || isMoshPitActive) {
      moveCartoonAgentTo(av, av.basePos, 0.05, t);
      av.root.position.y = 0.12 + Math.abs(Math.sin(p * 6.5)) * 0.22;
      animState.armWave = p * 6;
      animState.headTilt = Math.sin(p * 10) * 0.16;
    } else {
      moveCartoonAgentTo(av, av.basePos, 0.035, t);
      const breathe = Math.sin(p * 2.4);
      av.mesh.scale.set(1 - breathe * 0.025, 1 + breathe * 0.03, 1);
    }

    if (t - av.lastRedrawTime > 0.05) {
      av.lastRedrawTime = t;
      drawCultOfTheLambAgent(av.ctx, av.id, animState);
      av.texture.needsUpdate = true;
    }
  });

  koiFishes.forEach((f, idx) => {
    const ang = t * f.speed + f.angle;
    const nextAng = ang + (f.speed > 0 ? 0.05 : -0.05);
    f.mesh.position.set(f.centerX + Math.cos(ang) * f.orbitRadius, 0.10, f.centerZ + Math.sin(ang) * (f.orbitRadius * 0.85));
    f.mesh.lookAt(f.centerX + Math.cos(nextAng) * f.orbitRadius, 0.10, f.centerZ + Math.sin(nextAng) * (f.orbitRadius * 0.85));
    f.tail.rotation.y = Math.sin(t * 10 + idx) * 0.35;
  });

  streamFishes.forEach((sf, idx) => {
    sf.mesh.position.z += sf.speed * 0.018;
    if (sf.mesh.position.z > 13.0) sf.mesh.position.z = -12.0;
    if (sf.mesh.position.z < -12.0) sf.mesh.position.z = 13.0;
    const swayX = sf.baseX + Math.sin(t * 1.8 + sf.phase) * 0.18;
    sf.mesh.position.x = swayX;
    sf.mesh.lookAt(swayX, sf.mesh.position.y, sf.mesh.position.z + (sf.speed > 0 ? 0.2 : -0.2));
    sf.tail.rotation.y = Math.sin(t * 11 + idx) * 0.38;
  });

  streamRipples.forEach((sr) => {
    sr.mesh.position.z += sr.speed * 0.022;
    if (sr.mesh.position.z > 13.5) sr.mesh.position.z = -12.5;
  });

  rabbits.forEach((r, idx) => {
    const ang = t * r.speed + r.angle;
    const hop = Math.abs(Math.sin(t * 4.5 + idx * 1.7)) * 0.16;
    r.mesh.position.set(r.centerX + Math.cos(ang) * r.radius, hop, r.centerZ + Math.sin(ang) * r.radius);
  });

  cats.forEach((c, idx) => {
    const ang = t * c.speed + c.angle;
    c.group.position.set(c.centerX + Math.cos(ang) * c.radius, c.baseY, c.centerZ + Math.sin(ang) * c.radius);
    c.tailPivot.rotation.z = Math.sin(t * 3.5 + idx) * 0.35;
  });

  if (rainParticles && rainParticles.visible) {
    const pos = rainParticles.geometry.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i + 1] -= 0.38;
      if (pos[i + 1] < 0) pos[i + 1] = 14;
    }
    rainParticles.geometry.attributes.position.needsUpdate = true;
  }

  if (snowParticles && snowParticles.visible) {
    const pos = snowParticles.geometry.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i + 1] -= 0.045;
      if (pos[i + 1] < 0) pos[i + 1] = 14;
    }
    snowParticles.geometry.attributes.position.needsUpdate = true;
  }

  controls.update();
  renderer.render(scene, camera);
}

function toggleSeasonMode() {
  seasonModeIndex = (seasonModeIndex + 1) % 3;
  const btn = document.getElementById('btnSeason');
  const icon = document.getElementById('seasonIcon');
  const text = document.getElementById('seasonText');

  if (seasonModeIndex === 0) {
    rainParticles.visible = false; snowParticles.visible = false;
    grassFloorMesh.material.map = summerGrassTex; grassFloorMesh.material.needsUpdate = true;
    treeFoliageMeshes.forEach(item => item.mesh.material.color.copy(item.summerColor));
    btn.className = 'px-3 py-1.5 rounded-xl bg-lime-50 hover:bg-lime-100 text-lime-800 border border-lime-300 text-xs font-bold transition flex items-center gap-1.5';
    icon.textContent = '🌤️'; text.textContent = 'Musim Panas';
  } else if (seasonModeIndex === 1) {
    rainParticles.visible = true; snowParticles.visible = false;
    grassFloorMesh.material.map = summerGrassTex; grassFloorMesh.material.needsUpdate = true;
    btn.className = 'px-3 py-1.5 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-900 border border-sky-300 text-xs font-bold transition flex items-center gap-1.5';
    icon.textContent = '🌧️'; text.textContent = 'Musim Hujan';
  } else {
    rainParticles.visible = false; snowParticles.visible = true;
    grassFloorMesh.material.map = winterSnowTex; grassFloorMesh.material.needsUpdate = true;
    treeFoliageMeshes.forEach(item => item.mesh.material.color.setHex(0xf1f5f9));
    btn.className = 'px-3 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border border-cyan-300 text-xs font-bold transition flex items-center gap-1.5';
    icon.textContent = '❄️'; text.textContent = 'Musim Salju';
  }
  applyCurrentSkyAndLighting();
}

function toggleLightingMode() {
  lightingModeIndex = (lightingModeIndex + 1) % 3;
  const btn = document.getElementById('btnLighting');
  const btnIcon = document.getElementById('lightingIcon');
  const btnText = document.getElementById('lightingText');

  if (lightingModeIndex === 0) {
    btn.className = 'px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition flex items-center gap-1.5';
    btnIcon.textContent = '☀️'; btnText.textContent = 'Pagi Cerah';
  } else if (lightingModeIndex === 1) {
    btn.className = 'px-3 py-1.5 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-900 border border-orange-300 text-xs font-bold transition flex items-center gap-1.5';
    btnIcon.textContent = '🌇'; btnText.textContent = 'Golden Hour Sore';
  } else {
    btn.className = 'px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-600/60 text-xs font-bold transition flex items-center gap-1.5';
    btnIcon.textContent = '🌌'; btnText.textContent = 'Malam Aurora';
    addLog('🌌 Langit Malam Kutub Utara aktif! Cahaya Aurora Borealis menari di atas jembatan Jepang.', 'success');
  }
  applyCurrentSkyAndLighting();
}

function applyCurrentSkyAndLighting() {
  const isNight = lightingModeIndex === 2;
  if (auroraMesh) auroraMesh.visible = isNight;
  if (nightStars) nightStars.visible = isNight;

  if (lightingModeIndex === 0) {
    scene.background = new THREE.Color(0xe6f2e8);
    scene.fog.color = new THREE.Color(0xe6f2e8);
    ambientLight.color.setHex(0xfffaf0); ambientLight.intensity = 0.85;
    sunLight.color.setHex(0xfff5e4); sunLight.intensity = 0.98;
    warmLampLight.intensity = 0.45;
    if (expansionLampLight) expansionLampLight.intensity = 0.45;
  } else if (lightingModeIndex === 1) {
    scene.background = new THREE.Color(0xfde8d0);
    scene.fog.color = new THREE.Color(0xfde8d0);
    ambientLight.color.setHex(0xfff0db); ambientLight.intensity = 0.72;
    sunLight.color.setHex(0xffb36b); sunLight.intensity = 1.05;
    warmLampLight.intensity = 0.95;
    if (expansionLampLight) expansionLampLight.intensity = 0.95;
  } else {
    scene.background = new THREE.Color(0x060d1f);
    scene.fog.color = new THREE.Color(0x060d1f);
    ambientLight.color.setHex(0x2dd4bf); ambientLight.intensity = 0.48;
    sunLight.color.setHex(0x34d399); sunLight.intensity = 0.42;
    warmLampLight.intensity = 1.65;
    if (expansionLampLight) expansionLampLight.intensity = 1.65;
  }
}

function focusCamera(mode) {
  document.querySelectorAll('.cam-btn').forEach(btn => {
    btn.className = 'cam-btn px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-slate-600 border border-stone-200 hover:bg-stone-100 transition';
  });
  const activeBtn = document.getElementById(`cam-${mode}`);
  if (activeBtn) activeBtn.className = 'cam-btn px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-900 text-white transition';

  if (mode === 'overview') {
    targetCamPos.set(4.5, 11.8, 17.8); targetLookAt.set(1.5, 0.8, -0.5); closeAgentOverlay();
  } else if (mode === 'bridge') {
    targetCamPos.set(3.2, 4.2, 6.2); targetLookAt.set(3.15, 0.5, -1.6); closeAgentOverlay();
  } else if (mode === 'expansion') {
    targetCamPos.set(11.4, 6.5, 7.8); targetLookAt.set(11.4, 1.0, -2.5); closeAgentOverlay();
  } else if (AGENT_META[mode]) {
    const meta = AGENT_META[mode];
    targetCamPos.set(meta.camPos.x, meta.camPos.y, meta.camPos.z);
    targetLookAt.set(meta.targetPos.x, meta.targetPos.y, meta.targetPos.z);
    selectAgentCard(mode);
  }
  isCameraTransitioning = true;
}

function selectAgentCard(agentId) {
  const meta = AGENT_META[agentId];
  if (!meta) return;
  document.getElementById('selectedAgentOverlay').classList.remove('hidden');
  document.getElementById('selRoleBadge').textContent = `${meta.role} • ${meta.status}`;
  document.getElementById('selAgentName').textContent = meta.name;
  document.getElementById('selAgentDesc').textContent = meta.desc;
  document.getElementById('selAgentStatusMsg').textContent = meta.pesan;
}

function closeAgentOverlay() {
  document.getElementById('selectedAgentOverlay').classList.add('hidden');
}