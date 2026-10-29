import * as THREE from 'three';

// Expose THREE globally so the inspector hook can bind immediately
(window as any).THREE = THREE;

const container = document.getElementById('canvas-container')!;

// -------------------------------------------------------------
// Procedural Canvas Texture Generators
// (Generates crisp, high-signal textures with full mipmaps for inspection)
// -------------------------------------------------------------
function createCheckerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const tileSize = 64;
  for (let x = 0; x < canvas.width; x += tileSize) {
    for (let y = 0; y < canvas.height; y += tileSize) {
      const isEven = (x / tileSize + y / tileSize) % 2 === 0;
      ctx.fillStyle = isEven ? '#1e293b' : '#0f172a';
      ctx.fillRect(x, y, tileSize, tileSize);
    }
  }

  // Neon grid lines
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  for (let x = 0; x <= canvas.width; x += tileSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += tileSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'Cyber Grid Checker';
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

function createNormalPatternTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Neutral normal map base: RGB (128, 128, 255)
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Beveled tiles
  const size = 32;
  for (let x = 0; x < canvas.width; x += size) {
    for (let y = 0; y < canvas.height; y += size) {
      // Left edge normal (+X tilt)
      ctx.fillStyle = '#b080ff';
      ctx.fillRect(x, y, 4, size);
      // Top edge normal (+Y tilt)
      ctx.fillStyle = '#80b0ff';
      ctx.fillRect(x, y, size, 4);
      // Right edge normal (-X tilt)
      ctx.fillStyle = '#5080ff';
      ctx.fillRect(x + size - 4, y, 4, size);
      // Bottom edge normal (-Y tilt)
      ctx.fillStyle = '#8050ff';
      ctx.fillRect(x, y + size - 4, size, 4);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'Tile Bevel Normal Map';
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

function createRuneTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#050814';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Glowing concentric cyber-rings
  const center = 256;
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(center, center, 180, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(center, center, 140, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(center, center, 90, 0, Math.PI * 2);
  ctx.stroke();

  // Cross lines
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(center - 200, center);
  ctx.lineTo(center + 200, center);
  ctx.moveTo(center, center - 200);
  ctx.lineTo(center, center + 200);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'Arcane Rune Glyph';
  return texture;
}

function createNoiseRoughnessTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const imgData = ctx.createImageData(256, 256);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const val = Math.floor(Math.random() * 255);
    imgData.data[i] = val;
    imgData.data[i + 1] = val;
    imgData.data[i + 2] = val;
    imgData.data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'Brushed Noise Roughness';
  return texture;
}

// -------------------------------------------------------------
// Scene, Camera, Renderer Setup
// -------------------------------------------------------------
const scene = new THREE.Scene();
scene.name = 'Cyberpunk Laboratory';
scene.background = new THREE.Color(0x0a0f1d);
scene.fog = new THREE.FogExp2(0x0a0f1d, 0.025);
(window as any).scene = scene;

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.name = 'Director Camera';
camera.position.set(0, 6, 14);
camera.lookAt(0, 2, 0);

const secondaryCam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
secondaryCam.name = 'Security Monitor Cam';
secondaryCam.position.set(-8, 9, 8);
secondaryCam.lookAt(0, 2, 0);
scene.add(secondaryCam);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
container.appendChild(renderer.domElement);
(window as any).renderer = renderer;

// -------------------------------------------------------------
// Lights Collection (Spot, Point, Directional, Ambient)
// -------------------------------------------------------------
const lightsGroup = new THREE.Group();
lightsGroup.name = 'Lighting Rig';
scene.add(lightsGroup);

const ambientLight = new THREE.AmbientLight(0x0f172a, 1.5);
ambientLight.name = 'Deep Ambient';
lightsGroup.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
sunLight.name = 'Main Key Sunlight';
sunLight.position.set(8, 16, 10);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 40;
sunLight.shadow.camera.left = -15;
sunLight.shadow.camera.right = 15;
sunLight.shadow.camera.top = 15;
sunLight.shadow.camera.bottom = -15;
lightsGroup.add(sunLight);

const blueSpotLight = new THREE.SpotLight(0x38bdf8, 15, 25, Math.PI / 4, 0.5, 1.2);
blueSpotLight.name = 'Holodeck Blue Spotlight';
blueSpotLight.position.set(-6, 12, 0);
blueSpotLight.castShadow = true;
lightsGroup.add(blueSpotLight);

const redPointLight = new THREE.PointLight(0xf43f5e, 10, 15, 1.5);
redPointLight.name = 'Core Chamber Red Light';
redPointLight.position.set(5, 4, -4);
lightsGroup.add(redPointLight);

// -------------------------------------------------------------
// Textured Ground Floor
// -------------------------------------------------------------
const gridTex = createCheckerTexture();
const normalTex = createNormalPatternTexture();
const groundGeo = new THREE.PlaneGeometry(50, 50, 32, 32);
groundGeo.name = 'Floor Plane 50x50';
const groundMat = new THREE.MeshStandardMaterial({
  map: gridTex,
  normalMap: normalTex,
  roughness: 0.6,
  metalness: 0.4
});
groundMat.name = 'Grid Floor Material';
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.name = 'Hangar Floor';
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// -------------------------------------------------------------
// Interactive Textured Objects (PBR Materials + Textures)
// -------------------------------------------------------------
const texturedGroup = new THREE.Group();
texturedGroup.name = 'Textured Artifacts Group';
scene.add(texturedGroup);

// TextureLoader for external image file (cyber-panel.png)
const textureLoader = new THREE.TextureLoader();
const cyberImageTex = textureLoader.load('/textures/cyber-panel.png');
cyberImageTex.name = 'Cyber Panel Image (PNG)';
cyberImageTex.colorSpace = THREE.SRGBColorSpace;

const billboardGeo = new THREE.PlaneGeometry(3.5, 3.5);
billboardGeo.name = 'Holo Display Plane';
const billboardMat = new THREE.MeshStandardMaterial({
  map: cyberImageTex,
  roughness: 0.2,
  metalness: 0.5,
  side: THREE.DoubleSide
});
billboardMat.name = 'Holo Display Material';
const billboard = new THREE.Mesh(billboardGeo, billboardMat);
billboard.name = 'Cyber Hologram Screen';
billboard.position.set(-6, 3, 2);
billboard.rotation.y = Math.PI / 4;
billboard.castShadow = true;
texturedGroup.add(billboard);

// Rune Monolith
const runeTex = createRuneTexture();
const roughnessTex = createNoiseRoughnessTexture();
const monolithGeo = new THREE.BoxGeometry(2, 4, 0.6);
monolithGeo.name = 'Monolith Box Geometry';
const monolithMat = new THREE.MeshStandardMaterial({
  map: runeTex,
  roughnessMap: roughnessTex,
  roughness: 0.3,
  metalness: 0.8,
  emissive: new THREE.Color(0x38bdf8),
  emissiveIntensity: 0.2
});
monolithMat.name = 'Arcane Rune Slate Material';
const monolith = new THREE.Mesh(monolithGeo, monolithMat);
monolith.name = 'Arcane Monolith';
monolith.position.set(-5, 2, -2);
monolith.castShadow = true;
monolith.receiveShadow = true;
texturedGroup.add(monolith);

// Metal Specular Torus Knot
const knotGeo = new THREE.TorusKnotGeometry(1.4, 0.4, 128, 32);
knotGeo.name = 'Torus Knot HighPoly';
const knotMat = new THREE.MeshPhysicalMaterial({
  color: 0xec4899,
  roughness: 0.15,
  metalness: 0.9,
  clearcoat: 1.0,
  clearcoatRoughness: 0.1,
  emissive: 0x831843,
  emissiveIntensity: 0.4
});
knotMat.name = 'Chrome Pink Metal';
const knot = new THREE.Mesh(knotGeo, knotMat);
knot.name = 'Hero Chrome Knot';
knot.position.set(0, 3, 0);
knot.castShadow = true;
texturedGroup.add(knot);

// Glass Orb
const orbGeo = new THREE.SphereGeometry(1.2, 48, 48);
orbGeo.name = 'Glass Sphere Geometry';
const orbMat = new THREE.MeshPhysicalMaterial({
  color: 0x38bdf8,
  transmission: 0.9,
  opacity: 1,
  transparent: true,
  roughness: 0.05,
  ior: 1.5,
  thickness: 1.5
});
orbMat.name = 'Cryo Glass Material';
const glassOrb = new THREE.Mesh(orbGeo, orbMat);
glassOrb.name = 'Cryo Containment Orb';
glassOrb.position.set(5, 2.5, 2);
glassOrb.castShadow = true;
texturedGroup.add(glassOrb);

// Custom GLSL Shader Material Sphere (for Shader inspection & live edit)
const customShaderGeo = new THREE.IcosahedronGeometry(1.1, 12);
customShaderGeo.name = 'Plasma Icosahedron';
const customShaderMat = new THREE.ShaderMaterial({
  name: 'Plasma Shield Shader',
  uniforms: {
    uTime: { value: 0 },
    uColorA: { value: new THREE.Color(0x38bdf8) },
    uColorB: { value: new THREE.Color(0xa855f7) }
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    varying vec2 vUv;
    varying vec3 vNormal;
    void main() {
      float pulse = sin(vUv.x * 12.0 + uTime * 3.0) * 0.5 + 0.5;
      float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.5);
      vec3 color = mix(uColorA, uColorB, pulse) + fresnel * 0.8;
      gl_FragColor = vec4(color, 0.9);
    }
  `,
  transparent: true
});
const shaderMesh = new THREE.Mesh(customShaderGeo, customShaderMat);
shaderMesh.name = 'Plasma Energy Orb';
shaderMesh.position.set(-2, 4.5, -4);
scene.add(shaderMesh);

// -------------------------------------------------------------
// Animated Hierarchy with THREE.AnimationMixer
// (Mixers, Multiple Clips, Play/Pause/Speed/Seek testable)
// -------------------------------------------------------------
const robotGroup = new THREE.Group();
robotGroup.name = 'Animated Drone Sentry';
robotGroup.position.set(0, 0, 4);
scene.add(robotGroup);

// Drone Chassis
const droneBodyGeo = new THREE.CylinderGeometry(0.8, 1.1, 0.8, 16);
droneBodyGeo.name = 'Drone Chassis Geometry';
const droneMat = new THREE.MeshStandardMaterial({
  color: 0x334155,
  metalness: 0.85,
  roughness: 0.2
});
droneMat.name = 'Gunmetal Alloy';
const droneBody = new THREE.Mesh(droneBodyGeo, droneMat);
droneBody.name = 'Drone Body';
droneBody.position.y = 1.5;
droneBody.castShadow = true;
robotGroup.add(droneBody);

// Drone Eye Sensor
const eyeGeo = new THREE.SphereGeometry(0.35, 24, 24);
eyeGeo.name = 'Sensor Lens Geometry';
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
eyeMat.name = 'Cyan Sensor Glow';
const droneEye = new THREE.Mesh(eyeGeo, eyeMat);
droneEye.name = 'Sensor Optic';
droneEye.position.set(0, 1.6, 0.9);
robotGroup.add(droneEye);

// Hover Wings / Satellite Rings
const ringGeo = new THREE.TorusGeometry(1.8, 0.08, 16, 64);
ringGeo.name = 'Stabilizer Ring Geometry';
const ringMat = new THREE.MeshStandardMaterial({
  color: 0xf59e0b,
  roughness: 0.1,
  metalness: 0.9
});
ringMat.name = 'Gold Ring Alloy';
const droneRing = new THREE.Mesh(ringGeo, ringMat);
droneRing.name = 'Stabilizer Ring';
droneRing.position.y = 1.5;
droneRing.rotation.x = Math.PI / 2;
robotGroup.add(droneRing);

// Build AnimationClips
// Clip 1: "Hover Bobbing" (Drone floats smoothly up and down)
const bobbingTimes = [0, 1, 2, 3];
const bobbingValues = [
  0, 0, 4,
  0, 0.6, 4,
  0, -0.2, 4,
  0, 0, 4
];
const bobbingTrack = new THREE.VectorKeyframeTrack('Animated Drone Sentry.position', bobbingTimes, bobbingValues);
const hoverClip = new THREE.AnimationClip('Hover Bobbing', 3, [bobbingTrack]);

// Clip 2: "Rotor Spin" (Rotates stabilizer ring 360 degrees)
const q0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);
const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * 2);
const spinTimes = [0, 1, 2];
const spinValues = [
  q0.x, q0.y, q0.z, q0.w,
  q1.x, q1.y, q1.z, q1.w,
  q2.x, q2.y, q2.z, q2.w
];
const spinTrack = new THREE.QuaternionKeyframeTrack('Stabilizer Ring.quaternion', spinTimes, spinValues);
const spinClip = new THREE.AnimationClip('Rotor Spin', 2, [spinTrack]);

// Attach clips to root and setup AnimationMixer
robotGroup.animations = [hoverClip, spinClip];

const mixer = new THREE.AnimationMixer(robotGroup);
(robotGroup as any).mixer = mixer;
(window as any).mixer = mixer;

// Start both actions so the animation section displays active playback
const hoverAction = mixer.clipAction(hoverClip);
hoverAction.play();

const spinAction = mixer.clipAction(spinClip);
spinAction.play();

// Second standalone animated prop: Orbiting Crystal
const crystalGeo = new THREE.OctahedronGeometry(0.8, 0);
crystalGeo.name = 'Raw Energy Crystal Geo';
const crystalMat = new THREE.MeshStandardMaterial({
  color: 0x10b981,
  roughness: 0.1,
  metalness: 0.8,
  emissive: 0x059669,
  emissiveIntensity: 0.5
});
crystalMat.name = 'Emerald Crystal Material';
const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
crystalMesh.name = 'Hovering Emerald Crystal';
crystalMesh.position.set(4, 2, -2);
crystalMesh.castShadow = true;
scene.add(crystalMesh);

const crystalTimes = [0, 1.5, 3];
const crystalPosValues = [
  4, 2, -2,
  4, 3.2, -2,
  4, 2, -2
];
const crystalTrack = new THREE.VectorKeyframeTrack('Hovering Emerald Crystal.position', crystalTimes, crystalPosValues);
const pulseClip = new THREE.AnimationClip('Crystal Float', 3, [crystalTrack]);
crystalMesh.animations = [pulseClip];

const crystalMixer = new THREE.AnimationMixer(crystalMesh);
(crystalMesh as any).mixer = crystalMixer;
(window as any).mixers = [mixer, crystalMixer];

const crystalAction = crystalMixer.clipAction(pulseClip);
crystalAction.play();

// -------------------------------------------------------------
// Window Resize Handling
// -------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// -------------------------------------------------------------
// Main Render Loop
// -------------------------------------------------------------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // Update AnimationMixers
  mixer.update(delta);
  crystalMixer.update(delta);

  // Update procedural uniforms
  customShaderMat.uniforms.uTime.value = elapsed;

  // Gentle rotations on props
  knot.rotation.x = elapsed * 0.4;
  knot.rotation.y = elapsed * 0.6;
  monolith.rotation.y = Math.sin(elapsed * 0.3) * 0.15;
  crystalMesh.rotation.y = elapsed * 0.8;
  crystalMesh.rotation.z = elapsed * 0.3;

  // Orbit Point Light
  redPointLight.position.x = Math.sin(elapsed * 1.5) * 6;
  redPointLight.position.z = Math.cos(elapsed * 1.5) * 6;

  renderer.render(scene, camera);
}

animate();
