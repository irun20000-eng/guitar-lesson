// src/ 의 조각들을 파일 하나(index.html)로 합친다. 외부 도구 없이 node만으로 돈다.
// 규칙: src/js 의 모듈은 한 줄짜리 import 문과 "export function / export const" 만 쓴다.
//       합칠 때 import 줄은 지우고 export 낱말만 떼어 낸 뒤 아래 순서대로 이어 붙인다.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
export const JS_ORDER = ['notes', 'pitch', 'tuner', 'check', 'wav', 'synth', 'audio', 'ui-tuner', 'ui-check', 'main'];

export function stripModuleSyntax(code, name) {
  const out = code
    .replace(/^import\s[^;]*;[ \t]*\r?\n/gm, '')
    .replace(/^export\s+(?=(async\s+)?function\b|const\b|let\b|class\b)/gm, '');
  if (/^\s*(import|export)\s/m.test(out)) throw new Error(`${name}.js: 합칠 수 없는 import/export 문이 남아 있습니다`);
  return out;
}

export async function build() {
  const read = (p) => readFile(path.join(root, p), 'utf8');
  const [html, css] = await Promise.all([read('src/app.html'), read('src/style.css')]);
  const parts = [];
  for (const name of JS_ORDER) parts.push(`// ---- ${name}.js ----\n` + stripModuleSyntax(await read(`src/js/${name}.js`), name));
  const js = `(function () {\n'use strict';\n${parts.join('\n')}\n})();`;
  if (js.includes('</script')) throw new Error('JS 안에 </script 가 들어 있습니다');
  const result = html.replace('/*__CSS__*/', () => css.trim()).replace('/*__JS__*/', () => js);
  await writeFile(path.join(root, 'index.html'), result, 'utf8');
  return { bytes: Buffer.byteLength(result), js };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { bytes } = await build();
  console.log(`index.html 생성: ${(bytes / 1024).toFixed(1)}KB`);
}
