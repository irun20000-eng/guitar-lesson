// 튜너 화면.
import { STRINGS, midiToFreq, midiToName, midiToKo, describeFreq, stringByNum, NOTE_NAMES, pitchClass, midiToOctave } from './notes.js';
import { detectPitch, rmsLevel } from './pitch.js';
import { createTuner } from './tuner.js';
import { renderPluck } from './synth.js';
import { micErrorMessage } from './audio.js';

const CHECK_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function initTunerView(root, audio, env) {
  const q = (sel) => root.querySelector(sel);
  const el = {
    panel: q('.gauge-panel'), status: q('#tn-status'), needle: q('#tn-needle'), ticks: q('#tn-ticks'),
    note: q('#tn-note'), oct: q('#tn-oct'), ko: q('#tn-ko'), which: q('#tn-which'),
    cents: q('#tn-cents'), hint: q('#tn-hint'), heard: q('#tn-heard'), level: q('#tn-level'),
    mic: q('#tn-mic'), list: q('#tn-strings'), auto: q('#tn-auto'), reset: q('#tn-reset'),
    done: q('#tn-done'), dev: q('#tn-dev'),
  };
  const tuner = createTuner();
  const state = { target: null, done: new Set(), timer: null, running: false, visible: false, pauseUntil: 0, wake: null, devSource: null };

  // 눈금: -50 ~ +50센트, 10센트 간격. 바늘은 ±60도 안에서 움직인다.
  let ticks = '';
  for (let c = -50; c <= 50; c += 10) {
    const a = (c / 50) * 60 * Math.PI / 180, r1 = c === 0 ? 112 : 119, r2 = 130;
    ticks += `<line x1="${(160 + r1 * Math.sin(a)).toFixed(1)}" y1="${(170 - r1 * Math.cos(a)).toFixed(1)}" x2="${(160 + r2 * Math.sin(a)).toFixed(1)}" y2="${(170 - r2 * Math.cos(a)).toFixed(1)}"/>`;
  }
  el.ticks.innerHTML = ticks;

  el.list.innerHTML = STRINGS.map((s) => `
    <li data-row="${s.num}">
      <button type="button" class="string" data-num="${s.num}" aria-pressed="false">
        <span class="s-num">${s.num}</span>
        <span class="s-label"><span class="s-name">${NOTE_NAMES[pitchClass(s.midi)]}<small>${midiToOctave(s.midi)}</small> <em>${midiToKo(s.midi)}</em></span><span class="s-hint">${s.hint}</span></span>
        <span class="s-check">${CHECK_SVG}</span>
      </button>
      <button type="button" class="tone" data-tone="${s.num}" aria-label="${s.num}번줄 기준음 듣기">기준음</button>
    </li>`).join('');

  function setStatus(text, kind = '') {
    el.status.textContent = text;
    el.status.dataset.kind = kind;
  }

  function showNote(midi, label) {
    if (midi === null) {
      el.note.textContent = '–';
      el.oct.textContent = '';
      el.ko.textContent = '';
    } else {
      el.note.textContent = NOTE_NAMES[pitchClass(midi)];
      el.oct.textContent = midiToOctave(midi);
      el.ko.textContent = midiToKo(midi);
    }
    el.which.textContent = label || '';
  }

  function paintStrings(activeNum = null) {
    for (const li of el.list.children) {
      const num = Number(li.dataset.row);
      li.classList.toggle('done', state.done.has(num));
      li.classList.toggle('active', num === activeNum);
      li.querySelector('.string').setAttribute('aria-pressed', String(state.target === num));
    }
    el.auto.setAttribute('aria-pressed', String(state.target === null));
    el.done.hidden = state.done.size < STRINGS.length;
  }

  function setLevel(level) {
    // -60dB ~ -6dB 를 0~100%로
    const db = 20 * Math.log10(Math.max(level, 1e-6));
    el.level.style.width = Math.max(0, Math.min(100, ((db + 60) / 54) * 100)).toFixed(0) + '%';
  }

  function idle(text, kind) {
    el.panel.dataset.state = 'idle';
    el.needle.style.transform = 'rotate(0deg)';
    const t = state.target ? stringByNum(state.target) : null;
    showNote(t ? t.midi : null, t ? `${t.num}번줄` : '');
    el.cents.textContent = '';
    el.hint.textContent = '';
    el.heard.textContent = '';
    setStatus(text, kind);
    paintStrings(state.target);
  }

  function render(r) {
    if ((r.status !== 'ok' && r.status !== 'hold') || r.cents === undefined) {
      if (r.status === 'paused') return idle('기준음을 듣는 중이에요', '');
      if (r.status === 'unclear') return idle('소리가 또렷하지 않아요. 한 줄만 쳐서 길게 울려 주세요', '');
      return idle(state.target ? `${state.target}번줄을 쳐 보세요` : '줄을 하나 쳐 보세요', '');
    }
    const s = stringByNum(r.stringNum);
    const c = r.cents;
    const far = Math.abs(c) > 120;
    showNote(s.midi, `${s.num}번줄`);
    el.needle.style.transform = `rotate(${((Math.max(-50, Math.min(50, c)) / 50) * 60).toFixed(1)}deg)`;
    el.panel.dataset.state = r.inTune ? 'in' : far ? 'far' : 'off';
    const rounded = Math.round(Math.abs(c));
    // 반음 넘게 벗어나면 숫자가 오히려 헷갈리므로 말로만 알려 준다.
    el.cents.textContent = far ? (c < 0 ? '많이 낮아요' : '많이 높아요') : rounded === 0 ? '딱 맞아요' : `${rounded}센트 ${c < 0 ? '낮아요' : '높아요'}`;
    if (r.inTune) el.hint.textContent = '좋아요. 그대로 두세요.';
    else if (far) el.hint.textContent = c < 0 ? '[기준음]을 듣고 비슷해질 때까지 줄감개를 천천히 감으세요.' : '줄이 끊어지지 않게 줄감개를 천천히 풀어 주세요.';
    else el.hint.textContent = c < 0 ? '줄감개를 조금 감아 음을 올리세요.' : '줄감개를 조금 풀어 음을 내리세요.';
    el.heard.textContent = `지금 소리 ${describeFreq(r.freq).name} · ${r.freq.toFixed(1)}Hz`;
    if (r.locked && !state.done.has(s.num)) state.done.add(s.num);
    if (r.locked) setStatus(`${s.num}번줄 맞았어요`, 'good');
    else setStatus(`${s.num}번줄 맞추는 중`, '');
    paintStrings(s.num);
  }

  function tick() {
    const buf = audio.readFrame();
    if (!buf) return;
    const now = performance.now();
    const level = rmsLevel(buf);
    setLevel(level);
    if (now < state.pauseUntil) return render({ status: 'paused' });
    const p = detectPitch(buf, audio.sampleRate);
    render(tuner.update({ freq: p.freq, clarity: p.clarity, rms: level }, now, state.target));
  }

  function startLoop() {
    state.running = true;
    if (!state.timer && state.visible) state.timer = setInterval(tick, 50);
  }

  function stopLoop() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  }

  async function keepAwake() {
    try { if (navigator.wakeLock && !state.wake) state.wake = await navigator.wakeLock.request('screen'); } catch (e) { /* 화면 켜짐 유지는 없어도 된다 */ }
  }

  el.mic.addEventListener('click', async () => {
    if (audio.micOpen) {
      audio.closeMic();
      stopLoop();
      state.running = false;
      el.mic.textContent = '마이크 켜기';
      el.mic.classList.add('primary');
      setLevel(0);
      idle('마이크를 켜면 시작합니다', '');
      return;
    }
    el.mic.disabled = true;
    try {
      await audio.openMic();
      el.mic.textContent = '마이크 끄기';
      el.mic.classList.remove('primary');
      tuner.reset();
      startLoop();
      keepAwake();
      idle('줄을 하나 쳐 보세요', '');
    } catch (err) {
      setStatus(micErrorMessage(err), 'bad');
    } finally {
      el.mic.disabled = false;
    }
  });

  el.list.addEventListener('click', async (e) => {
    const toneBtn = e.target.closest('.tone');
    if (toneBtn) {
      const s = stringByNum(Number(toneBtn.dataset.tone));
      await audio.ensureContext();
      audio.play(renderPluck(midiToFreq(s.midi), audio.sampleRate, 2.4));
      // 스피커 소리를 줄 소리로 착각하지 않게 잠깐 판단을 멈춘다.
      state.pauseUntil = performance.now() + 2600;
      tuner.reset();
      return;
    }
    const strBtn = e.target.closest('.string');
    if (strBtn) {
      state.target = Number(strBtn.dataset.num);
      tuner.reset();
      idle(audio.micOpen || state.running ? `${state.target}번줄을 쳐 보세요` : '마이크를 켜면 시작합니다', '');
    }
  });

  el.auto.addEventListener('click', () => {
    state.target = null;
    tuner.reset();
    idle(audio.micOpen || state.running ? '줄을 하나 쳐 보세요' : '마이크를 켜면 시작합니다', '');
  });

  el.reset.addEventListener('click', () => {
    state.done.clear();
    paintStrings(state.target);
  });

  if (env.dev) {
    // 개발용: 합성한 줄 소리를 스피커가 아니라 분석 경로에 바로 넣어 튜너 반응을 본다.
    el.dev.hidden = false;
    el.dev.innerHTML = '<strong>시험 신호</strong> ' + STRINGS.map((s) => [-30, 0, 12].map((c) =>
      `<button type="button" data-dev-num="${s.num}" data-dev-cents="${c}">${s.num}번 ${c > 0 ? '+' : ''}${c}</button>`).join('')).join(' ') +
      ' <button type="button" data-dev-stop>멈춤</button>';
    el.dev.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      await audio.ensureContext();
      if (state.devSource) { try { state.devSource.stop(); } catch (err) { /* 이미 끝남 */ } state.devSource = null; }
      if (b.hasAttribute('data-dev-stop')) return;
      const s = stringByNum(Number(b.dataset.devNum));
      const f = midiToFreq(s.midi) * 2 ** (Number(b.dataset.devCents) / 1200);
      state.devSource = audio.play(renderPluck(f, audio.sampleRate, 8, { sustain: true }), 'input');
      startLoop();
    });
  }

  idle('마이크를 켜면 시작합니다', '');

  return {
    setVisible(visible) {
      state.visible = visible;
      if (visible && state.running) startLoop();
      else stopLoop();
    },
    tick,
    state,
  };
}
