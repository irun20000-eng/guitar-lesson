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
