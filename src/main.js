// Demo viewer for gsplat-grounding.
// Drop a .spz onto the window. The lib samples the splat, builds a floor
// heightmap, and a stand-in capsule character walks back and forth, feet
// snapped to the heightmap each frame.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import {
  sampleSplatCenters,
  buildSplatFloorHM,
  groundCharacter,
  buildFloorCarpet,
} from './splat-grounding.js';

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

const wrap = document.getElementById('canvas-wrap');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(wrap.clientWidth, wrap.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0e11);
const camera = new THREE.PerspectiveCamera(50, wrap.clientWidth / wrap.clientHeight, 0.05, 200);
camera.up.set(0, 0, 1);
camera.position.set(0, -5, 2);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.4;
orbit.screenSpacePanning = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffe8c8, 1.0);
sun.position.set(2, 2, 4);
scene.add(sun);

// Stand-in walker: a capsule. groundCharacter snaps any Object3D's lowest
// vertex to the heightmap — no rig required for the demo.
const walker = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.25, 1.2, 8, 16),
  new THREE.MeshStandardMaterial({ color: 0xe8a84d, roughness: 0.7 }),
);
body.position.z = 0.85;
body.rotation.x = Math.PI / 2;   // capsule's long axis runs along its local Y; rotate to Z-up
walker.add(body);
walker.visible = false;
scene.add(walker);

let splatViewer = null;
let splatRoot = null;
let floorHM = null;
let floorCarpet = null;
let pathT = 0;

const status = document.getElementById('status');
const dropEl = document.getElementById('drop');

async function loadSplat(url) {
  status.textContent = 'loading splat…';
  if (splatViewer) {
    if (splatRoot) scene.remove(splatRoot);
    if (floorCarpet) { scene.remove(floorCarpet); floorCarpet.geometry.dispose(); floorCarpet = null; }
    splatViewer = null;
  }
  splatViewer = new GaussianSplats3D.Viewer({
    threeScene: scene,
    renderer, camera,
    selfDrivenMode: false,
    useBuiltInControls: false,
    gpuAcceleratedSort: false,
    sharedMemoryForWorkers: false,
    dynamicScene: false,
  });
  await splatViewer.addSplatScene(url, { showLoadingUI: false, progressiveLoad: false });

  // Wrap splat in a Y-down→Z-up rotation group (Marble convention; flip the
  // sign or omit if your splat ships in a different up axis).
  splatRoot = new THREE.Group();
  splatRoot.name = 'splat-root';
  splatRoot.rotation.x = -Math.PI / 2;
  splatRoot.add(splatViewer.splatMesh);
  scene.add(splatRoot);
  scene.updateMatrixWorld(true);

  const samples = sampleSplatCenters(splatViewer.splatMesh, 30000);
  floorHM = buildSplatFloorHM(samples);

  const cX = floorHM.xMin + floorHM.nx * floorHM.cellX / 2;
  const cY = floorHM.yMin + floorHM.ny * floorHM.cellY / 2;
  walker.position.set(cX, cY, 0);
  walker.visible = true;

  camera.position.set(cX, cY - 4, 1.7);
  orbit.target.set(cX, cY, 0.8);
  orbit.update();

  status.textContent = `loaded ${splatViewer.splatMesh.getSplatCount()} splats — heightmap ${floorHM.nx}×${floorHM.ny}`;
}

document.getElementById('toggleCarpet').addEventListener('click', () => {
  if (!floorHM) return;
  if (floorCarpet) {
    scene.remove(floorCarpet);
    floorCarpet.geometry.dispose();
    floorCarpet = null;
  } else {
    floorCarpet = buildFloorCarpet(floorHM);
    scene.add(floorCarpet);
  }
});

window.addEventListener('dragover', e => { e.preventDefault(); dropEl.classList.add('active'); });
window.addEventListener('dragleave', () => dropEl.classList.remove('active'));
window.addEventListener('drop', e => {
  e.preventDefault();
  dropEl.classList.remove('active');
  const file = e.dataTransfer.files?.[0];
  if (!file) return;
  if (!/\.(spz|ply|splat|ksplat)$/i.test(file.name)) {
    status.textContent = 'unsupported file (need .spz, .ply, .splat, or .ksplat)';
    return;
  }
  const url = URL.createObjectURL(file);
  loadSplat(url).catch(err => {
    console.error(err);
    status.textContent = 'load failed: ' + err.message;
  });
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (floorHM && walker.visible) {
    // Walk the capsule back-and-forth along Y so foot grounding is visible.
    pathT += dt * 0.5;
    const cY = floorHM.yMin + floorHM.ny * floorHM.cellY / 2;
    const radius = floorHM.cellY * floorHM.ny * 0.3;
    walker.position.y = cY + Math.sin(pathT) * radius;
    groundCharacter(walker, floorHM);
  }
  if (splatViewer && splatViewer.splatRenderReady) {
    splatViewer.camera = camera;
    splatViewer.update();
    if (splatViewer.splatMesh) splatViewer.splatMesh.geometry.setDrawRange(0, 6);
  }
  orbit.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = wrap.clientWidth / wrap.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(wrap.clientWidth, wrap.clientHeight);
});
