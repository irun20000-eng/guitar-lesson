// 음 추적기: 25ms마다 들어오는 소리 프레임을 "줄을 튕긴 순간(onset)"과 "어떤 음을 쳤는지(note)" 사건으로 바꾼다.
// 원칙 1: 줄을 한 번 튕기면 음 사건은 한 번만 낸다. 울리던 소리가 사그라들며 다른 음처럼 들리는 것은 무시한다.
// 원칙 2: 쳐야 할 음을 알고 있으면(setExpected) 그 음이 들리는지부터 확인한다. 앞서 친 줄이 아직 울려도 통한다.
import { freqToMidi, midiToFreq } from './notes.js';
import { soundsLike, salienceAt } from './pitch.js';

export const TRACKER_DEFAULTS = {
  a4: 440,
  segment: 2048,      // 기대한 음을 확인할 때 쓰는 소리 길이(샘플)
  minRms: 0.004,      // 이보다 작으면 조용한 것으로 본다
  minClarity: 0.8,    // 이보다 흐리면 음을 판단하지 않는다
  stableFrames: 2,    // 튕긴 직후 같은 음이 연속 몇 프레임 나와야 인정할지
  slowFrames: 5,      // 튕긴 순간을 못 잡았을 때, 새 음이 연속 몇 프레임 나와야 인정할지(기대 음이 없을 때)
  softFrames: 3,      // 기대 음이 있을 때: 살짝 쳐서 튕김을 못 잡았어도, 기대 음이 새로 들리고 음량이 늘면 인정
  onsetRatio: 1.7,    // 음량이나 날카로운 성분이 직전 최소의 몇 배로 커지면 튕긴 것으로 볼지
  overPeak: 1.1,      // 동시에 직전 최대보다도 이만큼 커야 한다(여러 줄이 울릴 때 생기는 음량 출렁임을 튕김으로 오해하지 않게)
  lookback: 4,        // 직전 몇 프레임과 비교할지
  refractoryMs: 110,  // 튕김을 연달아 두 번 세지 않는 시간
  onsetValidMs: 600,  // 튕긴 뒤 이 시간 안에 음이 또렷해져야 그 튕김의 음으로 인정
  releaseMs: 200,     // 이만큼 조용하면 "울리는 음 없음"으로 되돌린다
};

// 스트로크 연습용 설정. 코드가 울리는 중에 다시 치면 음량이 조금만 커지므로 더 예민하게 잡는다.
// (박자 채점은 정해진 시각 근처의 타격만 세므로, 가끔 잘못 잡힌 타격이 있어도 큰 문제가 없다.)
export const STRUM_TRACKER = { onsetRatio: 1.35, overPeak: 1.02, refractoryMs: 180 };

export function createNoteTracker(options = {}) {
  const o = { ...TRACKER_DEFAULTS, ...options };
  let levels = [], sharps = [];
  let cand = null, candCount = 0, candSince = 0, candCents = 0, candExpected = false;
  let current = null;
  let lastHeardAt = -Infinity, lastOnsetAt = -Infinity;
  let onsetOpen = false;
  let expected = null;
  let salHistory = new Map();   // 기대 음별 최근 또렷함(튕기기 전 기준값을 구하는 데 쓴다)
  let baseAtOnset = new Map();  // 마지막 튕김 직전의 또렷함

  function reset() {
    levels = [];
    sharps = [];
    cand = null;
    candCount = 0;
    current = null;
    lastHeardAt = lastOnsetAt = -Infinity;
    onsetOpen = false;
    salHistory = new Map();
    baseAtOnset = new Map();
  }

  function setExpected(midis) {
    expected = midis && midis.length ? Array.from(new Set(midis)) : null;
    for (const m of Array.from(salHistory.keys())) if (!expected || !expected.includes(m)) salHistory.delete(m);
  }

  // frame: { time(ms), freq, clarity, rms, hf, buf?, sampleRate? }
  // → 사건 배열 [{ type: 'onset', time } | { type: 'note', midi, cents, time, clarity }]
  function push(frame) {
    const events = [];
    const t = frame.time;
    const sharp = frame.hf ?? 0;

    // 음량이 확 커지거나(조용한 데서 친 경우), 날카로운 성분이 확 커지면(울리는 중에 다시 친 경우) 튕긴 것으로 본다.
    const jumped = (value, past) => value >= Math.min(...past) * o.onsetRatio && value >= Math.max(...past) * o.overPeak;
    const rose = levels.length >= 1 && (jumped(frame.rms, levels) || (sharp > 0 && jumped(sharp, sharps)));
    if (rose && frame.rms >= o.minRms * 2 && t - lastOnsetAt >= o.refractoryMs) {
      lastOnsetAt = t;
      onsetOpen = true;
      cand = null;
      candCount = 0;
      baseAtOnset = new Map();
      for (const [m, values] of salHistory) baseAtOnset.set(m, Math.min(...values));
      events.push({ type: 'onset', time: t, rms: frame.rms });
    }
    const levelBefore = levels.length ? levels[0] : 0;   // 약 100ms 전 음량
    levels.push(frame.rms);
    sharps.push(sharp);
    if (levels.length > o.lookback) { levels.shift(); sharps.shift(); }
    if (onsetOpen && t - lastOnsetAt > o.onsetValidMs) onsetOpen = false;

    let midi = null, cents = 0, clarity = frame.clarity, matched = false;
    if (frame.rms >= o.minRms) {
      if (expected && frame.buf && frame.sampleRate) {
        const seg = frame.buf.subarray(Math.max(0, frame.buf.length - o.segment));
        let best = 0;
        for (const m of expected) {
          const f = midiToFreq(m, o.a4);
          const raw = salienceAt(seg, frame.sampleRate, f);
          const s = soundsLike(seg, frame.sampleRate, f, { salience: raw, baseline: onsetOpen ? baseAtOnset.get(m) : undefined });
          if (s > best) { best = s; midi = m; }
          const values = salHistory.get(m) || [];
          values.push(raw);
          if (values.length > o.lookback) values.shift();
          salHistory.set(m, values);
        }
        if (midi !== null) { clarity = best; matched = true; }
      }
      if (midi === null && frame.clarity >= o.minClarity && frame.freq > 0) {
        const exact = freqToMidi(frame.freq, o.a4);
        midi = Math.round(exact);
        cents = (exact - midi) * 100;
      }
    }
    if (midi === null) {
      if (t - lastHeardAt > o.releaseMs) { current = null; cand = null; candCount = 0; }
      return events;
    }
    lastHeardAt = t;
    if (midi === cand) candCount++;
    else { cand = midi; candCount = 1; candSince = t; candExpected = matched; }
    candCents = cents;

    // 기대 음이 있는데 다른 음이 들린 경우에는 조금 더 지켜본다. 튕긴 직후에는 울리던 음이 먼저 잡힐 수 있기 때문이다.
    const viaOnset = onsetOpen && candCount >= (expected && !candExpected ? o.stableFrames + 2 : o.stableFrames);
    // 튕김을 못 잡은 경우. 기대 음이 있을 때는 그 음에 한해서만, 그리고 음량이 늘고 있을 때만 인정한다.
    // (여러 줄이 울리며 생기는 엉뚱한 음이나, 울리던 줄이 남아 들리는 것을 새로 친 음으로 세지 않기 위해서다.)
    const loud = frame.rms >= o.minRms * 2;
    const viaChange = !onsetOpen && cand !== current && loud && (expected
      ? candExpected && candCount >= o.softFrames && frame.rms >= levelBefore * 1.05
      : candCount >= o.slowFrames);
    if (viaOnset || viaChange) {
      events.push({ type: 'note', midi: cand, cents: candCents, clarity, time: viaOnset ? lastOnsetAt : candSince });
      current = cand;
      onsetOpen = false;
    }
    return events;
  }

  return { push, reset, setExpected, options: o };
}
