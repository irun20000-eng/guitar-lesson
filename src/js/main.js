// 앱 시작점: 공용 상태, 화면 전환.
import { createAudio } from './audio.js';
import { createListener } from './listen.js';
import { loadProgress, saveProgress, dayKey, touchDay } from './progress.js';
import { initTunerView } from './ui-tuner.js';
import { initCheckView } from './ui-check.js';
import { renderLesson } from './ui-lesson.js';
import { renderHome, renderLearn, renderSongs, renderSong, renderTools, renderChords, renderChord, renderMetro, renderCalib, renderSettings } from './ui-pages.js';

const env = { dev: new URLSearchParams(location.search).has('dev') };
const appAudio = createAudio();
const store = (() => { try { return window.localStorage; } catch (e) { return { getItem: () => null, setItem: () => {} }; } })();

const app = {
  env,
  audio: appAudio,
  listener: createListener(appAudio),
  progress: loadProgress(store),
  save() { saveProgress(store, app.progress); },
  today() { return dayKey(new Date()); },
  replaceProgress(next) { app.progress = next; app.save(); },
  // 연습 화면이 소리를 듣기 전에 부른다. 개발 모드에서는 마이크 없이 합성음을 넣어 시험할 수 있다.
  async ensureInput() {
    if (env.dev && !appAudio.micOpen) { await appAudio.ensureContext(); return; }
    await appAudio.openMic();
  },
  addPracticeTime(seconds) {
    if (!(seconds > 1)) return;
    touchDay(app.progress, app.today(), Math.min(seconds, 900));
    app.save();
  },
};

const pageEl = document.getElementById('view-page');
const staticViews = { tuner: document.getElementById('view-tuner'), check: document.getElementById('view-check') };
const tunerView = initTunerView(staticViews.tuner, appAudio, env);
const checkView = initCheckView(staticViews.check, appAudio, env);

const PAGES = { home: renderHome, learn: renderLearn, lesson: renderLesson, songs: renderSongs, song: renderSong, tools: renderTools, chords: renderChords, chord: renderChord, metro: renderMetro, calib: renderCalib, settings: renderSettings };
const NAV_OF = { home: 'home', learn: 'learn', lesson: 'learn', songs: 'songs', song: 'songs' };
let cleanup = null;

function route() {
  const raw = decodeURIComponent((location.hash || '#home').slice(1));
  const cut = raw.indexOf('/');
  let name = cut < 0 ? raw : raw.slice(0, cut);
  const arg = cut < 0 ? '' : raw.slice(cut + 1);
  if (!PAGES[name] && !staticViews[name]) name = 'home';

  if (cleanup) { cleanup(); cleanup = null; }
  for (const [key, node] of Object.entries(staticViews)) node.hidden = key !== name;
  pageEl.hidden = !!staticViews[name];
  tunerView.setVisible(name === 'tuner');
  if (PAGES[name]) {
    pageEl.dataset.page = name;
    cleanup = PAGES[name](pageEl, app, arg) || null;
  }
  const nav = NAV_OF[name] || 'tools';
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === nav) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  document.body.dataset.view = name;
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();

if (env.dev) window.__dev = { app, audio: appAudio, tunerView, checkView };
