import test from 'node:test';
import assert from 'node:assert/strict';
import { createNoteTracker, STRUM_TRACKER } from '../src/js/tracker.js';
import { createWaitJudge, createTimedJudge, starsFor } from '../src/js/judge.js';
import { seq, scoreBeats, barCount, sliceBars, describeNote, patternHits, beatMs } from '../src/js/score.js';
import { CHORDS, CHORD_ORDER, chordStrings, strumSamples, verifyChord, pickOfTwo, createStringCheck } from '../src/js/chords.js';
import { chromaOf } from '../src/js/chroma.js';
import { emptyProgress, loadProgress, saveProgress, recordLesson, recordChange, bestChange, streakOf, weekDays, touchDay, nextLesson, todayPlan, stageSummary, dayKey } from '../src/js/progress.js';
import { midiToName } from '../src/js/notes.js';
import { SR, renderPerformance, eachFrame, trackEvents } from './sim.mjs';
import { makeRng } from './helpers.mjs';

const notesOf = (events) => events.filter((e) => e.type === 'note');
const onsetsOf = (events) => events.filter((e) => e.type === 'onset');

// 작은 별 첫 두 마디(솔 솔 레 레 미 미 레)
const TWINKLE = seq([[3, 0], [3, 0], [2, 3], [2, 3], [1, 0], [1, 0], [2, 3, 2]]);
const performanceOf = (notes, beatSec, lead = 0.3) => notes.map((n) => ({ at: lead + n.t * beatSec, midi: n.midi, string: n.string }));

test('악보 도우미: 차례로 놓기, 마디 자르기, 설명, 스트로크 패턴', () => {
  assert.deepEqual(TWINKLE.map((n) => n.t), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(TWINKLE.map((n) => midiToName(n.midi)), ['G3', 'G3', 'D4', 'D4', 'E4', 'E4', 'D4']);
  const score = { bpm: 80, beatsPerBar: 4, notes: TWINKLE };
  assert.equal(scoreBeats(score), 8);
  assert.equal(barCount(score), 2);
  assert.deepEqual(sliceBars(score, 2, 2).notes.map((n) => [n.t, n.fret]), [[0, 0], [1, 0], [2, 3]]);
  assert.equal(describeNote(TWINKLE[2]), '2번줄 3프렛 (레) · 왼손 약지');
  assert.equal(describeNote(TWINKLE[0]), '3번줄 개방현 (솔)');
  assert.deepEqual(patternHits('D-DU-UDU').map((h) => h.t + h.dir), ['0D', '1D', '1.5U', '2.5U', '3D', '3.5U']);
  assert.equal(beatMs(60), 1000);
  assert.equal(beatMs(80, 0.5), 1500);
});

test('음 추적기: 멜로디를 친 순서대로, 튕긴 시각과 함께 알아낸다', () => {
  const beat = 0.6;
  // 앞 줄이 울리는 채로 다음 줄을 치면 두 음이 섞인다(솔+레 → 낮은 솔처럼 들림). 쳐야 할 음을 알려 주면 구분한다.
  const tracker = createNoteTracker();
  tracker.setExpected(TWINKLE.map((n) => n.midi));
  const events = trackEvents(renderPerformance(performanceOf(TWINKLE, beat), 6), tracker);
  const got = notesOf(events);
  assert.deepEqual(got.map((e) => midiToName(e.midi)), ['G3', 'G3', 'D4', 'D4', 'E4', 'E4', 'D4']);
  got.forEach((e, i) => {
    const expected = (0.3 + TWINKLE[i].t * beat) * 1000;
    assert.ok(Math.abs(e.time - expected) <= 60, `${i}번째 음 시각: 기대 ${expected}, 실제 ${e.time}`);
  });
});

test('음 추적기: 한 번 친 음이 길게 울려도 한 번만 센다', () => {
  for (const midi of [40, 52, 64]) {
    const events = trackEvents(renderPerformance([{ at: 0.3, midi, string: 1 }], 3.5), createNoteTracker());
    assert.equal(notesOf(events).length, 1, `${midiToName(midi)}: ${JSON.stringify(notesOf(events))}`);
  }
});

test('음 추적기: 같은 음을 빠르게 여러 번 쳐도 친 횟수만큼 센다', () => {
  const plucks = [0, 1, 2, 3, 4, 5].map((i) => ({ at: 0.3 + i * 0.3, midi: 64, string: 1 }));
  assert.equal(notesOf(trackEvents(renderPerformance(plucks, 2.6), createNoteTracker())).length, 6);
});

test('음 추적기: 다른 줄이 울리는 중에 새 줄을 쳐도 새 음을 잡는다', () => {
  // 아르페지오처럼 줄을 바꿔 가며 치면 앞 음이 계속 울린다
  const plucks = [[45, 5], [55, 3], [60, 2], [64, 1], [60, 2], [55, 3]].map(([midi, string], i) => ({ at: 0.3 + i * 0.45, midi, string }));
  const tracker = createNoteTracker();
  tracker.setExpected(plucks.map((p) => p.midi));
  const got = notesOf(trackEvents(renderPerformance(plucks, 3.4), tracker));
  assert.deepEqual(got.map((e) => midiToName(e.midi)), ['A2', 'G3', 'C4', 'E4', 'C4', 'G3']);
});

test('음 추적기: 조용하거나 잡음뿐이면 아무 사건도 없다', () => {
  assert.equal(trackEvents(renderPerformance([], 2, { noise: 0.003 }), createNoteTracker()).length, 0);
});

test('기다려 주기 채점: 맞는 음에만 넘어가고 틀린 횟수를 센다', () => {
  const judge = createWaitJudge(TWINKLE);
  assert.equal(judge.onNote({ midi: 62 }).type, 'wrong');
  assert.equal(judge.index, 0);
  for (const n of TWINKLE) assert.equal(judge.onNote({ midi: n.midi }).type, 'hit');
  assert.equal(judge.done, true);
  const r = judge.result();
  assert.equal(r.wrong, 1);
  assert.equal(r.stars, 2);            // 7/8 = 0.875
  assert.equal(starsFor(1), 3);
  assert.equal(starsFor(0.5), 0);
  const unfinished = createWaitJudge(TWINKLE);
  unfinished.onNote({ midi: TWINKLE[0].midi });
  assert.equal(unfinished.result().stars, 0, '끝까지 못 치면 별이 없다');
});

test('박자 채점: 정확, 괜찮음, 놓침을 가른다', () => {
  const notes = [0, 500, 1000, 1500].map((timeMs) => ({ midi: 60, timeMs }));
  const judge = createTimedJudge(notes, { latencyMs: 50 });
  assert.equal(judge.onEvent({ time: 60, midi: 60 }).grade, 'perfect');     // 10ms 늦음
  assert.equal(judge.onEvent({ time: 670, midi: 60 }).grade, 'good');       // 120ms 늦음
  assert.equal(judge.onEvent({ time: 1050, midi: 62 }).type, 'extra');      // 다른 음
  assert.deepEqual(judge.advance(1300), [2]);                               // 세 번째 음은 지나감
  assert.equal(judge.onEvent({ time: 1520, midi: 60 }).grade, 'perfect');
  assert.equal(judge.finished, true);
  const r = judge.result();
  assert.deepEqual([r.perfect, r.good, r.miss, r.extra], [2, 1, 1, 1]);
  assert.equal(r.stars, 1);            // (2 + 0.75) / 4 = 0.69
  // 스트로크처럼 음 높이를 보지 않는 경우
  const strum = createTimedJudge([{ midi: null, timeMs: 0 }, { midi: null, timeMs: 500 }]);
  assert.equal(strum.onEvent({ time: 20 }).type, 'hit');
  assert.equal(strum.onEvent({ time: 480 }).type, 'hit');
});

test('소리 → 추적기 → 박자 채점: 박자에 맞게 친 멜로디는 전부 맞는다', () => {
  const beat = 0.75, lead = 0.5;
  const samples = renderPerformance(performanceOf(TWINKLE, beat, lead), 7);
  // 기기 지연이 없을 때 분석 과정 자체가 만드는 늦음은 0~50ms 정도다. 보정값 0으로도 모두 '정확'이어야 한다.
  const judge = createTimedJudge(TWINKLE.map((n) => ({ midi: n.midi, timeMs: n.t * beat * 1000 })), { latencyMs: 0 });
  const tracker = createNoteTracker();
  tracker.setExpected(TWINKLE.map((n) => n.midi));
  eachFrame(samples, (frame) => {
    for (const ev of tracker.push(frame)) if (ev.type === 'note') judge.onEvent({ time: ev.time - lead * 1000, midi: ev.midi });
    judge.advance(frame.time - lead * 1000);
  });
  const r = judge.result();
  assert.equal(r.perfect, TWINKLE.length, JSON.stringify(r));
  assert.ok(Math.abs(r.medianOffset) <= 50, `중앙 어긋남 ${r.medianOffset}ms`);
});

// 화면의 기다려 주기와 같은 흐름: 지금 쳐야 할 음 하나만 기대 음으로 알려 주고, 맞히면 다음 음으로 바꾼다.
function playWait(notes, plucks, seconds) {
  const judge = createWaitJudge(notes);
  const tracker = createNoteTracker();
  tracker.setExpected([notes[0].midi]);
  const log = [];
  eachFrame(renderPerformance(plucks, seconds), (frame) => {
    for (const ev of tracker.push(frame)) {
      if (ev.type !== 'note' || judge.done) continue;
      const out = judge.onNote(ev);
      log.push(`${frame.time}:${out.type}:${midiToName(ev.midi)}`);
      if (out.type === 'hit' && !out.done) tracker.setExpected([notes[judge.index].midi]);
    }
  });
  return { judge, log };
}

test('기다려 주기 전체 흐름: 개방현을 차례로 치면 틀림 없이 끝난다(앞 줄이 계속 울려도)', () => {
  const notes = seq([[6, 0], [5, 0], [4, 0], [3, 0], [2, 0], [1, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]]);
  for (const gap of [0.45, 0.8]) {
    const { judge, log } = playWait(notes, notes.map((n, i) => ({ at: 0.4 + i * gap, midi: n.midi, string: n.string })), 0.4 + 12 * gap + 1);
    assert.equal(judge.done, true, `간격 ${gap}초: ${log.join(' ')}`);
    assert.equal(judge.wrong, 0, `간격 ${gap}초: ${log.join(' ')}`);
  }
});

test('기다려 주기 전체 흐름: 작은 별을 치면 틀림 없이 끝나고, 틀린 음을 치면 기다린다', () => {
  const good = playWait(TWINKLE, performanceOf(TWINKLE, 0.6), 6);
  assert.equal(good.judge.done, true, good.log.join(' '));
  assert.equal(good.judge.wrong, 0, good.log.join(' '));
  // 세 번째 음(레)을 미로 잘못 친 뒤 다시 레를 친다
  const plucks = performanceOf(TWINKLE.slice(0, 4), 0.6);
  plucks.splice(2, 0, { at: 0.3 + 1.6 * 0.6, midi: 64, string: 1 });
  plucks[3].at = 0.3 + 2.4 * 0.6; plucks[4].at = 0.3 + 3.4 * 0.6;
  const bad = playWait(TWINKLE.slice(0, 4), plucks, 3.5);
  assert.equal(bad.judge.done, true, bad.log.join(' '));
  assert.equal(bad.judge.wrong, 1, bad.log.join(' '));
});

test('기다려 주기 전체 흐름: 큰 베이스 뒤에 살짝 친 멜로디도 알아듣고, 울리기만 하는 음은 새로 친 것으로 세지 않는다', () => {
  // Am 아르페지오: 베이스는 세게, 나머지는 그 절반 세기로
  const arp = seq([[5, 0], [3, 2], [2, 1], [1, 0], [5, 0], [3, 2], [2, 1], [1, 0]]);
  const plucks = arp.map((n, i) => ({ at: 0.4 + i * 0.5, midi: n.midi, string: n.string, gain: n.string === 5 ? 0.6 : 0.28 }));
  const soft = playWait(arp, plucks, 5.5);
  assert.equal(soft.judge.done, true, soft.log.join(' '));
  assert.equal(soft.judge.wrong, 0, soft.log.join(' '));
  // 라(5번줄)를 치고 미(1번줄)를 친 뒤 가만히 있으면, 다음 기대 음이 아직 울리는 라여도 넘어가지 않는다
  const hold = seq([[5, 0], [1, 0], [5, 0]]);
  const waited = playWait(hold, [{ at: 0.4, midi: 45, string: 5, gain: 0.6 }, { at: 0.9, midi: 64, string: 1, gain: 0.3 }], 4.5);
  assert.equal(waited.judge.index, 2, waited.log.join(' '));
});

test('스트로크: 쓸어 친 횟수만큼 튕김을 잡는다', () => {
  for (const [label, gapSec, count] of [['4분음표 60BPM', 1.0, 4], ['8분음표 80BPM', 0.375, 8], ['8분음표 100BPM', 0.3, 8]]) {
    // 내려치기는 굵은 줄부터, 올려치기는 가는 줄부터. 같은 줄을 다시 치면 앞 소리는 끊긴다.
    const plucks = [];
    for (let i = 0; i < count; i++) {
      const strings = chordStrings('Em');
      if (i % 2 === 1) strings.reverse();
      strings.forEach((x, k) => plucks.push({ at: 0.3 + i * gapSec + k * 0.014, midi: x.midi, string: x.num, gain: 0.2 }));
    }
    const onsets = onsetsOf(trackEvents(renderPerformance(plucks, 0.3 + gapSec * count + 0.5), createNoteTracker(STRUM_TRACKER)));
    assert.equal(onsets.length, count, `${label}: ${onsets.map((o) => o.time)}`);
    // 앱의 스트로크 연습은 8분음표 72BPM까지다. 그보다 빠른 100BPM은 횟수만 맞으면 되고 시각은 100ms까지 봐준다.
    const tol = gapSec < 0.35 ? 100 : 60;
    onsets.forEach((o, i) => assert.ok(Math.abs(o.time - (0.3 + i * gapSec) * 1000) <= tol, `${label} ${i}번째 ${o.time}`));
  }
});

test('기다려 주기 채점: 방금 맞힌 음이 다시 들린 것은 틀림으로 세지 않는다', () => {
  const judge = createWaitJudge(TWINKLE);
  judge.onNote({ midi: TWINKLE[0].midi });
  judge.onNote({ midi: TWINKLE[1].midi });
  assert.equal(judge.onNote({ midi: TWINKLE[1].midi }).type, 'echo');
  assert.equal(judge.wrong, 0);
});

test('코드 자료: 운지와 손가락 번호가 서로 맞는다', () => {
  assert.equal(CHORD_ORDER.length, Object.keys(CHORDS).length);
  for (const id of CHORD_ORDER) {
    const c = CHORDS[id];
    assert.equal(c.frets.length, 6, id);
    assert.equal(c.fingers.length, 6, id);
    c.frets.forEach((fret, i) => {
      if (fret <= 0) assert.equal(c.fingers[i], 0, `${id} ${6 - i}번줄: 누르지 않는 줄에 손가락 번호가 있다`);
      else assert.ok(c.fingers[i] >= 1 && c.fingers[i] <= 4, `${id} ${6 - i}번줄: 손가락 번호가 없다`);
    });
    for (const r of c.rivals) assert.ok(CHORDS[r], `${id}의 헷갈리는 코드 ${r} 가 자료에 없다`);
  }
  assert.deepEqual(chordStrings('C').map((s) => midiToName(s.midi)), ['C3', 'E3', 'G3', 'C4', 'E4']);
  assert.deepEqual(chordStrings('Em').map((s) => midiToName(s.midi)), ['E2', 'B2', 'E3', 'G3', 'B3', 'E4']);
  assert.deepEqual(chordStrings('F').map((s) => midiToName(s.midi)), ['F2', 'C3', 'F3', 'A3', 'C4', 'F4']);
  assert.deepEqual(chordStrings('D7').map((s) => midiToName(s.midi)), ['D3', 'A3', 'C4', 'F#4']);
});

// 손으로 친 것처럼 줄마다 세기가 다르고 잡음이 섞인 스트로크
function roughStrum(id, rng, { noise = 0.01, skip = null } = {}) {
  const strings = chordStrings(id).filter((s) => s.num !== skip);
  const plucks = strings.map((s, i) => ({ at: 0.05 + i * 0.016, midi: s.midi, string: s.num, gain: 0.25 + 0.3 * rng.rnd() }));
  const samples = renderPerformance(plucks, 0.5, { noise, seed: Math.floor(rng.rnd() * 1e6) });
  const start = Math.floor(0.17 * SR);
  return chromaOf(samples.subarray(start, start + 8192), SR);
}

test('코드 확인: 맞게 친 코드는 통과한다', () => {
  const rng = makeRng(23);
  let total = 0, ok = 0; const fails = {};
  for (const id of CHORD_ORDER) for (let r = 0; r < 20; r++) {
    total++;
    const v = verifyChord(roughStrum(id, rng), id, SR);
    if (v.ok) ok++; else fails[id] = (fails[id] || 0) + 1;
  }
  assert.ok(ok / total >= 0.95, `통과 ${(ok / total * 100).toFixed(1)}%, 실패 ${JSON.stringify(fails)}`);
});

test('코드 확인: 헷갈리는 코드나 전혀 다른 코드를 치면 걸러 낸다', () => {
  const rng = makeRng(29);
  let total = 0, rejected = 0; const leaks = {};
  for (const [expected, played] of [['Em', 'E'], ['E', 'Em'], ['Am', 'A'], ['A', 'Am'], ['D', 'Dm'], ['Dm', 'D'], ['C', 'Am'], ['Am', 'C'], ['G', 'Em'], ['Fmaj7', 'Am'], ['G7', 'G'], ['E7', 'E'], ['C', 'G'], ['G', 'D'], ['Em', 'D'], ['Am', 'G']]) {
    for (let r = 0; r < 10; r++) {
      total++;
      const v = verifyChord(roughStrum(played, rng), expected, SR);
      if (!v.ok) rejected++; else leaks[`${played}→${expected}`] = (leaks[`${played}→${expected}`] || 0) + 1;
    }
  }
  assert.ok(rejected / total >= 0.9, `걸러 냄 ${(rejected / total * 100).toFixed(1)}%, 새어 나감 ${JSON.stringify(leaks)}`);
  const v = verifyChord(roughStrum('E', makeRng(31)), 'Em', SR);
  assert.equal(v.reason, 'rival');
  assert.equal(v.rival.id, 'E');
});

test('두 코드 가운데 고르기(1분 전환)', () => {
  const rng = makeRng(37);
  for (const [a, b] of [['Em', 'Am'], ['C', 'Am'], ['G', 'Em'], ['G', 'D'], ['C', 'G'], ['C', 'F'], ['A', 'D']]) {
    for (let r = 0; r < 8; r++) {
      assert.equal(pickOfTwo(roughStrum(a, rng), a, b, SR), a, `${a} vs ${b}`);
      assert.equal(pickOfTwo(roughStrum(b, rng), a, b, SR), b, `${b} vs ${a}`);
    }
  }
  const silence = chromaOf(renderPerformance([], 0.5, { noise: 0.002 }).subarray(0, 8192), SR);
  assert.equal(pickOfTwo(silence, 'Em', 'Am', SR), null);
});

function runStringCheck(id, plucks) {
  const check = createStringCheck(id);
  const tracker = createNoteTracker();
  const samples = renderPerformance(plucks, plucks[plucks.length - 1].at + 1.2);
  eachFrame(samples, (frame) => {
    const onset = tracker.push(frame).some((e) => e.type === 'onset');
    check.push(frame, onset);
  });
  return check;
}

test('한 줄씩 점검: 맑은 줄, 먹먹한 줄, 잘못 누른 줄을 가른다', () => {
  const strings = chordStrings('C');
  const good = runStringCheck('C', strings.map((s, i) => ({ at: 0.3 + i * 0.9, midi: s.midi, string: s.num })));
  assert.equal(good.done, true);
  assert.deepEqual(good.results.map((r) => r.kind), ['clear', 'clear', 'clear', 'clear', 'clear']);

  // 2번줄(도)이 먹먹하고, 1번줄은 1프렛을 잘못 눌러 파가 난다
  const bad = runStringCheck('C', strings.map((s, i) => ({ at: 0.3 + i * 0.9, midi: s.num === 1 ? 65 : s.midi, string: s.num, dead: s.num === 2 })));
  assert.deepEqual(bad.results.map((r) => r.kind), ['clear', 'clear', 'clear', 'muffled', 'other']);
  assert.equal(midiToName(bad.results[4].midi), 'F4');
});

test('연습 기록: 저장, 별, 연속 연습일, 오늘의 연습', () => {
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) };
  const p = loadProgress(storage);
  assert.deepEqual(p, emptyProgress());
  recordLesson(p, 'a', 2, 0.85, '2026-11-10');
  recordLesson(p, 'a', 1, 0.7, '2026-11-11');
  assert.deepEqual([p.lessons.a.stars, p.lessons.a.best, p.lessons.a.count, p.lessons.a.last], [2, 0.85, 2, '2026-11-11']);
  touchDay(p, '2026-11-11', 300);
  assert.equal(p.days['2026-11-11'], 300);
  assert.deepEqual(streakOf(p, '2026-11-11'), { current: 2, best: 2, doneToday: true });
  assert.deepEqual(streakOf(p, '2026-11-12'), { current: 2, best: 2, doneToday: false }, '오늘 아직 안 했어도 어제까지 이어졌으면 유지');
  assert.equal(streakOf(p, '2026-11-13').current, 0, '하루를 건너뛰면 끊긴다');
  recordLesson(p, 'b', 3, 1, '2026-11-01');
  assert.equal(streakOf(p, '2026-11-11').best, 2);
  assert.equal(weekDays(p, '2026-11-12').filter((d) => d.done).length, 2);
  assert.equal(recordChange(p, 'Em', 'Am', 12, '2026-11-11'), 12);
  assert.equal(recordChange(p, 'Am', 'Em', 9, '2026-11-11'), 12);
  assert.equal(bestChange(p, 'Am', 'Em'), 12);
  assert.equal(dayKey(new Date(2026, 0, 5)), '2026-01-05');

  const lessons = [{ id: 'a', stage: 0, practice: true }, { id: 'b', stage: 0, practice: true }, { id: 'c', stage: 1, practice: true }];
  assert.equal(nextLesson(p, lessons).id, 'c');
  const plan = todayPlan(p, lessons);
  assert.deepEqual(plan.map((x) => x.kind + (x.lesson ? ':' + x.lesson.id : '')), ['tuner', 'review:a', 'new:c']);
  assert.deepEqual(stageSummary(p, lessons, 0), { total: 2, done: 2, stars: 5, maxStars: 6 });

  assert.equal(saveProgress(storage, p), true);
  assert.deepEqual(loadProgress(storage), p);
  store.set('guitar-lesson.progress.v1', '{깨진 글');
  assert.deepEqual(loadProgress(storage), emptyProgress(), '깨진 저장값은 새 기록으로 시작');
});
