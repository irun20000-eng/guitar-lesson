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
  for (const id of ['tn-status', 'tn-needle', 'tn-ticks', 'tn-note', 'tn-oct', 'tn-ko', 'tn-which', 'tn-cents', 'tn-hint', 'tn-heard', 'tn-level', 'tn-mic', 'tn-strings', 'tn-auto', 'tn-reset', 'tn-done', 'tn-dev', 'ck-status', 'ck-rows', 'ck-copy', 'ck-report', 'ck-dev', 'ck-fake', 'view-page', 'view-tuner', 'view-check']) {
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
