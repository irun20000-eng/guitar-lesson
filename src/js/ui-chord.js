// 코드 연습 화면 조각들: 한 줄씩 점검, 코드 확인, 1분 전환, 스트로크·반주.
import { midiToFreq } from './notes.js';
import { renderPluck } from './synth.js';
import { createNoteTracker, STRUM_TRACKER } from './tracker.js';
import { createTimedJudge, starsFor } from './judge.js';
import { CHORDS, strumSamples, verifyChord, pickOfTwo, createStringCheck } from './chords.js';
import { chromaOf } from './chroma.js';
import { beatMs, patternHits, describeMidi } from './score.js';
import { chordSvg } from './diagram.js';
import { micErrorMessage } from './audio.js';
import { starsHtml, clickSamples, trackerOptions, esc } from './listen.js';
import { bestChange, recordChange } from './progress.js';
import { chordMinScore } from './calibrate.js';

const CHROMA_DELAY_MS = 180;   // 쓸어 친 뒤 여섯 줄이 다 울릴 때까지 기다렸다가 코드를 확인한다
const strumCache = new Map();
function strumOf(id, sampleRate, up = false) {
  const key = `${id}@${sampleRate}@${up}`;
  if (!strumCache.has(key)) strumCache.set(key, strumSamples(id, sampleRate, 1.1, { up }));
  return strumCache.get(key);
}

function resultHtml(stars, main, detail) {
  return `${starsHtml(stars)}<p class="result-main">${esc(main)}</p><p class="result-detail">${esc(detail)}</p>`;
}
const praise = (stars) => (stars >= 3 ? '아주 좋아요' : stars === 2 ? '잘했어요' : stars === 1 ? '끝까지 해냈어요' : '조금만 더 해 봐요');

// 공통: 시작/멈춤과 듣기 구독을 관리한다.
function session(app, el) {
  let unsub = null, startedAt = 0;
  return {
    get active() { return !!unsub; },
    async open(onFrame) {
      try { await app.ensureInput(); } catch (err) { el.status.textContent = micErrorMessage(err); el.status.dataset.kind = 'bad'; return false; }
      startedAt = performance.now();
      unsub = app.listener.subscribe(onFrame);
      return true;
    },
    close() {
      if (!unsub) return;
      unsub();
      unsub = null;
      app.audio.stopAll();
      app.addPracticeTime((performance.now() - startedAt) / 1000);
    },
  };
}

// ---------- 한 줄씩 점검 ----------
export function mountStringCheck(host, app, spec) {
  const chord = CHORDS[spec.chord];
  host.innerHTML = `
    <div class="chordbox">
      <div class="chord-fig"></div>
      <div class="chord-side">
        <h3>${esc(chord.name)} 한 줄씩 점검</h3>
        <p class="status" role="status" aria-live="polite"></p>
        <ol class="string-results"></ol>
        <div class="player-actions">
          <button type="button" class="btn primary" data-act="start">점검 시작</button>
          <button type="button" class="btn" data-act="sound">소리 듣기</button>
          ${app.env.dev ? '<button type="button" class="btn ghost" data-act="auto">자동 연주(시험)</button>' : ''}
        </div>
        <div class="result" hidden></div>
      </div>
    </div>`;
  const q = (sel) => host.querySelector(sel);
  const el = { fig: q('.chord-fig'), status: q('.status'), list: q('.string-results'), result: q('.result'), start: q('[data-act="start"]') };
  const sess = session(app, el);
  let check = createStringCheck(spec.chord);
  const LABEL = { clear: '맑아요', muffled: '먹먹해요', other: '다른 음' };

  function paint() {
    const marks = {};
    check.strings.forEach((s, i) => { if (check.results[i]) marks[s.num] = check.results[i].kind; });
    const active = sess.active && !check.done ? check.strings[check.index].num : null;
    el.fig.innerHTML = chordSvg(spec.chord, { active, marks });
    el.list.innerHTML = check.strings.map((s, i) => {
      const r = check.results[i];
      const text = !r ? (i === check.index && sess.active ? '지금 치세요' : '') : r.kind === 'other' ? `다른 음(${describeMidi(r.midi)})이 나요` : LABEL[r.kind];
      return `<li data-kind="${r ? r.kind : ''}"${i === check.index && sess.active ? ' class="now"' : ''}><span class="s-num">${s.num}</span><span>${text}</span></li>`;
    }).join('');
  }

  function finish() {
    sess.close();
    const total = check.strings.length, clear = check.results.filter((r) => r && r.kind === 'clear').length;
    const accuracy = clear / total;
    const stars = clear === total ? 3 : accuracy >= 0.75 ? 2 : accuracy >= 0.5 ? 1 : 0;
    const bad = check.strings.filter((s, i) => check.results[i].kind !== 'clear');
    const detail = bad.length ? `${bad.map((s) => s.num + '번줄').join(', ')}을 다시 보세요. 손가락을 세우고 프렛 가까이를 눌러 옆줄에 닿지 않게 합니다.` : '모든 줄이 맑게 울렸어요.';
    el.result.hidden = false;
    el.result.innerHTML = resultHtml(stars, clear === total ? '깨끗해요' : `${total}줄 중 ${clear}줄이 맑아요`, detail);
    el.status.textContent = '';
    el.start.textContent = '다시 점검';
    paint();
    if (spec.onResult) spec.onResult({ stars, accuracy });
  }

  async function start(auto) {
    sess.close();
    check = createStringCheck(spec.chord);
    el.result.hidden = true;
    const tracker = createNoteTracker(trackerOptions(app.progress.settings));
    const ok = await sess.open((frame) => {
      const onset = tracker.push(frame).some((e) => e.type === 'onset');
      const out = check.push(frame, onset);
      if (!out) return;
      if (out.done) finish();
      else { el.status.textContent = `${check.strings[check.index].num}번줄을 한 번 쳐 보세요`; paint(); }
    });
    if (!ok) return;
    el.status.dataset.kind = '';
    el.status.textContent = `코드를 잡은 채로 ${check.strings[0].num}번줄부터 한 줄씩 칩니다`;
    paint();
    if (auto) check.strings.forEach((s, i) => app.audio.play(renderPluck(midiToFreq(s.midi), app.audio.sampleRate, 1.2), 'input', 0.4 + i * 0.9));
  }

  host.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'start') start(false);
    else if (a.dataset.act === 'auto') start(true);
    else if (a.dataset.act === 'sound') { await app.audio.ensureContext(); app.audio.play(strumSamples(spec.chord, app.audio.sampleRate, 2), 'speakers'); }
  });
  paint();
  return { destroy() { sess.close(); } };
}

// ---------- 코드 확인(쓸어 쳐서) ----------
export function mountStrumCheck(host, app, spec) {
  const chord = CHORDS[spec.chord];
  const times = spec.times ?? 4;
  host.innerHTML = `
    <div class="chordbox">
      <div class="chord-fig">${chordSvg(spec.chord)}</div>
      <div class="chord-side">
        <h3>${esc(chord.name)} 쳐서 확인</h3>
        <p class="lead">${esc(chord.tip)}</p>
        <div class="dots" aria-hidden="true">${Array.from({ length: times }, () => '<span></span>').join('')}</div>
        <p class="status" role="status" aria-live="polite"></p>
        <div class="player-actions">
          <button type="button" class="btn primary" data-act="start">확인 시작</button>
          <button type="button" class="btn" data-act="sound">소리 듣기</button>
          ${app.env.dev ? '<button type="button" class="btn ghost" data-act="auto">자동 연주(시험)</button>' : ''}
        </div>
        <div class="result" hidden></div>
      </div>
    </div>`;
  const q = (sel) => host.querySelector(sel);
  const el = { status: q('.status'), dots: q('.dots'), result: q('.result'), start: q('[data-act="start"]') };
  const sess = session(app, el);

  async function start(auto) {
    sess.close();
    el.result.hidden = true;
    let ok = 0, attempts = 0, pendingAt = null;
    const paint = () => [...el.dots.children].forEach((d, i) => d.classList.toggle('on', i < ok));
    paint();
    const tracker = createNoteTracker(trackerOptions(app.progress.settings, STRUM_TRACKER));
    const opened = await sess.open((frame) => {
      if (tracker.push(frame).some((e) => e.type === 'onset') && pendingAt === null) pendingAt = frame.time + CHROMA_DELAY_MS;
      if (pendingAt === null || frame.time < pendingAt) return;
      pendingAt = null;
      const v = verifyChord(chromaOf(frame.buf, frame.sampleRate), spec.chord, frame.sampleRate, { minScore: chordMinScore(app.progress.settings) });
      // 기준 바로 아래(애매함)는 시도로 세지 않는다.
      if (v.reason === 'unsure') {
        el.status.dataset.kind = '';
        el.status.textContent = '다시 쳐 볼까요? 코드 소리가 애매하게 들렸어요. 여섯 줄을 고르게 쓸어 쳐 보세요';
        return;
      }
      attempts++;
      if (v.ok) {
        ok++;
        el.status.dataset.kind = 'good';
        el.status.textContent = ok < times ? `좋아요. ${times - ok}번 더 쳐 보세요` : '좋아요';
      } else {
        el.status.dataset.kind = 'warn';
        el.status.textContent = v.reason === 'rival' ? `${CHORDS[v.rival.id].name} 코드처럼 들려요. 코드표와 손가락 자리를 비교해 보세요` : '소리가 또렷하지 않아요. 여섯 줄을 고르게 쓸어 치거나, 한 줄씩 점검으로 안 울리는 줄을 찾아보세요';
      }
      paint();
      if (ok >= times) {
        sess.close();
        const accuracy = ok / attempts, stars = Math.max(1, starsFor(accuracy));
        el.result.hidden = false;
        el.result.innerHTML = resultHtml(stars, praise(stars), `${attempts}번 쳐서 ${ok}번 맞았어요`);
        el.start.textContent = '다시 확인';
        if (spec.onResult) spec.onResult({ stars, accuracy });
      }
    });
    if (!opened) return;
    el.status.dataset.kind = '';
    el.status.textContent = `${chord.name}을 잡고 천천히 ${times}번 쓸어 치세요`;
    if (auto) for (let i = 0; i < times; i++) app.audio.play(strumOf(spec.chord, app.audio.sampleRate), 'input', 0.4 + i * 1.0);
  }

  host.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'start') start(false);
    else if (a.dataset.act === 'auto') start(true);
    else if (a.dataset.act === 'sound') { await app.audio.ensureContext(); app.audio.play(strumSamples(spec.chord, app.audio.sampleRate, 2), 'speakers'); }
  });
  return { destroy() { sess.close(); } };
}

// ---------- 코드 전환(1분) ----------
export function mountChange(host, app, spec) {
  const A = CHORDS[spec.a], B = CHORDS[spec.b];
  const seconds = spec.seconds ?? 60, goal = spec.goal ?? 10;
  host.innerHTML = `
    <div class="change">
      <h3>${esc(A.name)} ↔ ${esc(B.name)} ${seconds}초 전환</h3>
      <p class="lead">한 번 치고 바꾸고, 한 번 치고 바꿉니다. 맞게 바꿀 때마다 한 번으로 셉니다. 목표 ${goal}번.</p>
      <div class="change-row">
        <div class="change-fig" data-id="${spec.a}">${chordSvg(spec.a)}<strong>${esc(A.name)}</strong></div>
        <div class="change-mid"><div class="count-big">0</div><div class="timer"><div></div></div><p class="best"></p></div>
        <div class="change-fig" data-id="${spec.b}">${chordSvg(spec.b)}<strong>${esc(B.name)}</strong></div>
      </div>
      <p class="status" role="status" aria-live="polite"></p>
      <div class="player-actions">
        <button type="button" class="btn primary" data-act="start">시작</button>
        <button type="button" class="btn ghost" data-act="end" hidden>그만하기</button>
        ${app.env.dev ? '<button type="button" class="btn ghost" data-act="auto">자동 연주(시험)</button>' : ''}
      </div>
      <div class="result" hidden></div>
    </div>`;
  const q = (sel) => host.querySelector(sel);
  const el = { status: q('.status'), count: q('.count-big'), bar: q('.timer > div'), best: q('.best'), result: q('.result'), start: q('[data-act="start"]'), end: q('[data-act="end"]') };
  const sess = session(app, el);
  let state = null;
  const paintBest = () => { const b = bestChange(app.progress, spec.a, spec.b); el.best.textContent = b ? `최고 기록 ${b}번` : '첫 기록에 도전하세요'; };
  const paintNext = (id) => { for (const f of host.querySelectorAll('.change-fig')) f.classList.toggle('now', f.dataset.id === id); };

  function finish() {
    if (!state) return;
    const count = state.count;
    state = null;
    sess.close();
    const best = recordChange(app.progress, spec.a, spec.b, count, app.today());
    app.save();
    const stars = count >= goal ? 3 : count >= goal * 0.6 ? 2 : count >= 1 ? 1 : 0;
    el.result.hidden = false;
    el.result.innerHTML = resultHtml(stars, `${count}번 바꿨어요`, count >= best ? '새 최고 기록이에요. 내일은 한 번만 더 해 보세요.' : `최고 기록은 ${best}번이에요.`);
    el.start.hidden = false; el.start.textContent = '다시 도전'; el.end.hidden = true;
    el.status.textContent = '';
    paintNext(null);
    paintBest();
    if (spec.onResult) spec.onResult({ stars, accuracy: Math.min(1, count / goal), count });
  }

  async function start(auto) {
    sess.close();
    el.result.hidden = true;
    state = { count: 0, expected: spec.a, pendingAt: null, startAt: null };
    el.count.textContent = '0';
    const tracker = createNoteTracker(trackerOptions(app.progress.settings, STRUM_TRACKER));
    const opened = await sess.open((frame) => {
      if (!state) return;
      if (state.startAt === null) state.startAt = frame.time;
      const left = seconds * 1000 - (frame.time - state.startAt);
      el.bar.style.width = Math.max(0, (left / (seconds * 1000)) * 100).toFixed(1) + '%';
      if (left <= 0) { finish(); return; }
      if (tracker.push(frame).some((e) => e.type === 'onset') && state.pendingAt === null) state.pendingAt = frame.time + CHROMA_DELAY_MS;
      if (state.pendingAt === null || frame.time < state.pendingAt) return;
      state.pendingAt = null;
      const pick = pickOfTwo(chromaOf(frame.buf, frame.sampleRate), spec.a, spec.b, frame.sampleRate);
      if (pick === state.expected) {
        state.count++;
        state.expected = state.expected === spec.a ? spec.b : spec.a;
        el.count.textContent = String(state.count);
        paintNext(state.expected);
        el.status.textContent = `다음은 ${CHORDS[state.expected].name}`;
      }
    });
    if (!opened) { state = null; return; }
    el.start.hidden = true; el.end.hidden = false;
    el.status.dataset.kind = '';
    el.status.textContent = `${A.name}부터 치세요`;
    paintNext(spec.a);
    if (auto) for (let i = 0; i < 8; i++) app.audio.play(strumOf(i % 2 ? spec.b : spec.a, app.audio.sampleRate), 'input', 0.4 + i * 0.8);
  }

  host.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'start') start(false);
    else if (a.dataset.act === 'auto') start(true);
    else if (a.dataset.act === 'end') finish();
  });
  paintBest();
  return { destroy() { state = null; sess.close(); } };
}

// ---------- 스트로크·반주 ----------
// spec: { title, bars: ['G', 'Em', ...], pattern: 'D-DU-UDU', bpm, onResult }
export function mountRhythm(host, app, spec) {
  const beatsPerBar = spec.pattern.length / 2;
  const base = patternHits(spec.pattern);
  const hits = [];
  spec.bars.forEach((id, b) => base.forEach((h) => hits.push({ t: b * beatsPerBar + h.t, dir: h.dir, chord: id, bar: b })));
  const totalBeats = spec.bars.length * beatsPerBar;
  const pieceChords = Array.from(new Set(spec.bars));
  host.innerHTML = `
    <div class="player rhythm">
      <div class="player-bar">
        <strong>${esc(spec.title || '스트로크')}</strong>
        <label class="field">빠르기 <select data-role="tempo">${[50, 60, 70, 80, 90, 100].map((t) => `<option value="${t}"${t === 100 ? ' selected' : ''}>${t}%</option>`).join('')}</select></label>
        <label class="field check"><input type="checkbox" data-role="click"${app.progress.settings.click ? ' checked' : ''}> 박자 소리</label>
      </div>
      <div class="tab-wrap"><canvas class="tab lane" aria-label="스트로크 악보"></canvas></div>
      <div class="player-info"><p class="status target" role="status" aria-live="polite"></p><p class="heard"></p></div>
      <div class="now-chord"></div>
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
  const el = { status: q('.status'), heard: q('.heard'), now: q('.now-chord'), result: q('.result'), start: q('[data-act="start"]'), demo: q('[data-act="demo"]'), stop: q('[data-act="stop"]'), tempo: q('[data-role="tempo"]'), click: q('[data-role="click"]') };
  const sess = session(app, el);
  let run = null, raf = 0, destroyed = false, shownBar = -1;
  let view = { pos: -1, states: hits.map(() => null), count: '' };

  function showBar(b) {
    if (b === shownBar) return;
    shownBar = b;
    const id = spec.bars[Math.max(0, Math.min(b, spec.bars.length - 1))];
    const next = spec.bars[b + 1];
    el.now.innerHTML = `<div class="now-fig">${chordSvg(id)}</div><div><p class="now-name">${esc(CHORDS[id].name)}</p><p class="lead">${next ? `다음 마디: ${esc(CHORDS[next].name)}` : '마지막 마디'}</p></div>`;
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const cs = getComputedStyle(host), v = (name, fb) => cs.getPropertyValue(name).trim() || fb;
    const c = { line: v('--tab-line', '#b8ad9c'), ink: v('--ink', '#222'), muted: v('--muted', '#777'), note: v('--tab-note', '#a84f1c'), good: v('--good', '#1d8348'), warn: v('--tab-good', '#b9720b'), bad: v('--bad', '#b3261e'), hit: v('--tab-hit', '#1d8348') };
    const hitX = Math.max(84, W * 0.2), ppb = Math.max(70, Math.min(130, W / 7)), y = H * 0.6;
    const xOf = (t) => hitX + (t - view.pos) * ppb;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeStyle = c.line; g.lineWidth = 2;
    g.beginPath(); g.moveTo(8, y + 34); g.lineTo(W - 8, y + 34); g.stroke();
    for (let b = 0; b <= spec.bars.length; b++) {
      const x = xOf(b * beatsPerBar) - ppb * 0.25;
      if (x < 0 || x > W) continue;
      g.globalAlpha = 0.5; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, 10); g.lineTo(x, y + 34); g.stroke();
      g.globalAlpha = 1;
      if (b < spec.bars.length) { g.fillStyle = c.ink; g.font = '800 20px system-ui, sans-serif'; g.textAlign = 'left'; g.fillText(CHORDS[spec.bars[b]].name, x + 8, 24); g.textAlign = 'center'; }
    }
    g.strokeStyle = c.hit; g.lineWidth = 3; g.globalAlpha = 0.85;
    g.beginPath(); g.moveTo(hitX, 40); g.lineTo(hitX, y + 40); g.stroke();
    g.globalAlpha = 1;
    hits.forEach((h, i) => {
      const x = xOf(h.t);
      if (x < 24 || x > W + 20) return;
      const st = view.states[i];
      g.fillStyle = st === 'perfect' ? c.good : st === 'good' ? c.warn : st === 'miss' ? c.bad : c.note;
      g.globalAlpha = st ? 0.5 : 1;
      const up = h.dir === 'U', size = up ? 13 : 17, top = y - 26, bottom = y + 22;
      g.fillRect(x - 3, up ? top + size : top, 6, bottom - top - size);
      g.beginPath();
      if (up) { g.moveTo(x, top); g.lineTo(x - size, top + size + 2); g.lineTo(x + size, top + size + 2); }
      else { g.moveTo(x, bottom); g.lineTo(x - size, bottom - size - 2); g.lineTo(x + size, bottom - size - 2); }
      g.closePath(); g.fill();
      g.globalAlpha = 1;
    });
    if (view.count) { g.fillStyle = c.ink; g.font = '800 64px system-ui, sans-serif'; g.globalAlpha = 0.85; g.fillText(view.count, W / 2, H / 2); g.globalAlpha = 1; }
  }

  function stop(silent) {
    cancelAnimationFrame(raf);
    sess.close();
    app.audio.stopAll();
    run = null;
    el.start.hidden = false; el.demo.hidden = false; el.stop.hidden = true;
    if (!silent) { view = { pos: -1, states: hits.map(() => null), count: '' }; showBar(0); el.status.textContent = '시작을 누르면 한 마디를 세고 시작합니다. 화살표가 초록 선에 닿을 때 치세요.'; draw(); }
  }

  function finish() {
    const r = run;
    const result = r.judge.result();
    const voted = r.votes.filter((v) => v.total > 0);
    const chordOk = voted.filter((v) => v.ok * 2 >= v.total).length;
    const chordRatio = voted.length ? chordOk / voted.length : 1;
    let stars = result.stars;
    if (chordRatio < 0.5) stars = Math.min(stars, 1);
    stop(true);
    draw();
    el.result.hidden = false;
    el.result.innerHTML = resultHtml(stars, praise(stars), `박자 정확 ${result.perfect} · 괜찮음 ${result.good} · 놓침 ${result.miss} · 코드가 맞은 마디 ${chordOk}/${voted.length}`);
    el.status.textContent = '다시 하려면 시작을 누르세요.';
    if (spec.onResult) spec.onResult({ stars, accuracy: result.accuracy * (0.5 + 0.5 * chordRatio) });
  }

  async function start(kind, auto = false) {
    stop(true);
    el.result.hidden = true;
    const beat = beatMs(spec.bpm, Number(el.tempo.value) / 100);
    const lead = (beatsPerBar * beat) / 1000;
    if (kind === 'demo') { try { await app.audio.ensureContext(); } catch (err) { return; } }
    const sr = () => app.audio.sampleRate;
    view = { pos: -beatsPerBar, states: hits.map(() => null), count: '' };
    run = { kind, beat, t0: 0, judge: createTimedJudge(hits.map((h) => ({ midi: null, timeMs: h.t * beat })), { latencyMs: app.progress.latencyMs, perfectMs: 90, goodMs: 180 }), votes: spec.bars.map(() => ({ ok: 0, total: 0 })), pending: [] };
    if (kind !== 'demo') {
      const tracker = createNoteTracker(trackerOptions(app.progress.settings, STRUM_TRACKER));
      const opened = await sess.open((frame) => {
        if (!run) return;
        for (const ev of tracker.push(frame)) {
          if (ev.type !== 'onset') continue;
          const out = run.judge.onEvent({ time: ev.time - run.t0 });
          if (out.type === 'hit') { view.states[out.index] = out.grade; run.pending.push({ at: frame.time + CHROMA_DELAY_MS, bar: hits[out.index].bar }); }
        }
        while (run.pending.length && frame.time >= run.pending[0].at) {
          const p = run.pending.shift();
          const id = spec.bars[p.bar];
          const v = verifyChord(chromaOf(frame.buf, frame.sampleRate), id, frame.sampleRate, { rivals: pieceChords.filter((x) => x !== id), minScore: chordMinScore(app.progress.settings) });
          if (v.reason === 'unsure') { el.heard.textContent = '다시 쳐 볼까요? 코드 소리가 애매했어요'; continue; }
          run.votes[p.bar].total++;
          if (v.ok) run.votes[p.bar].ok++;
          el.heard.textContent = v.ok ? `${CHORDS[id].name} 좋아요` : v.reason === 'rival' ? `${CHORDS[v.rival.id].name}처럼 들려요` : '코드 소리가 또렷하지 않아요';
        }
      });
      if (!opened) { run = null; return; }
    }
    run.t0 = performance.now() + beatsPerBar * beat;
    el.start.hidden = true; el.demo.hidden = true; el.stop.hidden = false;
    el.status.dataset.kind = '';
    el.status.textContent = kind === 'demo' ? '시범을 듣는 중입니다.' : '화살표가 초록 선에 닿을 때 치세요.';
    for (let b = 0; b < beatsPerBar; b++) app.audio.play(clickSamples(sr(), b === 0), 'speakers', (b * beat) / 1000);
    if (el.click.checked && kind !== 'demo') for (let b = 0; b < totalBeats; b++) app.audio.play(clickSamples(sr(), b % beatsPerBar === 0), 'speakers', lead + (b * beat) / 1000);
    if (kind === 'demo' || auto) hits.forEach((h) => app.audio.play(strumOf(h.chord, sr(), h.dir === 'U'), kind === 'demo' ? 'speakers' : 'input', lead + (h.t * beat) / 1000));

    const loop = () => {
      if (!run || destroyed) return;
      const t = performance.now() - run.t0;
      view.pos = t / run.beat;
      view.count = t < 0 ? String(Math.ceil(-t / run.beat)) : '';
      showBar(Math.max(0, Math.floor(view.pos / beatsPerBar)));
      if (run.kind !== 'demo') for (const i of run.judge.advance(t)) view.states[i] = 'miss';
      if (t > totalBeats * run.beat + 500) {
        if (run.kind === 'demo') stop(); else { run.judge.advance(Infinity); finish(); }
        return;
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  host.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'start') start('play');
    else if (a.dataset.act === 'demo') start('demo');
    else if (a.dataset.act === 'auto') start('play', true);
    else if (a.dataset.act === 'stop') stop();
  });
  host.addEventListener('change', (e) => {
    if (e.target === el.click) { app.progress.settings.click = el.click.checked; app.save(); }
    else if (e.target === el.tempo) stop();
  });
  const onResize = () => { if (!run) draw(); };
  window.addEventListener('resize', onResize);
  stop();
  return { destroy() { destroyed = true; stop(true); window.removeEventListener('resize', onResize); } };
}
