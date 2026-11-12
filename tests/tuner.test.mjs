import test from 'node:test';
import assert from 'node:assert/strict';
import { createTuner, median } from '../src/js/tuner.js';
import { midiToFreq } from '../src/js/notes.js';

const detuned = (midi, cents) => midiToFreq(midi) * 2 ** (cents / 1200);
const frame = (freq, extra = {}) => ({ freq, clarity: 0.97, rms: 0.05, ...extra });
const QUIET = { freq: 0, clarity: 0, rms: 0.0001 };

// 50ms 간격으로 같은 프레임을 여러 번 넣고 마지막 결과를 돌려준다.
function feed(tuner, f, count, startMs, target = null) {
  let out;
  for (let i = 0; i < count; i++) out = tuner.update(f, startMs + i * 50, target);
  return out;
}

test('중앙값', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.ok(Number.isNaN(median([])));
});

test('자동 모드: 가장 가까운 줄을 고르고 방향을 알려 준다', () => {
  const t = createTuner();
  const low = feed(t, frame(detuned(40, -20)), 5, 0);
  assert.equal(low.stringNum, 6);
  assert.equal(low.direction, 'low');
  assert.ok(Math.abs(low.cents + 20) < 0.01);
  assert.equal(low.inTune, false);

  const t2 = createTuner();
  const high = feed(t2, frame(detuned(55, 15)), 5, 0);
  assert.equal(high.stringNum, 3);
  assert.equal(high.direction, 'high');
});

test('맞은 상태로 0.6초 유지해야 맞춤 완료가 된다', () => {
  const t = createTuner();
  const early = feed(t, frame(detuned(45, 2)), 5, 0);       // 0~200ms
  assert.equal(early.inTune, true);
  assert.equal(early.locked, false);
  const later = feed(t, frame(detuned(45, 2)), 14, 250);    // ~900ms
  assert.equal(later.locked, true);
  assert.equal(later.stringNum, 5);
});

test('중간에 벗어나면 유지 시간이 다시 0부터', () => {
  const t = createTuner();
  feed(t, frame(detuned(45, 0)), 8, 0);
  const off = feed(t, frame(detuned(45, 25)), 5, 400);
  assert.equal(off.inTune, false);
  const back = feed(t, frame(detuned(45, 0)), 5, 650);
  assert.equal(back.inTune, true);
  assert.equal(back.locked, false);
});

test('한 프레임 튄 값으로는 흔들리지 않는다', () => {
  const t = createTuner();
  feed(t, frame(detuned(40, 1)), 6, 0);
  const spike = t.update(frame(detuned(40, 1) * 2), 300);   // 옥타브 위로 한 번 튐(4번줄 근처)
  assert.equal(spike.stringNum, 6, '줄이 바뀌면 안 된다');
  const after = feed(t, frame(detuned(40, 1)), 10, 350);
  assert.equal(after.stringNum, 6);
  assert.equal(after.locked, true);
});

test('다른 줄을 계속 치면 그 줄로 넘어간다', () => {
  const t = createTuner();
  feed(t, frame(detuned(40, 0)), 5, 0);
  const next = feed(t, frame(detuned(45, -10)), 5, 250);
  assert.equal(next.stringNum, 5);
  assert.equal(next.direction, 'low');
});

test('줄을 직접 고르면 멀리 벗어난 소리도 그 줄 기준으로 잰다', () => {
  const t = createTuner();
  // 6번줄을 골랐는데 300센트 낮은 소리(새 줄이 많이 풀린 상황)
  const r = feed(t, frame(detuned(40, -300)), 5, 0, 6);
  assert.equal(r.stringNum, 6);
  assert.ok(Math.abs(r.cents + 300) < 0.01);
  assert.equal(r.direction, 'low');
});

test('조용하거나 흐린 소리는 판단하지 않는다', () => {
  const t = createTuner();
  assert.equal(t.update(QUIET, 0).status, 'silent');
  assert.equal(t.update(frame(110, { clarity: 0.5 }), 50).status, 'unclear');
  feed(t, frame(detuned(45, 0)), 5, 100);
  // 잠깐(0.5초 이내) 끊기면 직전 값을 유지
  assert.equal(t.update(QUIET, 400).status, 'hold');
  // 오래 조용하면 초기화
  assert.equal(t.update(QUIET, 1200).status, 'silent');
  const fresh = t.update(frame(detuned(45, 0)), 1250);
  assert.equal(fresh.inTune, false, '초기화 뒤 첫 프레임만으로는 맞았다고 하지 않는다');
});
