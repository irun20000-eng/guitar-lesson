// 연습 기록. 기기 안(localStorage)에만 저장한다. 저장소를 인자로 받아 node에서도 시험할 수 있게 했다.

export const PROGRESS_KEY = 'guitar-lesson.progress.v1';

export function emptyProgress() {
  return { version: 1, lessons: {}, changes: {}, days: {}, custom: [], latencyMs: 80, settings: { sensitivity: 'normal', click: true } };
}

export function loadProgress(storage) {
  try {
    const raw = storage.getItem(PROGRESS_KEY);
    if (!raw) return emptyProgress();
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return emptyProgress();
    const base = emptyProgress();
    return { ...base, ...data, settings: { ...base.settings, ...(data.settings || {}) } };
  } catch (e) {
    return emptyProgress();
  }
}

export function saveProgress(storage, progress) {
  try { storage.setItem(PROGRESS_KEY, JSON.stringify(progress)); return true; } catch (e) { return false; }
}

export function dayKey(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function addDays(key, delta) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + delta));
}

export function recordLesson(progress, id, stars, accuracy, today) {
  const prev = progress.lessons[id] || { stars: 0, best: 0, count: 0 };
  progress.lessons[id] = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, accuracy), count: prev.count + 1, last: today };
  touchDay(progress, today, 0);
  return progress.lessons[id];
}

export function touchDay(progress, today, seconds) {
  progress.days[today] = (progress.days[today] || 0) + Math.max(0, Math.round(seconds));
  return progress.days[today];
}

export function recordChange(progress, a, b, count, today) {
  const key = [a, b].sort().join('-');
  const list = progress.changes[key] || (progress.changes[key] = []);
  list.push({ date: today, count });
  if (list.length > 60) list.splice(0, list.length - 60);
  touchDay(progress, today, 0);
  return Math.max(...list.map((x) => x.count));
}

export function bestChange(progress, a, b) {
  const list = progress.changes[[a, b].sort().join('-')] || [];
  return list.length ? Math.max(...list.map((x) => x.count)) : 0;
}

// 연속 연습일. 오늘 아직 안 했어도 어제까지 이어졌으면 끊기지 않은 것으로 센다.
export function streakOf(progress, today) {
  const has = (key) => key in progress.days;
  let current = 0;
  let key = has(today) ? today : addDays(today, -1);
  while (has(key)) { current++; key = addDays(key, -1); }
  let best = 0, run = 0, prev = null;
  for (const k of Object.keys(progress.days).sort()) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return { current, best, doneToday: has(today) };
}

export function weekDays(progress, today) {
  const out = [];
  for (let i = 6; i >= 0; i--) { const key = addDays(today, -i); out.push({ key, done: key in progress.days, seconds: progress.days[key] || 0 }); }
  return out;
}

export function lessonStars(progress, id) {
  return progress.lessons[id] ? progress.lessons[id].stars : 0;
}

// lessons: [{ id, stage }] 순서대로. 아직 별이 없는 첫 레슨.
export function nextLesson(progress, lessons) {
  return lessons.find((l) => lessonStars(progress, l.id) === 0) || null;
}

// 오늘의 연습: 튜닝 → 복습(별이 가장 적은, 가장 오래된 것) → 새 레슨.
export function todayPlan(progress, lessons) {
  const plan = [{ kind: 'tuner' }];
  const done = lessons.filter((l) => lessonStars(progress, l.id) > 0 && l.practice);
  if (done.length) {
    const review = done.slice().sort((a, b) => (lessonStars(progress, a.id) - lessonStars(progress, b.id)) || String(progress.lessons[a.id].last).localeCompare(String(progress.lessons[b.id].last)))[0];
    plan.push({ kind: 'review', lesson: review });
  }
  const next = nextLesson(progress, lessons);
  if (next) plan.push({ kind: 'new', lesson: next });
  return plan;
}

export function stageSummary(progress, lessons, stage) {
  const list = lessons.filter((l) => l.stage === stage);
  const done = list.filter((l) => lessonStars(progress, l.id) > 0).length;
  const stars = list.reduce((sum, l) => sum + lessonStars(progress, l.id), 0);
  return { total: list.length, done, stars, maxStars: list.length * 3 };
}
