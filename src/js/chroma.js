// 크로마: 소리의 에너지를 12개 음이름(도, 도#, ... 시)별로 모은 벡터. 코드를 확인할 때 쓴다.

export function fftInPlace(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr0 = Math.cos(ang), wi0 = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wr = 1, wi = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
        const nwr = wr * wr0 - wi * wi0;
        wi = wr * wi0 + wi * wr0;
        wr = nwr;
      }
    }
  }
}

// buf 길이는 2의 거듭제곱이어야 한다. 75~2100Hz만 보고, 음과 음 사이에 걸친 에너지는 버린다.
export function chromaOf(buf, sampleRate) {
  const n = buf.length;
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = buf[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  fftInPlace(re, im);
  const out = new Float64Array(12);
  const kMin = Math.ceil((75 * n) / sampleRate), kMax = Math.min(n / 2 - 1, Math.floor((2100 * n) / sampleRate));
  for (let k = kMin; k <= kMax; k++) {
    const midi = 69 + 12 * Math.log2((k * sampleRate) / n / 440);
    const near = Math.round(midi);
    if (Math.abs(midi - near) > 0.35) continue;
    out[((near % 12) + 12) % 12] += re[k] * re[k] + im[k] * im[k];
  }
  let norm = 0;
  for (let i = 0; i < 12; i++) norm += out[i] * out[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < 12; i++) out[i] /= norm;
  return out;
}

export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na * nb) || 1);
}
