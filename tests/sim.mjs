// 브라우저의 듣기 루프를 node에서 흉내 낸다: 25ms마다 최근 소리 조각으로 음량과 음 높이를 구한다.
import { detectPitch, rmsLevel, hfLevel } from '../src/js/pitch.js';
import { renderPluck } from '../src/js/synth.js';
import { midiToFreq } from '../src/js/notes.js';
import { makeRng } from './helpers.mjs';

export const SR = 48000;

// plucks: [{ at(초), midi, string?, gain?, dead? }]. 같은 줄(string)에 새 음이 오면 앞 음은 끊긴다. dead는 먹먹한 줄(짧은 잡음).
export function renderPerformance(plucks, seconds, { noise = 0.002, seed = 5 } = {}) {
  const rng = makeRng(seed);
  const out = new Float32Array(Math.floor(seconds * SR));
  const sorted = plucks.slice().sort((a, b) => a.at - b.at);
  sorted.forEach((p, i) => {
    const start = Math.floor(p.at * SR);
    let end = out.length;
    if (p.string != null) {
      const next = sorted.slice(i + 1).find((q) => q.string === p.string);
      if (next) end = Math.min(end, Math.floor(next.at * SR));
    }
    const len = end - start;
    if (len <= 0) return;
    const gain = p.gain ?? 0.5;
    if (p.dead) {
      for (let k = 0; k < Math.min(len, SR * 0.04); k++) out[start + k] += gain * 0.8 * Math.exp(-k / (SR * 0.008)) * rng.gauss();
      return;
    }
    const tone = renderPluck(midiToFreq(p.midi), SR, Math.min(len / SR, 4));
    const fade = Math.min(tone.length, Math.floor(SR * 0.004));
    for (let k = 0; k < tone.length; k++) out[start + k] += gain * tone[k] * (k > tone.length - fade ? (tone.length - k) / fade : 1);
  });
  for (let i = 0; i < out.length; i++) out[i] += noise * rng.gauss();
  return out;
}

// 프레임을 차례로 만들어 fn(frame)을 부른다. frame.buf 는 최근 8192샘플.
export function eachFrame(samples, fn, stepMs = 25) {
  const size = 8192;
  const buf = new Float32Array(size);
  for (let t = stepMs; (t / 1000) * SR <= samples.length; t += stepMs) {
    const end = Math.floor((t / 1000) * SR);
    buf.fill(0);
    const from = Math.max(0, end - size);
    buf.set(samples.subarray(from, end), size - (end - from));
    const p = detectPitch(buf.subarray(size - 2048), SR, { minFreq: 70 });
    const tail = buf.subarray(size - 2048);
    fn({ time: t, freq: p.freq, clarity: p.clarity, rms: rmsLevel(tail), hf: hfLevel(tail), buf, sampleRate: SR });
  }
}

export function trackEvents(samples, tracker) {
  const events = [];
  eachFrame(samples, (frame) => { for (const ev of tracker.push(frame)) events.push(ev); });
  return events;
}
