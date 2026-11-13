// 앱 시작점: 공용 상태, 화면 전환.
import { createAudio } from './audio.js';
import { createListener } from './listen.js';
import { loadProgress, saveProgress, dayKey, touchDay } from './progress.js';
import { initTunerView } from './ui-tuner.js';
import { initCheckView } from './ui-check.js';
import { renderLesson } from './ui-lesson.js';
import { renderHome, renderLearn, renderSongs, renderSong, renderTools, renderChords, renderChord, renderMetro, renderCalib, renderSettings, APP_VERSION } from './ui-pages.js';
import { renderAdjust } from './ui-adjust.js';
import { isCalibrated } from './calibrate.js';

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
  replaceProgress(next) { app.progress = next; app.save(); applyTheme(); },
  applyTheme() { applyTheme(); },
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

// 화면 밝기: 자동이면 기기 설정을 따른다. 첫 그림이 깜박이지 않도록 head의 작은 스크립트가 먼저 한 번 정해 둔다.
const lightQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
function applyTheme() {
  const pref = app.progress.settings.theme || 'auto';
  const theme = pref === 'auto' ? (lightQuery && lightQuery.matches ? 'light' : 'dark') : pref;
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f6f3ec' : '#14112a');
}
applyTheme();
if (lightQuery) {
  if (lightQuery.addEventListener) lightQuery.addEventListener('change', applyTheme);
  else if (lightQuery.addListener) lightQuery.addListener(applyTheme);
}

// 처음 쓰는 사람에게는 '새로 생긴 것'을 보여 주지 않는다(바뀐 것이 없으므로).
if (app.progress.settings.seen == null && !Object.keys(app.progress.lessons).length && !Object.keys(app.progress.days).length && !isCalibrated(app.progress.settings)) {
  app.progress.settings.seen = APP_VERSION;
  app.save();
}

const pageEl = document.getElementById('view-page');
const staticViews = { tuner: document.getElementById('view-tuner'), check: document.getElementById('view-check') };
const tunerView = initTunerView(staticViews.tuner, appAudio, env);
const checkView = initCheckView(staticViews.check, appAudio, env);

const PAGES = { home: renderHome, learn: renderLearn, lesson: renderLesson, songs: renderSongs, song: renderSong, tools: renderTools, chords: renderChords, chord: renderChord, metro: renderMetro, calib: renderCalib, adjust: renderAdjust, settings: renderSettings };
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
  if (name === 'tuner') { const hint = document.getElementById('tn-calib'); if (hint) hint.hidden = isCalibrated(app.progress.settings); }
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

// 인터넷 없이 열기: https 주소(또는 이 PC의 localhost)에서만 서비스 워커를 등록한다. 파일로 열었을 때는 쓰지 않는다.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
