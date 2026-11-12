import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, LESSONS, SONGS, LESSON_INDEX, lessonById, isPractice } from '../src/js/lessons-data.js';
import { CHORDS } from '../src/js/chords.js';
import { scoreBeats, barCount, patternHits } from '../src/js/score.js';
import { chordSvg, fretboardSvg, openStringsSvg, figureSvg } from '../src/js/diagram.js';
import { midiToName } from '../src/js/notes.js';

test('레슨 자료: 단계마다 레슨이 있고 번호가 겹치지 않는다', () => {
  assert.equal(STAGES.length, 11);
  STAGES.forEach((s, i) => assert.equal(s.n, i));
  const ids = LESSONS.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length, '레슨 번호가 겹친다');
  for (const st of STAGES) assert.ok(LESSONS.some((l) => l.stage === st.n), `${st.n}단계에 레슨이 없다`);
  // 단계 순서대로 놓여 있어야 "다음 레슨"이 자연스럽다
  for (let i = 1; i < LESSONS.length; i++) assert.ok(LESSONS[i].stage >= LESSONS[i - 1].stage, `${LESSONS[i].id} 순서`);
  assert.equal(LESSON_INDEX.length, LESSONS.length);
  assert.equal(lessonById('3-1').title, '코드표 읽기와 Em');
});

test('레슨 자료: 모든 단계가 화면에 그릴 수 있는 내용이다', () => {
  const types = new Set(['card', 'tuner', 'notes', 'strings', 'strum', 'change', 'rhythm']);
  for (const lesson of LESSONS) {
    assert.ok(lesson.title && lesson.goal && lesson.steps.length, lesson.id);
    for (const step of lesson.steps) {
      const where = `${lesson.id} ${step.type}`;
      assert.ok(types.has(step.type), where);
      if (step.type === 'card') {
        assert.ok(step.title && step.body.length && step.body.every((p) => typeof p === 'string' && p.length > 5), where);
        if (step.figure) assert.ok(figureSvg(step.figure).startsWith('<svg'), where + ' 그림');
      }
      if (step.type === 'notes') {
        assert.ok(step.score.notes.length >= 4, where);
        for (const n of step.score.notes) {
          assert.ok(n.string >= 1 && n.string <= 6 && n.fret >= 0 && n.fret <= 4 && Number.isInteger(n.midi), `${where}: ${JSON.stringify(n)}`);
          assert.ok(n.dur > 0, where);
        }
        assert.ok(step.modes.length && step.modes.every((m) => m === 'wait' || m === 'timed'), where);
        assert.ok(step.score.bpm >= 40 && step.score.bpm <= 120, where);
      }
      if (step.type === 'strings' || step.type === 'strum') assert.ok(CHORDS[step.chord], where + ' ' + step.chord);
      if (step.type === 'change') assert.ok(CHORDS[step.a] && CHORDS[step.b] && step.a !== step.b && step.goal > 0, where);
      if (step.type === 'rhythm') {
        assert.ok(step.bars.length && step.bars.every((id) => CHORDS[id]), where);
        assert.ok(/^[DU-]+$/.test(step.pattern) && step.pattern.length % 2 === 0 && patternHits(step.pattern).length > 0, where);
        assert.ok(step.bpm >= 40 && step.bpm <= 120, where);
      }
    }
    // 코드를 쓰는 연습은 그 코드를 먼저(같은 레슨이나 앞 레슨에서) 소개한 뒤여야 한다
    assert.equal(typeof isPractice(lesson.steps[0]), 'boolean');
  }
});

test('레슨 자료: 코드는 연습에 쓰이기 전에 코드표로 소개된다', () => {
  const shown = new Set();
  for (const lesson of LESSONS) {
    for (const step of lesson.steps) {
      if (step.type === 'card' && step.figure && step.figure.kind === 'chord') shown.add(step.figure.id);
      const used = step.type === 'strings' || step.type === 'strum' ? [step.chord] : step.type === 'change' ? [step.a, step.b] : step.type === 'rhythm' ? step.bars : [];
      // 한 줄 점검과 코드 확인 화면은 스스로 코드표를 보여 주므로 소개로 친다
      if (step.type === 'strings' || step.type === 'strum') shown.add(step.chord);
      for (const id of used) assert.ok(shown.has(id), `${lesson.id}: ${id} 코드를 소개하기 전에 연습에 썼다`);
    }
  }
});

test('곡 자료: 멜로디의 마디와 음이 맞는다', () => {
  const byId = Object.fromEntries(SONGS.map((s) => [s.id, s]));
  const names = (id) => byId[id].score.notes.map((n) => midiToName(n.midi));
  // 작은 별(사장조): 솔 솔 레 레 미 미 레 / 도 도 시 시 라 라 솔
  assert.deepEqual(names('twinkle').slice(0, 14), ['G3', 'G3', 'D4', 'D4', 'E4', 'E4', 'D4', 'C4', 'C4', 'B3', 'B3', 'A3', 'A3', 'G3']);
  assert.equal(scoreBeats(byId.twinkle.score), 48);
  assert.equal(barCount(byId.twinkle.score), 12);
  // 메리의 어린 양(다장조): 미 레 도 레 미 미 미
  assert.deepEqual(names('mary').slice(0, 7), ['E4', 'D4', 'C4', 'D4', 'E4', 'E4', 'E4']);
  assert.equal(scoreBeats(byId.mary.score), 32);
  // 환희의 송가: 미 미 파 솔 솔 파 미 레 도 도 레 미 미 레 레
  assert.deepEqual(names('ode').slice(0, 15), ['E4', 'E4', 'F4', 'G4', 'G4', 'F4', 'E4', 'D4', 'C4', 'C4', 'D4', 'E4', 'E4', 'D4', 'D4']);
  assert.equal(scoreBeats(byId.ode.score), 32);
  assert.equal(scoreBeats(byId['twinkle-solo'].score), 16);
  for (const s of SONGS) {
    assert.ok(s.title && s.source, s.id);
    if (s.kind === 'melody') {
      // 마디 안에서 음이 겹치거나 비지 않는다
      let t = 0;
      for (const n of s.score.notes) { assert.ok(Math.abs(n.t - t) < 1e-9, `${s.id}: 음 위치 ${n.t} != ${t}`); t += n.dur; }
      assert.equal(scoreBeats(s.score) % s.score.beatsPerBar, 0, `${s.id}: 마지막 마디가 차지 않았다`);
    } else {
      assert.ok(s.bars.every((id) => CHORDS[id]), s.id);
    }
  }
});

test('그림: 코드표와 지판 그림이 내용대로 그려진다', () => {
  const c = chordSvg('C');
  assert.equal((c.match(/class="dg-dot"/g) || []).length, 3, 'C는 점 세 개');
  assert.equal((c.match(/class="dg-open"/g) || []).length, 2, 'C는 개방현 두 줄');
  assert.equal((c.match(/class="dg-mute"/g) || []).length, 1, 'C는 6번줄을 치지 않는다');
  const f = chordSvg('F');
  assert.ok(f.includes('dg-barre'), 'F는 바레 표시');
  assert.equal((f.match(/class="dg-dot"/g) || []).length, 3, 'F는 바레 밖 점 세 개');
  assert.ok(chordSvg('Em', { active: 5, marks: { 6: 'clear' } }).includes('is-active'));
  const b = fretboardSvg([{ string: 2, fret: 1, finger: 1, label: '도' }], { current: { string: 1, fret: 0 } });
  assert.ok(b.includes('>도<') && b.includes('is-current'));
  assert.ok(openStringsSvg().includes('6번줄') && openStringsSvg().includes('E 미'));
});
