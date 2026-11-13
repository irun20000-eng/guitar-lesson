// 듣기 루프와 화면 공용 도우미.
// 25ms마다 최근 소리로 음량, 날카로운 성분, 음 높이를 구해 구독자에게 넘긴다. 구독자가 없으면 멈춘다.
import { detectPitch, rmsLevel, hfLevel } from './pitch.js';
import { calibValues } from './calibrate.js';

export function createListener(audio) {
  const subs = new Set();
  let timer = null;

  function tick() {
    const buf = audio.readFrame(8192);
    if (!buf) return;
    // 음량은 최근 2048샘플(약 43ms)로 잰다. 더 짧으면 굵은 줄 여러 개가 함께 울릴 때 값이 출렁인다.
    const n = buf.length, tail = buf.subarray(n - 2048);
    const p = detectPitch(tail, audio.sampleRate, { minFreq: 70 });
    const frame = { time: performance.now(), freq: p.freq, clarity: p.clarity, rms: rmsLevel(tail), hf: hfLevel(tail), buf, sampleRate: audio.sampleRate };
    for (const fn of Array.from(subs)) fn(frame);
  }

  return {
    subscribe(fn) {
      subs.add(fn);
      if (!timer) timer = setInterval(tick, 25);
      return () => {
        subs.delete(fn);
        if (!subs.size && timer) { clearInterval(timer); timer = null; }
      };
    },
  };
}

export function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const STAR_PATH = 'M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z';
export function starsHtml(count, max = 3) {
  let out = `<span class="stars" role="img" aria-label="별 ${count}개 (${max}개 중)">`;
  for (let i = 0; i < max; i++) out += `<svg viewBox="0 0 24 24" class="star${i < count ? ' on' : ''}" aria-hidden="true"><path d="${STAR_PATH}"/></svg>`;
  return out + '</span>';
}

// 짧은 박자 소리(메트로놈). accent 이면 조금 높은 음.
export function clickSamples(sampleRate, accent = false) {
  const n = Math.floor(sampleRate * 0.03), out = new Float32Array(n), f = accent ? 1760 : 1175;
  for (let i = 0; i < n; i++) out[i] = 0.35 * Math.sin((2 * Math.PI * f * i) / sampleRate) * Math.exp(-i / (sampleRate * 0.008));
  return out;
}

// 보정값(없으면 기본값) + 마이크 민감도 설정 → 추적기 옵션. 민감도는 보정된 소리 크기 기준에 곱한다(낮게 2배, 높게 절반).
export function trackerOptions(settings, extra = {}) {
  const c = calibValues(settings);
  const factor = { low: 2, normal: 1, high: 0.5 }[settings && settings.sensitivity] ?? 1;
  return { minRms: c.minRms * factor, minClarity: c.minClarity, minSalience: c.minSalience, ...extra };
}
