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
