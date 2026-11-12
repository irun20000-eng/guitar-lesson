// 기획 단계 타당성 실험 (합성 신호). 실행: node spike/feasibility.mjs
// 목적: (1) 단음 피치 검출이 기타 음역(E2~E5)에서 얼마나 정확한가, 분석 창 길이는 얼마가 필요한가
//       (2) 코드 판정을 "무슨 코드인지 맞히기"가 아니라 "기대한 코드가 맞는지 확인"으로 풀면 구분이 되는가
// 주의: 합성 신호는 실제 마이크 녹음보다 깨끗하다. 여기서 안 되면 실제로도 안 되고, 여기서 되면 "가능성 있음"까지만 말할 수 있다.

const SR = 48000;
const midiToFreq = (m) => 440 * 2 ** ((m - 69) / 12);
const cents = (f, ref) => 1200 * Math.log2(f / ref);
const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midiName = (m) => NOTE[m % 12] + (Math.floor(m / 12) - 1);

let seed = 20261112;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += rnd(); return (u - 3) / Math.SQRT1_2; };

// 기타 줄을 튕긴 소리 흉내: 배음 12개(1/k), 약한 비조화성, 배음마다 다른 감쇠, 백색 잡음
function pluck(f0, n, { fundGain = 1, B = 1e-4, t0 = 0.1, gain = 1 } = {}, out = new Float32Array(n)) {
  for (let k = 1; k <= 12; k++) {
    const fk = k * f0 * Math.sqrt(1 + B * k * k);
    if (fk > SR / 2) break;
    const amp = gain * (k === 1 ? fundGain : 1) / k;
    const ph = rnd() * 2 * Math.PI, decay = 1.5 + 0.8 * k;
    for (let i = 0; i < n; i++) {
      const t = t0 + i / SR;
      if (t < 0) continue;
      out[i] += amp * Math.exp(-decay * t) * Math.sin(2 * Math.PI * fk * t + ph);
    }
  }
  return out;
}
const addNoise = (buf, level) => { for (let i = 0; i < buf.length; i++) buf[i] += level * gauss(); return buf; };

// McLeod Pitch Method (NSDF + 첫 번째 유력 봉우리 + 포물선 보간)
function mpm(buf, sr, { cutoff = 0.93, minF = 70 } = {}) {
  const n = buf.length, maxLag = Math.min(n >> 1, Math.floor(sr / minF));
  const nsdf = new Float32Array(maxLag + 2);
  for (let tau = 0; tau <= maxLag + 1; tau++) {
    let acf = 0, m = 0;
    for (let i = 0; i < n - tau; i++) { acf += buf[i] * buf[i + tau]; m += buf[i] * buf[i] + buf[i + tau] * buf[i + tau]; }
    nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
  }
  const peaks = [];
  let tau = 1;
  while (tau < maxLag && nsdf[tau] > 0) tau++;
  while (tau < maxLag) {
    while (tau < maxLag && nsdf[tau] <= 0) tau++;
    let best = -1, bestTau = -1;
    while (tau <= maxLag && nsdf[tau] > 0) {
      if (nsdf[tau] > best && nsdf[tau] >= nsdf[tau - 1] && nsdf[tau] >= nsdf[tau + 1]) { best = nsdf[tau]; bestTau = tau; }
      tau++;
    }
    if (bestTau > 0) peaks.push(bestTau);
  }
  if (!peaks.length) return { freq: 0, clarity: 0 };
  const maxV = Math.max(...peaks.map((p) => nsdf[p]));
  const p = peaks.find((q) => nsdf[q] >= cutoff * maxV);
  const a = nsdf[p - 1], b = nsdf[p], c = nsdf[p + 1];
  const shift = a - 2 * b + c !== 0 ? (0.5 * (a - c)) / (a - 2 * b + c) : 0;
  return { freq: sr / (p + shift), clarity: b };
}

// ---------- 실험 1: 단음 ----------
console.log('=== 실험 1. 단음 피치 검출 (E2~E5, 37개 음 x 5회) ===');
const conditions = [
  ['깨끗한 소리', { fundGain: 1, noise: 0.02 }],
  ['기본음 약함(휴대폰 마이크 흉내)', { fundGain: 0.15, noise: 0.02 }],
  ['시끄러운 방', { fundGain: 1, noise: 0.15 }],
  ['기본음 약함 + 시끄러움', { fundGain: 0.15, noise: 0.15 }],
];
for (const N of [1024, 2048, 4096]) {
  console.log(`\n분석 창 ${N}샘플 = ${(N / SR * 1000).toFixed(0)}ms`);
  for (const [label, c] of conditions) {
    let ok = 0, fine = 0, total = 0, oct = 0, worst = 0; const fails = new Set();
    for (let m = 40; m <= 76; m++) {
      for (let r = 0; r < 5; r++) {
        const f0 = midiToFreq(m);
        const buf = addNoise(pluck(f0, N, { fundGain: c.fundGain, t0: 0.05 + 0.1 * r }), c.noise);
        const { freq } = mpm(buf, SR);
        const e = freq > 0 ? cents(freq, f0) : 9999;
        total++;
        if (Math.abs(e) < 50) { ok++; worst = Math.max(worst, Math.abs(e)); if (Math.abs(e) < 10) fine++; }
        else { fails.add(midiName(m)); if (freq > 0 && Math.abs(Math.abs(e) - 1200) < 60) oct++; }
      }
    }
    console.log(`  ${label}: 음 맞힘 ${(ok / total * 100).toFixed(1)}% | ±10센트 이내 ${(fine / total * 100).toFixed(1)}% | 맞힌 것 중 최대 오차 ${worst.toFixed(1)}센트 | 옥타브 착오 ${oct}건` + (fails.size ? ` | 실패 음: ${[...fails].join(' ')}` : ''));
  }
}

// ---------- 실험 2: 코드 ----------
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const a = i + k, b = i + k + len / 2;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
      }
    }
  }
}
function chroma(buf) {
  const n = buf.length, re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = buf[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  fft(re, im);
  const ch = new Float64Array(12);
  for (let k = 1; k < n / 2; k++) {
    const f = (k * SR) / n;
    if (f < 75 || f > 2100) continue;
    const midi = 69 + 12 * Math.log2(f / 440);
    if (Math.abs(midi - Math.round(midi)) > 0.35) continue; // 음과 음 사이 에너지는 버림
    ch[((Math.round(midi) % 12) + 12) % 12] += re[k] * re[k] + im[k] * im[k];
  }
  const norm = Math.hypot(...ch) || 1;
  return ch.map((v) => v / norm);
}
const cos = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0) / ((Math.hypot(...a) || 1) * (Math.hypot(...b) || 1));

const OPEN = [40, 45, 50, 55, 59, 64]; // 6번줄→1번줄
const CHORDS = { // 6번줄→1번줄 프렛, -1은 치지 않는 줄
  Em: [0, 2, 2, 0, 0, 0], E: [0, 2, 2, 1, 0, 0], Am: [-1, 0, 2, 2, 1, 0], A: [-1, 0, 2, 2, 2, 0],
  Dm: [-1, -1, 0, 2, 3, 1], D: [-1, -1, 0, 2, 3, 2], C: [-1, 3, 2, 0, 1, 0], G: [3, 2, 0, 0, 0, 3],
  Fmaj7: [-1, -1, 3, 2, 1, 0], F: [1, 3, 3, 2, 1, 1],
};
const names = Object.keys(CHORDS);
const WIN = 8192;
function strum(frets, { fundGain = 1, noise = 0.02, vary = true, mute = [] } = {}) {
  const buf = new Float32Array(WIN);
  frets.forEach((fr, s) => {
    if (fr < 0 || mute.includes(s)) return;
    pluck(midiToFreq(OPEN[s] + fr), WIN, { fundGain, t0: 0.12 - 0.012 * s, gain: vary ? 0.5 + 0.5 * rnd() : 1 }, buf);
  });
  return addNoise(buf, noise);
}
// 템플릿 A: 구성음만 1로 둔 이진 템플릿. 템플릿 B: 실제 운지(줄·프렛)대로 합성한 잡음 없는 소리의 크로마
const binT = Object.fromEntries(names.map((nm) => {
  const t = new Float64Array(12); CHORDS[nm].forEach((fr, s) => { if (fr >= 0) t[(OPEN[s] + fr) % 12] = 1; }); return [nm, t];
}));
const voiT = Object.fromEntries(names.map((nm) => {
  const acc = new Float64Array(12);
  for (let r = 0; r < 8; r++) chroma(strum(CHORDS[nm], { noise: 0, vary: false })).forEach((v, i) => (acc[i] += v));
  return [nm, acc];
}));

console.log(`\n=== 실험 2. 코드 (분석 창 ${WIN}샘플 = ${(WIN / SR * 1000).toFixed(0)}ms, 코드당 40회) ===`);
for (const [tLabel, T] of [['A 이진 템플릿', binT], ['B 운지 반영 템플릿', voiT]]) {
  for (const [cLabel, c] of [['깨끗한 소리', { fundGain: 1, noise: 0.02 }], ['기본음 약함 + 시끄러움', { fundGain: 0.15, noise: 0.15 }]]) {
    let right = 0, total = 0; const conf = {}; let minMargin = Infinity, minPair = '';
    for (const nm of names) for (let r = 0; r < 40; r++) {
      const ch = chroma(strum(CHORDS[nm], c));
      const scores = names.map((x) => [x, cos(ch, T[x])]).sort((p, q) => q[1] - p[1]);
      total++;
      if (scores[0][0] === nm) right++; else conf[`${nm}→${scores[0][0]}`] = (conf[`${nm}→${scores[0][0]}`] || 0) + 1;
      const own = scores.find((s) => s[0] === nm)[1], other = scores.find((s) => s[0] !== nm);
      if (own - other[1] < minMargin) { minMargin = own - other[1]; minPair = `${nm} vs ${other[0]}`; }
    }
    console.log(`  [${tLabel}] ${cLabel}: 10개 코드 중 맞힘 ${(right / total * 100).toFixed(1)}% | 가장 헷갈린 쌍 ${minPair} (점수 차 ${minMargin.toFixed(3)})` + (Object.keys(conf).length ? ` | 오답 ${JSON.stringify(conf)}` : ''));
  }
}

console.log('\n=== 실험 3. 초보자 흔한 실수: 한 줄이 먹먹하게 안 울릴 때 코드 점수가 떨어지는가 (운지 반영 템플릿) ===');
for (const [nm, s, why] of [['C', 5, '1번줄이 손가락 살에 닿아 안 울림'], ['C', 2, '4번줄이 안 울림'], ['G', 5, '1번줄 3프렛이 덜 눌림'], ['D', 5, '1번줄이 안 울림'], ['Am', 4, '2번줄이 안 울림']]) {
  let full = 0, muted = 0;
  for (let r = 0; r < 20; r++) { full += cos(chroma(strum(CHORDS[nm])), voiT[nm]); muted += cos(chroma(strum(CHORDS[nm], { mute: [s] })), voiT[nm]); }
  console.log(`  ${nm} (${why}): 정상 ${(full / 20).toFixed(3)} → 한 줄 죽음 ${(muted / 20).toFixed(3)}`);
}
