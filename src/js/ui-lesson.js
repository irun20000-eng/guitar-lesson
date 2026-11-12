// 레슨 화면: 설명 카드와 연습을 한 단계씩 넘기고, 끝나면 별을 기록한다.
import { STAGES, LESSONS, lessonById, isPractice } from './lessons-data.js';
import { figureSvg } from './diagram.js';
import { mountNotePlayer } from './ui-play.js';
import { mountStringCheck, mountStrumCheck, mountChange, mountRhythm } from './ui-chord.js';
import { recordLesson } from './progress.js';
import { starsHtml, esc } from './listen.js';

const STEP_LABEL = { card: '설명', tuner: '튜닝', notes: '연습', strings: '한 줄 점검', strum: '코드 확인', change: '코드 전환', rhythm: '리듬' };

export function renderLesson(host, app, arg) {
  const [id, stepArg] = arg.split('/');
  const lesson = lessonById(id);
  if (!lesson) {
    host.innerHTML = '<div class="panel"><p>없는 레슨입니다.</p><p><a class="btn" href="#learn">배우는 순서로</a></p></div>';
    return null;
  }
  const stage = STAGES[lesson.stage];
  const results = new Map();
  let index = Math.max(0, Math.min(Number(stepArg) || 0, lesson.steps.length));
  let widget = null;

  function mountStep(body, step, i) {
    const onResult = (r) => { results.set(i, r); paintNav(); };
    if (step.type === 'card') {
      body.innerHTML = `<h2>${esc(step.title)}</h2>${step.body.map((p) => `<p>${esc(p)}</p>`).join('')}${step.figure ? `<div class="figure">${figureSvg(step.figure)}</div>` : ''}`;
    } else if (step.type === 'tuner') {
      body.innerHTML = '<h2>튜너로 여섯 줄 맞추기</h2><p>튜너를 열어 6번줄부터 1번줄까지 맞춘 뒤 이 화면으로 돌아와 다음을 누르세요. 브라우저의 뒤로 가기를 누르면 돌아옵니다.</p><p><a class="btn primary big" href="#tuner">튜너 열기</a></p>';
      results.set(i, { stars: 3, accuracy: 1 });
    } else if (step.type === 'notes') {
      body.innerHTML = `<h2>${esc(step.title)}</h2><div class="widget"></div>`;
      widget = mountNotePlayer(body.querySelector('.widget'), app, { score: step.score, modes: step.modes, onResult });
    } else {
      body.innerHTML = '<div class="widget"></div>';
      const mount = { strings: mountStringCheck, strum: mountStrumCheck, change: mountChange, rhythm: mountRhythm }[step.type];
      widget = mount(body.querySelector('.widget'), app, { ...step, onResult });
    }
  }

  function summary(body) {
    const practice = lesson.steps.map((s, i) => [s, i]).filter(([s]) => isPractice(s));
    const done = practice.filter(([, i]) => results.has(i));
    let stars = 3;
    if (practice.length) stars = done.length ? Math.max(done.length === practice.length ? 1 : 0, Math.round(practice.reduce((sum, [, i]) => sum + (results.get(i)?.stars ?? 0), 0) / practice.length)) : 0;
    const accuracy = practice.length ? practice.reduce((sum, [, i]) => sum + (results.get(i)?.accuracy ?? 0), 0) / practice.length : 1;
    if (stars > 0) { recordLesson(app.progress, lesson.id, stars, accuracy, app.today()); app.save(); }
    const pos = LESSONS.indexOf(lesson), next = LESSONS[pos + 1];
    body.innerHTML = `
      <div class="lesson-done">
        ${starsHtml(stars)}
        <h2>${stars > 0 ? '레슨을 마쳤어요' : '연습을 건너뛰었어요'}</h2>
        <p class="lead">${stars > 0 ? esc(lesson.goal) : '연습을 한 번이라도 끝내면 별이 기록됩니다.'}</p>
        <div class="row center">
          ${next ? `<a class="btn primary big" href="#lesson/${next.id}">다음: ${esc(next.title)}</a>` : '<a class="btn primary big" href="#songs">곡 연습하러 가기</a>'}
          <button type="button" class="btn" data-go="0">한 번 더</button>
          <a class="btn ghost" href="#learn">배우는 순서</a>
        </div>
      </div>`;
  }

  function paintNav() {
    const nextBtn = host.querySelector('[data-go="next"]');
    if (!nextBtn) return;
    const step = lesson.steps[index];
    const last = index === lesson.steps.length - 1;
    const waiting = step && isPractice(step) && !results.has(index);
    nextBtn.textContent = waiting ? '건너뛰기' : last ? '마치기' : '다음';
    nextBtn.classList.toggle('primary', !waiting);
  }

  function show() {
    if (widget) { widget.destroy(); widget = null; }
    const atEnd = index >= lesson.steps.length;
    history.replaceState(null, '', `#lesson/${lesson.id}/${index}`);
    host.innerHTML = `
      <div class="lesson">
        <a class="back" href="#learn">배우는 순서</a>
        <p class="eyebrow">${stage.n}단계 · ${esc(stage.title)}</p>
        <h1 class="title">${esc(lesson.title)}</h1>
        <ol class="step-dots" aria-label="레슨 진행">${lesson.steps.map((s, i) => `<li class="${i < index ? 'done' : i === index ? 'now' : ''}"><span>${STEP_LABEL[s.type]}</span></li>`).join('')}</ol>
        <div class="panel step-body"></div>
        ${atEnd ? '' : `<div class="row step-nav"><button type="button" class="btn" data-go="prev"${index === 0 ? ' disabled' : ''}>이전</button><button type="button" class="btn primary" data-go="next">다음</button></div>`}
      </div>`;
    const body = host.querySelector('.step-body');
    if (atEnd) summary(body);
    else { mountStep(body, lesson.steps[index], index); paintNav(); }
    window.scrollTo(0, 0);
  }

  const onClick = (e) => {
    const b = e.target.closest('[data-go]');
    if (!b) return;
    if (b.dataset.go === 'next') index++;
    else if (b.dataset.go === 'prev') index = Math.max(0, index - 1);
    else index = Number(b.dataset.go);
    show();
  };
  host.addEventListener('click', onClick);
  show();
  return () => {
    host.removeEventListener('click', onClick);
    if (widget) widget.destroy();
  };
}
