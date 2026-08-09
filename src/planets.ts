export interface PlanetData {
  name: string;
  /** 表示用の日本語名 */
  nameJa: string;
  color: number;
  /** 太陽からの平均距離（天文単位 AU） */
  distanceAU: number;
  /** 実際の半径（km） */
  radiusKm: number;
  /** 公転周期（地球年） */
  orbitalPeriodYears: number;
}

export const planets: PlanetData[] = [
  { name: "Mercury", nameJa: "水星", color: 0x9c9c9c, distanceAU: 0.39, radiusKm: 2440, orbitalPeriodYears: 0.2408 },
  { name: "Venus", nameJa: "金星", color: 0xe0c16c, distanceAU: 0.72, radiusKm: 6052, orbitalPeriodYears: 0.6152 },
  { name: "Earth", nameJa: "地球", color: 0x3399ff, distanceAU: 1.0, radiusKm: 6371, orbitalPeriodYears: 1.0 },
  { name: "Mars", nameJa: "火星", color: 0xcc5533, distanceAU: 1.52, radiusKm: 3390, orbitalPeriodYears: 1.8808 },
  { name: "Jupiter", nameJa: "木星", color: 0xd8ae7e, distanceAU: 5.2, radiusKm: 69911, orbitalPeriodYears: 11.862 },
  { name: "Saturn", nameJa: "土星", color: 0xe3c98f, distanceAU: 9.58, radiusKm: 58232, orbitalPeriodYears: 29.457 },
  { name: "Uranus", nameJa: "天王星", color: 0x9fe3e0, distanceAU: 19.2, radiusKm: 25362, orbitalPeriodYears: 84.011 },
  { name: "Neptune", nameJa: "海王星", color: 0x3a5fcd, distanceAU: 30.1, radiusKm: 24622, orbitalPeriodYears: 164.79 },
];
