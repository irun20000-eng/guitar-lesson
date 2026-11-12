// 코드 자료와 코드 확인.
// frets, fingers 는 6번줄 → 1번줄 순서. frets 의 -1은 치지 않는 줄, 0은 개방현. fingers 의 0은 누르지 않음(1 검지, 2 중지, 3 약지, 4 새끼).
import { STRINGS, midiToFreq, freqToMidi } from './notes.js';
import { renderPluck } from './synth.js';
import { soundsLike } from './pitch.js';
import { chromaOf, cosine } from './chroma.js';

export const CHORDS = {
  Em: { name: 'Em', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], rivals: ['E', 'G'], tip: '손가락 두 개만 씁니다. 여섯 줄을 모두 칩니다.' },
  Am: { name: 'Am', frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0], rivals: ['A', 'C', 'Fmaj7'], tip: '5번줄부터 칩니다. 1번줄이 검지에 닿아 먹먹해지기 쉬우니 손가락을 세우세요.' },
  C: { name: 'C', frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], rivals: ['Am', 'Em'], tip: '5번줄부터 칩니다. 세 손가락이 계단처럼 비스듬히 놓입니다.' },
  G: { name: 'G', frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], rivals: ['Em', 'G7'], tip: '손을 넓게 벌립니다. 여섯 줄을 모두 칩니다.' },
  D: { name: 'D', frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], rivals: ['Dm', 'D7'], tip: '4번줄부터 칩니다. 세 손가락이 작은 세모 모양이 됩니다.' },
  E: { name: 'E', frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], rivals: ['Em', 'E7'], tip: 'Em에 검지 하나를 더한 모양입니다.' },
  A: { name: 'A', frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0], rivals: ['Am', 'A7'], tip: '2프렛에 세 손가락이 나란히 섭니다. 5번줄부터 칩니다.' },
  Dm: { name: 'Dm', frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1], rivals: ['D', 'F'], tip: 'D에서 1번줄을 한 프렛 낮춘 모양입니다. 4번줄부터 칩니다.' },
  G7: { name: 'G7', frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1], rivals: ['G'], tip: 'C 코드 모양을 위아래로 벌린 느낌입니다.' },
  D7: { name: 'D7', frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3], rivals: ['D'], tip: 'D의 세모를 뒤집은 모양입니다.' },
  A7: { name: 'A7', frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0], rivals: ['A'], tip: 'A에서 가운데 손가락을 뺀 모양입니다.' },
  E7: { name: 'E7', frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0], rivals: ['E'], tip: 'E에서 약지를 뗀 모양입니다.' },
  Fmaj7: { name: 'Fmaj7', frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0], rivals: ['Am', 'F'], tip: 'C 코드를 한 줄씩 아래로 옮긴 모양입니다. F 대신 쓸 수 있습니다. 4번줄부터 칩니다.' },
  Fs: { name: 'F(작은)', frets: [-1, -1, 3, 2, 1, 1], fingers: [0, 0, 3, 2, 1, 1], barre: { fret: 1, from: 2, to: 1 }, rivals: ['Fmaj7'], tip: '검지를 눕혀 1번줄과 2번줄을 함께 누릅니다. 4번줄부터 칩니다.' },
  F: { name: 'F', frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 1, from: 6, to: 1 }, rivals: ['Fmaj7', 'Dm'], tip: '검지로 1프렛 여섯 줄을 모두 누릅니다. 검지의 옆면(엄지 쪽)을 쓰고 프렛에 바짝 붙이세요.' },
};
export const CHORD_ORDER = ['Em', 'Am', 'C', 'G', 'D', 'E', 'A', 'Dm', 'G7', 'D7', 'A7', 'E7', 'Fmaj7', 'Fs', 'F'];

// 치는 줄만 { num, midi } 로. 굵은 줄부터.
export function chordStrings(id) {
  const chord = CHORDS[id];
  const out = [];
  chord.frets.forEach((fret, i) => { if (fret >= 0) out.push({ num: STRINGS[i].num, fret, midi: STRINGS[i].midi + fret }); });
  return out;
}

// 코드를 한 번 쓸어 친 소리(합성). up 이면 가는 줄부터.
export function strumSamples(id, sampleRate, seconds = 1.6, options = {}) {
  const gap = options.gap ?? 0.016;
  const strings = chordStrings(id);
  if (options.up) strings.reverse();
  const n = Math.floor(sampleRate * seconds);
  const out = new Float32Array(n);
  strings.forEach((s, i) => {
    const offset = Math.floor(i * gap * sampleRate);
    const tone = renderPluck(midiToFreq(s.midi), sampleRate, seconds - i * gap, { brightness: options.brightness ?? 1.5 });
    for (let k = 0; k < tone.length && offset + k < n; k++) out[offset + k] += tone[k] / Math.sqrt(strings.length);
  });
  return out;
}

const templateCache = new Map();
export function chordTemplate(id, sampleRate, size = 8192) {
  const key = `${id}@${sampleRate}@${size}`;
  if (!templateCache.has(key)) {
    const start = Math.floor(0.12 * sampleRate);
    const audio = strumSamples(id, sampleRate, 0.12 + size / sampleRate + 0.05);
    templateCache.set(key, chromaOf(audio.subarray(start, start + size), sampleRate));
  }
  return templateCache.get(key);
}

export function scoreChord(chroma, id, sampleRate, size) {
  return cosine(chroma, chordTemplate(id, sampleRate, size));
}

// 지금 쳐야 하는 코드가 맞는지 확인한다. 헷갈리기 쉬운 코드(rivals) 쪽이 더 비슷하면 그 이름을 알려 준다.
export function verifyChord(chroma, expectedId, sampleRate, options = {}) {
  const minScore = options.minScore ?? 0.78;
  const margin = options.margin ?? 0.02;
  const size = options.size;
  const rivals = (options.rivals ?? CHORDS[expectedId].rivals).filter((id) => id !== expectedId && CHORDS[id]);
  const score = scoreChord(chroma, expectedId, sampleRate, size);
  let rival = null;
  for (const id of rivals) {
    const s = scoreChord(chroma, id, sampleRate, size);
    if (!rival || s > rival.score) rival = { id, score: s };
  }
  if (rival && rival.score > score + margin) return { ok: false, score, reason: 'rival', rival };
  if (score < minScore) return { ok: false, score, reason: 'unclear', rival };
  return { ok: true, score, rival };
}

// 두 코드 가운데 어느 쪽에 가까운지(1분 전환용). 둘 다 아니면 null.
export function pickOfTwo(chroma, a, b, sampleRate, minScore = 0.7) {
  const sa = scoreChord(chroma, a, sampleRate), sb = scoreChord(chroma, b, sampleRate);
  if (Math.max(sa, sb) < minScore) return null;
  return sa >= sb ? a : b;
}

// 한 줄씩 점검: 튕긴 뒤 windowMs 동안 들린 프레임을 모아 그 줄이 맑게 울렸는지 판단한다.
// 앞서 친 줄들이 아직 울리고 있으므로, 무슨 음인지 맞히지 않고 "이 줄의 음이 들리는가"를 확인한다.
export function createStringCheck(id, options = {}) {
  const windowMs = options.windowMs ?? 650;
  const needFrames = options.needFrames ?? 3;
  const a4 = options.a4 ?? 440;
  const strings = chordStrings(id);
  const results = strings.map(() => null);
  let index = 0, openAt = null, clear = 0, others = new Map();

  function settle(result) {
    results[index] = result;
    index++;
    openAt = null;
    clear = 0;
    others = new Map();
    return { type: 'string', index: index - 1, string: strings[index - 1], result, done: index >= strings.length };
  }

  return {
    strings,
    results,
    get index() { return index; },
    get done() { return index >= strings.length; },
    // frame: { time, freq, clarity, rms, buf, sampleRate }, onset: 이 프레임에서 튕김이 감지됐는지
    push(frame, onset) {
      if (index >= strings.length) return null;
      if (onset && openAt === null) { openAt = frame.time; clear = 0; others = new Map(); }
      if (openAt === null) return null;
      const target = strings[index].midi;
      const seg = frame.buf.subarray(Math.max(0, frame.buf.length - 2048));
      if (soundsLike(seg, frame.sampleRate, midiToFreq(target, a4)) > 0) clear++;
      else if (frame.freq > 0 && frame.clarity >= 0.85) {
        // 프렛을 잘못 누른 경우만 "다른 음"으로 본다: 목표에서 4반음 안쪽이고, 앞서 친 줄의 음이 아닌 것.
        const midi = Math.round(freqToMidi(frame.freq, a4));
        const ringing = strings.slice(0, index).some((x) => x.midi === midi);
        if (midi !== target && Math.abs(midi - target) <= 4 && !ringing) others.set(midi, (others.get(midi) || 0) + 1);
      }
      if (clear >= needFrames) return settle({ kind: 'clear' });
      if (frame.time - openAt >= windowMs) {
        let top = null;
        for (const [midi, count] of others) if (!top || count > top.count) top = { midi, count };
        if (top && top.count >= needFrames) return settle({ kind: 'other', midi: top.midi });
        return settle({ kind: 'muffled' });
      }
      return null;
    },
    retry(i) { if (i < index) { index = i; results.fill(null, i); openAt = null; } },
  };
}
