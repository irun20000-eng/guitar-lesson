// 시험용 합성 신호. 난수는 씨앗을 고정해 매번 같은 결과가 나오게 한다.

export function makeRng(seed = 20261112) {
  let s = seed >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += rnd(); return (u - 3) / Math.SQRT1_2; };
  return { rnd, gauss };
}

export function sine(freq, sampleRate, n, amp = 0.5) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return out;
}

// 대역 제한 톱니파: 배음을 1/k 크기로 maxHz까지만 더한다. 기타 줄 소리처럼 배음이 많지만 매끄러운 신호다.
// (배음을 끝없이 가진 단순 톱니파는 접힘 잡음 때문에 주기가 흐려져 시험 신호로 맞지 않는다.)
export function saw(freq, sampleRate, n, amp = 0.5, maxHz = 8000) {
  const out = new Float32Array(n);
  for (let k = 1; k * freq <= maxHz; k++) {
    const w = (2 * Math.PI * k * freq) / sampleRate, a = (amp * 0.6) / k;
    for (let i = 0; i < n; i++) out[i] += a * Math.sin(w * i);
  }
  return out;
}

// 기타 줄 흉내: 배음 12개, 약한 비조화성, 배음마다 다른 감쇠, 백색 잡음.
// fundGain을 낮추면 저음을 잘 못 받는 작은 마이크를 흉내 낸다.
export function guitarLike(freq, sampleRate, n, { rng, fundGain = 1, noise = 0.02, t0 = 0.1, B = 1e-4, amp = 0.3 } = {}) {
  const r = rng || makeRng();
  const out = new Float32Array(n);
  for (let k = 1; k <= 12; k++) {
    const fk = k * freq * Math.sqrt(1 + B * k * k);
    if (fk > sampleRate / 2) break;
    const a = (amp * (k === 1 ? fundGain : 1)) / k, ph = r.rnd() * 2 * Math.PI, decay = 1.5 + 0.8 * k;
    for (let i = 0; i < n; i++) { const t = t0 + i / sampleRate; out[i] += a * Math.exp(-decay * t) * Math.sin(2 * Math.PI * fk * t + ph); }
  }
  for (let i = 0; i < n; i++) out[i] += amp * noise * r.gauss();
  return out;
}

export const cents = (f, ref) => 1200 * Math.log2(f / ref);
