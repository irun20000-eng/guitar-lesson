import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { build, stripModuleSyntax } from '../build.mjs';

// 홈 화면 설치용 link(manifest, 아이콘)만 허용한다. 앱이 돌아가는 데 필요한 바깥 파일은 여전히 없어야 한다.
const INSTALL_LINK = /<link rel="(?:manifest|icon|apple-touch-icon)" href="(?:manifest\.webmanifest|icons\/[\w.-]+)"[^>]*>\n?/g;
const withoutInstallLinks = (h) => h.replace(INSTALL_LINK, '');

test('빌드: 파일 하나로 합쳐지고 문법 오류가 없다', async () => {
  const { js, bytes } = await build();
  assert.doesNotThrow(() => new vm.Script(js), '합친 JS에 문법 오류가 없어야 한다');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(!html.includes('/*__CSS__*/') && !html.includes('/*__JS__*/'), '자리표시가 남으면 안 된다');
  assert.ok(!/<script[^>]+src=|<link[^>]+href=/.test(withoutInstallLinks(html)), '바깥 파일을 불러오면 안 된다');
  assert.ok(!/^\s*(import|export)\s/m.test(js), 'import/export 가 남으면 안 된다');
  assert.ok(bytes < 400 * 1024, `파일이 너무 크다: ${bytes}`);
  for (const id of ['tn-status', 'tn-needle', 'tn-ticks', 'tn-note', 'tn-oct', 'tn-ko', 'tn-which', 'tn-cents', 'tn-hint', 'tn-heard', 'tn-level', 'tn-mic', 'tn-strings', 'tn-auto', 'tn-reset', 'tn-done', 'tn-dev', 'ck-status', 'ck-rows', 'ck-copy', 'ck-report', 'ck-dev', 'ck-fake', 'tn-calib', 'view-page', 'view-tuner', 'view-check']) {
    assert.ok(html.includes(`id="${id}"`), `id="${id}" 가 있어야 한다`);
  }
});

test('빌드: 합칠 수 없는 모듈 문법은 막는다', () => {
  assert.equal(stripModuleSyntax("import { a } from './a.js';\nexport function f() {}\n", 'x'), 'function f() {}\n');
  assert.throws(() => stripModuleSyntax('export default 1;\n', 'x'));
  assert.throws(() => stripModuleSyntax("import {\n a\n} from './a.js'\n", 'x'));
});

test('설치: manifest와 아이콘 파일이 있고 head에서 가리킨다', async () => {
  const { readFile: rf, stat } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const html = await rf(new URL('index.html', root), 'utf8');
  const mf = JSON.parse(await rf(new URL('manifest.webmanifest', root), 'utf8'));
  assert.ok(mf.name && mf.short_name && mf.start_url && mf.display === 'standalone');
  const purposes = mf.icons.map((i) => (i.purpose || 'any') + ':' + i.sizes);
  for (const p of ['any:192x192', 'any:512x512', 'maskable:512x512']) assert.ok(purposes.includes(p), p);
  const hrefs = [...html.matchAll(/<link rel="(?:manifest|icon|apple-touch-icon)" href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(hrefs.includes('manifest.webmanifest') && hrefs.includes('icons/apple-touch-icon.png'));
  for (const f of [...hrefs, ...mf.icons.map((i) => i.src)]) assert.ok((await stat(new URL(f, root))).size > 0, f);
});

test('인터넷 없이 열기: sw.js가 index.html 판 번호와 저장할 파일 목록을 담는다', async () => {
  const { readFile: rf, stat } = await import('node:fs/promises');
  const { createHash } = await import('node:crypto');
  const root = new URL('../', import.meta.url);
  const { sw } = await build();
  const html = await rf(new URL('index.html', root), 'utf8');
  const code = await rf(new URL('sw.js', root), 'utf8');
  assert.doesNotThrow(() => new vm.Script(code), 'sw.js 문법 오류 없음');
  const hash = createHash('sha256').update(html).digest('hex').slice(0, 10);
  const appVersion = html.match(/APP_VERSION = '([^']+)'/)[1];
  assert.equal(sw.version, `${appVersion}-${hash}`);
  assert.ok(code.includes(`const VERSION = '${sw.version}'`), '판 번호가 index.html 내용과 맞아야 한다');
  assert.ok(!code.includes('__VERSION__') && !code.includes('__FILES__'));
  assert.ok(!/https?:\/\//.test(code), '바깥 주소를 저장하거나 부르지 않는다');
  for (const f of ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon.png']) assert.ok(sw.files.includes(f), f);
  for (const f of sw.files) if (f !== './') assert.ok((await stat(new URL(f, root))).size > 0, f);
  assert.ok(html.includes("register('sw.js')"), 'index.html이 sw.js를 등록한다');
  assert.ok(/location\.protocol === 'https:'/.test(html), 'https 또는 localhost에서만 등록한다');
});

test('화면 밝기와 보정 도우미: 첫 그림 전에 밝기를 정하고, 보정 화면으로 가는 길이 있다', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const head = html.slice(0, html.indexOf('<style>'));
  assert.ok(head.includes('prefers-color-scheme: light') && head.includes('dataset.theme'), 'head에서 밝기를 먼저 정한다');
  assert.ok(html.includes(':root[data-theme="light"]'), '밝은 화면 스타일');
  assert.ok(html.includes('id="tn-calib"'), '튜너에 보정 안내');
  assert.ok(html.includes('href="#adjust"') && html.includes('adjust: renderAdjust'), '보정 도우미 경로');
});