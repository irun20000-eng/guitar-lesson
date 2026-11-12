// 튜너 판단 로직. 소리 프레임을 받아 "어느 줄이 얼마나 벗어났는지, 맞춘 상태로 유지했는지"를 돌려준다.
import { STRINGS, midiToFreq, centsBetween, nearestString, stringByNum } from './notes.js';

export const TUNER_DEFAULTS = {
  a4: 440,
  tolerance: 6,        // 이 센트 안이면 맞은 것으로 본다
  holdMs: 600,         // 이만큼 유지해야 "맞춤 완료"
  medianSize: 5,       // 최근 몇 프레임의 중앙값을 쓸지
  minClarity: 0.85,    // 이보다 흐린 소리는 판단하지 않는다
  minRms: 0.004,       // 이보다 작은 소리는 조용한 것으로 본다
  silenceResetMs: 500, // 이만큼 조용하면 기록을 지운다
  switchFrames: 2,     // 자동 모드에서 다른 줄로 넘어가려면 연속 몇 프레임 필요한지
};

export function median(values) {
  if (!values.length) return NaN;
  const sorted = Array.from(values).sort((x, y) => x - y);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function createTuner(options = {}) {
  const o = { ...TUNER_DEFAULTS, ...options };
  let history = [];
  let current = null;        // 지금 보고 있는 줄 번호
  let pending = null;        // 자동 모드에서 넘어가려는 줄 번호
  let pendingCount = 0;
  let inSince = null;
  let lastSoundAt = -Infinity;
  let last = null;

  function reset() {
    history = [];
    current = null;
    pending = null;
    pendingCount = 0;
    inSince = null;
    last = null;
  }

  // frame: { freq, clarity, rms }, timeMs: 단조 증가 시각, targetNum: 줄을 직접 골랐으면 그 번호
  function update(frame, timeMs, targetNum = null) {
    const heard = frame.rms >= o.minRms && frame.clarity >= o.minClarity && frame.freq > 0;
    if (!heard) {
      if (timeMs - lastSoundAt > o.silenceResetMs) {
        history = [];
        inSince = null;
        pending = null;
        pendingCount = 0;
        last = null;
        return { status: frame.rms < o.minRms ? 'silent' : 'unclear', stringNum: targetNum ?? current };
      }
      return last ? { ...last, status: 'hold' } : { status: 'silent', stringNum: targetNum ?? current };
    }
    lastSoundAt = timeMs;

    let string, cents;
    if (targetNum) {
      string = stringByNum(targetNum);
      cents = centsBetween(frame.freq, midiToFreq(string.midi, o.a4));
    } else {
      ({ string, cents } = nearestString(frame.freq, o.a4));
      if (current !== null && string.num !== current) {
        // 한 프레임만 튄 값으로 줄을 바꾸지 않는다.
        if (pending === string.num) pendingCount++;
        else { pending = string.num; pendingCount = 1; }
        if (pendingCount < o.switchFrames) return last ? { ...last, status: 'hold' } : { status: 'unclear', stringNum: current };
      }
      pending = null;
      pendingCount = 0;
    }
    if (string.num !== current) {
      history = [];
      inSince = null;
      current = string.num;
    }

    history.push(cents);
    if (history.length > o.medianSize) history.shift();
    const c = median(history);
    const inTune = history.length >= 3 && Math.abs(c) <= o.tolerance;
    if (inTune) { if (inSince === null) inSince = timeMs; } else inSince = null;
    const locked = inTune && timeMs - inSince >= o.holdMs;
    last = {
      status: 'ok',
      stringNum: string.num,
      cents: c,
      freq: frame.freq,
      direction: c < -o.tolerance ? 'low' : c > o.tolerance ? 'high' : 'in',
      inTune,
      locked,
    };
    return last;
  }

  return { update, reset, options: o };
}

export const ALL_STRING_NUMS = STRINGS.map((s) => s.num);
