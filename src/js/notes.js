// 음 이름, 주파수, 줄·프렛 변환. 화면과 무관한 순수 함수만 둔다.

export const A4_DEFAULT = 440;
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTE_KO = ['도', '도#', '레', '레#', '미', '파', '파#', '솔', '솔#', '라', '라#', '시'];

// 표준 튜닝. 6번줄(가장 굵은 줄)부터 1번줄(가장 가는 줄)까지.
export const STRINGS = [
  { num: 6, midi: 40, hint: '가장 굵은 줄' },
  { num: 5, midi: 45, hint: '' },
  { num: 4, midi: 50, hint: '' },
  { num: 3, midi: 55, hint: '' },
  { num: 2, midi: 59, hint: '' },
  { num: 1, midi: 64, hint: '가장 가는 줄' },
];

export function freqToMidi(freq, a4 = A4_DEFAULT) {
  return 69 + 12 * Math.log2(freq / a4);
}

export function midiToFreq(midi, a4 = A4_DEFAULT) {
  return a4 * 2 ** ((midi - 69) / 12);
}

export function centsBetween(freq, refFreq) {
  return 1200 * Math.log2(freq / refFreq);
}

export function pitchClass(midi) {
  return ((Math.round(midi) % 12) + 12) % 12;
}

export function midiToOctave(midi) {
  return Math.floor(Math.round(midi) / 12) - 1;
}

export function midiToName(midi) {
  return NOTE_NAMES[pitchClass(midi)] + midiToOctave(midi);
}

export function midiToKo(midi) {
  return NOTE_KO[pitchClass(midi)];
}

// 주파수를 가장 가까운 음과 그 음에서 벗어난 정도(센트)로 풀어 준다.
export function describeFreq(freq, a4 = A4_DEFAULT) {
  const exact = freqToMidi(freq, a4);
  const midi = Math.round(exact);
  return {
    midi,
    letter: NOTE_NAMES[pitchClass(midi)],
    octave: midiToOctave(midi),
    name: midiToName(midi),
    ko: midiToKo(midi),
    cents: (exact - midi) * 100,
  };
}

export function stringByNum(num) {
  return STRINGS.find((s) => s.num === num) || null;
}

// 들린 주파수에 가장 가까운 개방현과, 그 줄 기준으로 벗어난 센트.
export function nearestString(freq, a4 = A4_DEFAULT) {
  let best = null;
  for (const s of STRINGS) {
    const cents = centsBetween(freq, midiToFreq(s.midi, a4));
    if (!best || Math.abs(cents) < Math.abs(best.cents)) best = { string: s, cents };
  }
  return best;
}

export function fretToMidi(stringNum, fret) {
  const s = stringByNum(stringNum);
  if (!s || fret < 0) return null;
  return s.midi + fret;
}
