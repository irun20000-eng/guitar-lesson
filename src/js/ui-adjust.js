// 보정 도우미 화면: 조용한 방 3초 → 개방현 여섯 줄 → 코드 세 개를 차례로 듣고, 이 기기에 맞는 판정 기준을 저장한다.
// 사용자가 결과를 복사해 보내지 않아도 앱이 스스로 기준을 정한다. 녹음은 이 화면에만 잠시 두고, 원하면 WAV로 내려받는다.
import { STRINGS, midiToName, midiToKo, midiToFreq } from './notes.js';
import { renderPluck } from './synth.js';
import { CHORDS, strumSamples } from './chords.js';
import { chordSvg } from './diagram.js';
import { encodeWav } from './wav.js';
import { micErrorMessage } from './audio.js';
import { esc } from './listen.js';
import { CALIB_DEFAULTS, CALIB_LABELS, CALIB_CHORDS, measureNoise, measurePluck, measureChord, computeThresholds, makeCalibRecord, calibValues, isCalibrated } from './calibrate.js';

const ADJ_TAKE_SECONDS = 3;
const ADJ_READY_MS = 1400;

function adjustSteps() {
  return [
    { kind: 'quiet', key: 'quiet', short: '조용히', prompt: '3초 동안 조용히 해 주세요', sub: '손바닥을 줄에 가볍게 얹어 울림을 막아 두세요. 방의 잡음을 잽니다.' },
    ...STRINGS.map((s) => ({ kind: 'string', key: `s${s.num}`, s, short: `${s.num}번줄`, prompt: `${s.num}번줄을 한 번 치세요`, sub: `${midiToName(s.midi)} ${midiToKo(s.midi)} · 개방현(누르지 않고). 친 뒤에는 그대로 울리게 두세요.` })),
    ...CALIB_CHORDS.map((id) => ({ kind: 'chord', key: `c${id}`, id, short: CHORDS[id].name, prompt: `${CHORDS[id].name} 코드를 잡고 한 번 쓸어 치세요`, sub: '굵은 줄에서 가는 줄 쪽으로 천천히 한 번. 그대로 울리게 두세요.' })),
  ];
}

const adjFmt = (key, v) => (key === 'minRms' ? v.toFixed(4) : v.toFixed(2));

export function renderAdjust(host, app) {
  const steps = adjustSteps();
  let running = false, token = 0, timer = null, takes = [], measured = null, lastRecord = null, message = '';

  host.innerHTML = `
    <a class="back" href="#tools">도구</a><h1 class="title">보정 도우미</h1>
    <div class="panel adjust">
      <p class="lead">이 기기의 마이크와 지금 있는 방에 맞게 판정 기준을 맞춥니다. 1분쯤 걸리고, 결과는 이 기기에만 저장됩니다.</p>
      <ol class="steps" data-role="intro">
        <li>먼저 <a href="#tuner">튜너</a>로 여섯 줄을 맞춥니다.</li>
        <li>기기를 기타 앞 30~50cm에 두고 [보정 시작]을 누릅니다.</li>
        <li>화면에 나오는 대로 조용히 3초, 개방현 여섯 줄, 코드 Em·C·G를 한 번씩 칩니다.</li>
      </ol>
      <div class="adj-now" data-role="now" hidden>
        <p class="adj-count" data-role="count"></p>
        <p class="adj-prompt" data-role="prompt"></p>
        <p class="adj-sub" data-role="sub"></p>
        <div class="adj-fig" data-role="fig" hidden></div>
        <div class="timer" aria-hidden="true"><div data-role="bar"></div></div>
      </div>
      <ol class="adj-track" data-role="track" aria-label="보정 순서">${steps.map((st) => `<li data-key="${st.key}">${esc(st.short)}</li>`).join('')}</ol>
      <p class="status" data-role="status" role="status" aria-live="polite"></p>
      <div class="adj-result" data-role="result" hidden></div>
      <div class="row">
        <button type="button" class="btn primary big" data-act="start">보정 시작</button>
        <button type="button" class="btn ghost" data-act="stop" hidden>그만하기</button>
        <button type="button" class="btn" data-act="copy" hidden>결과 복사</button>
        <button type="button" class="btn" data-act="wav" hidden>녹음 WAV 저장</button>
        <button type="button" class="btn ghost" data-act="defaults">기본값으로</button>
        ${app.env.dev ? '<label class="dev"><input type="checkbox" data-role="fake"> 합성음으로 시험</label>' : ''}
      </div>
      <p class="hint" data-role="state"></p>
    </div>`;
  const q = (role) => host.querySelector(`[data-role="${role}"]`);
  const btn = (act) => host.querySelector(`[data-act="${act}"]`);
  const el = { intro: q('intro'), now: q('now'), count: q('count'), prompt: q('prompt'), sub: q('sub'), fig: q('fig'), bar: q('bar'), track: q('track'), status: q('status'), result: q('result'), state: q('state'), fake: q('fake') };

  function setStatus(text, kind = '') { el.status.textContent = text; el.status.dataset.kind = kind; }
  function paintState() {
    const s = app.progress.settings;
    el.state.textContent = isCalibrated(s) ? `지금은 ${s.calib.date || ''} 보정값으로 판정합니다.` : '아직 보정하지 않아 기본값으로 판정합니다.';
    btn('defaults').hidden = !isCalibrated(s);
  }
  function mark(key, kind) {
    const li = el.track.querySelector(`[data-key="${key}"]`);
    if (li) li.dataset.kind = kind;
  }
  function showStep(i, retry) {
    const st = steps[i];
    el.now.hidden = false;
    el.count.textContent = `${i + 1} / ${steps.length}`;
    el.prompt.textContent = retry ? `한 번 더: ${st.prompt}` : st.prompt;
    el.sub.textContent = st.sub;
    el.fig.hidden = st.kind !== 'chord';
    el.fig.innerHTML = st.kind === 'chord' ? chordSvg(st.id) : '';
    el.bar.style.transform = 'scaleX(0)';
    for (const li of el.track.children) li.classList.toggle('now', li.dataset.key === st.key);
  }
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function recordTake(seconds) {
    const started = performance.now();
    clearInterval(timer);
    timer = setInterval(() => { el.bar.style.transform = `scaleX(${Math.min(1, (performance.now() - started) / (seconds * 1000)).toFixed(3)})`; }, 50);
    const samples = await app.audio.record(seconds);
    clearInterval(timer);
    el.bar.style.transform = 'scaleX(1)';
    return samples;
  }

  function playFake(st) {
    const sr = app.audio.sampleRate;
    if (st.kind === 'string') app.audio.play(renderPluck(midiToFreq(st.s.midi), sr, 2.6), 'input', 0.35);
    else if (st.kind === 'chord') app.audio.play(strumSamples(st.id, sr, 2.6), 'input', 0.35);
  }

  function heardEnough(st, m) {
    const floor = Math.max((measured.noise?.rms ?? 0) * 4, 0.0015);
    if (st.kind === 'string') return m.peakRms >= floor && m.hitRate > 0;
    return m.peakRms >= floor;
  }

  async function start() {
    if (running) return;
    const fake = !!(el.fake && el.fake.checked);
    try {
      if (fake) await app.audio.ensureContext();
      else await app.ensureInput();
    } catch (err) { setStatus(micErrorMessage(err), 'bad'); return; }
    running = true;
    const my = ++token;
    const alive = () => running && token === my;
    takes = [];
    measured = { noise: null, strings: [], chords: [] };
    el.intro.hidden = true;
    el.result.hidden = true;
    btn('start').hidden = true; btn('stop').hidden = false; btn('copy').hidden = true; btn('wav').hidden = true; btn('defaults').hidden = true;
    for (const li of el.track.children) delete li.dataset.kind;
    const sr = app.audio.sampleRate;
    for (let i = 0; i < steps.length; i++) {
      const st = steps[i];
      let m = null, ok = false;
      for (let attempt = 0; attempt < 2 && !ok; attempt++) {
        showStep(i, attempt > 0);
        setStatus('준비하세요');
        await wait(ADJ_READY_MS);
        if (!alive()) return;
        setStatus(st.kind === 'quiet' ? '듣는 중이에요. 조용히 기다려 주세요' : '지금 치세요', '');
        if (fake) playFake(st);
        const samples = await recordTake(ADJ_TAKE_SECONDS);
        if (!alive()) return;
        takes.push({ key: st.key, label: st.short, samples, sampleRate: sr });
        if (st.kind === 'quiet') { m = measureNoise(samples, sr); ok = true; }
        else if (st.kind === 'string') { m = { num: st.s.num, midi: st.s.midi, ...measurePluck(samples, sr, st.s.midi) }; ok = heardEnough(st, m); }
        else { m = measureChord(samples, sr, st.id); ok = heardEnough(st, m); }
        if (!ok && attempt === 0) setStatus('소리를 잘 듣지 못했어요. 한 번 더 해 볼게요', 'warn');
      }
      if (st.kind === 'quiet') measured.noise = m;
      else if (st.kind === 'string') measured.strings.push(m);
      else measured.chords.push(m);
      mark(st.key, ok ? 'done' : 'warn');
    }
    running = false;
    finish();
  }

  function finish() {
    const result = computeThresholds(measured);
    lastRecord = makeCalibRecord(measured, result, { date: app.today(), sampleRate: app.audio.sampleRate });
    app.progress.settings.calib = lastRecord;
    app.save();
    el.now.hidden = true;
    for (const li of el.track.children) li.classList.remove('now');
    btn('start').hidden = false; btn('start').textContent = '다시 보정';
    btn('stop').hidden = true; btn('copy').hidden = false; btn('wav').hidden = !takes.length;
    setStatus(result.quality === 'good' ? '다 맞췄어요. 이제 이 기기에 맞는 기준으로 판정합니다' : '맞췄어요. 아래 안내를 한 번 확인해 주세요', result.quality === 'good' ? 'good' : 'warn');
    paintResult(result);
    paintState();
  }

  function stringVerdict(s) {
    if (!s || s.hitRate === 0) return ['warn', '못 들었어요'];
    if (s.hitRate >= 0.8) return ['good', '잘 들려요'];
    if (s.hitRate >= 0.5) return ['good', '들려요'];
    return ['warn', '잘 안 들려요'];
  }

  function paintResult(result) {
    const v = result.values;
    const strings = measured.strings.map((s) => { const [kind, text] = stringVerdict(s); return `<li data-kind="${kind}"><span class="s-num">${s.num}</span>${esc(text)}</li>`; }).join('');
    const chords = measured.chords.map((c) => `<li data-kind="${c.score >= v.chordMinScore ? 'good' : 'warn'}"><strong>${esc(CHORDS[c.id].name)}</strong>${c.score >= v.chordMinScore ? '잘 들려요' : '애매해요'}</li>`).join('');
    el.result.hidden = false;
    el.result.innerHTML = `
      ${result.notes.length ? `<ul class="adj-notes">${result.notes.map((n) => `<li>${esc(n.text)}</li>`).join('')}</ul>` : ''}
      <h2>들린 소리</h2>
      <ul class="adj-heard">${strings}${chords}</ul>
      <h2>판정 기준</h2>
      <div class="table-wrap"><table class="check adj-table">
        <thead><tr><th scope="col">기준</th><th scope="col">기본값</th><th scope="col">이 기기</th></tr></thead>
        <tbody>${Object.keys(CALIB_DEFAULTS).map((k) => `<tr><th scope="row">${esc(CALIB_LABELS[k])}</th><td>${adjFmt(k, CALIB_DEFAULTS[k])}</td><td><strong>${adjFmt(k, v[k])}</strong></td></tr>`).join('')}</tbody>
      </table></div>
      <p class="hint">기준은 기본값보다 까다로워지지 않습니다. 소리 크기 기준만 방의 잡음에 맞춰 오르내립니다. 설정의 마이크 민감도는 이 값에 한 번 더 곱해집니다.</p>`;
  }

  function reportText() {
    const r = lastRecord || app.progress.settings.calib;
    if (!r) return '';
    const lines = [`여섯줄 보정 결과 ${r.date || ''}`, `샘플레이트 ${r.sampleRate || '-'}Hz, 방 잡음 ${r.measured.noise ?? '-'}`];
    for (const s of r.measured.strings) lines.push(`${s.num}번줄: 최대 ${s.peak} 울림 ${s.sustain} 맞힘 ${s.hit} 선명도 ${s.clarity ?? '-'} 들림 ${s.salience ?? '-'}`);
    for (const c of r.measured.chords) lines.push(`${c.id}: 점수 ${c.score}`);
    lines.push('기준: ' + Object.entries(r.values).map(([k, x]) => `${k}=${x}`).join(', '));
    if (takes.length) {
      let at = 0;
      lines.push('녹음 구간(초): ' + takes.map((t) => { const s = `${t.label} ${at.toFixed(1)}`; at += t.samples.length / t.sampleRate + 0.5; return s; }).join(', '));
    }
    return lines.join('\n');
  }

  async function copy() {
    const text = reportText();
    // 권한 창이 뜬 채 답이 없으면 기다리지 않고 예전 방식으로 복사한다.
    const timeout = new Promise((resolve, reject) => setTimeout(() => reject(new Error('timeout')), 1500));
    try { await Promise.race([navigator.clipboard.writeText(text), timeout]); setStatus('결과를 복사했어요', 'good'); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); setStatus('결과를 복사했어요', 'good'); } catch (err) { setStatus('복사하지 못했어요', 'warn'); }
      ta.remove();
    }
  }

  function saveWav() {
    if (!takes.length) return;
    const sr = takes[0].sampleRate, gap = Math.floor(sr * 0.5);
    const total = takes.reduce((n, t) => n + t.samples.length + gap, 0);
    const all = new Float32Array(total);
    let pos = 0;
    for (const t of takes) { all.set(t.samples, pos); pos += t.samples.length + gap; }
    const url = URL.createObjectURL(new Blob([encodeWav(all, sr)], { type: 'audio/wav' }));
    const a = document.createElement('a');
    a.href = url; a.download = `guitar-calib-${app.today()}.wav`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setStatus('녹음 파일을 내려받았어요. 구간은 [결과 복사]에 적혀 있어요', 'good');
  }

  function stop(text = '보정을 멈췄어요. 저장된 기준은 그대로예요') {
    if (!running) return;
    running = false;
    token++;
    clearInterval(timer);
    app.audio.stopAll();
    el.now.hidden = true;
    el.intro.hidden = false;
    btn('start').hidden = false; btn('stop').hidden = true;
    setStatus(text, '');
    paintState();
  }

  const onClick = (e) => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'start') start();
    else if (act === 'stop') stop();
    else if (act === 'copy') copy();
    else if (act === 'wav') saveWav();
    else if (act === 'defaults') {
      delete app.progress.settings.calib;
      app.save();
      lastRecord = null;
      el.result.hidden = true;
      btn('copy').hidden = true;
      setStatus('기본값으로 되돌렸어요', '');
      paintState();
    }
  };
  host.addEventListener('click', onClick);
  paintState();
  if (isCalibrated(app.progress.settings)) {
    const v = calibValues(app.progress.settings);
    message = `지난 보정 기준: ${Object.keys(CALIB_DEFAULTS).map((k) => `${CALIB_LABELS[k]} ${adjFmt(k, v[k])}`).join(' · ')}`;
    btn('start').textContent = '다시 보정';
    btn('copy').hidden = false;
    setStatus(message, '');
  }
  return () => { stop(''); host.removeEventListener('click', onClick); };
}
