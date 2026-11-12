// 레슨과 곡 자료. 화면 코드와 분리해 두어 내용만 따로 고치거나 늘릴 수 있다.
// 단계(step) 종류: card(설명), tuner(튜너로 이동), notes(단음 연습), strings(한 줄씩 점검),
//                  strum(코드 확인), change(코드 전환), rhythm(스트로크·반주)
import { seq } from './score.js';

export const STAGES = [
  { n: 0, title: '준비', desc: '기타 각 부분, 앉는 자세, 두 손, 튜닝' },
  { n: 1, title: '줄과 프렛', desc: '줄 번호와 개방현 음, TAB 악보 읽기' },
  { n: 2, title: '단음 멜로디', desc: '1~3번줄에서 검지와 중지를 번갈아 쳐서 쉬운 멜로디' },
  { n: 3, title: '첫 코드', desc: 'Em, Am. 코드표 읽기와 한 줄씩 점검' },
  { n: 4, title: '코드 넓히기 1', desc: 'C, G, D와 1분 코드 전환' },
  { n: 5, title: '스트로크와 박자', desc: '엄지와 검지로 쓸어 치기, 박자 맞추기' },
  { n: 6, title: '첫 곡 반주', desc: '코드 네 개로 한 곡을 끝까지' },
  { n: 7, title: '아르페지오', desc: '엄지 베이스와 검지·중지·약지 패턴' },
  { n: 8, title: '코드 넓히기 2', desc: 'E, A, Dm, 세븐스 코드' },
  { n: 9, title: 'F 코드', desc: 'Fmaj7 → 작은 F → 바레 F로 천천히' },
  { n: 10, title: '멜로디와 베이스 함께', desc: '혼자서 베이스와 멜로디를 주고받는 독주 기초' },
];

const score = (title, bpm, items, beatsPerBar = 4) => ({ title, bpm, beatsPerBar, notes: seq(items) });
const card = (title, body, figure) => ({ type: 'card', title, body, figure });
const notes = (title, bpm, items, modes = ['wait', 'timed'], beatsPerBar = 4) => ({ type: 'notes', title, score: score(title, bpm, items, beatsPerBar), modes });
const rep = (items, times) => Array.from({ length: times }, () => items).flat();

// 음 위치 줄임말: [줄, 프렛]
const G3 = [3, 0], A3 = [3, 2], B3 = [2, 0], C4 = [2, 1], D4 = [2, 3], E4 = [1, 0], F4 = [1, 1], G4 = [1, 3];
const L = (p, dur) => [p[0], p[1], dur];

const TWINKLE = [G3, G3, D4, D4, E4, E4, L(D4, 2), C4, C4, B3, B3, A3, A3, L(G3, 2),
  D4, D4, C4, C4, B3, B3, L(A3, 2), D4, D4, C4, C4, B3, B3, L(A3, 2),
  G3, G3, D4, D4, E4, E4, L(D4, 2), C4, C4, B3, B3, A3, A3, L(G3, 2)];
const MARY = [E4, D4, C4, D4, E4, E4, L(E4, 2), D4, D4, L(D4, 2), E4, G4, L(G4, 2),
  E4, D4, C4, D4, E4, E4, E4, E4, D4, D4, E4, D4, L(C4, 4)];
const ODE = [E4, E4, F4, G4, G4, F4, E4, D4, C4, C4, D4, E4, L(E4, 1.5), L(D4, 0.5), L(D4, 2),
  E4, E4, F4, G4, G4, F4, E4, D4, C4, C4, D4, E4, L(D4, 1.5), L(C4, 0.5), L(C4, 2)];

// 작은 별: 베이스(엄지)와 멜로디를 반 박씩 주고받는 독주 편곡. 베이스는 솔(6번줄 3프렛), 도(5번줄 3프렛), 레(4번줄 개방).
const bG = [6, 3], bC = [5, 3], bD = [4, 0];
const duo = (bass, a, b) => [L(bass, 0.5), L(a, 0.5), L(bass, 0.5), L(b, 0.5)];
const TWINKLE_SOLO = [...duo(bG, G3, G3), ...duo(bG, D4, D4), ...duo(bC, E4, E4), L(bG, 0.5), L(D4, 1.5),
  ...duo(bC, C4, C4), ...duo(bG, B3, B3), ...duo(bD, A3, A3), L(bG, 0.5), L(G3, 1.5)];

export const SONGS = [
  { id: 'twinkle', kind: 'melody', title: '작은 별', source: '프랑스 전래 선율', stage: 2, score: score('작은 별', 80, TWINKLE) },
  { id: 'mary', kind: 'melody', title: '메리의 어린 양', source: '미국 동요(로웰 메이슨 선율)', stage: 2, score: score('메리의 어린 양', 88, MARY) },
  { id: 'ode', kind: 'melody', title: '환희의 송가', source: '베토벤', stage: 2, score: score('환희의 송가', 88, ODE) },
  { id: 'round-g', kind: 'chords', title: '연습곡 1 · 네 코드 돌리기', source: '이 앱의 연습곡', stage: 6, bars: rep(['G', 'Em', 'C', 'D'], 4), pattern: 'D-D-D-D-', bpm: 66 },
  { id: 'round-c', kind: 'chords', title: '연습곡 2 · 도 라 파 솔', source: '이 앱의 연습곡', stage: 6, bars: rep(['C', 'Am', 'Fmaj7', 'G'], 4), pattern: 'D-DUD-DU', bpm: 66 },
  { id: 'twinkle-acc', kind: 'chords', title: '작은 별 반주', source: '프랑스 전래 선율', stage: 6, bars: ['G', 'G', 'C', 'G', 'C', 'G', 'D', 'G', 'G', 'C', 'G', 'D', 'G', 'C', 'G', 'D', 'G', 'G', 'C', 'G', 'C', 'G', 'D', 'G'], pattern: 'D-D-', bpm: 72 },
  { id: 'twinkle-solo', kind: 'melody', title: '작은 별 독주(베이스와 주고받기)', source: '프랑스 전래 선율', stage: 10, score: score('작은 별 독주', 60, TWINKLE_SOLO) },
];
const song = (id) => SONGS.find((s) => s.id === id);

export const LESSONS = [
  // ---------- 0 준비 ----------
  { id: '0-1', stage: 0, title: '기타와 친해지기', goal: '기타 각 부분의 이름과 줄 번호를 안다', steps: [
    card('기타의 각 부분', ['위쪽부터 헤드(줄감개가 달린 곳), 넥(왼손으로 잡는 긴 부분), 몸통 순서입니다.', '넥 앞면을 지판이라 하고, 지판에 가로로 박힌 쇠막대를 프렛이라고 합니다. 몸통 가운데 둥근 구멍은 울림구멍, 줄이 묶인 아래쪽 나무는 브리지입니다.', '클래식 기타는 나일론 줄을 써서 소리가 부드럽고 손끝이 덜 아픕니다. 넥이 넓어 손가락 사이가 넉넉합니다.']),
    card('줄 번호', ['기타를 안았을 때 바닥 쪽에 있는 가장 가는 줄이 1번줄, 얼굴 쪽에 있는 가장 굵은 줄이 6번줄입니다.', '누르지 않고 치는 줄을 개방현이라고 합니다. 6번줄부터 미, 라, 레, 솔, 시, 미입니다.'], { kind: 'open' }),
  ] },
  { id: '0-2', stage: 0, title: '앉는 자세와 두 손', goal: '편하게 앉아 두 손의 기본 모양을 잡는다', steps: [
    card('앉는 자세', ['의자 앞쪽에 허리를 펴고 앉습니다. 기타 옆구리의 오목한 곳을 왼쪽 허벅지에 올리고, 왼발을 발받침이나 두꺼운 책 위에 올려 넥이 비스듬히 위를 향하게 합니다.', '발받침이 없으면 오른쪽 허벅지에 올려도 됩니다. 어깨에 힘이 들어가지 않는 자세가 좋은 자세입니다.']),
    card('왼손', ['엄지는 넥 뒤 가운데쯤에 가볍게 댑니다. 손가락은 둥글게 세워서 손끝으로, 프렛 바로 뒤(몸통 쪽 쇠막대에 가깝게)를 누릅니다.', '손가락 번호는 검지 1, 중지 2, 약지 3, 새끼 4입니다. 손톱은 짧게 깎아 주세요.']),
    card('오른손', ['손가락 이름은 엄지 p, 검지 i, 중지 m, 약지 a입니다. 클래식 기타는 피크 없이 손가락으로 칩니다.', '기본 자리는 엄지가 4~6번줄, 검지가 3번줄, 중지가 2번줄, 약지가 1번줄입니다. 손목은 줄에서 살짝 띄우고 힘을 뺍니다.']),
  ] },
  { id: '0-3', stage: 0, title: '튜닝하기', goal: '여섯 줄을 튜너로 맞춘다', steps: [
    card('연습 전에는 항상 튜닝', ['줄이 조금만 풀려도 맞게 눌렀는데 틀린 음이 납니다. 이 앱도 튜닝이 틀어지면 잘못 알아듣습니다.', '새 나일론 줄은 며칠 동안 계속 풀립니다. 연습을 시작할 때마다 튜너를 한 번 열어 주세요.']),
    { type: 'tuner' },
  ] },

  // ---------- 1 줄과 프렛 ----------
  { id: '1-1', stage: 1, title: '여섯 줄의 이름', goal: '부르는 개방현을 바로 찾아 친다', steps: [
    card('굵은 줄부터 차례로', ['6번줄부터 1번줄까지 엄지로 하나씩 쳐 봅니다. 화면이 가리키는 줄을 치면 다음으로 넘어갑니다.', '맞는 줄을 칠 때까지 기다려 주니 천천히 하세요.'], { kind: 'open' }),
    notes('6번줄에서 1번줄로, 다시 6번줄로', 60, [[6, 0], [5, 0], [4, 0], [3, 0], [2, 0], [1, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]], ['wait']),
  ] },
  { id: '1-2', stage: 1, title: 'TAB 악보 읽기', goal: 'TAB을 보고 어느 줄인지 안다', steps: [
    card('TAB 악보', ['가로줄 여섯 개가 기타 줄입니다. 맨 윗줄이 1번줄(가장 가는 줄), 맨 아랫줄이 6번줄입니다. 기타를 눕혀 놓고 위에서 내려다본 모양입니다.', '줄 위의 숫자는 누를 프렛입니다. 0은 누르지 않고 치는 개방현입니다.']),
    notes('줄 건너뛰기', 60, [[3, 0], [2, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [4, 0], [2, 0], [5, 0], [3, 0], [6, 0], [1, 0]], ['wait']),
  ] },
  { id: '1-3', stage: 1, title: '프렛 누르기', goal: '1번줄과 2번줄에서 프렛을 눌러 맑은 소리를 낸다', steps: [
    card('한 프렛에 한 손가락', ['1프렛은 검지, 2프렛은 중지, 3프렛은 약지로 누릅니다. 손끝을 세워 프렛 바로 뒤를 누르면 적은 힘으로도 맑은 소리가 납니다.', '소리가 지지직거리면 프렛에서 너무 멀거나 덜 눌린 것입니다.'], { kind: 'fretboard', marks: [{ string: 1, fret: 1, finger: 1 }, { string: 1, fret: 3, finger: 3 }] }),
    notes('1번줄: 미 파 솔', 60, [E4, F4, G4, F4, E4, F4, G4, G4, F4, E4], ['wait']),
    notes('2번줄: 시 도 레', 60, [B3, C4, D4, C4, B3, C4, D4, D4, C4, B3], ['wait']),
  ] },

  // ---------- 2 단음 멜로디 ----------
  { id: '2-1', stage: 2, title: '검지와 중지 번갈아 치기', goal: '오른손 검지와 중지를 걷듯이 번갈아 쓴다', steps: [
    card('i, m 번갈아 치기', ['멜로디는 오른손 검지(i)와 중지(m)를 걷는 것처럼 번갈아 칩니다. 같은 손가락을 연달아 쓰지 않는 것이 요령입니다.', '줄을 친 손가락이 바로 옆(굵은 쪽) 줄에 기대어 멈추게 치면 소리가 또렷합니다. 이것을 아포얀도라고 합니다.']),
    notes('1번줄 개방현을 i m i m', 70, rep([E4], 8), ['wait', 'timed']),
    notes('2번줄에서 1번줄로', 70, [B3, B3, C4, C4, D4, D4, E4, E4, F4, F4, G4, G4], ['wait', 'timed']),
  ] },
  { id: '2-2', stage: 2, title: '도레미파솔', goal: '도에서 솔까지 오르내린다', steps: [
    card('다섯 음의 자리', ['도와 레는 2번줄 1프렛과 3프렛, 미 파 솔은 1번줄 개방현, 1프렛, 3프렛입니다.'], { kind: 'fretboard', marks: [{ string: 2, fret: 1, finger: 1, label: '도' }, { string: 2, fret: 3, finger: 3, label: '레' }, { string: 1, fret: 0, label: '미' }, { string: 1, fret: 1, finger: 1, label: '파' }, { string: 1, fret: 3, finger: 3, label: '솔' }] }),
    notes('올라갔다 내려오기', 70, [C4, D4, E4, F4, G4, F4, E4, D4, L(C4, 2)], ['wait', 'timed']),
  ] },
  { id: '2-3', stage: 2, title: '3번줄 솔과 라', goal: '낮은 솔부터 높은 솔까지 잇는다', steps: [
    card('3번줄', ['3번줄 개방현은 솔, 2프렛(중지)은 라입니다. 여기에 2번줄 시 도 레를 이으면 낮은 솔에서 레까지 올라갑니다.'], { kind: 'fretboard', marks: [{ string: 3, fret: 0, label: '솔' }, { string: 3, fret: 2, finger: 2, label: '라' }, { string: 2, fret: 0, label: '시' }, { string: 2, fret: 1, finger: 1, label: '도' }, { string: 2, fret: 3, finger: 3, label: '레' }] }),
    notes('솔 라 시 도 레', 70, [G3, A3, B3, C4, D4, C4, B3, A3, L(G3, 2)], ['wait', 'timed']),
  ] },
  { id: '2-4', stage: 2, title: '작은 별', goal: '작은 별을 끝까지 친다', steps: [
    card('첫 곡', ['지금까지 배운 여섯 음으로 칩니다. 먼저 기다려 주기로 음을 익히고, 익숙해지면 박자 맞추기로 바꿔 보세요. 빠르기는 70%부터 시작하면 편합니다.']),
    { type: 'notes', title: '작은 별', score: song('twinkle').score, modes: ['wait', 'timed'] },
  ] },
  { id: '2-5', stage: 2, title: '메리의 어린 양', goal: '도 레 미 솔 네 음으로 한 곡을 친다', steps: [
    { type: 'notes', title: '메리의 어린 양', score: song('mary').score, modes: ['wait', 'timed'] },
  ] },
  { id: '2-6', stage: 2, title: '환희의 송가', goal: '점음표가 있는 곡을 박자에 맞춰 친다', steps: [
    card('길게 끄는 음', ['넷째 마디에 한 박 반짜리 음과 반 박짜리 음이 나옵니다. 화면에서 음표의 간격을 보고 길게, 짧게를 구분하세요.']),
    { type: 'notes', title: '환희의 송가', score: song('ode').score, modes: ['wait', 'timed'] },
  ] },

  // ---------- 3 첫 코드 ----------
  { id: '3-1', stage: 3, title: '코드표 읽기와 Em', goal: 'Em을 잡고 여섯 줄을 맑게 울린다', steps: [
    card('코드표 읽는 법', ['코드표는 기타를 세워 놓고 정면에서 본 그림입니다. 세로줄 여섯 개가 줄이고 맨 왼쪽이 6번줄입니다. 가로줄은 프렛입니다.', '점 안의 숫자는 왼손 손가락 번호입니다. 줄 위의 ○는 누르지 않고 치는 줄, ×는 치지 않는 줄입니다.'], { kind: 'chord', id: 'Em' }),
    card('Em 잡기', ['중지를 5번줄 2프렛에, 약지를 4번줄 2프렛에 놓습니다. 엄지로 6번줄부터 1번줄까지 천천히 쓸어내립니다.', '한 줄씩 쳐 보면 어느 줄이 덜 울리는지 알 수 있습니다. 아래에서 확인해 보세요.'], { kind: 'chord', id: 'Em' }),
    { type: 'strings', chord: 'Em' },
    { type: 'strum', chord: 'Em', times: 4 },
  ] },
  { id: '3-2', stage: 3, title: 'Am', goal: 'Am을 잡고 5번줄부터 울린다', steps: [
    card('Am 잡기', ['검지를 2번줄 1프렛, 중지를 4번줄 2프렛, 약지를 3번줄 2프렛에 놓습니다. 6번줄은 치지 않고 5번줄부터 칩니다.', '1번줄이 검지 살에 닿아 먹먹해지기 쉽습니다. 손가락을 세우고 손바닥을 넥에서 조금 떼어 보세요.'], { kind: 'chord', id: 'Am' }),
    { type: 'strings', chord: 'Am' },
    { type: 'strum', chord: 'Am', times: 4 },
  ] },
  { id: '3-3', stage: 3, title: 'Em과 Am 바꾸기', goal: '두 코드를 1분에 10번 넘게 바꾼다', steps: [
    card('바꾸는 요령', ['Em에서 중지와 약지를 모양 그대로 한 줄씩 아래(가는 줄 쪽)로 옮기고 검지를 더하면 Am입니다.', '손가락을 하나씩 옮기지 말고 한꺼번에 움직이는 연습을 합니다. 한 번 치고 바꾸고, 한 번 치고 바꿉니다. 횟수가 기록되니 어제보다 한 번만 더 해 보세요.']),
    { type: 'change', a: 'Em', b: 'Am', seconds: 60, goal: 10 },
  ] },

  // ---------- 4 코드 넓히기 1 ----------
  { id: '4-1', stage: 4, title: 'C', goal: 'C를 잡고 5번줄부터 맑게 울린다', steps: [
    card('C 잡기', ['검지를 2번줄 1프렛, 중지를 4번줄 2프렛, 약지를 5번줄 3프렛에 놓습니다. Am에서 약지만 5번줄 3프렛으로 옮긴 모양입니다.', '약지가 4번줄에 닿지 않게, 검지가 1번줄에 닿지 않게 손가락을 세웁니다.'], { kind: 'chord', id: 'C' }),
    { type: 'strings', chord: 'C' },
    { type: 'strum', chord: 'C', times: 4 },
    { type: 'change', a: 'C', b: 'Am', seconds: 60, goal: 10 },
  ] },
  { id: '4-2', stage: 4, title: 'G', goal: 'G를 잡고 여섯 줄을 울린다', steps: [
    card('G 잡기', ['검지를 5번줄 2프렛, 중지를 6번줄 3프렛, 약지를 1번줄 3프렛에 놓습니다. 손을 넓게 벌려야 해서 처음에는 어색합니다.', '약지 대신 새끼손가락으로 1번줄을 눌러도 됩니다. 편한 쪽으로 하세요.'], { kind: 'chord', id: 'G' }),
    { type: 'strings', chord: 'G' },
    { type: 'strum', chord: 'G', times: 4 },
    { type: 'change', a: 'G', b: 'Em', seconds: 60, goal: 10 },
  ] },
  { id: '4-3', stage: 4, title: 'D', goal: 'D를 잡고 4번줄부터 울린다', steps: [
    card('D 잡기', ['검지를 3번줄 2프렛, 중지를 1번줄 2프렛, 약지를 2번줄 3프렛에 놓습니다. 5번줄과 6번줄은 치지 않습니다.', '세 손가락이 작은 세모를 이룹니다. 엄지로 4번줄부터 쓸어내립니다.'], { kind: 'chord', id: 'D' }),
    { type: 'strings', chord: 'D' },
    { type: 'strum', chord: 'D', times: 4 },
    { type: 'change', a: 'G', b: 'D', seconds: 60, goal: 10 },
  ] },
  { id: '4-4', stage: 4, title: 'C와 G 바꾸기', goal: '가장 자주 나오는 전환을 익힌다', steps: [
    card('멀리 움직이는 전환', ['C와 G는 손가락이 모두 자리를 옮깁니다. 바꾸기 직전에 다음 모양을 머릿속에 그리고, 손가락을 줄에서 조금만 띄워 움직입니다.', '소리가 완벽하지 않아도 박자에 맞춰 바꾸는 것이 먼저입니다.']),
    { type: 'change', a: 'C', b: 'G', seconds: 60, goal: 10 },
  ] },

  // ---------- 5 스트로크와 박자 ----------
  { id: '5-1', stage: 5, title: '엄지로 네 박', goal: '박자에 맞춰 한 마디에 네 번 쓸어내린다', steps: [
    card('내려치기', ['엄지 옆면으로 굵은 줄에서 가는 줄 쪽으로 쓸어내립니다. 화면의 화살표가 판정선에 닿을 때 칩니다.', '세게 치기보다 고르게 치는 데 집중하세요. 발로 박자를 같이 세면 쉽습니다.']),
    { type: 'rhythm', title: 'Em 네 박', bars: ['Em', 'Em', 'Em', 'Em'], pattern: 'D-D-D-D-', bpm: 60 },
  ] },
  { id: '5-2', stage: 5, title: '내리고 올리기', goal: '검지로 내리고 올리는 8비트를 친다', steps: [
    card('올려치기', ['검지 손톱 쪽으로 쓸어내리고(↓), 검지 살 쪽으로 가는 줄 서너 개만 가볍게 쓸어올립니다(↑).', '손은 시계추처럼 계속 아래위로 움직입니다. 올려치기는 내려치기보다 작게 칩니다.']),
    { type: 'rhythm', title: 'Em 8비트', bars: ['Em', 'Em', 'Am', 'Am'], pattern: 'DUDUDUDU', bpm: 60 },
  ] },
  { id: '5-3', stage: 5, title: '칼립소 리듬', goal: '가장 널리 쓰는 반주 리듬을 익힌다', steps: [
    card('↓ ↓↑ ↑↓↑', ['손은 계속 아래위로 움직이되, 줄을 치지 않고 지나가는 곳이 두 군데 있습니다. 입으로 "쿵 쿵짝 짝쿵짝" 하고 따라 하면 쉽습니다.', '처음에는 느리게, 왼손은 Em 하나만 잡고 오른손에 집중합니다.']),
    { type: 'rhythm', title: 'Em 칼립소', bars: ['Em', 'Em', 'Em', 'Em'], pattern: 'D-DU-UDU', bpm: 60 },
  ] },
  { id: '5-4', stage: 5, title: '코드를 바꾸며 치기', goal: '리듬을 멈추지 않고 코드를 바꾼다', steps: [
    card('멈추지 않기', ['코드를 바꾸느라 오른손이 멈추면 노래가 끊깁니다. 왼손이 조금 늦어도 오른손은 계속 움직이세요.', '마디의 마지막 박에서 미리 손을 떼고 옮기기 시작하면 다음 마디 첫 박에 맞출 수 있습니다.']),
    { type: 'rhythm', title: 'Em과 Am', bars: ['Em', 'Em', 'Am', 'Am', 'Em', 'Em', 'Am', 'Am'], pattern: 'D-D-D-D-', bpm: 60 },
    { type: 'rhythm', title: 'C와 G', bars: ['C', 'C', 'G', 'G', 'C', 'C', 'G', 'G'], pattern: 'D-D-D-D-', bpm: 60 },
  ] },

  // ---------- 6 첫 곡 반주 ----------
  { id: '6-1', stage: 6, title: '네 코드 돌리기', goal: 'G, Em, C, D를 한 마디씩 이어 친다', steps: [
    card('가장 흔한 진행', ['G, Em, C, D 네 코드를 차례로 도는 진행은 수많은 노래에 쓰입니다. 한 마디에 네 번 내려치면서 마디마다 코드를 바꿉니다.']),
    { type: 'rhythm', title: song('round-g').title, bars: song('round-g').bars, pattern: song('round-g').pattern, bpm: song('round-g').bpm },
  ] },
  { id: '6-2', stage: 6, title: 'Fmaj7과 도 라 파 솔', goal: 'F 대신 Fmaj7을 써서 C, Am, F, G 진행을 친다', steps: [
    card('Fmaj7', ['F 코드는 초보자에게 가장 어려운 코드입니다. 당분간은 모양이 쉬운 Fmaj7으로 대신합니다. C 코드에서 중지와 약지를 한 줄씩 아래로 옮긴 모양이고, 4번줄부터 칩니다.'], { kind: 'chord', id: 'Fmaj7' }),
    { type: 'strings', chord: 'Fmaj7' },
    { type: 'rhythm', title: song('round-c').title, bars: song('round-c').bars, pattern: song('round-c').pattern, bpm: song('round-c').bpm },
  ] },
  { id: '6-3', stage: 6, title: '작은 별 반주', goal: '노래를 부르며 G, C, D로 반주한다', steps: [
    card('노래 반주', ['두 박마다 코드가 바뀝니다. 한 코드에 두 번씩 내려칩니다. 익숙해지면 작은 별을 흥얼거리며 쳐 보세요.']),
    { type: 'rhythm', title: song('twinkle-acc').title, bars: song('twinkle-acc').bars, pattern: song('twinkle-acc').pattern, bpm: song('twinkle-acc').bpm },
  ] },

  // ---------- 7 아르페지오 ----------
  { id: '7-1', stage: 7, title: 'p i m a 개방현', goal: '엄지, 검지, 중지, 약지를 차례로 쓴다', steps: [
    card('아르페지오', ['코드를 한꺼번에 치지 않고 한 줄씩 차례로 뜯는 것을 아르페지오라고 합니다. 엄지(p)가 굵은 줄을, 검지(i) 중지(m) 약지(a)가 3번, 2번, 1번줄을 맡습니다.', '손가락을 미리 줄 위에 올려놓고, 손등은 움직이지 않은 채 손가락만 움직입니다.']),
    notes('6번 3번 2번 1번', 60, rep([[6, 0], [3, 0], [2, 0], [1, 0]], 4), ['wait', 'timed']),
  ] },
  { id: '7-2', stage: 7, title: 'Am 아르페지오', goal: '코드를 잡은 채로 한 줄씩 뜯는다', steps: [
    card('코드를 잡고 뜯기', ['왼손은 Am을 잡고 있습니다. 오른손 엄지가 5번줄, 검지 중지 약지가 3번, 2번, 1번줄을 칩니다.', '앞에 친 줄이 계속 울리기 때문에 앱이 가끔 헷갈릴 수 있습니다. 한 음씩 또렷하게 치면 잘 알아듣습니다.'], { kind: 'chord', id: 'Am' }),
    notes('Am: 5 3 2 1', 60, rep([[5, 0], [3, 2], [2, 1], [1, 0]], 4), ['wait', 'timed']),
    notes('Em: 6 3 2 1', 60, rep([[6, 0], [3, 0], [2, 0], [1, 0]], 4), ['wait', 'timed']),
  ] },
  { id: '7-3', stage: 7, title: 'C와 G 아르페지오', goal: '코드를 바꾸며 아르페지오를 잇는다', steps: [
    notes('C 두 마디, G 두 마디', 60, [...rep([[5, 3], [3, 0], [2, 1], [1, 0]], 2), ...rep([[6, 3], [3, 0], [2, 0], [1, 3]], 2)], ['wait', 'timed']),
  ] },
  { id: '7-4', stage: 7, title: '올라갔다 내려오기', goal: 'p i m a m i 여섯 음 패턴을 친다', steps: [
    card('여섯 음 패턴', ['엄지, 검지, 중지, 약지로 올라갔다가 중지, 검지로 내려옵니다. 발라드 반주에 많이 쓰는 패턴입니다.']),
    notes('Am과 Em', 66, [...rep([[5, 0], [3, 2], [2, 1], [1, 0], [2, 1], [3, 2]], 2), ...rep([[6, 0], [3, 0], [2, 0], [1, 0], [2, 0], [3, 0]], 2)], ['wait', 'timed'], 3),
  ] },

  // ---------- 8 코드 넓히기 2 ----------
  { id: '8-1', stage: 8, title: 'E와 A', goal: 'E와 A를 잡는다', steps: [
    card('E', ['Em에 검지(3번줄 1프렛)를 더하면 E입니다. 음 하나 차이로 밝은 느낌이 됩니다.'], { kind: 'chord', id: 'E' }),
    { type: 'strings', chord: 'E' },
    card('A', ['2프렛에 검지, 중지, 약지를 4번, 3번, 2번줄 순서로 나란히 세웁니다. 자리가 좁으니 손가락을 비스듬히 놓으세요. 5번줄부터 칩니다.'], { kind: 'chord', id: 'A' }),
    { type: 'strings', chord: 'A' },
    { type: 'change', a: 'A', b: 'E', seconds: 60, goal: 10 },
  ] },
  { id: '8-2', stage: 8, title: 'Dm', goal: 'Dm을 잡고 D와 구분한다', steps: [
    card('Dm', ['검지를 1번줄 1프렛, 중지를 3번줄 2프렛, 약지를 2번줄 3프렛에 놓습니다. D에서 1번줄만 한 프렛 낮춘 모양이고 4번줄부터 칩니다.'], { kind: 'chord', id: 'Dm' }),
    { type: 'strings', chord: 'Dm' },
    { type: 'strum', chord: 'Dm', times: 4 },
    { type: 'change', a: 'Dm', b: 'Am', seconds: 60, goal: 10 },
  ] },
  { id: '8-3', stage: 8, title: '세븐스 코드', goal: 'G7, D7, A7, E7을 잡는다', steps: [
    card('세븐스', ['코드 이름에 7이 붙으면 음 하나가 더해져 다음 코드로 넘어가고 싶은 느낌이 납니다. 모양은 기본 코드에서 손가락 하나를 옮기거나 떼면 됩니다.']),
    card('G7', ['중지를 5번줄 2프렛, 약지를 6번줄 3프렛, 검지를 1번줄 1프렛에 놓습니다.'], { kind: 'chord', id: 'G7' }),
    { type: 'strum', chord: 'G7', times: 3 },
    card('D7', ['검지를 2번줄 1프렛, 중지를 3번줄 2프렛, 약지를 1번줄 2프렛에 놓습니다. 4번줄부터 칩니다.'], { kind: 'chord', id: 'D7' }),
    { type: 'strum', chord: 'D7', times: 3 },
    card('A7과 E7', ['A7은 중지를 4번줄 2프렛, 약지를 2번줄 2프렛에 놓고 3번줄은 비웁니다. E7은 중지를 5번줄 2프렛, 검지를 3번줄 1프렛에 놓습니다.'], { kind: 'chord', id: 'A7' }),
    { type: 'strum', chord: 'A7', times: 3 },
    { type: 'strum', chord: 'E7', times: 3 },
  ] },
  { id: '8-4', stage: 8, title: '카포', goal: '카포가 무엇이고 언제 쓰는지 안다', steps: [
    card('카포', ['카포는 프렛에 끼워 모든 줄을 한꺼번에 눌러 주는 집게입니다. 같은 코드 모양으로 치면서 전체 음을 높일 수 있습니다.', '노래가 내 목소리에 낮으면 카포를 2프렛이나 3프렛에 끼워 보세요. 클래식 기타는 넥이 평평하고 넓으니 클래식 기타용 카포를 써야 합니다.', '카포를 끼운 상태에서는 이 앱의 판정이 맞지 않습니다. 앱으로 연습할 때는 빼 주세요.']),
  ] },

  // ---------- 9 F 코드 ----------
  { id: '9-1', stage: 9, title: '작은 F', goal: '검지로 두 줄을 함께 누른다', steps: [
    card('검지를 눕히기', ['Fmaj7에서 검지를 눕혀 1번줄과 2번줄 1프렛을 함께 누르면 작은 F입니다. 검지 끝마디의 넓은 면을 씁니다.', '처음에는 1번줄이 잘 안 울립니다. 며칠에 걸쳐 조금씩 됩니다. 하루에 몇 분씩만 하세요.'], { kind: 'chord', id: 'Fs' }),
    { type: 'strings', chord: 'Fs' },
    { type: 'change', a: 'C', b: 'Fs', seconds: 60, goal: 8 },
  ] },
  { id: '9-2', stage: 9, title: '바레 F', goal: '검지로 여섯 줄을 모두 누른다', steps: [
    card('바레 코드', ['검지를 곧게 펴서 1프렛의 여섯 줄을 모두 누르고, 나머지 손가락으로 E 코드 모양을 한 프렛 위에 잡습니다.', '요령은 세 가지입니다. 검지를 프렛에 바짝 붙이고, 검지의 엄지 쪽 옆면으로 누르고, 넥 뒤의 엄지를 검지 맞은편에 둡니다. 팔꿈치를 몸에 붙이면 힘이 덜 듭니다.', '여섯 줄이 모두 울리기까지 몇 주가 걸리는 것이 보통입니다. 안 울리는 줄이 어디인지 한 줄씩 확인하며 조금씩 고쳐 가세요.'], { kind: 'chord', id: 'F' }),
    { type: 'strings', chord: 'F' },
  ] },
  { id: '9-3', stage: 9, title: 'F 넣어 치기', goal: '진행 안에서 F로 바꾼다', steps: [
    card('진행 속의 F', ['F를 잡는 데 시간이 걸려도 괜찮습니다. 작은 F로 쳐도 좋으니 박자를 지키며 바꾸는 연습을 합니다.']),
    { type: 'change', a: 'Am', b: 'Fs', seconds: 60, goal: 8 },
    { type: 'rhythm', title: 'C Am F G', bars: rep(['C', 'Am', 'Fs', 'G'], 2), pattern: 'D-D-D-D-', bpm: 60 },
  ] },

  // ---------- 10 멜로디와 베이스 함께 ----------
  { id: '10-1', stage: 10, title: '베이스와 멜로디 주고받기', goal: '엄지와 다른 손가락이 번갈아 나온다', steps: [
    card('독주의 첫걸음', ['혼자서 반주와 멜로디를 함께 치는 것이 독주입니다. 엄지가 굵은 줄에서 베이스를, 검지와 중지가 가는 줄에서 멜로디를 맡습니다.', '여기서는 베이스와 멜로디를 반 박씩 번갈아 칩니다. 두 음을 동시에 치는 독주는 다음 버전에서 다룹니다.']),
    notes('베이스 솔과 멜로디', 60, [...duo(bG, G3, B3), ...duo(bG, D4, B3), ...duo(bC, C4, E4), ...duo(bC, G4, E4)], ['wait', 'timed']),
  ] },
  { id: '10-2', stage: 10, title: '작은 별 독주', goal: '베이스를 넣어 작은 별 앞부분을 혼자 친다', steps: [
    card('베이스 자리', ['베이스는 세 음만 씁니다. 솔은 6번줄 3프렛, 도는 5번줄 3프렛, 레는 4번줄 개방현입니다. 모두 엄지로 칩니다.'], { kind: 'fretboard', marks: [{ string: 6, fret: 3, finger: 3, label: '솔' }, { string: 5, fret: 3, finger: 3, label: '도' }, { string: 4, fret: 0, label: '레' }] }),
    { type: 'notes', title: '작은 별 독주', score: song('twinkle-solo').score, modes: ['wait', 'timed'] },
  ] },
];

export function lessonById(id) {
  return LESSONS.find((l) => l.id === id) || null;
}

export function isPractice(step) {
  return step.type !== 'card';
}

// 기록·오늘의 연습용 요약 목록
export const LESSON_INDEX = LESSONS.map((l) => ({ id: l.id, stage: l.stage, title: l.title, practice: l.steps.some(isPractice) }));
