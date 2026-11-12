// 앱 시작점: 화면 전환과 각 화면 초기화.
import { createAudio } from './audio.js';
import { initTunerView } from './ui-tuner.js';
import { initCheckView } from './ui-check.js';

const env = { dev: new URLSearchParams(location.search).has('dev') };
const appAudio = createAudio();
const viewEls = {
  home: document.getElementById('view-home'),
  tuner: document.getElementById('view-tuner'),
  check: document.getElementById('view-check'),
};
const tunerView = initTunerView(viewEls.tuner, appAudio, env);
const checkView = initCheckView(viewEls.check, appAudio, env);

function route() {
  const wanted = (location.hash || '#home').slice(1);
  const name = viewEls[wanted] ? wanted : 'home';
  for (const [key, node] of Object.entries(viewEls)) node.hidden = key !== name;
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === name) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  tunerView.setVisible(name === 'tuner');
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();

if (env.dev) window.__dev = { audio: appAudio, tunerView, checkView };
