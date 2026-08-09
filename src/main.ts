import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { planets } from "./planets";

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
camera.position.set(0, 110, 300);
camera.lookAt(0, 0, 0);

// 距離は太陽からの実際の距離（AU）に比例させる。
const AU_TO_UNITS = 4;

// 天体の大きさは、距離と同じ縮尺では太陽以外ほぼ見えなくなるため、
// 見やすさのために「地球の半径に対する立方根比」で圧縮して誇張している。
// （距離のスケールだけは誇張せず正確に保つ）
const EARTH_RADIUS_KM = 6371;
const PLANET_SIZE_SCALE = 0.3;
// 水星の軌道距離（0.39 AU × AU_TO_UNITS）より小さくして、太陽の中に埋もれないようにする
const SUN_DISPLAY_RADIUS = 1.0;

const sun = new THREE.Mesh(
  new THREE.SphereGeometry(SUN_DISPLAY_RADIUS, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xffcc33 }),
);
scene.add(sun);

const sunLight = new THREE.PointLight(0xffffff, 500);
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

interface AnimatedPlanet {
  mesh: THREE.Mesh;
  distance: number;
  angle: number;
  angularSpeed: number;
}

const animatedPlanets: AnimatedPlanet[] = planets.map((planet, index) => {
  const radius = PLANET_SIZE_SCALE * Math.cbrt(planet.radiusKm / EARTH_RADIUS_KM);
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 32),
    new THREE.MeshStandardMaterial({ color: planet.color }),
  );

  const distance = planet.distanceAU * AU_TO_UNITS;
  const angle = (index / planets.length) * Math.PI * 2;
  mesh.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);

  scene.add(mesh);
  scene.add(createOrbitLine(distance, planet.color));

  const angularSpeed = (Math.PI * 2) / (planet.orbitalPeriodYears * EARTH_ORBIT_SECONDS);
  return { mesh, distance, angle, angularSpeed };
});

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
controls.maxDistance = 500;

const clock = new THREE.Clock();

function animate(): void {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  for (const planet of animatedPlanets) {
    planet.angle += planet.angularSpeed * delta;
    planet.mesh.position.set(
      Math.cos(planet.angle) * planet.distance,
      0,
      Math.sin(planet.angle) * planet.distance,
    );
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();
