// 악보 자료 도우미. 악보는 { title, bpm, beatsPerBar, notes: [{ t, string, fret, dur, midi }] } 꼴이고 t, dur 단위는 박이다.
import { fretToMidi, midiToKo, midiToName } from './notes.js';

// seq([[줄, 프렛, 길이(박, 기본 1)], ...]) → 앞에서부터 차례로 놓인 음 배열
export function seq(items, start = 0) {
  let t = start;
  return items.map(([string, fret, dur = 1]) => {
    const note = { t, string, fret, dur, midi: fretToMidi(string, fret) };
    t += dur;
    return note;
  });
}

export function scoreBeats(score) {
  let end = 0;
  for (const n of score.notes) end = Math.max(end, n.t + n.dur);
  return end;
}

export function barCount(score) {
  return Math.ceil(scoreBeats(score) / score.beatsPerBar);
}

export function beatMs(bpm, tempo = 1) {
  return 60000 / (bpm * tempo);
}

// fromBar ~ toBar (1부터, 양 끝 포함) 구간만 잘라 t를 0부터 다시 매긴다.
export function sliceBars(score, fromBar, toBar) {
  const a = (fromBar - 1) * score.beatsPerBar, b = toBar * score.beatsPerBar;
  return { ...score, notes: score.notes.filter((n) => n.t >= a && n.t < b).map((n) => ({ ...n, t: n.t - a })) };
}

const FINGER_KO = ['', '검지', '중지', '약지', '새끼'];
export function describeNote(note) {
  const where = note.fret === 0 ? `${note.string}번줄 개방현` : `${note.string}번줄 ${note.fret}프렛`;
  const finger = note.fret >= 1 && note.fret <= 4 ? ` · 왼손 ${FINGER_KO[note.fret]}` : '';
  return `${where} (${midiToKo(note.midi)})${finger}`;
}

export function describeMidi(midi) {
  return `${midiToKo(midi)}(${midiToName(midi)})`;
}

// 스트로크 패턴 글자열 → 박 위치 배열. 'D' 내려치기, 'U' 올려치기, '-' 쉼. 한 글자가 반 박.
// 예: 'D-DU-UDU' (칼립소) → [{ t: 0, dir: 'D' }, { t: 1, dir: 'D' }, { t: 1.5, dir: 'U' }, ...]
export function patternHits(pattern) {
  const hits = [];
  [...pattern].forEach((ch, i) => { if (ch === 'D' || ch === 'U') hits.push({ t: i * 0.5, dir: ch }); });
  return hits;
}
