// 채점. 두 가지 방식이 있다.
// 기다려 주기: 맞는 음을 칠 때까지 기다린다. 박자는 보지 않는다.
// 박자 맞추기: 정해진 시각에 맞는 음(또는 스트로크)을 쳤는지 본다.

export function starsFor(accuracy) {
  return accuracy >= 0.95 ? 3 : accuracy >= 0.8 ? 2 : accuracy >= 0.6 ? 1 : 0;
}

// notes: [{ midi }]
export function createWaitJudge(notes) {
  let index = 0, wrong = 0;
  return {
    get index() { return index; },
    get wrong() { return wrong; },
    get done() { return index >= notes.length; },
    onNote(ev) {
      if (index >= notes.length) return { type: 'done' };
      if (ev.midi === notes[index].midi) {
        index++;
        return { type: 'hit', index: index - 1, done: index >= notes.length };
      }
      // 방금 맞힌 음이 아직 울려서 다시 들린 것은 틀림으로 세지 않는다.
      if (index > 0 && ev.midi === notes[index - 1].midi) return { type: 'echo' };
      wrong++;
      return { type: 'wrong', heard: ev.midi, expected: notes[index].midi, index };
    },
    result() {
      const accuracy = notes.length ? index / (index + wrong) || 0 : 0;
      return { mode: 'wait', total: notes.length, hit: index, wrong, accuracy, stars: index >= notes.length ? Math.max(1, starsFor(accuracy)) : 0 };
    },
  };
}

// notes: [{ midi | null, timeMs }]. midi가 null이면 어떤 소리든(스트로크) 시각만 본다.
export function createTimedJudge(notes, options = {}) {
  const latencyMs = options.latencyMs ?? 0;
  const perfectMs = options.perfectMs ?? 80;
  const goodMs = options.goodMs ?? 160;
  const grades = notes.map(() => null);
  const offsets = [];
  let extra = 0;

  return {
    grades,
    get extra() { return extra; },
    // ev: { time(ms, 연습 시작 기준), midi? }
    onEvent(ev) {
      const t = ev.time - latencyMs;
      let best = -1, bestDist = Infinity;
      for (let i = 0; i < notes.length; i++) {
        if (grades[i] !== null) continue;
        if (notes[i].midi != null && notes[i].midi !== ev.midi) continue;
        const d = Math.abs(t - notes[i].timeMs);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      if (best >= 0 && bestDist <= goodMs) {
        grades[best] = bestDist <= perfectMs ? 'perfect' : 'good';
        offsets.push(t - notes[best].timeMs);
        return { type: 'hit', index: best, grade: grades[best], offset: t - notes[best].timeMs };
      }
      extra++;
      return { type: 'extra' };
    },
    // 지나가 버린 음을 놓침으로 처리하고, 새로 놓친 음 번호를 돌려준다.
    advance(nowMs) {
      const t = nowMs - latencyMs;
      const missed = [];
      for (let i = 0; i < notes.length; i++) {
        if (grades[i] === null && notes[i].timeMs + goodMs < t) { grades[i] = 'miss'; missed.push(i); }
      }
      return missed;
    },
    get finished() { return grades.every((g) => g !== null); },
    result() {
      const count = (g) => grades.filter((x) => x === g).length;
      const perfect = count('perfect'), good = count('good'), miss = notes.length - perfect - good;
      const accuracy = notes.length ? (perfect + 0.75 * good) / notes.length : 0;
      const sorted = offsets.slice().sort((a, b) => a - b);
      const medianOffset = sorted.length ? sorted[sorted.length >> 1] : 0;
      return { mode: 'timed', total: notes.length, perfect, good, miss, extra, accuracy, medianOffset, stars: starsFor(accuracy) };
    },
  };
}
