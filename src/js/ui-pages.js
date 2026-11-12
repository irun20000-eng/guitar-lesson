// 홈, 배우는 순서, 곡, 도구(코드표, 메트로놈, 박자 보정, 설정) 화면.
import { STAGES, LESSONS, LESSON_INDEX, SONGS } from './lessons-data.js';
import { CHORDS, CHORD_ORDER, strumSamples } from './chords.js';
import { chordSvg } from './diagram.js';
import { mountNotePlayer } from './ui-play.js';
import { mountStringCheck, mountStrumCheck, mountRhythm } from './ui-chord.js';
import { createNoteTracker } from './tracker.js';
import { streakOf, weekDays, todayPlan, stageSummary, lessonStars, emptyProgress, PROGRESS_KEY } from './progress.js';
import { micErrorMessage } from './audio.js';
import { starsHtml, esc, clickSamples, trackerOptions } from './listen.js';

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
const PATTERNS = [['D-D-D-D-', '네 번 내려치기'], ['DUDUDUDU', '8비트(내리고 올리기)'], ['D-DU-UDU', '칼립소']];
const patternArrows = (p) => [...p].map((ch) => (ch === 'D' ? '↓' : ch === 'U' ? '↑' : '·')).join(' ');

// 홈 화면 그림: 조명 아래 놓인 기타의 울림구멍과 여섯 줄. 사진 대신 벡터로 그려 파일 하나에 담는다.
const HERO_ART = '<svg viewBox="0 0 900 420" preserveAspectRatio="xMaxYMid slice" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="ha-spot" cx="18%" cy="0%" r="95%"><stop offset="0" stop-color="#f5b342" stop-opacity=".5"/><stop offset=".5" stop-color="#f5b342" stop-opacity=".1"/><stop offset="1" stop-color="#f5b342" stop-opacity="0"/></radialGradient><radialGradient id="ha-top" cx="58%" cy="42%" r="78%"><stop offset="0" stop-color="#d39a52"/><stop offset=".5" stop-color="#8a5530"/><stop offset="1" stop-color="#2a1a22"/></radialGradient><linearGradient id="ha-neck" x1="0" x2="1"><stop offset="0" stop-color="#120e19"/><stop offset="1" stop-color="#2b1d24"/></linearGradient><filter id="ha-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter><filter id="ha-glow" x="-10%" y="-400%" width="120%" height="900%"><feGaussianBlur stdDeviation="2.4"/></filter></defs><rect width="900" height="420" fill="#141126"/><g filter="url(#ha-blur)"><circle cx="120" cy="70" r="46" fill="#f5b342" opacity=".5"/><circle cx="300" cy="350" r="38" fill="#5cd3c0" opacity=".35"/><circle cx="60" cy="330" r="30" fill="#ff8f82" opacity=".35"/><circle cx="380" cy="60" r="24" fill="#a08cff" opacity=".45"/></g><path d="M430-40C560-70 900-60 980 120c60 140-20 350-220 380-160 20-290-30-330-80z" fill="url(#ha-top)"/><g transform="translate(660 215)"><circle r="118" fill="none" stroke="#2a1a22" stroke-width="22" opacity=".5"/><circle r="126" fill="none" stroke="#f5b342" stroke-width="2"/><circle r="117" fill="none" stroke="#5cd3c0" stroke-width="6" stroke-dasharray="3 9"/><circle r="107" fill="none" stroke="#ff8f82" stroke-width="7" stroke-dasharray="14 6" opacity=".85"/><circle r="98" fill="none" stroke="#f5b342" stroke-width="2"/><circle r="91" fill="#07080d"/></g><path d="M-20 166L560 149v134L-20 264z" fill="url(#ha-neck)"/><path d="M70 163.9L70 266.4" stroke="#d9d2c2" stroke-opacity=".55" stroke-width="3"/><path d="M190 160.3L190 270.5" stroke="#d9d2c2" stroke-opacity=".55" stroke-width="3"/><path d="M320 156.4L320 274.9" stroke="#d9d2c2" stroke-opacity=".55" stroke-width="3"/><path d="M450 152.5L450 279.3" stroke="#d9d2c2" stroke-opacity=".55" stroke-width="3"/><path d="M-20 192L920 176.5" stroke="#f5b342" stroke-width="5" filter="url(#ha-glow)" opacity=".55"/><path d="M-20 240L920 256" stroke="#f5b342" stroke-width="5" filter="url(#ha-glow)" opacity=".55"/><path d="M-20 176L920 150" stroke="#fff4dc" stroke-opacity=".86" stroke-width="1.00"/><path d="M-20 192L920 176.5" stroke="#fff4dc" stroke-opacity=".86" stroke-width="1.36"/><path d="M-20 208L920 203" stroke="#fff4dc" stroke-opacity=".86" stroke-width="1.72"/><path d="M-20 224L920 229.5" stroke="#fff4dc" stroke-opacity=".86" stroke-width="2.08"/><path d="M-20 240L920 256" stroke="#fff4dc" stroke-opacity=".86" stroke-width="2.44"/><path d="M-20 256L920 282.5" stroke="#fff4dc" stroke-opacity=".86" stroke-width="2.80"/><rect width="900" height="420" fill="url(#ha-spot)"/></svg>';
const FLAME = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.4 2c.9 3.2-1 4.9-2.6 6.9C8.3 10.8 7 12.5 7 15a5 5 0 0 0 10 0c0-2.1-1-3.6-2.1-4.7-.3 1.6-1 2.4-2 2.7.9-2.8.6-6.700-.5-11z"/></svg>';

// ---------- 홈 ----------
export function renderHome(host, app) {
  const today = app.today();
  const streak = streakOf(app.progress, today);
  const week = weekDays(app.progress, today);
  const plan = todayPlan(app.progress, LESSON_INDEX);
  const minutes = Math.round((app.progress.days[today] || 0) / 60);
  const doneCount = LESSON_INDEX.filter((l) => lessonStars(app.progress, l.id) > 0).length;
  const first = plan.find((p) => p.kind === 'new') || plan.find((p) => p.kind === 'review');
  const cta = first ? `#lesson/${first.lesson.id}` : '#songs';
  const item = (href, kind, title, sub) => `<li><a href="${href}"><span class="plan-kind">${kind}</span><span class="plan-text"><strong>${esc(title)}</strong><em>${esc(sub)}</em></span><span class="plan-go" aria-hidden="true">›</span></a></li>`;
  host.innerHTML = `
    <div class="hero">
      <div class="hero-art" aria-hidden="true">${HERO_ART}</div>
      <div class="hero-body">
        <p class="eyebrow">클래식 기타 첫걸음</p>
        <h1>${streak.doneToday ? '오늘도 <em>기타를 잡았네요</em>' : '치면, <em>듣고 알려 줍니다</em>'}</h1>
        <p class="lead">하루 15분이면 충분합니다. 마이크로 소리를 듣고 맞았는지 바로 알려 줍니다.</p>
        <a class="btn primary big" href="${cta}">${streak.doneToday ? '이어서 연습하기' : '오늘의 연습 시작'}</a>
        <div class="stats">
          <div class="stat streak">${FLAME}<strong>${streak.current}</strong><span>일 연속</span></div>
          <div class="stat"><strong>${minutes}</strong><span>분 · 오늘</span></div>
          <div class="stat"><strong>${doneCount}</strong><span>/ ${LESSON_INDEX.length} 레슨</span></div>
        </div>
        <ol class="week" aria-label="이번 주 연습">${week.map((d) => `<li class="${d.done ? 'done' : ''}${d.key === today ? ' today' : ''}"><span>${WEEKDAY[new Date(d.key + 'T00:00:00').getDay()]}</span></li>`).join('')}</ol>
      </div>
    </div>
    <h2>오늘 할 것</h2>
    <ol class="plan">
      ${plan.map((p) => p.kind === 'tuner' ? item('#tuner', '1분', '튜닝 확인', '여섯 줄이 맞는지 먼저 봅니다')
        : p.kind === 'review' ? item(`#lesson/${p.lesson.id}`, '복습', p.lesson.title, `${STAGES[p.lesson.stage].n}단계 · ${STAGES[p.lesson.stage].title}`)
        : item(`#lesson/${p.lesson.id}`, '새 레슨', p.lesson.title, `${STAGES[p.lesson.stage].n}단계 · ${STAGES[p.lesson.stage].title}`)).join('')}
      ${plan.some((p) => p.kind === 'new') ? '' : item('#songs', '곡', '곡 연습', '모든 레슨을 마쳤어요. 곡으로 다져 보세요')}
    </ol>
    <h2>바로 가기</h2>
    <div class="cards">
      <a class="card" href="#learn"><h3>배우는 순서</h3><p>준비부터 독주 기초까지 11단계</p></a>
      <a class="card" href="#songs"><h3>곡</h3><p>멜로디와 반주 연습곡, 내 곡 만들기</p></a>
      <a class="card" href="#chords"><h3>코드표</h3><p>코드 15개의 운지와 한 줄씩 점검</p></a>
      <a class="card" href="#tuner"><h3>튜너</h3><p>여섯 줄을 차례로 맞춥니다</p></a>
    </div>`;
  return null;
}

// ---------- 배우는 순서 ----------
export function renderLearn(host, app) {
  host.innerHTML = `<h1 class="title">배우는 순서</h1><p class="lead">순서대로 하면 좋지만 잠겨 있지 않습니다. 원하는 곳부터 해도 됩니다.</p>` + STAGES.map((st) => {
    const sum = stageSummary(app.progress, LESSON_INDEX, st.n);
    return `
      <section class="stage${sum.done === sum.total ? ' complete' : ''}">
        <header><span class="ring" style="--p:${sum.total ? Math.round((sum.done / sum.total) * 100) : 0}"><span>${st.n}</span></span><div><h2>${esc(st.title)}</h2><p>${esc(st.desc)}</p></div><span class="tag${sum.done ? ' on' : ''}">${sum.done}/${sum.total}</span></header>
        <ul class="lesson-list">${LESSONS.filter((l) => l.stage === st.n).map((l) => `<li><a href="#lesson/${l.id}"><span class="l-title">${esc(l.title)}</span><span class="l-goal">${esc(l.goal)}</span>${starsHtml(lessonStars(app.progress, l.id))}</a></li>`).join('')}</ul>
      </section>`;
  }).join('');
  return null;
}

// ---------- 곡 ----------
function customSongs(app) {
  return app.progress.custom || (app.progress.custom = []);
}
const CHORD_BY_NAME = Object.fromEntries(CHORD_ORDER.map((id) => [id === 'Fs' ? '작은F' : CHORDS[id].name, id]));

export function renderSongs(host, app) {
  function paint(message = '') {
    const row = (s, href, extra = '') => `<li><a href="${href}"><span class="l-title">${esc(s.title)}</span><span class="l-goal">${esc(s.kind === 'melody' ? '멜로디' : '반주')} · ${esc(s.source || '')}</span><span class="tag">${s.kind === 'melody' ? 'TAB' : esc(Array.from(new Set(s.bars)).map((id) => CHORDS[id].name).join(' '))}</span></a>${extra}</li>`;
    host.innerHTML = `
      <h1 class="title">곡</h1>
      <p class="lead">저작권 보호 기간이 끝난 선율과 이 앱의 연습곡입니다. 가사는 싣지 않습니다.</p>
      <section class="stage"><header><div><h2>멜로디</h2><p>한 음씩 치는 TAB 악보</p></div></header><ul class="lesson-list">${SONGS.filter((s) => s.kind === 'melody').map((s) => row(s, `#song/${s.id}`)).join('')}</ul></section>
      <section class="stage"><header><div><h2>반주</h2><p>코드를 바꾸며 스트로크</p></div></header><ul class="lesson-list">${SONGS.filter((s) => s.kind === 'chords').map((s) => row(s, `#song/${s.id}`)).join('')}</ul></section>
      <section class="stage"><header><div><h2>내 곡</h2><p>좋아하는 노래의 코드 진행을 적어 나만의 반주 연습을 만듭니다</p></div></header>
        <ul class="lesson-list">${customSongs(app).map((s) => row({ ...s, kind: 'chords', source: `${s.bpm}BPM` }, `#song/${s.id}`, `<button type="button" class="btn ghost small" data-del="${s.id}" aria-label="${esc(s.title)} 지우기">지우기</button>`)).join('') || '<li class="empty">아직 만든 곡이 없어요.</li>'}</ul>
        <form class="custom">
          <label>제목 <input name="title" maxlength="30" placeholder="내 연습곡" required></label>
          <label>코드(한 마디에 하나씩, 띄어쓰기로 구분) <input name="chords" placeholder="G Em C D G Em C D" required></label>
          <label>리듬 <select name="pattern">${PATTERNS.map(([p, label]) => `<option value="${p}">${label} (${patternArrows(p)})</option>`).join('')}</select></label>
          <label>빠르기(BPM) <input name="bpm" type="number" min="40" max="140" value="66" required></label>
          <button type="submit" class="btn primary">곡 만들기</button>
          <p class="status" role="status">${esc(message)}</p>
          <p class="hint">쓸 수 있는 코드: ${Object.keys(CHORD_BY_NAME).join(', ')}</p>
        </form>
      </section>`;
  }
  const onSubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const names = String(f.get('chords')).trim().split(/[\s,|]+/).filter(Boolean);
    const unknown = names.filter((n) => !CHORD_BY_NAME[n]);
    if (!names.length || unknown.length) { paint(unknown.length ? `모르는 코드가 있어요: ${unknown.join(', ')}` : '코드를 하나 이상 적어 주세요'); return; }
    customSongs(app).push({ id: 'my-' + Date.now().toString(36), title: String(f.get('title')).trim() || '내 연습곡', bars: names.map((n) => CHORD_BY_NAME[n]), pattern: String(f.get('pattern')), bpm: Math.max(40, Math.min(140, Number(f.get('bpm')) || 66)) });
    app.save();
    paint('곡을 만들었어요. 위 목록에서 눌러 연습하세요.');
  };
  const onClick = (e) => {
    const del = e.target.closest('[data-del]');
    if (!del) return;
    app.progress.custom = customSongs(app).filter((s) => s.id !== del.dataset.del);
    app.save();
    paint();
  };
  host.addEventListener('submit', onSubmit);
  host.addEventListener('click', onClick);
  paint();
  return () => { host.removeEventListener('submit', onSubmit); host.removeEventListener('click', onClick); };
}

export function renderSong(host, app, id) {
  const song = SONGS.find((s) => s.id === id) || customSongs(app).find((s) => s.id === id);
  if (!song) { host.innerHTML = '<div class="panel"><p>없는 곡입니다.</p><p><a class="btn" href="#songs">곡 목록으로</a></p></div>'; return null; }
  host.innerHTML = `<a class="back" href="#songs">곡</a><h1 class="title">${esc(song.title)}</h1><p class="lead">${esc(song.source || '내 곡')}</p><div class="panel"><div class="widget"></div></div>`;
  const slot = host.querySelector('.widget');
  const widget = song.score ? mountNotePlayer(slot, app, { score: song.score, modes: ['wait', 'timed'] }) : mountRhythm(slot, app, { title: song.title, bars: song.bars, pattern: song.pattern, bpm: song.bpm });
  return () => widget.destroy();
}

// ---------- 도구 ----------
export function renderTools(host) {
  host.innerHTML = `
    <h1 class="title">도구</h1>
    <div class="cards">
      <a class="card" href="#tuner"><h3>튜너</h3><p>여섯 줄을 차례로 맞춥니다</p></a>
      <a class="card" href="#chords"><h3>코드표</h3><p>운지 그림, 소리 듣기, 한 줄씩 점검</p></a>
      <a class="card" href="#metro"><h3>메트로놈</h3><p>일정한 박자를 들려줍니다</p></a>
      <a class="card" href="#calib"><h3>박자 보정</h3><p>이 기기의 소리 지연을 재서 박자 판정을 맞춥니다</p></a>
      <a class="card" href="#check"><h3>소리 점검</h3><p>마이크가 기타 소리를 잘 듣는지 확인합니다</p></a>
      <a class="card" href="#settings"><h3>설정</h3><p>마이크 민감도, 기록 내보내기와 가져오기</p></a>
    </div>`;
  return null;
}

export function renderChords(host) {
  host.innerHTML = `<a class="back" href="#tools">도구</a><h1 class="title">코드표</h1><p class="lead">코드를 누르면 소리를 듣고 한 줄씩 점검할 수 있습니다.</p>
    <div class="chord-grid">${CHORD_ORDER.map((id) => `<a class="chord-card" href="#chord/${id}">${chordSvg(id)}<strong>${esc(CHORDS[id].name)}</strong></a>`).join('')}</div>`;
  return null;
}

export function renderChord(host, app, id) {
  const chord = CHORDS[id];
  if (!chord) { host.innerHTML = '<div class="panel"><p>없는 코드입니다.</p><p><a class="btn" href="#chords">코드표로</a></p></div>'; return null; }
  host.innerHTML = `<a class="back" href="#chords">코드표</a><h1 class="title">${esc(chord.name)}</h1><p class="lead">${esc(chord.tip)}</p>
    <div class="panel"><div class="widget" data-w="strings"></div></div>
    <div class="panel"><div class="widget" data-w="strum"></div></div>`;
  const a = mountStringCheck(host.querySelector('[data-w="strings"]'), app, { chord: id });
  const b = mountStrumCheck(host.querySelector('[data-w="strum"]'), app, { chord: id, times: 4 });
  return () => { a.destroy(); b.destroy(); };
}

// ---------- 메트로놈 ----------
export function renderMetro(host, app) {
  host.innerHTML = `
    <a class="back" href="#tools">도구</a><h1 class="title">메트로놈</h1>
    <div class="panel metro">
      <div class="pulse" aria-hidden="true"><span class="bpm-big">80</span><span>BPM</span></div>
      <ol class="beats" aria-hidden="true"></ol>
      <label class="field wide">빠르기 <input type="range" min="40" max="200" value="80" data-role="bpm"></label>
      <label class="field">한 마디 박 수 <select data-role="bar"><option>2</option><option>3</option><option selected>4</option><option>6</option></select></label>
      <div class="row center"><button type="button" class="btn primary big" data-act="toggle">시작</button></div>
    </div>`;
  const q = (sel) => host.querySelector(sel);
  const el = { pulse: q('.pulse'), big: q('.bpm-big'), beats: q('.beats'), bpm: q('[data-role="bpm"]'), bar: q('[data-role="bar"]'), toggle: q('[data-act="toggle"]') };
  let timer = null, nextAt = 0, beat = 0;
  const timeouts = new Set();
  const paintBeats = () => { el.beats.innerHTML = Array.from({ length: Number(el.bar.value) }, () => '<li></li>').join(''); };

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    for (const t of timeouts) clearTimeout(t);
    timeouts.clear();
    app.audio.stopAll();
    el.toggle.textContent = '시작';
    el.pulse.classList.remove('on');
  }
  async function start() {
    await app.audio.ensureContext();
    beat = 0;
    nextAt = performance.now() + 120;
    el.toggle.textContent = '멈춤';
    timer = setInterval(() => {
      const now = performance.now();
      while (nextAt < now + 130) {
        const delay = Math.max(0, nextAt - now), n = beat % Number(el.bar.value);
        app.audio.play(clickSamples(app.audio.sampleRate, n === 0), 'speakers', delay / 1000);
        const t = setTimeout(() => {
          timeouts.delete(t);
          [...el.beats.children].forEach((li, i) => li.classList.toggle('on', i === n));
          el.pulse.classList.remove('on');
          void el.pulse.offsetWidth;
          el.pulse.classList.add('on');
        }, delay);
        timeouts.add(t);
        beat++;
        nextAt += 60000 / Number(el.bpm.value);
      }
    }, 25);
  }
  const onClick = (e) => { if (e.target.closest('[data-act="toggle"]')) { if (timer) stop(); else start(); } };
  const onInput = (e) => {
    if (e.target === el.bpm) el.big.textContent = el.bpm.value;
    if (e.target === el.bar) paintBeats();
  };
  host.addEventListener('click', onClick);
  host.addEventListener('input', onInput);
  paintBeats();
  return () => { stop(); host.removeEventListener('click', onClick); host.removeEventListener('input', onInput); };
}

// ---------- 박자 보정 ----------
export function renderCalib(host, app) {
  const BPM = 80, COUNT_IN = 4, BEATS = 8, beat = 60000 / BPM;
  host.innerHTML = `
    <a class="back" href="#tools">도구</a><h1 class="title">박자 보정</h1>
    <div class="panel calib">
      <p class="lead">기기마다 소리가 앱에 닿는 데 걸리는 시간이 다릅니다. 그 시간을 재서 박자 맞추기 판정에 반영합니다.</p>
      <ol class="steps"><li>시작을 누르면 원이 네 번 깜박인 뒤 여덟 번 더 깜박입니다.</li><li>원이 가장 커지는 순간마다 아무 줄이나 한 번씩 치세요. 소리는 나지 않으니 눈으로 맞춥니다.</li></ol>
      <div class="pulse calib-pulse" aria-hidden="true"><span class="bpm-big">-</span></div>
      <p class="status" role="status" aria-live="polite"></p>
      <p class="hint">지금 보정값: <strong data-role="latency"></strong>ms</p>
      <div class="row center">
        <button type="button" class="btn primary big" data-act="start">시작</button>
        ${app.env.dev ? '<button type="button" class="btn ghost" data-act="auto">자동 연주(시험)</button>' : ''}
      </div>
    </div>`;
  const q = (sel) => host.querySelector(sel);
  const el = { pulse: q('.pulse'), big: q('.bpm-big'), status: q('.status'), latency: q('[data-role="latency"]') };
  let unsub = null, raf = 0;
  const paint = () => { el.latency.textContent = String(app.progress.latencyMs); };

  function stop() {
    if (unsub) unsub();
    unsub = null;
    cancelAnimationFrame(raf);
    app.audio.stopAll();
    el.pulse.style.transform = '';
  }
  async function start(auto) {
    stop();
    try { await app.ensureInput(); } catch (err) { el.status.textContent = micErrorMessage(err); el.status.dataset.kind = 'bad'; return; }
    const t0 = performance.now() + 600;
    const offsets = [];
    const tracker = createNoteTracker(trackerOptions(app.progress.settings));
    el.status.dataset.kind = '';
    el.status.textContent = '원을 보며 준비하세요';
    unsub = app.listener.subscribe((frame) => {
      for (const ev of tracker.push(frame)) {
        if (ev.type !== 'onset') continue;
        const k = Math.round((ev.time - t0) / beat);
        if (k < COUNT_IN || k >= COUNT_IN + BEATS) continue;
        const off = ev.time - (t0 + k * beat);
        if (Math.abs(off) < 300) offsets.push(off);
      }
    });
    if (auto) for (let k = COUNT_IN; k < COUNT_IN + BEATS; k++) app.audio.play(clickSamples(app.audio.sampleRate, true), 'input', (t0 - performance.now() + k * beat + 60) / 1000);
    const loop = () => {
      const t = performance.now() - t0;
      const k = Math.floor(t / beat), phase = (t / beat) - k;
      el.pulse.style.transform = `scale(${(0.6 + 0.4 * Math.max(0, 1 - Math.min(phase, 1 - phase) * 4)).toFixed(3)})`;
      el.big.textContent = t < 0 ? '-' : k < COUNT_IN ? String(COUNT_IN - k) : k < COUNT_IN + BEATS ? '치세요' : '끝';
      if (k === COUNT_IN) el.status.textContent = '원이 커지는 순간마다 한 번씩 치세요';
      if (t > (COUNT_IN + BEATS) * beat + 300) {
        stop();
        if (offsets.length < 4) { el.status.dataset.kind = 'warn'; el.status.textContent = `소리를 ${offsets.length}번밖에 듣지 못했어요. 조금 더 크게 치고 다시 해 보세요`; return; }
        offsets.sort((a, b) => a - b);
        const median = offsets[offsets.length >> 1];
        app.progress.latencyMs = Math.max(0, Math.min(300, Math.round(median)));
        app.save();
        paint();
        el.status.dataset.kind = 'good';
        el.status.textContent = `${offsets.length}번을 듣고 ${app.progress.latencyMs}ms로 맞췄어요`;
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }
  const onClick = (e) => {
    const a = e.target.closest('[data-act]');
    if (a) start(a.dataset.act === 'auto');
  };
  host.addEventListener('click', onClick);
  paint();
  return () => { stop(); host.removeEventListener('click', onClick); };
}

// ---------- 설정 ----------
export function renderSettings(host, app) {
  function paint(message = '') {
    const s = app.progress.settings;
    host.innerHTML = `
      <a class="back" href="#tools">도구</a><h1 class="title">설정</h1>
      <div class="panel settings">
        <label class="field wide">마이크 민감도
          <select data-role="sens">${[['low', '낮게(시끄러운 곳)'], ['normal', '보통'], ['high', '높게(소리가 작게 잡힐 때)']].map(([v, t]) => `<option value="${v}"${s.sensitivity === v ? ' selected' : ''}>${t}</option>`).join('')}</select>
        </label>
        <label class="field check"><input type="checkbox" data-role="click"${s.click ? ' checked' : ''}> 박자 맞추기에서 박자 소리 켜기</label>
        <p class="hint">박자 보정값 ${app.progress.latencyMs}ms · <a href="#calib">다시 재기</a></p>
        <h2>연습 기록</h2>
        <p class="hint">기록은 이 기기의 브라우저에만 저장됩니다. 다른 기기로 옮기려면 내보낸 파일을 그 기기에서 가져오세요.</p>
        <div class="row">
          <button type="button" class="btn" data-act="export">기록 내보내기</button>
          <label class="btn">기록 가져오기<input type="file" accept="application/json,.json" data-role="import" hidden></label>
          <button type="button" class="btn ghost" data-act="reset">기록 지우기</button>
        </div>
        <p class="status" role="status">${esc(message)}</p>
        <p class="foot">여섯줄 v0.5</p>
      </div>`;
  }
  const onClick = (e) => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'export') {
      const url = URL.createObjectURL(new Blob([JSON.stringify(app.progress, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `guitar-progress-${app.today()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      paint('기록 파일을 내려받았어요');
    } else if (a.dataset.act === 'reset') {
      if (a.dataset.sure) { app.replaceProgress(emptyProgress()); paint('기록을 지웠어요'); }
      else { a.dataset.sure = '1'; a.textContent = '정말 지우려면 한 번 더 누르세요'; }
    }
  };
  const onChange = async (e) => {
    const role = e.target.dataset.role;
    if (role === 'sens') { app.progress.settings.sensitivity = e.target.value; app.save(); }
    else if (role === 'click') { app.progress.settings.click = e.target.checked; app.save(); }
    else if (role === 'import' && e.target.files[0]) {
      try {
        const data = JSON.parse(await e.target.files[0].text());
        if (!data || data.version !== 1 || typeof data.lessons !== 'object') throw new Error('형식');
        app.replaceProgress({ ...emptyProgress(), ...data, settings: { ...emptyProgress().settings, ...(data.settings || {}) } });
        paint('기록을 가져왔어요');
      } catch (err) { paint('이 앱의 기록 파일이 아니에요'); }
    }
  };
  host.addEventListener('click', onClick);
  host.addEventListener('change', onChange);
  paint();
  return () => { host.removeEventListener('click', onClick); host.removeEventListener('change', onChange); };
}
