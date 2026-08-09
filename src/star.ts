// 太陽の実効温度（K）。Kopparapu et al. (2013) のT*基準点でもある。
export const SUN_TEFF_K = 5778;

export interface StarParams {
  massSolar: number;
  luminositySolar: number;
  radiusSolar: number;
  teffK: number;
}

// 主系列星の質量-光度・質量-半径の近似関係から、光度・半径・表面温度を
// 恒星質量（太陽質量比）だけから連動して求める。
// L/L_sun ≈ (M/M_sun)^3.5, R/R_sun ≈ (M/M_sun)^0.8 という主系列近似に、
// シュテファン・ボルツマンの法則 L = 4πR^2 σT^4 を組み合わせている。
export function computeStarParams(massSolar: number): StarParams {
  const luminositySolar = Math.pow(massSolar, 3.5);
  const radiusSolar = Math.pow(massSolar, 0.8);
  const teffK = SUN_TEFF_K * Math.pow(luminositySolar, 0.25) / Math.pow(radiusSolar, 0.5);
  return { massSolar, luminositySolar, radiusSolar, teffK };
}

interface HzCoefficients {
  seffSun: number;
  a: number;
  b: number;
  c: number;
  d: number;
}

// Kopparapu et al. (2013, ApJ 765, 131; erratum 2013, ApJ 770, 82) Table 3の
// 「Runaway Greenhouse」（内側境界）「Maximum Greenhouse」（外側境界）係数。
// 有効温度範囲は2600K〜7200K。
const RUNAWAY_GREENHOUSE: HzCoefficients = {
  seffSun: 1.0385,
  a: 1.2456e-4,
  b: 1.4612e-8,
  c: -7.6345e-12,
  d: -1.7511e-15,
};

const MAXIMUM_GREENHOUSE: HzCoefficients = {
  seffSun: 0.3507,
  a: 5.9578e-5,
  b: 1.6707e-9,
  c: -3.0058e-12,
  d: -5.1925e-16,
};

function effectiveFlux(teffK: number, coeff: HzCoefficients): number {
  const tStar = teffK - SUN_TEFF_K;
  return (
    coeff.seffSun +
    coeff.a * tStar +
    coeff.b * tStar ** 2 +
    coeff.c * tStar ** 3 +
    coeff.d * tStar ** 4
  );
}

function clamp8bit(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

// 表面温度(K)から恒星の見た目の色を求める近似式（Tanner Hellandの黒体色近似）。
// 分光測定に基づく厳密なプランク放射×等色関数の計算ではなく経験的なフィットだが、
// 教育目的の可視化としては十分な精度で黄色〜白〜青白の変化を表現できる。
export function teffToColor(teffK: number): number {
  const temp = teffK / 100;

  const red = temp <= 66 ? 255 : clamp8bit(329.698727446 * Math.pow(temp - 60, -0.1332047592));

  const green =
    temp <= 66
      ? clamp8bit(99.4708025861 * Math.log(temp) - 161.1195681661)
      : clamp8bit(288.1221695283 * Math.pow(temp - 60, -0.0755148492));

  let blue: number;
  if (temp >= 66) {
    blue = 255;
  } else if (temp <= 19) {
    blue = 0;
  } else {
    blue = clamp8bit(138.5177312231 * Math.log(temp - 10) - 305.0447927307);
  }

  return (red << 16) | (green << 8) | blue;
}

export interface HabitableZone {
  innerAU: number;
  outerAU: number;
}

// ハビタブルゾーン内側・外側境界（AU）。Runaway Greenhouse/Maximum Greenhouseの
// 実効フラックスと恒星光度から d = sqrt(L / Seff) で軌道距離を求める（保守的HZ）。
export function computeHabitableZone(star: StarParams): HabitableZone {
  const innerSeff = effectiveFlux(star.teffK, RUNAWAY_GREENHOUSE);
  const outerSeff = effectiveFlux(star.teffK, MAXIMUM_GREENHOUSE);
  return {
    innerAU: Math.sqrt(star.luminositySolar / innerSeff),
    outerAU: Math.sqrt(star.luminositySolar / outerSeff),
  };
}

// 1天文単位を太陽半径単位で表した値（放射平衡温度の計算で単位を揃えるために使う）
const AU_IN_SOLAR_RADII = 215.032;

// 惑星表面の放射平衡温度（K）。大気による温室効果は含まない、恒星放射と
// 惑星表面での反射（アルベド）だけを考慮した黒体としての釣り合い温度。
// Teq = Teff・√(R★ / (2a))・(1-A)^0.25
export function computeEquilibriumTemperature(
  star: StarParams,
  distanceAU: number,
  albedo: number,
): number {
  const distanceSolarRadii = distanceAU * AU_IN_SOLAR_RADII;
  return star.teffK * Math.sqrt(star.radiusSolar / (2 * distanceSolarRadii)) * Math.pow(1 - albedo, 0.25);
}

// ケプラーの第3法則（AU・太陽質量・年の単位系では比例定数が1になる）: T^2 = a^3 / M
export function computeOrbitalPeriodYears(distanceAU: number, massSolar: number): number {
  return Math.sqrt(distanceAU ** 3 / massSolar);
}

// 地球の実際の平均地表気温（約288K・15℃）と、大気を無視した放射平衡温度
// （約255K・-18℃）との差から求めた温室効果による底上げ分。恒星や軌道半径が
// 変わっても地球と同じ大気組成のままだと仮定した近似値であり、実際には
// 気圧や大気組成自体も条件次第で変化しうるが、そこまではモデル化していない。
const EARTH_GREENHOUSE_OFFSET_K = 33;

// 温室効果を加味した、体感に近い地表気温（K）の推定値。
export function computeSurfaceTemperature(star: StarParams, distanceAU: number, albedo: number): number {
  return computeEquilibriumTemperature(star, distanceAU, albedo) + EARTH_GREENHOUSE_OFFSET_K;
}
