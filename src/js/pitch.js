// 단음 피치 검출: McLeod Pitch Method.
// 정규화 제곱차 함수(NSDF)를 구하고, 가장 큰 봉우리의 cutoff 배 이상인 첫 봉우리를 주기로 고른다.
// 기타처럼 배음이 센 소리에서 옥타브를 헷갈리지 않게 해 주는 부분이 이 "첫 봉우리" 규칙이다.

const NO_PITCH = Object.freeze({ freq: 0, clarity: 0 });
let scratch = new Float32Array(0);

export function rmsLevel(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / (buf.length || 1));
}

// 날카로운(높은 주파수) 성분의 크기. 줄을 튕기는 순간에 크게 뛰고 금방 줄어들어 타격을 잡는 데 쓴다.
export function hfLevel(buf) {
  let sum = 0;
  for (let i = 1; i < buf.length; i++) { const d = buf[i] - buf[i - 1]; sum += d * d; }
  return Math.sqrt(sum / (buf.length - 1 || 1));
}

function nsdfAtLag(buf, lag) {
  let acf = 0, m = 0;
  for (let i = 0, end = buf.length - lag; i < end; i++) { const a = buf[i], b = buf[i + lag]; acf += a * b; m += a * a + b * b; }
  return m > 1e-12 ? (2 * acf) / m : 0;
}

// freq 근처(±2.5%, 약 ±43센트) 주기에서 소리가 얼마나 되풀이되는지(0~1).
export function salienceAt(buf, sampleRate, freq) {
  const period = sampleRate / freq;
  let best = -1;
  for (let lag = Math.floor(period * 0.975); lag <= Math.ceil(period * 1.025); lag++) best = Math.max(best, nsdfAtLag(buf, lag));
  return best;
}

// "이 음이 들리는가"를 확인한다. 다른 줄이 함께 울려도 통하도록, 무슨 음인지 맞히는 대신 기대한 음만 본다.
// 들리면 또렷함(0~1), 아니면 0을 돌려준다. 인정 조건은 두 가지 중 하나다.
//   (1) 또렷함이 min 이상이다.
//   (2) baseline(줄을 튕기기 직전의 또렷함)이 주어졌고, 그보다 눈에 띄게 올랐다.
//       크게 울리는 베이스 위에 한 옥타브 위 음을 살짝 친 경우처럼, 절대값은 낮아도 새로 생긴 음은 이것으로 잡는다.
// 어느 경우든 옆 반음보다 또렷해야 하고, 한 옥타브·12도 위 음을 같은 음으로 착각하지 않게 그 주기들도 함께 본다.
export function soundsLike(buf, sampleRate, freq, options = {}) {
  const min = options.min ?? 0.7, gap = options.gap ?? 0.2;
  const s = options.salience ?? salienceAt(buf, sampleRate, freq);
  const risen = options.baseline != null && s >= 0.35 && s - options.baseline >= 0.25;
  if (s < min && !risen) return 0;
  const semitone = 2 ** (1 / 12);
  if (salienceAt(buf, sampleRate, freq * semitone) > s) return 0;
  if (salienceAt(buf, sampleRate, freq / semitone) > s) return 0;
  if (salienceAt(buf, sampleRate, freq * 2) > s - gap) return 0;
  if (salienceAt(buf, sampleRate, freq * 3) > s - gap) return 0;
  return s;
}

export function detectPitch(buf, sampleRate, options = {}) {
  const minFreq = options.minFreq ?? 55;
  const maxFreq = options.maxFreq ?? 1500;
  const cutoff = options.cutoff ?? 0.93;
  const n = buf.length;
  const maxLag = Math.min((n >> 1) - 1, Math.floor(sampleRate / minFreq));
  const minLag = Math.max(2, Math.floor(sampleRate / maxFreq));
  if (maxLag <= minLag) return NO_PITCH;

  if (scratch.length < maxLag + 2) scratch = new Float32Array(maxLag + 2);
  const nsdf = scratch;

  // m(0) = 2 * 전체 에너지. m(tau) = m(tau-1) - x[tau-1]^2 - x[n-tau]^2 로 줄여 나간다.
  let m = 0;
  for (let i = 0; i < n; i++) m += buf[i] * buf[i];
  m *= 2;
  if (m <= 1e-12) return NO_PITCH;
  nsdf[0] = 1;
  for (let tau = 1; tau <= maxLag + 1; tau++) {
    m -= buf[tau - 1] * buf[tau - 1] + buf[n - tau] * buf[n - tau];
    let acf = 0;
    for (let i = 0, end = n - tau; i < end; i++) acf += buf[i] * buf[i + tau];
    nsdf[tau] = m > 1e-12 ? (2 * acf) / m : 0;
  }

  // 0을 지나 올라왔다가 다시 내려가는 구간마다 가장 높은 점 하나씩을 후보로 모은다.
  let tau = 1;
  while (tau < maxLag && nsdf[tau] > 0) tau++;
  let bestTau = -1, bestVal = 0, chosen = -1;
  const candTau = [], candVal = [];
  while (tau < maxLag) {
    while (tau < maxLag && nsdf[tau] <= 0) tau++;
    let localTau = -1, localVal = -1;
    while (tau <= maxLag && nsdf[tau] > 0) {
      if (nsdf[tau] > localVal && nsdf[tau] >= nsdf[tau - 1] && nsdf[tau] >= nsdf[tau + 1]) {
        localVal = nsdf[tau];
        localTau = tau;
      }
      tau++;
    }
    if (localTau >= minLag) {
      candTau.push(localTau);
      candVal.push(localVal);
      if (localVal > bestVal) { bestVal = localVal; bestTau = localTau; }
    }
  }
  if (bestTau < 0) return NO_PITCH;
  for (let i = 0; i < candTau.length; i++) {
    if (candVal[i] >= cutoff * bestVal) { chosen = candTau[i]; break; }
  }

  // 포물선 보간으로 샘플 사이의 봉우리 위치를 구한다.
  const a = nsdf[chosen - 1], b = nsdf[chosen], c = nsdf[chosen + 1];
  const denom = a - 2 * b + c;
  const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
  const clarity = denom !== 0 ? b - ((a - c) * shift) / 4 : b;
  return { freq: sampleRate / (chosen + shift), clarity: Math.min(1, clarity) };
}
