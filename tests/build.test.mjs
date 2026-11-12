import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { build, stripModuleSyntax } from '../build.mjs';

test('빌드: 파일 하나로 합쳐지고 문법 오류가 없다', async () => {
  const { js, bytes } = await build();
  assert.doesNotThrow(() => new vm.Script(js), '합친 JS에 문법 오류가 없어야 한다');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(!html.includes('/*__CSS__*/') && !html.includes('/*__JS__*/'), '자리표시가 남으면 안 된다');
  assert.ok(!/<script[^>]+src=|<link[^>]+href=/.test(html), '바깥 파일을 불러오면 안 된다');
  assert.ok(!/^\s*(import|export)\s/m.test(js), 'import/export 가 남으면 안 된다');
  assert.ok(bytes < 200 * 1024, `파일이 너무 크다: ${bytes}`);
  for (const id of ['tn-status', 'tn-needle', 'tn-ticks', 'tn-note', 'tn-oct', 'tn-ko', 'tn-which', 'tn-cents', 'tn-hint', 'tn-heard', 'tn-level', 'tn-mic', 'tn-strings', 'tn-auto', 'tn-reset', 'tn-done', 'tn-dev', 'ck-status', 'ck-rows', 'ck-copy', 'ck-report', 'ck-dev', 'ck-fake', 'view-home', 'view-tuner', 'view-check']) {
    assert.ok(html.includes(`id="${id}"`), `id="${id}" 가 있어야 한다`);
  }
});

test('빌드: 합칠 수 없는 모듈 문법은 막는다', () => {
  assert.equal(stripModuleSyntax("import { a } from './a.js';\nexport function f() {}\n", 'x'), 'function f() {}\n');
  assert.throws(() => stripModuleSyntax('export default 1;\n', 'x'));
  assert.throws(() => stripModuleSyntax("import {\n a\n} from './a.js'\n", 'x'));
});
