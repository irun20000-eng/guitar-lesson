# 인계: 여섯줄(기타 연습 웹앱) · 2026-11-12

- 앱: https://irun20000-eng.github.io/guitar-lesson/ (GitHub Pages, main 루트, 올리면 1~2분 뒤 반영, noindex)
- 레포: `irun20000-eng/guitar-lesson` (공개). 로컬 `C:\Users\irun2\Desktop\Claude_ProjecT\guitar-lesson`
- 본사 기록: `aftermath-hq` `briefs/T-20261112-03/` (handoff.md, 노하우.md, retro.md)
- 디자인 참고: `design-library` `references/webapp-ui-2026-11/`

## 현재 상태
v0.5. 0~10단계 레슨 39개, 곡 7개 + 내 곡 만들기, 코드 15개, 튜너·메트로놈·박자 보정·소리 점검·설정, "야간 무대" 디자인. 판정 기준은 합성 소리로만 맞췄고 **실제 기타·태블릿 마이크로는 아직 확인하지 않았다.**

## 다음 할 일(순서대로)
1. 실제 클래식 기타와 태블릿으로 튜너와 「도구 → 소리 점검」을 해 보고 결과를 받아 판정 기준(`src/js/tracker.js` `TRACKER_DEFAULTS`, `src/js/listen.js` `trackerOptions`, `src/js/chords.js` `verifyChord`의 `minScore`)을 조정
2. 실제 녹음 WAV를 `tests/`의 고정 시험 자료로 추가
3. 디자인의 글로우 사용이 본사 디자인 아카데미 원칙 2와 부딪힘. 개정 후보로 올릴지, 글로우를 뺄지 결정
4. 두 음 동시 독주, 밝은 쪽 테마, 오프라인(PWA)

## 재개 방법
```
node --test "tests/*.test.mjs"   # 시험 46개(약 30초)
node build.mjs                   # src → index.html. index.html을 함께 커밋
node tools/serve.mjs             # http://localhost:5173 (끝에 ?dev=1 이면 합성음 시험 단추)
```
- 새 기기에서 커밋하기 전에 `git config user.email 252165118+irun20000-eng@users.noreply.github.com` (개인 메일이면 푸시가 거절됨)

## 꼭 지킬 것
1. 여러 줄이 함께 울리는 상황 때문에 음 판정은 "쳐야 할 음이 들리는가"를 확인하는 방식(`setExpected`)이다. "가장 강한 음 하나"로 되돌리지 않는다.
2. 판정 기준을 바꾸면 `tests/sim.mjs`(연주 시뮬레이터)를 쓰는 `tests/practice.test.mjs`부터 돌린다.
3. 레슨·곡은 `src/js/lessons-data.js`만 고친다. `tests/content.test.mjs`가 형식, 코드 소개 순서, 마디 길이를 검사한다.
4. 곡은 저작권 보호 기간이 끝난 선율과 자체 연습곡만, 가사는 넣지 않는다.
