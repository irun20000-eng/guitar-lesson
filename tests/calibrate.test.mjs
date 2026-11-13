import test from 'node:test';
import assert from 'node:assert/strict';
import { SR, renderPerformance, trackEvents } from './sim.mjs';
import { makeRng } from './helpers.mjs';
import { STRINGS } from '../src/js/notes.js';
import { strumSamples, verifyChord } from '../src/js/chords.js';
import { chromaOf } from '../src/js/chroma.js';
import { createNoteTracker } from '../src/js/tracker.js';
import { createWaitJudge } from '../src/js/judge.js';
import { trackerOptions } from '../src/js/listen.js';
import { emptyProgress, loadProgress, saveProgress } from '../src/js/progress.js';
import {
  CALIB_DEFAULTS, CALIB_LIMITS, CALIB_VERSION, CALIB_CHORDS, measureNoise, measurePluck, measureChord,
  computeThresholds, calibValues, isCalibrated, chordMinScore, makeCalibRecord, percentile,
} from '../src/js/calibrate.js';

// 보정 도우미가 듣는 것을 합성한다: 조용한 방 3초, 개방현 여섯 줄 3초씩, 코드 셋 3초씩.
function calibrationRun(gain, noise, seed = 1) {
  const rng = makeRng(seed);
  const m = { noise: measureNoise(renderPerformance([], 3, { noise, seed }), SR), strings: [], chords: [] };
  for (const s of STRINGS) m.strings.push({ num: s.num, midi: s.midi, ...measurePluck(renderPerformance([{ at: 0.5, midi: s.midi, gain }], 3, { noise, seed: seed + s.num }), SR, s.midi) });
  for (const id of CALIB_CHORDS) {
    const x = strumSamples(id, SR, 2.5), out = new Float32Array(3 * SR), at = Math.floor(0.5 * SR);
    for (let i = 0; i < x.length; i++) out[at + i] = x[i] * gain * 2;
    for (let i = 0; i < out.length; i++) out[i] += noise * rng.gauss();
    m.chords.push(measureChord(out, SR, id));
  }
  return m;
}
const settingsWith = (m) => ({ sensitivity: 'normal', calib: makeCalibRecord(m, computeThresholds(m), { date: '2026-11-13', sampleRate: SR }) });
const OPEN_STRINGS = STRINGS.map((s, i) => ({ at: 0.4 + i * 0.7, midi: s.midi }));
const notesHeard = (audio, settings) => trackEvents(audio, createNoteTracker(trackerOptions(settings))).filter((e) => e.type === 'note').map((e) => e.midi);
const inRange = (values) => { for (const [k, [lo, hi]] of Object.entries(CALIB_LIMITS)) assert.ok(values[k] >= lo && values[k] <= hi, `${k}=${values[k]}`); };

test('보정 측정: 조용한 방, 개방현, 코드를 숫자로 잰다', () => {
  const m = calibrationRun(0.5, 0.002);
  assert.ok(Math.abs(m.noise.rms - 0.002) < 0.0005, `잡음 ${m.noise.rms}`);
  for (const s of m.strings) {
    assert.ok(s.hitRate >= 0.95, `${s.num}번줄 맞힘 ${s.hitRate}`);
    assert.ok(s.clarity > 0.95 && s.salience > 0.95);
    assert.ok(s.peakRms > s.sustainRms && s.sustainRms > 0.03);
  }
  for (const c of m.chords) assert.ok(c.score > 0.95, `${c.id} ${c.score}`);
  assert.equal(percentile([3, 1, 2], 0.5), 2);
  assert.equal(percentile([], 0.5), null);
});

test('보정 계산: 깨끗한 소리면 기본값 근처, 까다롭게는 바꾸지 않는다', () => {
  const r = computeThresholds(calibrationRun(0.5, 0.002));
  assert.equal(r.quality, 'good');
  assert.deepEqual(r.notes, []);
  assert.equal(r.values.minClarity, CALIB_DEFAULTS.minClarity);
  assert.equal(r.values.minSalience, CALIB_DEFAULTS.minSalience);
  assert.equal(r.values.chordMinScore, CALIB_DEFAULTS.chordMinScore);
  assert.ok(r.values.minRms >= 0.004 && r.values.minRms <= 0.0065, `잡음 3배 이상으로 올라간다: ${r.values.minRms}`);
  inRange(r.values);
});

test('보정 계산: 시끄러운 방은 소리 크기 기준을 올리고 알려 준다, 흐린 소리는 또렷함 기준을 푼다', () => {
  const r = computeThresholds(calibrationRun(0.5, 0.02));
  assert.equal(r.quality, 'warn');
  assert.ok(r.notes.some((n) => n.text.includes('시끄러')));
  assert.equal(r.values.minRms, CALIB_LIMITS.minRms[1], '상한으로 묶인다');
  assert.ok(r.values.minClarity < CALIB_DEFAULTS.minClarity, `흐린 소리에 맞춰 푼다: ${r.values.minClarity}`);
  inRange(r.values);
});

test('보정 계산: 엉뚱한 값도 안전한 범위로 묶고, 안 들린 줄과 흐린 코드를 알려 준다', () => {
  const r = computeThresholds({
    noise: { rms: 0.5 },
    strings: [{ num: 6, peakRms: 0.001, sustainRms: 0.0002, hitRate: 0, frames: 40, others: 0, clarity: 0.1, salience: 0.1 },
      { num: 5, peakRms: 0.3, sustainRms: 0.0001, hitRate: 0.9, frames: 40, others: 0, clarity: 0.2, salience: 0.05 }],
    chords: [{ id: 'Em', score: 0.1 }],
  });
  inRange(r.values);
  assert.equal(r.values.minClarity, CALIB_LIMITS.minClarity[0]);
  assert.equal(r.values.minSalience, CALIB_LIMITS.minSalience[0]);
  assert.equal(r.values.chordMinScore, CALIB_LIMITS.chordMinScore[0]);
  assert.ok(r.notes.some((n) => n.text.startsWith('6번줄')));
  assert.ok(r.notes.some((n) => n.text.startsWith('Em')));
  const empty = computeThresholds({});
  assert.deepEqual(empty.values, CALIB_DEFAULTS, '잰 것이 없으면 기본값');
});

test('보정 효과: 소리를 작게 받는 마이크에서도 보정하면 여섯 줄을 다 알아듣는다', () => {
  const gain = 0.012, noise = 0.0002;
  const audio = renderPerformance(OPEN_STRINGS.map((p) => ({ ...p, gain })), 5, { noise, seed: 9 });
  assert.deepEqual(notesHeard(audio, { sensitivity: 'normal' }), [], '기본값으로는 너무 작아 못 듣는다');
  const settings = settingsWith(calibrationRun(gain, noise));
  assert.ok(settings.calib.values.minRms < CALIB_DEFAULTS.minRms);
  assert.deepEqual(notesHeard(audio, settings), STRINGS.map((s) => s.midi));
});

test('보정 효과: 크게 받는 마이크와 시끄러운 방에서도 친 음만 센다', () => {
  for (const [gain, noise] of [[0.5, 0.002], [0.5, 0.02]]) {
    const audio = renderPerformance(OPEN_STRINGS.map((p) => ({ ...p, gain })), 5, { noise, seed: 4 });
    assert.deepEqual(notesHeard(audio, settingsWith(calibrationRun(gain, noise))), STRINGS.map((s) => s.midi), `gain ${gain} noise ${noise}`);
  }
});

test('저장된 보정값 읽기: 없거나 망가지면 기본값, 범위 밖은 묶고, 민감도는 곱한다', () => {
  assert.deepEqual(calibValues({}), CALIB_DEFAULTS);
  assert.deepEqual(calibValues(undefined), CALIB_DEFAULTS);
  assert.deepEqual(calibValues({ calib: { version: CALIB_VERSION + 1, values: { minRms: 0.01 } } }), CALIB_DEFAULTS, '다른 판의 보정값은 쓰지 않는다');
  const odd = calibValues({ calib: { version: CALIB_VERSION, values: { minRms: 9, minClarity: 'x', chordMinScore: -1 } } });
  assert.equal(odd.minRms, CALIB_LIMITS.minRms[1]);
  assert.equal(odd.minClarity, CALIB_DEFAULTS.minClarity);
  assert.equal(odd.chordMinScore, CALIB_LIMITS.chordMinScore[0]);
  assert.equal(isCalibrated({}), false);
  const s = { sensitivity: 'normal', calib: { version: CALIB_VERSION, values: { minRms: 0.003, minClarity: 0.75, minSalience: 0.65, chordMinScore: 0.7 } } };
  assert.equal(isCalibrated(s), true);
  assert.equal(chordMinScore(s), 0.7);
  assert.deepEqual(trackerOptions(s), { minRms: 0.003, minClarity: 0.75, minSalience: 0.65 });
  assert.equal(trackerOptions({ ...s, sensitivity: 'low' }).minRms, 0.006);
  assert.equal(trackerOptions({ ...s, sensitivity: 'high' }).minRms, 0.0015);
  assert.equal(trackerOptions({ sensitivity: 'low' }).minRms, 0.008, '보정 전에는 v0.5와 같은 값');
  assert.equal(trackerOptions({ sensitivity: 'high' }, { onsetRatio: 1.35 }).onsetRatio, 1.35);
});

test('보정값은 기록과 함께 저장되고, 내보낸 파일을 가져와도 남는다', () => {
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const p = emptyProgress();
  p.settings.calib = settingsWith(calibrationRun(0.5, 0.002)).calib;
  p.settings.theme = 'light';
  saveProgress(storage, p);
  const back = loadProgress(storage);
  assert.deepEqual(back.settings.calib, p.settings.calib);
  assert.equal(back.settings.theme, 'light');
  // 설정 화면의 가져오기와 같은 방식으로 합친다
  const imported = JSON.parse(JSON.stringify(p));
  const merged = { ...emptyProgress(), ...imported, settings: { ...emptyProgress().settings, ...(imported.settings || {}) } };
  assert.ok(isCalibrated(merged.settings));
  assert.deepEqual(calibValues(merged.settings), p.settings.calib.values);
  assert.equal(p.settings.calib.measured.strings.length, 6);
  assert.equal(p.settings.calib.measured.chords.length, 3);
});

test('애매한 판정: 코드 점수가 기준 바로 아래면 다시 치게 하고, 애매한 음은 틀림으로 세지 않는다', () => {
  const chroma = chromaOf(strumSamples('Em', SR, 0.4).subarray(0, 8192), SR);
  const score = verifyChord(chroma, 'Em', SR).score;
  assert.equal(verifyChord(chroma, 'Em', SR, { minScore: score + 0.02, rivals: [] }).reason, 'unsure');
  assert.equal(verifyChord(chroma, 'Em', SR, { minScore: score + 0.2, rivals: [] }).reason, 'unclear');
  assert.equal(verifyChord(chroma, 'Em', SR, { minScore: score - 0.01, rivals: [] }).ok, true);

  const judge = createWaitJudge([{ midi: 55 }, { midi: 57 }]);
  assert.equal(judge.onNote({ midi: 56, unsure: true }).type, 'unsure');
  assert.equal(judge.wrong, 0);
  assert.equal(judge.onNote({ midi: 56 }).type, 'wrong');
  assert.equal(judge.wrong, 1);
  assert.equal(judge.onNote({ midi: 55 }).type, 'hit');
});

test('애매한 음 표시: 두 음 사이에 걸친 소리는 unsure, 또렷한 음은 아니다', () => {
  // 50센트 어긋난 음(두 음 사이)과 정확한 음
  const between = 440 * 2 ** (-0.5 / 12);
  const events = (freq) => trackEvents(renderPerformance([{ at: 0.3, midi: 69 + 12 * Math.log2(freq / 440), gain: 0.5 }], 1.5, { noise: 0.001 }), createNoteTracker()).filter((e) => e.type === 'note');
  const odd = events(between);
  assert.ok(odd.length >= 1 && odd.every((e) => e.unsure), JSON.stringify(odd));
  const clean = events(440);
  assert.equal(clean.length, 1);
  assert.equal(clean[0].unsure, false);
});
