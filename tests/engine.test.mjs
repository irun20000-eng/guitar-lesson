import test from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, freqToMidi, midiToFreq, midiToName, midiToKo, describeFreq, nearestString, fretToMidi, centsBetween } from '../src/js/notes.js';
import { detectPitch, rmsLevel } from '../src/js/pitch.js';
import { renderPluck } from '../src/js/synth.js';
import { encodeWav, decodeWav } from '../src/js/wav.js';
import { analyzeTake } from '../src/js/check.js';
import { makeRng, sine, saw, guitarLike, cents } from './helpers.mjs';

const near = (actual, expected, tol, msg) => assert.ok(Math.abs(actual - expected) <= tol, `${msg || ''} 기대 ${expected} ± ${tol}, 실제 ${actual}`);

test('음 이름 변환: 개방현 6개의 이름과 주파수', () => {
  const expected = [[6, 'E2', 82.41, '미'], [5, 'A2', 110.0, '라'], [4, 'D3', 146.83, '레'], [3, 'G3', 196.0, '솔'], [2, 'B3', 246.94, '시'], [1, 'E4', 329.63, '미']];
  for (const [num, name, freq, ko] of expected) {
    const s = STRINGS.find((x) => x.num === num);
    assert.equal(midiToName(s.midi), name);
    assert.equal(midiToKo(s.midi), ko);
    near(midiToFreq(s.midi), freq, 0.01, name);
  }
});

test('음 이름 변환: 주파수 → 음과 센트', () => {
  assert.equal(freqToMidi(440), 69);
  const d = describeFreq(445);
  assert.equal(d.name, 'A4');
  near(d.cents, 19.56, 0.05);
  assert.equal(describeFreq(261.63).name, 'C4');
  assert.equal(describeFreq(261.63).ko, '도');
  // 기준음을 442로 바꾸면 442Hz가 정확히 A4
  near(describeFreq(442, 442).cents, 0, 1e-9);
});

test('음 이름 변환: 가장 가까운 줄과 프렛 음', () => {
  assert.equal(nearestString(84).string.num, 6);
  assert.equal(nearestString(200).string.num, 3);
  assert.equal(nearestString(320).string.num, 1);
  near(nearestString(110).cents, 0, 1e-9);
  assert.equal(midiToName(fretToMidi(2, 1)), 'C4');   // 2번줄 1프렛 = 도
  assert.equal(midiToName(fretToMidi(5, 3)), 'C3');   // 5번줄 3프렛 = 도
  assert.equal(midiToName(fretToMidi(1, 12)), 'E5');
  assert.equal(fretToMidi(7, 0), null);
});

test('피치 검출: 조용하거나 잡음뿐이면 음이 없다고 한다', () => {
  assert.equal(detectPitch(new Float32Array(4096), 48000).freq, 0);
  const { gauss } = makeRng(7);
  const noise = Float32Array.from({ length: 4096 }, () => 0.1 * gauss());
  assert.ok(detectPitch(noise, 48000).clarity < 0.6, '잡음의 선명도는 낮아야 한다');
});

test('피치 검출: E2~E5 전 음, 사인파와 대역 제한 톱니파 1센트 이내', () => {
  for (const sr of [44100, 48000]) {
    for (let midi = 40; midi <= 76; midi++) {
      const f = midiToFreq(midi);
      for (const [label, make, tol] of [['사인', sine, 1], ['톱니', saw, 1]]) {
        const r = detectPitch(make(f, sr, 4096), sr);
        near(cents(r.freq, f), 0, tol, `${label} ${midiToName(midi)} @${sr}`);
        assert.ok(r.clarity > 0.95, `${label} ${midiToName(midi)} 선명도 ${r.clarity}`);
      }
    }
  }
});

test('피치 검출: 기타 흉내음, 창 2048에서도 전 음을 맞힌다', () => {
  const rng = makeRng(11);
  let total = 0, ok = 0, worst = 0;
  for (const n of [2048, 4096]) {
    for (const fundGain of [1, 0.15]) {
      for (let midi = 40; midi <= 76; midi++) {
        for (let r = 0; r < 4; r++) {
          const f = midiToFreq(midi);
          const got = detectPitch(guitarLike(f, 48000, n, { rng, fundGain, t0: 0.05 + 0.1 * r }), 48000);
          const e = Math.abs(cents(got.freq, f));
          total++;
          if (e < 50) { ok++; worst = Math.max(worst, e); }
        }
      }
    }
  }
  assert.equal(ok, total, `맞힌 수 ${ok}/${total}`);
  assert.ok(worst < 6, `최대 오차 ${worst.toFixed(2)}센트`);
});

test('피치 검출: 시끄러운 조건에서도 95% 이상', () => {
  const rng = makeRng(13);
  let total = 0, ok = 0;
  for (let midi = 40; midi <= 76; midi++) for (let r = 0; r < 6; r++) {
    const f = midiToFreq(midi);
    const got = detectPitch(guitarLike(f, 48000, 4096, { rng, fundGain: 0.15, noise: 0.15, t0: 0.05 + 0.05 * r }), 48000);
    total++;
    if (Math.abs(cents(got.freq, f)) < 50) ok++;
  }
  assert.ok(ok / total >= 0.95, `맞힘 ${(ok / total * 100).toFixed(1)}%`);
});

test('피치 검출: 줄이 많이 풀려 E2보다 한참 낮아도 읽는다', () => {
  const f = 65.41; // C2
  near(cents(detectPitch(saw(f, 48000, 4096), 48000).freq, f), 0, 2);
});

test('합성 기준음: 6줄 모두 1센트 이내로 정확하다', () => {
  for (const s of STRINGS) {
    const f = midiToFreq(s.midi);
    const buf = renderPluck(f, 48000, 1);
    const got = detectPitch(buf.subarray(4800, 4800 + 4096), 48000);
    near(centsBetween(got.freq, f), 0, 1, `${s.num}번줄`);
    assert.ok(Math.max(...buf.map(Math.abs)) <= 0.61, '소리가 깨질 만큼 크면 안 된다');
  }
});

test('WAV: 머리 정보와 샘플이 왕복 후에도 같다', () => {
  const src = sine(440, 48000, 1000, 0.8);
  const wav = encodeWav(src, 48000);
  assert.equal(wav.byteLength, 44 + 2000);
  assert.equal(new TextDecoder().decode(new Uint8Array(wav, 0, 4)), 'RIFF');
  const back = decodeWav(wav);
  assert.equal(back.sampleRate, 48000);
  assert.equal(back.samples.length, 1000);
  for (let i = 0; i < 1000; i += 37) near(back.samples[i], src[i], 1 / 30000);
  near(rmsLevel(back.samples), rmsLevel(src), 1e-3);
});

test('소리 점검: 맞는 줄은 통과, 다른 줄을 치면 드러난다', () => {
  const rng = makeRng(17);
  const e2 = guitarLike(midiToFreq(40), 48000, 48000 * 3, { rng, t0: 0, amp: 0.3 });
  const good = analyzeTake(e2, 48000, 40);
  assert.ok(good.heard > 10, `들린 프레임 ${good.heard}`);
  assert.equal(good.hitRate, 1);
  near(good.medianCents, 0, 6);
  const wrong = analyzeTake(e2, 48000, 45); // 5번줄을 기대했는데 6번줄 소리
  assert.equal(wrong.hitRate, 0);
  assert.ok(wrong.others.E2 > 10, JSON.stringify(wrong.others));
  const silent = analyzeTake(new Float32Array(48000), 48000, 40);
  assert.equal(silent.heard, 0);
  assert.equal(silent.medianCents, null);
});
