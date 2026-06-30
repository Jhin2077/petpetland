import * as THREE from "./assets/vendor/three/three.module.js?v=20260630d";
import { GLTFLoader } from "./assets/vendor/three/GLTFLoader.js?v=20260630d";

const stage = document.querySelector("#threeStage");
const mealStage = document.querySelector(".meal-stage");
const processStage = document.querySelector("#processThreeStage");
const processVisual = document.querySelector(".process-visual");

let renderer;
let scene;
let camera;
let root;
let processRenderer;
let processScene;
let processCamera;
let processRoot;
let initialized = false;
let visible = false;
let frameId = 0;
let activeScene = document.documentElement.dataset.petScene || "play";

const loader = new GLTFLoader();
const slideGroups = {};
const floatingProps = [];
const processFloatingProps = [];

const palette = {
  ink: 0x1b1028,
  purple: 0x7026c9,
  purpleLight: 0xa979ee,
  red: 0xff2c21,
  orange: 0xff8f3d,
  yellow: 0xffd23f,
  cream: 0xfff3cf,
  green: 0x3cff53,
  mint: 0x7dffbf,
  pink: 0xff8ecf,
  white: 0xfffaf0,
  cyan: 0x55d7ff
};

function mat(color) {
  return new THREE.MeshToonMaterial({ color });
}

function edgeMat() {
  return new THREE.LineBasicMaterial({
    color: palette.ink,
    opacity: 0.45,
    transparent: true
  });
}

function prepareModel(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;

    const materials = Array.isArray(child.material) ? child.material : [child.material].filter(Boolean);
    materials.forEach((material) => {
      material.roughness = 0.86;
      material.metalness = 0;
      if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
      material.needsUpdate = true;
    });
  });
  return object;
}

function addSoftEdges(object, threshold = 44) {
  object.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const edges = new THREE.EdgesGeometry(child.geometry, threshold);
    child.add(new THREE.LineSegments(edges, edgeMat()));
  });
  return object;
}

function setObject(object, { position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }) {
  object.position.set(...position);
  object.rotation.set(...rotation);
  if (Array.isArray(scale)) object.scale.set(...scale);
  else object.scale.setScalar(scale);
  return object;
}

function roundedBox(width, height, depth, color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth, 1, 1, 1), mat(color));
  addSoftEdges(mesh);
  return mesh;
}

function normalizeToStage(object, targetSize = 1) {
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z) || 1;
  object.scale.multiplyScalar(targetSize / maxDimension);
  object.updateWorldMatrix(true, true);

  const fittedBounds = new THREE.Box3().setFromObject(object);
  const center = fittedBounds.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.y -= fittedBounds.min.y;
  object.position.z -= center.z;
}

async function loadModel(path, options = {}, floaters = floatingProps) {
  const gltf = await loader.loadAsync(path);
  const model = prepareModel(gltf.scene);
  normalizeToStage(model, options.size || 1);

  const wrapper = new THREE.Group();
  wrapper.add(model);
  setObject(wrapper, options);
  wrapper.userData.baseY = wrapper.position.y;
  wrapper.userData.floatPhase = options.floatPhase || 0;
  wrapper.userData.floatAmount = options.floatAmount ?? 0.025;
  floaters.push(wrapper);
  return wrapper;
}

function loadCharacter(file, options, floaters = floatingProps) {
  return loadModel(`assets/models/characters/${file}`, options, floaters);
}

function loadPet(file, options, floaters = floatingProps) {
  return loadModel(`assets/models/pets/${file}`, options, floaters);
}

function loadFood(file, options, floaters = floatingProps) {
  return loadModel(`assets/models/food/kenney/${file}`, options, floaters);
}

function buildPortal() {
  const portal = new THREE.Group();
  const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 72), mat(palette.purple));
  setObject(fill, { scale: [1.08, 1.45, 1] });
  portal.add(fill);

  const points = [];
  for (let i = 0; i < 96; i += 1) {
    const angle = (i / 96) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * 1.08, Math.sin(angle) * 1.45, 0.01));
  }
  portal.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), edgeMat()));
  setObject(portal, { position: [1.32, 1.06, -2.46], rotation: [0.02, 0, 0.02], scale: 2.25 });
  return portal;
}

function buildSparkle(size = 0.3, color = palette.white) {
  const shape = new THREE.Shape();
  shape.moveTo(0, size);
  shape.lineTo(size * 0.22, size * 0.22);
  shape.lineTo(size, 0);
  shape.lineTo(size * 0.22, -size * 0.22);
  shape.lineTo(0, -size);
  shape.lineTo(-size * 0.22, -size * 0.22);
  shape.lineTo(-size, 0);
  shape.lineTo(-size * 0.22, size * 0.22);
  shape.closePath();

  const sparkle = new THREE.Group();
  sparkle.add(new THREE.Mesh(new THREE.ShapeGeometry(shape), mat(color)));
  sparkle.add(new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(shape.getPoints().map((point) => new THREE.Vector3(point.x, point.y, 0.02))),
    edgeMat()
  ));
  return sparkle;
}

function buildPlatform(width, depth, color, position = [0, -0.4, 0]) {
  const base = roundedBox(width, 0.28, depth, color);
  return setObject(base, { position, rotation: [-0.08, 0.02, -0.08] });
}

function buildBall() {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), mat(palette.red));
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 8, 40), mat(palette.white));
  stripe.rotation.x = Math.PI / 2;
  const group = new THREE.Group();
  group.add(ball, stripe);
  setObject(group, { position: [1.55, 0.03, 1.42], rotation: [0.1, 0.2, -0.16], scale: 0.9 });
  addSoftEdges(ball);
  return group;
}

function buildTable() {
  const table = new THREE.Group();
  const top = roundedBox(1.7, 0.18, 1.1, palette.yellow);
  const runner = roundedBox(1.25, 0.08, 0.18, palette.cyan);
  const legA = roundedBox(0.16, 0.7, 0.16, palette.purple);
  const legB = legA.clone();
  const legC = legA.clone();
  const legD = legA.clone();
  setObject(top, { position: [0, 0.72, 0] });
  setObject(runner, { position: [0, 0.86, 0.08] });
  setObject(legA, { position: [-0.65, 0.34, -0.38] });
  setObject(legB, { position: [0.65, 0.34, -0.38] });
  setObject(legC, { position: [-0.65, 0.34, 0.38] });
  setObject(legD, { position: [0.65, 0.34, 0.38] });
  table.add(top, runner, legA, legB, legC, legD);
  return setObject(table, { position: [0.18, -0.52, 0.62], rotation: [-0.04, 0.16, -0.08], scale: 0.9 });
}

function buildTray() {
  const tray = new THREE.Group();
  const base = roundedBox(7.2, 0.3, 4.5, palette.purple);
  const top = roundedBox(6.48, 0.2, 3.72, palette.purpleLight);
  setObject(top, { position: [0, 0.24, 0] });
  tray.add(base, top);

  const backLip = roundedBox(7.38, 0.46, 0.28, palette.purple);
  const frontLip = roundedBox(7.38, 0.38, 0.24, palette.purple);
  const leftLip = roundedBox(0.28, 0.42, 4.56, palette.purple);
  const rightLip = roundedBox(0.28, 0.42, 4.56, palette.purple);
  setObject(backLip, { position: [0, 0.4, -2.28] });
  setObject(frontLip, { position: [0, 0.34, 2.28] });
  setObject(leftLip, { position: [-3.58, 0.36, 0] });
  setObject(rightLip, { position: [3.58, 0.36, 0] });
  tray.add(backLip, frontLip, leftLip, rightLip);

  const matA = roundedBox(2.36, 0.16, 1.18, palette.cyan);
  const matB = roundedBox(1.24, 0.16, 1.0, palette.yellow);
  setObject(matA, { position: [1.2, 0.46, 1.02], rotation: [0, -0.12, 0] });
  setObject(matB, { position: [-2.24, 0.46, 1.05], rotation: [0, 0.16, 0] });
  tray.add(matA, matB);

  return setObject(tray, { position: [0, -0.78, 0], rotation: [-0.13, 0.08, -0.11], scale: 0.94 });
}

async function buildPlayScene(group) {
  group.add(buildPlatform(5.4, 3.35, palette.green, [-0.1, -0.52, 0.22]));
  group.add(buildBall());

  const [owner, dog, bunny] = await Promise.all([
    loadCharacter("character-a.glb", {
      position: [-1.6, -0.35, 0.16],
      rotation: [0, 0.32, 0],
      size: 2.35,
      floatPhase: 0.1
    }),
    loadPet("animal-dog.glb", {
      position: [0.68, -0.26, 0.92],
      rotation: [0, -0.62, 0],
      size: 1.18,
      floatPhase: 1.2,
      floatAmount: 0.04
    }),
    loadPet("animal-bunny.glb", {
      position: [2.0, -0.24, -0.42],
      rotation: [0, -0.2, 0],
      size: 0.9,
      floatPhase: 2.2,
      floatAmount: 0.035
    })
  ]);
  group.add(owner, dog, bunny);
}

async function buildSocialScene(group) {
  group.add(buildPlatform(5.9, 3.38, palette.purpleLight, [-0.08, -0.54, 0.18]));
  group.add(buildTable());

  const [ownerA, ownerB, cat, fox, snackA, snackB] = await Promise.all([
    loadCharacter("character-a.glb", {
      position: [-1.74, -0.35, 0.1],
      rotation: [0, 0.72, 0],
      size: 2.14,
      floatPhase: 0.4
    }),
    loadCharacter("character-q.glb", {
      position: [1.58, -0.34, -0.08],
      rotation: [0, -0.82, 0],
      size: 2.12,
      floatPhase: 1.1
    }),
    loadPet("animal-cat.glb", {
      position: [-0.46, -0.28, 1.12],
      rotation: [0, 0.24, 0],
      size: 0.95,
      floatPhase: 1.8,
      floatAmount: 0.035
    }),
    loadPet("animal-fox.glb", {
      position: [2.62, -0.25, 0.84],
      rotation: [0, -0.9, 0],
      size: 0.9,
      floatPhase: 2.6,
      floatAmount: 0.035
    }),
    loadFood("soda-can.glb", {
      position: [-0.24, 0.18, 0.56],
      rotation: [0, 0.24, 0],
      size: 0.5,
      floatPhase: 3.1,
      floatAmount: 0.01
    }),
    loadFood("donut-sprinkles.glb", {
      position: [0.44, 0.18, 0.56],
      rotation: [0, -0.28, 0],
      size: 0.48,
      floatPhase: 3.8,
      floatAmount: 0.01
    })
  ]);
  group.add(ownerA, ownerB, cat, fox, snackA, snackB);
}

async function buildCinemaScene(group) {
  group.add(buildTray());

  const [owner, dog, cat, hotdog, fries, iceCream, burger, donut, soda] = await Promise.all([
    loadCharacter("character-e.glb", {
      position: [-2.72, -0.34, -0.72],
      rotation: [0, 0.62, 0],
      size: 1.72,
      floatPhase: 0.2
    }),
    loadPet("animal-dog.glb", {
      position: [-2.38, -0.24, 1.1],
      rotation: [0, 0.2, 0],
      size: 0.78,
      floatPhase: 0.9,
      floatAmount: 0.03
    }),
    loadPet("animal-cat.glb", {
      position: [3.08, -0.22, 0.72],
      rotation: [0, -0.84, 0],
      size: 0.66,
      floatPhase: 1.4,
      floatAmount: 0.03
    }),
    loadFood("hot-dog.glb", {
      position: [0.52, -0.08, 1.05],
      rotation: [-0.26, 0.18, -0.18],
      size: 2.74,
      floatPhase: 0.1
    }),
    loadFood("fries.glb", {
      position: [2.35, 0.02, -0.92],
      rotation: [-0.16, -0.22, 0.08],
      size: 1.64,
      floatPhase: 0.9
    }),
    loadFood("ice-cream.glb", {
      position: [-1.2, 0.06, -0.92],
      rotation: [-0.12, 0.22, -0.08],
      size: 1.58,
      floatPhase: 1.8
    }),
    loadFood("burger-cheese.glb", {
      position: [-1.65, -0.03, 0.82],
      rotation: [-0.14, 0.28, 0.1],
      size: 1.24,
      floatPhase: 2.5
    }),
    loadFood("donut-sprinkles.glb", {
      position: [-0.25, 0.02, -1.4],
      rotation: [-0.08, -0.5, 0.05],
      size: 0.98,
      floatPhase: 3.1
    }),
    loadFood("soda.glb", {
      position: [0.98, 0.05, -1.34],
      rotation: [-0.08, -0.16, 0.04],
      size: 1.18,
      floatPhase: 3.7
    })
  ]);
  group.add(owner, dog, cat, hotdog, fries, iceCream, burger, donut, soda);
}

function buildHeroShell() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 4.9, 11.2);
  camera.lookAt(0, 0.2, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 2.5));
  const key = new THREE.DirectionalLight(0xffffff, 3.5);
  key.position.set(3.5, 7, 5.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xfff3cf, 1.35);
  rim.position.set(-4, 4, 2);
  scene.add(rim);

  root = new THREE.Group();
  root.position.set(-0.14, -0.05, 0);
  root.scale.setScalar(0.96);
  scene.add(root);

  root.add(buildPortal());
  const sparkleA = buildSparkle(0.28);
  const sparkleB = buildSparkle(0.2);
  setObject(sparkleA, { position: [-3.06, 2.34, -1.82], rotation: [0, 0, 0.16], scale: 1.15 });
  setObject(sparkleB, { position: [3.12, 1.96, -1.68], rotation: [0, 0, -0.1], scale: 1 });
  root.add(sparkleA, sparkleB);

  ["play", "social", "cinema"].forEach((name) => {
    const group = new THREE.Group();
    group.visible = name === activeScene;
    slideGroups[name] = group;
    root.add(group);
  });
}

async function buildProcessScene() {
  if (!processStage || !processVisual) return;

  processScene = new THREE.Scene();
  processCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  processCamera.position.set(0, 4.4, 10.4);
  processCamera.lookAt(0, 0.26, 0);

  processRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  processRenderer.setClearColor(0x000000, 0);
  processRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  processRenderer.outputColorSpace = THREE.SRGBColorSpace;
  processStage.appendChild(processRenderer.domElement);

  processScene.add(new THREE.AmbientLight(0xffffff, 2.4));
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(2.8, 6, 5);
  processScene.add(key);

  processRoot = new THREE.Group();
  processRoot.position.set(0.05, -0.2, 0);
  processScene.add(processRoot);
  processRoot.add(buildPlatform(5.6, 3.1, palette.green, [0, -0.52, 0.26]));

  const [owner, dog, cat] = await Promise.all([
    loadCharacter("character-a.glb", {
      position: [-1.28, -0.34, 0.12],
      rotation: [0, 0.38, 0],
      size: 2.15,
      floatPhase: 0.2
    }, processFloatingProps),
    loadPet("animal-dog.glb", {
      position: [0.55, -0.25, 0.92],
      rotation: [0, -0.52, 0],
      size: 1.06,
      floatPhase: 1.2,
      floatAmount: 0.04
    }, processFloatingProps),
    loadPet("animal-cat.glb", {
      position: [1.78, -0.24, -0.22],
      rotation: [0, -0.42, 0],
      size: 0.82,
      floatPhase: 2.2,
      floatAmount: 0.035
    }, processFloatingProps)
  ]);
  processRoot.add(owner, dog, cat, buildBall());

  processVisual.classList.add("has-process-three");
  resizeProcess();
}

async function buildScene() {
  buildHeroShell();

  await Promise.all([
    buildPlayScene(slideGroups.play),
    buildSocialScene(slideGroups.social),
    buildCinemaScene(slideGroups.cinema)
  ]);

  resize();
  setScene(activeScene);
  initialized = true;
  mealStage.classList.add("has-three-ready");
  buildProcessScene().catch((error) => console.warn("PET PET LAND process three fallback:", error));
}

function resize() {
  if (!renderer || !stage) return;
  const rect = stage.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  resizeProcess();
}

function resizeProcess() {
  if (!processRenderer || !processStage) return;
  const rect = processStage.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  processRenderer.setSize(width, height, false);
  processCamera.aspect = width / height;
  processCamera.updateProjectionMatrix();
}

function setScene(name = "play") {
  activeScene = slideGroups[name] ? name : "play";
  document.documentElement.dataset.petScene = activeScene;
  Object.entries(slideGroups).forEach(([sceneName, group]) => {
    group.visible = sceneName === activeScene;
  });
}

function animateFloaters(time, floaters) {
  floaters.forEach((prop, index) => {
    prop.position.y = prop.userData.baseY + Math.sin(time * 0.0016 + prop.userData.floatPhase + index * 0.32) * prop.userData.floatAmount;
  });
}

function animate(time = 0) {
  if (!visible || !renderer) return;
  frameId = requestAnimationFrame(animate);
  root.rotation.y = Math.sin(time * 0.00068) * 0.065;
  root.rotation.x = Math.sin(time * 0.00045) * 0.018;
  animateFloaters(time, floatingProps);
  renderer.render(scene, camera);

  if (processRenderer && processScene && processCamera) {
    processRoot.rotation.y = Math.sin(time * 0.00072) * 0.06;
    animateFloaters(time, processFloatingProps);
    processRenderer.render(processScene, processCamera);
  }
}

async function setVisible(nextVisible) {
  visible = nextVisible;
  stage.hidden = !nextVisible;

  if (!nextVisible) {
    cancelAnimationFrame(frameId);
    return;
  }

  try {
    if (!initialized) await buildScene();
    setScene(document.documentElement.dataset.petScene || activeScene);
    resize();
    cancelAnimationFrame(frameId);
    animate();
  } catch (error) {
    console.warn("PET PET LAND three scene fallback:", error);
    visible = false;
    stage.hidden = true;
    mealStage.classList.remove("has-three-ready");
  }
}

window.petSnackThree = { setVisible, setScene };
window.addEventListener("resize", resize);

if (mealStage.classList.contains("is-three-slide")) {
  setVisible(true);
}
