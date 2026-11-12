// 소리 점검 화면: 줄마다 3초씩 듣고, 이 기기의 마이크가 기타 소리를 얼마나 잘 받는지 숫자로 보여 준다.
import { STRINGS, midiToName, midiToKo, midiToFreq } from './notes.js';
import { analyzeTake } from './check.js';
import { encodeWav } from './wav.js';
import { renderPluck } from './synth.js';
import { micErrorMessage } from './audio.js';

const TAKE_SECONDS = 3;

export function initCheckView(root, audio, env) {
  const q = (sel) => root.querySelector(sel);
  const el = { status: q('#ck-status'), rows: q('#ck-rows'), copy: q('#ck-copy'), report: q('#ck-report'), devWrap: q('#ck-dev'), devFake: q('#ck-fake') };
  const takes = new Map();

  el.rows.innerHTML = STRINGS.map((s) => `
    <tr data-row="${s.num}">
      <th scope="row"><span class="s-num">${s.num}</span> ${midiToName(s.midi)} <em>${midiToKo(s.midi)}</em></th>
      <td><button type="button" class="btn rec" data-rec="${s.num}">녹음</button></td>
      <td class="ck-result"><span class="verdict">아직 안 했어요</span><span class="detail"></span></td>
      <td><button type="button" class="btn ghost save" data-save="${s.num}" disabled>WAV 저장</button></td>
    </tr>`).join('');
  if (env.dev) el.devWrap.hidden = false;

  function setStatus(text, kind = '') {
    el.status.textContent = text;
    el.status.dataset.kind = kind;
  }

  function verdictOf(r) {
    if (r.heard < 5) return ['warn', '소리가 너무 작거나 흐려요. 기기를 기타 가까이에 두고 다시 해 보세요'];
    if (r.hitRate >= 0.9) return ['good', '잘 들려요'];
    if (r.hitRate >= 0.6) return ['warn', '대체로 들리지만 가끔 놓쳐요'];
    const top = Object.entries(r.others).sort((a, b) => b[1] - a[1])[0];
    return ['bad', top ? `다른 음(${top[0]})으로 들려요. 튜닝을 먼저 확인해 주세요` : '음을 알아듣지 못했어요'];
  }

  function detailOf(r) {
    const parts = [`들린 구간 ${r.heard}/${r.frames}`, `맞힘 ${Math.round(r.hitRate * 100)}%`];
    if (r.medianCents !== null) parts.push(`오차 ${r.medianCents >= 0 ? '+' : '-'}${Math.abs(r.medianCents).toFixed(1)}센트`);
    if (r.medianClarity !== null) parts.push(`선명도 ${r.medianClarity.toFixed(2)}`);
    parts.push(`음량 ${r.peakRms.toFixed(3)}`);
    return parts.join(' · ');
  }

  function paintRow(num) {
    const row = el.rows.querySelector(`[data-row="${num}"]`);
    const take = takes.get(num);
    const [kind, text] = verdictOf(take.result);
    row.dataset.kind = kind;
    row.querySelector('.verdict').textContent = text;
    row.querySelector('.detail').textContent = detailOf(take.result);
    row.querySelector('.save').disabled = false;
    el.copy.disabled = false;
  }

  function setBusy(busy) {
    for (const b of el.rows.querySelectorAll('.rec')) b.disabled = busy;
  }

  async function recordString(num, button) {
    const s = STRINGS.find((x) => x.num === num);
    const fake = env.dev && el.devFake.checked;
    try {
      if (fake) await audio.ensureContext();
      else await audio.openMic();
    } catch (err) {
      setStatus(micErrorMessage(err), 'bad');
      return;
    }
    setBusy(true);
    button.textContent = '듣는 중';
    setStatus(`${s.num}번줄을 한 번 치고 그대로 울리게 두세요 (${TAKE_SECONDS}초)`, '');
    if (fake) audio.play(renderPluck(midiToFreq(s.midi), audio.sampleRate, TAKE_SECONDS), 'input');
    const samples = await audio.record(TAKE_SECONDS);
    takes.set(num, { samples, sampleRate: audio.sampleRate, result: analyzeTake(samples, audio.sampleRate, s.midi) });
    paintRow(num);
    button.textContent = '다시 녹음';
    setBusy(false);
    setStatus(takes.size < STRINGS.length ? `${takes.size}/${STRINGS.length}줄 완료. 다음 줄을 녹음해 주세요` : '여섯 줄 모두 끝났어요. 아래 [결과 복사]를 눌러 보내 주세요', takes.size < STRINGS.length ? '' : 'good');
  }

  function buildReport() {
    const st = audio.micSettings || {};
    const flag = (v) => (v === undefined ? '?' : v ? '켜짐' : '꺼짐');
    const lines = [
      `[여섯줄 소리 점검] ${new Date().toLocaleString('ko-KR')}`,
      `기기: ${navigator.userAgent}`,
      `샘플레이트 ${audio.sampleRate}Hz · 울림 제거 ${flag(st.echoCancellation)} · 잡음 억제 ${flag(st.noiseSuppression)} · 자동 음량 ${flag(st.autoGainControl)}`,
    ];
    for (const s of STRINGS) {
      const take = takes.get(s.num);
      lines.push(`${s.num}번줄 ${midiToName(s.midi)}: ` + (take ? `${verdictOf(take.result)[1]} | ${detailOf(take.result)}` + (Object.keys(take.result.others).length ? ` | 다른 음 ${JSON.stringify(take.result.others)}` : '') : '안 함'));
    }
    return lines.join('\n');
  }

  el.rows.addEventListener('click', (e) => {
    const rec = e.target.closest('.rec');
    if (rec) return void recordString(Number(rec.dataset.rec), rec);
    const save = e.target.closest('.save');
    if (save) {
      const num = Number(save.dataset.save), take = takes.get(num), s = STRINGS.find((x) => x.num === num);
      const url = URL.createObjectURL(new Blob([encodeWav(take.samples, take.sampleRate)], { type: 'audio/wav' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `string${num}_${midiToName(s.midi)}.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  });

  el.copy.addEventListener('click', async () => {
    const text = buildReport();
    el.report.hidden = false;
    el.report.value = text;
    try {
      await navigator.clipboard.writeText(text);
      setStatus('결과를 복사했어요. 채팅창에 붙여 넣어 보내 주세요', 'good');
    } catch (err) {
      el.report.focus();
      el.report.select();
      setStatus('아래 글상자의 내용을 길게 눌러 복사해 주세요', '');
    }
  });

  return { buildReport, takes };
}
