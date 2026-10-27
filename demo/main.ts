import * as THREE from 'three';

// Expose THREE globally so the inspector hook can immediately bind
(window as any).THREE = THREE;

const container = document.getElementById('canvas-container')!;

// Scene
const scene = new THREE.Scene();
scene.name = 'Main Game Scene';
(window as any).scene = scene;

// Camera
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.name = 'Main Camera';
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);
(window as any).renderer = renderer;

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
ambientLight.name = 'Ambient Light';
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.name = 'Sun Light';
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
scene.add(dirLight);

const pointLight = new THREE.PointLight(0x38bdf8, 2, 10);
pointLight.name = 'Blue Core Light';
pointLight.position.set(-2, 3, 2);
scene.add(pointLight);

// Ground Plane
const groundGeo = new THREE.PlaneGeometry(30, 30);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x1e293b,
  roughness: 0.8,
  metalness: 0.2
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.name = 'Ground Plane';
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Nested Group: Hero Character / Prop
const heroGroup = new THREE.Group();
heroGroup.name = 'Hero Group';
heroGroup.position.set(0, 1, 0);
scene.add(heroGroup);

// Torus Knot
const torusGeo = new THREE.TorusKnotGeometry(1.2, 0.35, 128, 32);
const torusMat = new THREE.MeshStandardMaterial({
  color: 0xec4899,
  roughness: 0.3,
  metalness: 0.7
});
const torusKnot = new THREE.Mesh(torusGeo, torusMat);
torusKnot.name = 'Floating Crystal Knot';
torusKnot.position.set(0, 1.5, 0);
torusKnot.castShadow = true;
heroGroup.add(torusKnot);

// Surrounding floating cubes
const cubeGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
const cubeMat = new THREE.MeshStandardMaterial({
  color: 0x10b981,
  roughness: 0.2,
  metalness: 0.5
});

for (let i = 0; i < 4; i++) {
  const angle = (i / 4) * Math.PI * 2;
  const cube = new THREE.Mesh(cubeGeo, cubeMat.clone());
  cube.name = `Orbit Cube ${i + 1}`;
  cube.position.set(Math.cos(angle) * 3.5, 0.8, Math.sin(angle) * 3.5);
  cube.castShadow = true;
  heroGroup.add(cube);
}

// Window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
let clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();

  torusKnot.rotation.x = elapsed * 0.5;
  torusKnot.rotation.y = elapsed * 0.7;

  heroGroup.rotation.y = elapsed * 0.2;

  renderer.render(scene, camera);
}

animate();
