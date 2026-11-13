// src/ 의 조각들을 파일 하나(index.html)로 합친다. 외부 도구 없이 node만으로 돈다.
// 규칙: src/js 의 모듈은 한 줄짜리 import 문과 "export function / export const" 만 쓴다.
//       합칠 때 import 줄은 지우고 export 낱말만 떼어 낸 뒤 아래 순서대로 이어 붙인다.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
export const JS_ORDER = ['notes', 'pitch', 'tuner', 'check', 'wav', 'synth', 'chroma', 'chords', 'calibrate', 'score', 'tracker', 'judge', 'progress', 'lessons-data', 'diagram', 'audio', 'listen', 'ui-tuner', 'ui-check', 'ui-play', 'ui-chord', 'ui-lesson', 'ui-adjust', 'ui-pages', 'main'];

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
  // 줄바꿈은 LF로 맞춘다(체크아웃 방식과 상관없이 sw.js 판 번호가 같게 나오도록).
  const result = html.replace('/*__CSS__*/', () => css.trim()).replace('/*__JS__*/', () => js).replace(/\r\n/g, '\n');
  await writeFile(path.join(root, 'index.html'), result, 'utf8');
  const sw = await buildServiceWorker(result);
  return { bytes: Buffer.byteLength(result), js, sw };
}

// 인터넷 없이 열기: 저장해 둘 파일 목록(화면, manifest, head와 manifest의 아이콘)과 판 번호를 넣어 sw.js를 만든다.
// 판 번호는 앱 판(APP_VERSION)과 index.html 내용의 해시라서, 내용이 바뀌어 다시 올리면 기기의 저장본도 바뀐다.
export async function buildServiceWorker(html) {
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.webmanifest'), 'utf8'));
  const links = [...html.matchAll(/<link rel="(?:manifest|icon|apple-touch-icon)" href="([^"]+)"/g)].map((m) => m[1]);
  const files = Array.from(new Set(['./', 'index.html', 'manifest.webmanifest', ...links, ...manifest.icons.map((i) => i.src)]));
  const appVersion = (html.match(/APP_VERSION = '([^']+)'/) || [])[1] || '0';
  const version = appVersion + '-' + createHash('sha256').update(html).digest('hex').slice(0, 10);
  const template = (await readFile(path.join(root, 'src/sw.template.js'), 'utf8')).replace(/\r\n/g, '\n');
  const code = template.replace('__VERSION__', version).replace('__FILES__', JSON.stringify(files));
  await writeFile(path.join(root, 'sw.js'), code, 'utf8');
  return { version, files };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { bytes } = await build();
  console.log(`index.html 생성: ${(bytes / 1024).toFixed(1)}KB`);
}
