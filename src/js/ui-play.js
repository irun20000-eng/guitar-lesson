// 단음 연습 화면: 흘러가는 TAB 악보. 기다려 주기 / 박자 맞추기 / 시범 듣기.
import { midiToFreq } from './notes.js';
import { renderPluck } from './synth.js';
import { createNoteTracker } from './tracker.js';
import { createWaitJudge, createTimedJudge } from './judge.js';
import { barCount, sliceBars, scoreBeats, beatMs, describeNote, describeMidi } from './score.js';
import { fretboardSvg } from './diagram.js';
import { micErrorMessage } from './audio.js';
import { starsHtml, clickSamples, trackerOptions } from './listen.js';

const TEMPOS = [50, 60, 70, 80, 90, 100];
const pluckCache = new Map();
function pluckOf(midi, sampleRate) {
  const key = `${midi}@${sampleRate}`;
  if (!pluckCache.has(key)) pluckCache.set(key, renderPluck(midiToFreq(midi), sampleRate, 1.3));
  return pluckCache.get(key);
}

// spec: { score, modes: ['wait', 'timed'], onResult(result) }
export function mountNotePlayer(host, app, spec) {
  const full = spec.score;
  const bars = barCount(full);
  const barOptions = (sel) => Array.from({ length: bars }, (_, i) => `<option value="${i + 1}"${i + 1 === sel ? ' selected' : ''}>${i + 1}</option>`).join('');
  host.innerHTML = `
    <div class="player">
      <div class="player-bar">
        <div class="seg" role="group" aria-label="연습 방식">${spec.modes.map((m) => `<button type="button" class="btn chip" data-mode="${m}">${m === 'wait' ? '기다려 주기' : '박자 맞추기'}</button>`).join('')}</div>
        <label class="field">빠르기 <select data-role="tempo">${TEMPOS.map((t) => `<option value="${t}"${t === 100 ? ' selected' : ''}>${t}%</option>`).join('')}</select></label>
        ${bars > 4 ? `<label class="field">마디 <select data-role="from">${barOptions(1)}</select> ~ <select data-role="to">${barOptions(bars)}</select></label>` : ''}
        <label class="field check"><input type="checkbox" data-role="click"${app.progress.settings.click ? ' checked' : ''}> 박자 소리</label>
      </div>
      <div class="tab-wrap"><canvas class="tab" aria-label="TAB 악보"></canvas></div>
      <div class="player-info">
        <p class="target" role="status" aria-live="polite"></p>
        <p class="heard"></p>
      </div>
      <div class="board"></div>
      <div class="player-actions">
        <button type="button" class="btn primary big" data-act="start">시작</button>
        <button type="button" class="btn" data-act="demo">시범 듣기</button>
        <button type="button" class="btn ghost" data-act="stop" hidden>멈춤</button>
        ${app.env.dev ? '<button type="button" class="btn ghost" data-act="auto">자동 연주(시험)</button>' : ''}
      </div>
      <div class="result" hidden></div>
    </div>`;
  const q = (sel) => host.querySelector(sel);
  const canvas = q('canvas'), g = canvas.getContext('2d');
  const el = { target: q('.target'), heard: q('.heard'), board: q('.board'), result: q('.result'), start: q('[data-act="start"]'), demo: q('[data-act="demo"]'), stop: q('[data-act="stop"]'), tempo: q('[data-role="tempo"]'), from: q('[data-role="from"]'), to: q('[data-role="to"]'), click: q('[data-role="click"]') };
  let mode = spec.modes[0];
  let run = null;       // 진행 중인 연습
  let view = null;      // 화면에 그릴 악보 상태 { notes, states, pos, beatsPerBar, current }
  let raf = 0, destroyed = false;

  function currentScore() {
    if (!el.from) return full;
    const a = Math.min(Number(el.from.value), Number(el.to.value)), b = Math.max(Number(el.from.value), Number(el.to.value));
    return sliceBars(full, a, b);
  }

  function paintModes() {
    for (const b of host.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    el.tempo.closest('.field').hidden = mode === 'wait';
  }

  function setInfo(text, kind = '') {
    el.target.textContent = text;
    el.target.dataset.kind = kind;
  }

  function showTarget(note) {
    if (!note) { el.board.innerHTML = ''; return; }
    setInfo(`칠 음: ${describeNote(note)}`);
    el.board.innerHTML = fretboardSvg([], { current: { string: note.string, fret: note.fret, finger: note.fret || '' }, frets: Math.max(4, note.fret) });
  }

  // ---------- 그리기 ----------
  function colors() {
    const cs = getComputedStyle(host);
    const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
    return { line: v('--tab-line', '#b8ad9c'), ink: v('--ink', '#222'), muted: v('--muted', '#777'), note: v('--tab-note', '#a84f1c'), noteInk: v('--tab-note-ink', '#fff'), good: v('--good', '#1d8348'), warn: v('--warn', '#b9720b'), bad: v('--bad', '#b3261e'), hit: v('--tab-hit', '#1d8348') };
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const c = colors();
    const top = 30, gap = (H - top - 26) / 5, hitX = Math.max(84, W * 0.2), ppb = Math.max(64, Math.min(120, W / 8));
    const yOf = (string) => top + (string - 1) * gap;
    const v = view;
    const pos = v ? v.pos : 0;
    const xOf = (t) => hitX + (t - pos) * ppb;

    g.lineWidth = 1;
    g.font = '600 13px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let s = 1; s <= 6; s++) {
      g.strokeStyle = c.line;
      g.lineWidth = 1 + (s - 1) * 0.35;
      g.beginPath(); g.moveTo(34, yOf(s)); g.lineTo(W - 8, yOf(s)); g.stroke();
      g.fillStyle = c.muted;
      g.fillText(String(s), 16, yOf(s));
    }
    if (v) {
      // 마디선
      g.strokeStyle = c.line; g.lineWidth = 1; g.fillStyle = c.muted; g.font = '600 12px system-ui, sans-serif';
      const total = Math.ceil(v.beats / v.beatsPerBar);
      for (let b = 0; b <= total; b++) {
        const x = xOf(b * v.beatsPerBar) - ppb * 0.45;
        if (x < 34 || x > W) continue;
        g.globalAlpha = 0.55;
        g.beginPath(); g.moveTo(x, top - 8); g.lineTo(x, top + gap * 5 + 8); g.stroke();
        g.globalAlpha = 1;
        if (b < total) g.fillText(String(b + (v.barOffset || 0) + 1), x + 12, 12);
      }
    }
    // 판정선
    g.strokeStyle = c.hit; g.lineWidth = 3; g.globalAlpha = 0.85;
    g.beginPath(); g.moveTo(hitX, top - 12); g.lineTo(hitX, top + gap * 5 + 12); g.stroke();
    g.globalAlpha = 1;
    if (v) {
      v.notes.forEach((n, i) => {
        const x = xOf(n.t), y = yOf(n.string);
        if (x < 20 || x > W + 30) return;
        const st = v.states[i];
        const tail = Math.max(0, n.dur * ppb - 34);
        const fill = st === 'hit' || st === 'perfect' ? c.good : st === 'good' ? c.warn : st === 'miss' ? c.bad : c.note;
        g.globalAlpha = st ? 0.45 : 1;
        if (tail > 6) { g.strokeStyle = fill; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + 14, y); g.lineTo(x + 14 + tail, y); g.stroke(); }
        g.fillStyle = fill;
        g.beginPath(); g.arc(x, y, 15, 0, Math.PI * 2); g.fill();
        if (i === v.current && !st) { g.strokeStyle = c.ink; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 19, 0, Math.PI * 2); g.stroke(); }
        g.fillStyle = c.noteInk; g.font = '800 15px system-ui, sans-serif';
        g.fillText(String(n.fret), x, y + 1);
        g.globalAlpha = 1;
      });
      if (v.count) { g.fillStyle = c.ink; g.font = '800 64px system-ui, sans-serif'; g.globalAlpha = 0.85; g.fillText(v.count, W / 2, H / 2); g.globalAlpha = 1; }
    }
  }

  function idleView() {
    const sc = currentScore();
    view = { notes: sc.notes, states: sc.notes.map(() => null), pos: -1, beats: scoreBeats(sc), beatsPerBar: sc.beatsPerBar, current: 0, barOffset: el.from ? Math.min(Number(el.from.value), Number(el.to.value)) - 1 : 0 };
    showTarget(sc.notes[0]);
    setInfo(mode === 'wait' ? '시작을 누르고 첫 음을 치세요. 맞는 음을 칠 때까지 기다립니다.' : '시작을 누르면 한 마디를 세고 시작합니다. 음표가 초록 선에 닿을 때 치세요.');
    el.heard.textContent = '';
    draw();
  }

  // ---------- 진행 ----------
  function stop(silent) {
    if (run) {
      if (run.unsub) run.unsub();
      cancelAnimationFrame(raf);
      app.audio.stopAll();
      if (run.kind !== 'demo') app.addPracticeTime((performance.now() - run.startedAt) / 1000);
      run = null;
    }
    el.start.hidden = false; el.demo.hidden = false; el.stop.hidden = true;
    if (!silent) idleView();
  }

  function finish() {
    const r = run;
    const result = r.judge.result();
    stop(true);
    draw();
    let detail;
    if (result.mode === 'wait') detail = result.wrong ? `틀린 음 ${result.wrong}번` : '틀린 음 없이 끝까지 쳤어요';
    else {
      detail = `정확 ${result.perfect} · 괜찮음 ${result.good} · 놓침 ${result.miss}`;
      if (Math.abs(result.medianOffset) > 90 && result.perfect + result.good >= 4) detail += `. 전체적으로 ${result.medianOffset > 0 ? '늦게' : '빠르게'} 잡혔어요. 도구의 박자 보정을 해 보면 좋아요`;
    }
    el.result.hidden = false;
    el.result.innerHTML = `${starsHtml(result.stars)}<p class="result-main">${result.stars >= 3 ? '아주 좋아요' : result.stars === 2 ? '잘했어요' : result.stars === 1 ? '끝까지 해냈어요' : '조금만 더 해 봐요'}</p><p class="result-detail">${detail}</p>`;
    setInfo('다시 하려면 시작을 누르세요.');
    if (spec.onResult) spec.onResult(result);
  }

  function schedule(notes, beat, leadSec, target) {
    notes.forEach((n) => app.audio.play(pluckOf(n.midi, app.audio.sampleRate), target, leadSec + (n.t * beat) / 1000));
  }

  async function start(kind, auto = false) {
    stop(true);
    el.result.hidden = true;
    try {
      if (kind === 'demo') await app.audio.ensureContext();
      else await app.ensureInput();
    } catch (err) {
      idleView();
      setInfo(micErrorMessage(err), 'bad');
      return;
    }
    const sc = currentScore();
    const tempo = kind === 'wait' ? 1 : Number(el.tempo.value) / 100;
    const beat = beatMs(sc.bpm, tempo);
    const notes = sc.notes;
    view = { notes, states: notes.map(() => null), pos: kind === 'wait' ? notes[0].t - 0.6 : -sc.beatsPerBar, beats: scoreBeats(sc), beatsPerBar: sc.beatsPerBar, current: 0, barOffset: view ? view.barOffset : 0 };
    run = { kind, notes, beat, startedAt: performance.now(), t0: performance.now() + (kind === 'wait' ? 0 : sc.beatsPerBar * beat) };
    el.start.hidden = true; el.demo.hidden = true; el.stop.hidden = false;

    if (kind !== 'wait') {
      const lead = (sc.beatsPerBar * beat) / 1000;
      const clickOn = el.click.checked;
      const sr = app.audio.sampleRate;
      for (let b = 0; b < sc.beatsPerBar; b++) app.audio.play(clickSamples(sr, b === 0), 'speakers', (b * beat) / 1000);
      if (clickOn && kind !== 'demo') for (let b = 0; b < view.beats; b++) app.audio.play(clickSamples(sr, b % sc.beatsPerBar === 0), 'speakers', lead + (b * beat) / 1000);
      if (kind === 'demo') schedule(notes, beat, lead, 'speakers');
      else if (auto) schedule(notes, beat, lead, 'input');
    } else if (auto) {
      notes.forEach((n, i) => app.audio.play(pluckOf(n.midi, app.audio.sampleRate), 'input', 0.4 + i * 0.45));
    }

    if (kind === 'demo') {
      setInfo('시범을 듣는 중입니다.');
    } else {
      const tracker = createNoteTracker(trackerOptions(app.progress.settings));
      if (kind === 'wait') {
        run.judge = createWaitJudge(notes);
        tracker.setExpected([notes[0].midi]);
        showTarget(notes[0]);
      } else {
        run.judge = createTimedJudge(notes.map((n) => ({ midi: n.midi, timeMs: n.t * beat })), { latencyMs: app.progress.latencyMs });
        showTarget(notes[0]);
      }
      run.unsub = app.listener.subscribe((frame) => {
        if (!run) return;
        if (kind === 'timed') {
          // 판정 범위 안에 든 음들만 기대 음으로 알려 준다.
          const now = frame.time - run.t0 - app.progress.latencyMs;
          tracker.setExpected(notes.filter((n, i) => run.judge.grades[i] === null && Math.abs(n.t * beat - now) <= 260).map((n) => n.midi));
        }
        for (const ev of tracker.push(frame)) {
          if (ev.type !== 'note') continue;
          el.heard.textContent = `들린 음: ${describeMidi(ev.midi)}`;
          if (kind === 'wait') {
            const out = run.judge.onNote(ev);
            if (out.type === 'hit') {
              view.states[out.index] = 'hit';
              view.current = out.index + 1;
              if (out.done) { finish(); return; }
              tracker.setExpected([notes[view.current].midi]);
              showTarget(notes[view.current]);
            } else if (out.type === 'wrong') {
              setInfo(`다른 음이 들렸어요(${describeMidi(out.heard)}). 칠 음: ${describeNote(notes[view.current])}`, 'warn');
            }
          } else {
            const out = run.judge.onEvent({ time: ev.time - run.t0, midi: ev.midi });
            if (out.type === 'hit') view.states[out.index] = out.grade;
          }
        }
      });
    }

    const loop = () => {
      if (!run || destroyed) return;
      const now = performance.now();
      if (run.kind === 'wait') {
        const target = notes[Math.min(view.current, notes.length - 1)].t;
        view.pos += (target - view.pos) * 0.18;
      } else {
        const t = now - run.t0;
        view.pos = t / run.beat;
        view.count = t < 0 ? String(Math.ceil(-t / run.beat)) : '';
        if (run.kind === 'timed') {
          for (const i of run.judge.advance(t)) view.states[i] = 'miss';
          const next = notes.findIndex((n, i) => view.states[i] === null);
          if (next >= 0 && next !== view.current) { view.current = next; showTarget(notes[next]); }
          if (t > view.beats * run.beat + 500) { run.judge.advance(Infinity); finish(); return; }
        } else if (t > view.beats * run.beat + 600) { stop(); return; }
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  host.addEventListener('click', (e) => {
    const m = e.target.closest('[data-mode]');
    if (m) { mode = m.dataset.mode; paintModes(); stop(); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'start') start(mode);
    else if (a.dataset.act === 'demo') start('demo');
    else if (a.dataset.act === 'auto') start(mode, true);
    else if (a.dataset.act === 'stop') stop();
  });
  host.addEventListener('change', (e) => {
    if (e.target === el.click) { app.progress.settings.click = el.click.checked; app.save(); }
    else if (e.target === el.from || e.target === el.to || e.target === el.tempo) stop();
  });
  const onResize = () => { if (!run) draw(); };
  window.addEventListener('resize', onResize);

  paintModes();
  idleView();

  return {
    destroy() {
      destroyed = true;
      stop(true);
      window.removeEventListener('resize', onResize);
    },
  };
}
