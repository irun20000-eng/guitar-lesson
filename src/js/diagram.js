// 그림: 코드표(세로), 지판(가로), 개방현 안내. SVG 글자열을 돌려준다. 색은 CSS(dg-* 클래스)에서 정한다.
import { STRINGS, midiToKo, NOTE_NAMES, pitchClass } from './notes.js';
import { CHORDS } from './chords.js';

// 코드표: 기타를 세워 정면에서 본 모양. 왼쪽이 6번줄.
export function chordSvg(id, options = {}) {
  const chord = CHORDS[id];
  const active = options.active ?? null;   // 강조할 줄 번호
  const marks = options.marks ?? {};       // { 줄번호: 'clear' | 'muffled' | 'other' }
  const x0 = 34, y0 = 44, dx = 30, dy = 38, rows = 4;
  const x = (i) => x0 + i * dx, w = dx * 5;
  let s = `<svg class="dg dg-chord" viewBox="0 0 ${x0 * 2 + w} ${y0 + dy * rows + 44}" role="img" aria-label="${chord.name} 코드표">`;
  s += `<rect class="dg-nut" x="${x0 - 2}" y="${y0 - 6}" width="${w + 4}" height="6" rx="2"/>`;
  for (let r = 0; r <= rows; r++) s += `<line class="dg-fret" x1="${x0}" y1="${y0 + r * dy}" x2="${x0 + w}" y2="${y0 + r * dy}"/>`;
  for (let i = 0; i < 6; i++) {
    const num = 6 - i, cls = ['dg-string', num === active ? 'is-active' : '', marks[num] ? `is-${marks[num]}` : ''].join(' ').trim();
    s += `<line class="${cls}" x1="${x(i)}" y1="${y0}" x2="${x(i)}" y2="${y0 + rows * dy}" stroke-width="${(1.2 + (5 - i) * 0.35).toFixed(2)}"/>`;
  }
  if (chord.barre) {
    const a = 6 - chord.barre.from, b = 6 - chord.barre.to, y = y0 + (chord.barre.fret - 0.5) * dy;
    s += `<rect class="dg-barre" x="${x(a) - 11}" y="${y - 11}" width="${x(b) - x(a) + 22}" height="22" rx="11"/>`;
  }
  chord.frets.forEach((fret, i) => {
    const num = 6 - i;
    if (fret < 0) s += `<text class="dg-mute" x="${x(i)}" y="${y0 - 16}" text-anchor="middle">×</text>`;
    else if (fret === 0) s += `<circle class="dg-open" cx="${x(i)}" cy="${y0 - 20}" r="6.5"/>`;
    else {
      const y = y0 + (fret - 0.5) * dy;
      const inBarre = chord.barre && chord.barre.fret === fret && num <= chord.barre.from && num >= chord.barre.to;
      if (!inBarre) s += `<circle class="dg-dot" cx="${x(i)}" cy="${y}" r="12"/>`;
      s += `<text class="dg-finger" x="${x(i)}" y="${y + 5}" text-anchor="middle">${chord.fingers[i]}</text>`;
    }
    s += `<text class="dg-num${num === active ? ' is-active' : ''}" x="${x(i)}" y="${y0 + rows * dy + 22}" text-anchor="middle">${num}</text>`;
  });
  s += `<text class="dg-cap" x="${x0 + w / 2}" y="${y0 + rows * dy + 40}" text-anchor="middle">줄 번호</text>`;
  return s + '</svg>';
}

// 지판: TAB과 같은 방향(위가 1번줄). marks: [{ string, fret, finger?, label? }], current: 강조할 한 곳
export function fretboardSvg(marks = [], options = {}) {
  const frets = options.frets ?? 4;
  const current = options.current ?? null;
  const x0 = 58, y0 = 18, fw = 74, sh = 26;
  const w = fw * frets, h = sh * 5;
  let s = `<svg class="dg dg-board" viewBox="0 0 ${x0 + w + 16} ${y0 + h + 34}" role="img" aria-label="지판 그림">`;
  s += `<rect class="dg-wood" x="${x0}" y="${y0 - 8}" width="${w}" height="${h + 16}" rx="4"/>`;
  s += `<rect class="dg-nut" x="${x0 - 5}" y="${y0 - 8}" width="6" height="${h + 16}" rx="2"/>`;
  for (let f = 1; f <= frets; f++) {
    s += `<line class="dg-fret" x1="${x0 + f * fw}" y1="${y0 - 8}" x2="${x0 + f * fw}" y2="${y0 + h + 8}"/>`;
    s += `<text class="dg-num" x="${x0 + (f - 0.5) * fw}" y="${y0 + h + 28}" text-anchor="middle">${f}프렛</text>`;
  }
  for (let n = 1; n <= 6; n++) {
    const y = y0 + (n - 1) * sh;
    s += `<line class="dg-string" x1="${x0}" y1="${y}" x2="${x0 + w}" y2="${y}" stroke-width="${(1.1 + (n - 1) * 0.4).toFixed(2)}"/>`;
    s += `<text class="dg-num" x="14" y="${y + 5}" text-anchor="middle">${n}</text>`;
  }
  const draw = (m, cls) => {
    const y = y0 + (m.string - 1) * sh;
    const cx = m.fret === 0 ? x0 - 22 : x0 + (m.fret - 0.5) * fw;
    const text = m.label ?? (m.fret === 0 ? '' : m.finger ?? '');
    s += `<circle class="${m.fret === 0 ? 'dg-open' : 'dg-dot'} ${cls}" cx="${cx}" cy="${y}" r="11.5"/>`;
    if (text !== '') s += `<text class="${m.fret === 0 ? 'dg-openlabel' : 'dg-finger'} ${cls}" x="${cx}" y="${y + 4.5}" text-anchor="middle">${text}</text>`;
  };
  marks.forEach((m) => draw(m, ''));
  if (current) draw(current, 'is-current');
  return s + '</svg>';
}

// 개방현 여섯 줄의 이름
export function openStringsSvg() {
  const x0 = 96, y0 = 20, sh = 30, w = 300;
  let s = `<svg class="dg dg-open-strings" viewBox="0 0 ${x0 + w + 20} ${y0 + sh * 5 + 26}" role="img" aria-label="개방현 여섯 줄의 음 이름">`;
  STRINGS.slice().reverse().forEach((st, i) => {
    const y = y0 + i * sh;
    s += `<text class="dg-finger is-plain" x="12" y="${y + 6}">${st.num}번줄</text>`;
    s += `<line class="dg-string" x1="${x0}" y1="${y}" x2="${x0 + w - 70}" y2="${y}" stroke-width="${(1.1 + i * 0.45).toFixed(2)}"/>`;
    s += `<text class="dg-finger is-plain" x="${x0 + w - 56}" y="${y + 6}">${NOTE_NAMES[pitchClass(st.midi)]} ${midiToKo(st.midi)}</text>`;
  });
  return s + '</svg>';
}

export function figureSvg(figure) {
  if (!figure) return '';
  if (figure.kind === 'chord') return chordSvg(figure.id);
  if (figure.kind === 'fretboard') return fretboardSvg(figure.marks, { frets: figure.frets });
  if (figure.kind === 'open') return openStringsSvg();
  return '';
}
