import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { planets } from "./planets";
import {
  computeStarParams,
  computeHabitableZone,
  computeEquilibriumTemperature,
  computeOrbitalPeriodYears,
  teffToColor,
  type StarParams,
  type HabitableZone,
} from "./star";

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

function createOrbitPoints(radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= ORBIT_LINE_SEGMENTS; i++) {
    const theta = (i / ORBIT_LINE_SEGMENTS) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
  }
  return points;
}

function createOrbitLine(radius: number, color: number): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints(createOrbitPoints(radius));
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.4 });
  return new THREE.Line(geometry, material);
}

function updateOrbitLine(line: THREE.Line, radius: number): void {
  line.geometry.dispose();
  line.geometry = new THREE.BufferGeometry().setFromPoints(createOrbitPoints(radius));
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

let earthDistance = earthData.distanceAU * AU_TO_UNITS;
let earthAngle = 0;
let earthAngularSpeed = (Math.PI * 2) / (earthData.orbitalPeriodYears * EARTH_ORBIT_SECONDS);
earthMesh.position.set(earthDistance, 0, 0);

const earthOrbitLine = createOrbitLine(earthDistance, earthData.color);
scene.add(earthOrbitLine);

// 惑星表面の放射平衡温度を計算する際のアルベド（反射率）。地球の実測値に近い平均値を固定で使う。
const EARTH_ALBEDO = 0.3;

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
  const teffCelsius = star.teffK - 273.15;
  starReadout.textContent = `光度: ${star.luminositySolar.toFixed(2)} 太陽光度 ／ 表面温度: ${teffCelsius.toFixed(0)}℃`;
}

const earthDistanceSliderEl = document.getElementById("earth-distance");
if (!(earthDistanceSliderEl instanceof HTMLInputElement)) {
  throw new Error("#earth-distance element not found");
}
const earthDistanceSlider: HTMLInputElement = earthDistanceSliderEl;

const earthReadoutEl = document.getElementById("earth-readout");
if (!earthReadoutEl) {
  throw new Error("#earth-readout element not found");
}
const earthReadout: HTMLElement = earthReadoutEl;

function zoneStatusText(distanceAU: number, hz: HabitableZone): string {
  if (distanceAU < hz.innerAU) {
    return "ハビタブルゾーンより内側（暑すぎる）";
  }
  if (distanceAU > hz.outerAU) {
    return "ハビタブルゾーンより外側（寒すぎる）";
  }
  return "ハビタブルゾーン内";
}

function updateEarthReadout(distanceAU: number, teqKelvin: number, hz: HabitableZone): void {
  const teqCelsius = teqKelvin - 273.15;
  earthReadout.textContent = `放射平衡温度: ${teqCelsius.toFixed(0)}℃ ／ ${zoneStatusText(distanceAU, hz)}`;
}

// 恒星質量・地球の公転半径の両方に依存する量（公転周期・放射平衡温度・HZ内外判定）を
// まとめて更新する。恒星スライダー・地球軌道スライダーのどちらが変化しても呼び出す。
let currentStar: StarParams = computeStarParams(1.0);

function updateEarth(): void {
  const distanceAU = Number(earthDistanceSlider.value);
  earthDistance = distanceAU * AU_TO_UNITS;
  updateOrbitLine(earthOrbitLine, earthDistance);
  earthAngularSpeed =
    (Math.PI * 2) / (computeOrbitalPeriodYears(distanceAU, currentStar.massSolar) * EARTH_ORBIT_SECONDS);

  const hz = computeHabitableZone(currentStar);
  const teq = computeEquilibriumTemperature(currentStar, distanceAU, EARTH_ALBEDO);
  updateEarthReadout(distanceAU, teq, hz);
}

function onStarMassChange(): void {
  currentStar = applyStarParams(Number(starMassSlider.value));
  updateStarReadout(currentStar);
  updateEarth();
}

starMassSlider.addEventListener("input", onStarMassChange);
earthDistanceSlider.addEventListener("input", updateEarth);
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
