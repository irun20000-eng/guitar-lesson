// 줄 튕기는 소리 합성. 기준음으로 쓰이므로 주파수가 정확해야 해서 배음을 직접 더하는 방식으로 만든다.
// brightness가 클수록 배음이 빨리 약해져 나일론 줄처럼 부드러운 소리가 난다.

export function renderPluck(freq, sampleRate, seconds = 2, options = {}) {
  const brightness = options.brightness ?? 1.6;
  const sustain = options.sustain ?? false;
  const n = Math.floor(sampleRate * seconds);
  const out = new Float32Array(n);
  for (let k = 1; k <= 10; k++) {
    const fk = k * freq;
    if (fk > sampleRate * 0.45) break;
    const amp = 1 / k ** brightness;
    const decay = sustain ? 0.12 : 1.2 + 0.7 * k;
    const w = (2 * Math.PI * fk) / sampleRate;
    for (let i = 0; i < n; i++) out[i] += amp * Math.exp((-decay * i) / sampleRate) * Math.sin(w * i);
  }
  const attack = Math.min(n, Math.floor(sampleRate * 0.004));
  const release = Math.min(n, Math.floor(sampleRate * 0.05));
  for (let i = 0; i < attack; i++) out[i] *= i / attack;
  for (let i = 0; i < release; i++) out[n - 1 - i] *= i / release;
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) for (let i = 0; i < n; i++) out[i] *= 0.6 / peak;
  return out;
}
