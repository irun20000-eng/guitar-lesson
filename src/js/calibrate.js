// 보정 도우미 계산: 이 기기의 마이크로 잰 소리로 판정 기준을 정한다. 화면과 무관한 순수 함수라 node에서 시험한다.
// 순서: 조용한 방 3초 → 개방현 여섯 줄 3초씩 → 코드 Em, C, G 3초씩. 잰 값에서 기준을 계산하고 안전한 범위로 묶는다.
// 원칙: 음이 또렷한지, 코드가 맞는지를 보는 기준은 기본값보다 "까다롭게" 만들지 않는다(느슨하게만 푼다).
//       소리 크기 기준만 방의 잡음과 기타 소리 크기에 맞춰 올리거나 내린다.
import { detectPitch, rmsLevel, salienceAt } from './pitch.js';
import { midiToFreq, centsBetween } from './notes.js';
import { chromaOf } from './chroma.js';
import { verifyChord } from './chords.js';

export const CALIB_VERSION = 1;
export const CALIB_DEFAULTS = { minRms: 0.004, minClarity: 0.8, minSalience: 0.7, chordMinScore: 0.78 };
export const CALIB_LIMITS = { minRms: [0.0015, 0.02], minClarity: [0.7, 0.88], minSalience: [0.55, 0.8], chordMinScore: [0.62, 0.85] };
// 기준 바로 아래(이 폭 안)에 걸친 판정은 틀림이 아니라 "다시 쳐 볼까요"로 처리한다.
export const UNSURE_MARGIN = { clarity: 0.05, chord: 0.05, cents: 35 };
export const CALIB_CHORDS = ['Em', 'C', 'G'];

const CAL_WIN = 2048;
const calClamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
const calRound = (v, digits) => Number(v.toFixed(digits));

export function percentile(values, p) {
  if (!values.length) return null;
  const s = values.slice().sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))));
  return s[i];
}

// 25ms 간격으로 최근 2048샘플 조각을 넘긴다(듣기 루프와 같은 크기).
function eachWindow(samples, sampleRate, fn) {
  const hop = Math.max(1, Math.round(sampleRate * 0.025));
  for (let end = CAL_WIN, i = 0; end <= samples.length; end += hop, i++) fn(samples.subarray(end - CAL_WIN, end), i, end / sampleRate);
}

// 조용한 방: 음량(90백분위)과 함께, 웅웅거리는 소리처럼 음 높이가 뚜렷한 잡음이 얼마나 이어지는지(tonal, 0~1)도 잰다.
export function measureNoise(samples, sampleRate) {
  const levels = [];
  let frames = 0, tonal = 0;
  eachWindow(samples, sampleRate, (w, i) => {
    const r = rmsLevel(w);
    levels.push(r);
    if (i % 4) return;   // 음 높이는 100ms마다만 본다(충분하고 빠르다)
    frames++;
    if (r >= NOISE_LIMITS.tonalMinRms && detectPitch(w, sampleRate, { minFreq: 50 }).clarity >= 0.85) tonal++;
  });
  return { rms: percentile(levels, 0.9) ?? 0, median: percentile(levels, 0.5) ?? 0, tonal: frames ? tonal / frames : 0 };
}

// 이보다 크거나, 음 높이가 있는 잡음이 절반 넘게 이어지면 '주변이 조금 시끄러워요'를 먼저 알린다(계속할 수는 있다).
export const NOISE_LIMITS = { rms: 0.002, tonal: 0.5, tonalMinRms: 0.0008 };
export function isNoisy(noise) {
  if (!noise) return false;
  return noise.rms > NOISE_LIMITS.rms || (noise.tonal ?? 0) > NOISE_LIMITS.tonal;
}

// 보정이 잘 됐는지: 줄 셋 이상 또는 코드 하나라도 못 들었으면 실패로 보고 저장하기 전에 다시 하도록 권한다.
// heard가 false인 항목(화면이 소리를 못 들었다고 표시한 것)과 맞힘 비율이 0인 줄을 '못 들음'으로 센다.
export function assessCalibration(m) {
  const failedStrings = (m.strings || []).filter((s) => s && (s.heard === false || !(s.hitRate > 0))).map((s) => s.num);
  const failedChords = (m.chords || []).filter((c) => c && c.heard === false).map((c) => c.id);
  const failed = failedStrings.length >= 3 || failedChords.length >= 1;
  return { verdict: failed ? 'failed' : failedStrings.length ? 'partial' : 'good', failedStrings, failedChords, noisy: isNoisy(m.noise) };
}

// 개방현 한 줄: 가장 큰 순간(튕김)을 찾고, 그 뒤 1.2초 동안 음이 얼마나 또렷하게 들리는지 잰다.
export function measurePluck(samples, sampleRate, midi, options = {}) {
  const a4 = options.a4 ?? 440;
  const target = midiToFreq(midi, a4);
  const wins = [];
  eachWindow(samples, sampleRate, (w, i, t) => wins.push({ w, t, rms: rmsLevel(w) }));
  if (!wins.length) return { peakRms: 0, sustainRms: 0, hitRate: 0, frames: 0, clarity: null, salience: null, medianCents: null, others: 0 };
  let peak = 0;
  for (let i = 1; i < wins.length; i++) if (wins[i].rms > wins[peak].rms) peak = i;
  const peakRms = wins[peak].rms, peakT = wins[peak].t;
  const after = wins.filter((x) => x.t >= peakT + 0.05 && x.t <= peakT + 1.2 && x.rms >= Math.max(peakRms * 0.08, 1e-4));
  const sustain = wins.filter((x) => x.t >= peakT + 0.3 && x.t <= peakT + 0.7).map((x) => x.rms);
  const clarities = [], saliences = [], cents = [];
  let hits = 0, others = 0;
  for (const x of after) {
    const p = detectPitch(x.w, sampleRate, { minFreq: 70 });
    saliences.push(salienceAt(x.w, sampleRate, target));
    if (!(p.freq > 0)) continue;
    const c = centsBetween(p.freq, target);
    if (Math.abs(c) < 50) { hits++; clarities.push(p.clarity); cents.push(c); }
    else if (p.clarity >= 0.8) others++;
  }
  return {
    peakRms,
    sustainRms: percentile(sustain, 0.5) ?? peakRms * 0.3,
    frames: after.length,
    hitRate: after.length ? hits / after.length : 0,
    clarity: clarities.length >= 3 ? percentile(clarities, 0.25) : null,
    salience: saliences.length >= 3 ? percentile(saliences, 0.25) : null,
    medianCents: cents.length ? percentile(cents, 0.5) : null,
    others,
  };
}

// 코드 한 번 쓸어 치기: 튕긴 뒤 0.18초, 0.4초, 0.7초에 코드 점수를 재서 가운데 값을 쓴다.
export function measureChord(samples, sampleRate, id) {
  const size = 8192;
  let peakAt = 0, peak = 0;
  eachWindow(samples, sampleRate, (w, i, t) => { const r = rmsLevel(w); if (r > peak) { peak = r; peakAt = t; } });
  const scores = [];
  for (const d of [0.18, 0.4, 0.7]) {
    const end = Math.floor((peakAt + d) * sampleRate);
    if (end > samples.length || end - size < 0) continue;
    scores.push(verifyChord(chromaOf(samples.subarray(end - size, end), sampleRate), id, sampleRate).score);
  }
  return { id, peakRms: peak, score: percentile(scores, 0.5) ?? 0, best: scores.length ? Math.max(...scores) : 0 };
}

// m: { noise: { rms }, strings: [{ num, midi, ...measurePluck }], chords: [{ id, ...measureChord }] }
// → { values, notes: [{ kind, text }], quality: 'good' | 'warn' }
// previous: 지난번 보정값(있으면). 못 들은 부분에서 나올 기준은 지난번 값(없으면 기본값)을 그대로 둔다.
export function computeThresholds(m, previous = null) {
  const notes = [];
  const base = { ...CALIB_DEFAULTS, ...(previous || {}) };
  const strings = (m.strings || []).filter(Boolean);
  const heardStrings = strings.filter((s) => s.heard !== false && s.hitRate >= 0.5);
  const noiseFloor = (m.noise?.rms ?? 0) * 3;

  // 소리 크기: 방의 잡음보다는 크고, 가장 작게 울리는 줄보다는 충분히 작게.
  let minRms = base.minRms;
  const softest = heardStrings.length ? Math.min(...heardStrings.map((s) => s.sustainRms)) : null;
  if (softest != null) {
    const ceiling = softest * 0.3;
    if (noiseFloor <= ceiling) minRms = Math.max(noiseFloor, Math.min(ceiling, CALIB_DEFAULTS.minRms));
    else {
      minRms = Math.sqrt(noiseFloor * ceiling);
      // 울리는 기타 소리가 잡음의 여섯 배도 안 되면 알려 준다.
      if (noiseFloor > softest * 0.5) notes.push({ kind: 'warn', text: '주변 소리가 기타 소리에 비해 커요. 조용한 곳에서 다시 보정하면 더 정확해요' });
    }
  } else if (noiseFloor > base.minRms) minRms = noiseFloor;
  if (noiseFloor > CALIB_LIMITS.minRms[1]) notes.push({ kind: 'warn', text: '주변이 많이 시끄러워요. 판정이 자주 놓칠 수 있어요' });

  // 음의 또렷함: 여섯 줄 가운데 가장 흐린 줄도 통과하도록, 기본값보다 까다롭게는 하지 않는다.
  const clar = heardStrings.map((s) => s.clarity).filter((v) => v != null);
  const minClarity = clar.length ? Math.min(CALIB_DEFAULTS.minClarity, Math.min(...clar) - 0.04) : base.minClarity;
  const sal = heardStrings.map((s) => s.salience).filter((v) => v != null);
  const minSalience = sal.length ? Math.min(CALIB_DEFAULTS.minSalience, Math.min(...sal) - 0.05) : base.minSalience;

  for (const s of strings) {
    if (s.hitRate >= 0.5) continue;
    notes.push({ kind: 'warn', text: s.others > s.frames * 0.3 ? `${s.num}번줄이 다른 음으로 들려요. 튜닝을 확인해 주세요` : `${s.num}번줄이 잘 안 들려요. 기기를 기타 가까이에 두거나 조금 더 세게 쳐 보세요` });
  }

  // 코드: 세 코드 중 가장 낮은 점수보다 조금 아래로. 역시 기본값보다 까다롭게는 하지 않는다.
  const chordScores = (m.chords || []).filter((c) => c && c.heard !== false).map((c) => c.score);
  const chordMinScore = chordScores.length ? Math.min(CALIB_DEFAULTS.chordMinScore, Math.min(...chordScores) - 0.05) : base.chordMinScore;
  for (const c of (m.chords || []).filter(Boolean)) {
    if (c.heard === false) { notes.push({ kind: 'warn', text: ` 코드를 듣지 못했어요. 이 코드 기준은 지난번 값을 그대로 둡니다` }); continue; }
    if (c.score < CALIB_LIMITS.chordMinScore[0] + 0.05) notes.push({ kind: 'warn', text: `${c.id} 코드가 또렷하게 들리지 않았어요. 코드표를 보고 손가락 자리를 확인한 뒤 다시 보정해 보세요` });
  }

  const values = {
    minRms: calRound(calClamp(minRms, CALIB_LIMITS.minRms), 5),
    minClarity: calRound(calClamp(minClarity, CALIB_LIMITS.minClarity), 3),
    minSalience: calRound(calClamp(minSalience, CALIB_LIMITS.minSalience), 3),
    chordMinScore: calRound(calClamp(chordMinScore, CALIB_LIMITS.chordMinScore), 3),
  };
  return { values, notes, quality: notes.length ? 'warn' : 'good' };
}

// 저장된 보정값(없거나 망가졌으면 기본값). 범위를 벗어난 값은 다시 묶는다.
export function calibValues(settings) {
  const v = settings && settings.calib && settings.calib.version === CALIB_VERSION ? settings.calib.values || {} : {};
  const out = {};
  for (const key of Object.keys(CALIB_DEFAULTS)) {
    const x = Number(v[key]);
    out[key] = Number.isFinite(x) ? calClamp(x, CALIB_LIMITS[key]) : CALIB_DEFAULTS[key];
  }
  return out;
}

export function isCalibrated(settings) {
  return !!(settings && settings.calib && settings.calib.version === CALIB_VERSION && settings.calib.values);
}

export function chordMinScore(settings) {
  return calibValues(settings).chordMinScore;
}

// 보정 결과를 기록에 넣을 모양으로. 잰 숫자도 함께 남겨 나중에 기준을 다시 검토할 수 있게 한다.
export function makeCalibRecord(m, result, info = {}) {
  const r3 = (x) => (x == null ? null : calRound(x, 4));
  return {
    version: CALIB_VERSION,
    date: info.date || null,
    sampleRate: info.sampleRate || null,
    values: result.values,
    quality: result.quality,
    measured: {
      noise: r3(m.noise?.rms),
      strings: (m.strings || []).filter(Boolean).map((s) => ({ num: s.num, peak: r3(s.peakRms), sustain: r3(s.sustainRms), hit: r3(s.hitRate), clarity: r3(s.clarity), salience: r3(s.salience) })),
      chords: (m.chords || []).filter(Boolean).map((c) => ({ id: c.id, score: r3(c.score) })),
    },
  };
}

// 화면에 보여 줄 기준 설명(쉬운 말).
export const CALIB_LABELS = {
  minRms: '들었다고 볼 가장 작은 소리',
  minClarity: '음이 또렷하다고 볼 기준',
  minSalience: '쳐야 할 음이 들린다고 볼 기준',
  chordMinScore: '코드가 맞다고 볼 기준',
};
