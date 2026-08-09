import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { planets } from "./planets";
import { computeStarParams, computeHabitableZone, teffToColor, type StarParams } from "./star";

const container = document.getElementById("app");
if (!container) {
  throw new Error("#app element not found");
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 8, 14);
camera.lookAt(0, 0, 0);

// 距離は太陽からの実際の距離（AU）に比例させる。
const AU_TO_UNITS = 4;

// 天体の大きさは、距離と同じ縮尺では見えなくなるため、見やすさのために誇張している
// （距離のスケールだけは誇張せず正確に保つ）
const PLANET_SIZE_SCALE = 0.3;
// 地球の軌道距離（1 AU × AU_TO_UNITS）より小さくして、太陽の中に埋もれないようにする
const SUN_DISPLAY_RADIUS = 1.0;

const sun = new THREE.Mesh(
  new THREE.SphereGeometry(SUN_DISPLAY_RADIUS, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xffcc33 }),
);
scene.add(sun);

// 恒星質量M=1（太陽）のときの点光源強度。恒星の光度に比例させてスライダーに連動する。
const SUN_LIGHT_BASE_INTENSITY = 500;

const sunLight = new THREE.PointLight(0xffffff, SUN_LIGHT_BASE_INTENSITY);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);

// 太陽光は距離の2乗で減衰するため、これだけでは遠い惑星がほぼ見えなくなる。
// このアプリは物理的な明るさの再現ではなく天体の位置・大きさを示すことが目的なので、
// 距離によらず全惑星の色がはっきり見えるよう環境光で底上げする。
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const ORBIT_LINE_SEGMENTS = 128;

function createOrbitLine(radius: number, color: number): THREE.Line {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= ORBIT_LINE_SEGMENTS; i++) {
    const theta = (i / ORBIT_LINE_SEGMENTS) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.4 });
  return new THREE.Line(geometry, material);
}

// 地球が1周するのにかかる実時間（秒）。完全なリアルタイムではなく、
// 公転周期の比率（速さの違い）が見て分かるように短縮している。
const EARTH_ORBIT_SECONDS = 8;

const earthData = planets.find((planet) => planet.name === "Earth");
if (!earthData) {
  throw new Error("Earth data not found in planets.ts");
}

const earthMesh = new THREE.Mesh(
  new THREE.SphereGeometry(PLANET_SIZE_SCALE, 32, 32),
  new THREE.MeshStandardMaterial({ color: earthData.color }),
);
scene.add(earthMesh);

const earthDistance = earthData.distanceAU * AU_TO_UNITS;
let earthAngle = 0;
const earthAngularSpeed = (Math.PI * 2) / (earthData.orbitalPeriodYears * EARTH_ORBIT_SECONDS);
earthMesh.position.set(earthDistance, 0, 0);

scene.add(createOrbitLine(earthDistance, earthData.color));

// ハビタブルゾーン（恒星周辺で惑星表面に液体の水が存在できる範囲）を、
// 太陽面（軌道面）に重なる半透明のリングとして表示する。
// 境界の算出方法はsrc/star.tsを参照（Kopparapu et al. 2013の実効フラックス式）。
const HZ_RING_SEGMENTS = 128;

function createHabitableZoneRing(innerAU: number, outerAU: number): THREE.Mesh {
  const geometry = new THREE.RingGeometry(
    innerAU * AU_TO_UNITS,
    outerAU * AU_TO_UNITS,
    HZ_RING_SEGMENTS,
  );
  const material = new THREE.MeshBasicMaterial({
    color: 0x33cc66,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(geometry, material);
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

function updateHabitableZoneRing(ring: THREE.Mesh, innerAU: number, outerAU: number): void {
  ring.geometry.dispose();
  ring.geometry = new THREE.RingGeometry(innerAU * AU_TO_UNITS, outerAU * AU_TO_UNITS, HZ_RING_SEGMENTS);
}

const initialStarParams = computeStarParams(1.0);
const initialHabitableZone = computeHabitableZone(initialStarParams);
const habitableZoneRing = createHabitableZoneRing(
  initialHabitableZone.innerAU,
  initialHabitableZone.outerAU,
);
scene.add(habitableZoneRing);

// 恒星質量スライダーの値を、光度・半径・表面温度・ハビタブルゾーンへ反映する。
// 太陽メッシュは立方体の見た目を保つため、ベース半径からのスケール比としてR★を適用する。
function applyStarParams(massSolar: number): StarParams {
  const star = computeStarParams(massSolar);

  sun.scale.setScalar(star.radiusSolar);
  (sun.material as THREE.MeshBasicMaterial).color.setHex(teffToColor(star.teffK));
  sunLight.intensity = SUN_LIGHT_BASE_INTENSITY * star.luminositySolar;

  const hz = computeHabitableZone(star);
  updateHabitableZoneRing(habitableZoneRing, hz.innerAU, hz.outerAU);

  return star;
}

const starMassSliderEl = document.getElementById("star-mass");
if (!(starMassSliderEl instanceof HTMLInputElement)) {
  throw new Error("#star-mass element not found");
}
const starMassSlider: HTMLInputElement = starMassSliderEl;

const starReadoutEl = document.getElementById("star-readout");
if (!starReadoutEl) {
  throw new Error("#star-readout element not found");
}
const starReadout: HTMLElement = starReadoutEl;

function updateStarReadout(star: StarParams): void {
  starReadout.textContent = `光度: ${star.luminositySolar.toFixed(2)} 太陽光度 ／ 表面温度: ${Math.round(star.teffK)} K`;
}

function onStarMassChange(): void {
  const star = applyStarParams(Number(starMassSlider.value));
  updateStarReadout(star);
}

starMassSlider.addEventListener("input", onStarMassChange);
onStarMassChange();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 自由視点操作: ドラッグ/1本指スワイプで回転、ホイール/ピンチでズーム、右ドラッグ/2本指ドラッグでパン
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 2;
controls.maxDistance = 50;

const clock = new THREE.Clock();

function animate(): void {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  earthAngle += earthAngularSpeed * delta;
  earthMesh.position.set(Math.cos(earthAngle) * earthDistance, 0, Math.sin(earthAngle) * earthDistance);

  controls.update();
  renderer.render(scene, camera);
}

animate();
