# 인계: 여섯줄(기타 연습 웹앱) · 2026-11-13

- 앱: https://irun20000-eng.github.io/guitar-lesson/ (GitHub Pages, main 루트, 올리면 1~2분 뒤 반영, noindex)
- 레포: `irun20000-eng/guitar-lesson` (공개). 로컬 `C:\Users\irun2\Desktop\Claude_ProjecT\guitar-lesson`
- 본사 기록: `aftermath-hq` `briefs/T-20261112-03/`(v0.5), `briefs/T-20261113-01/`(세 앱 업데이트, v0.6)
- 디자인 참고: `design-library` `references/webapp-ui-2026-11/`

## 현재 상태
v0.6. 0~10단계 레슨 39개, 곡 7개 + 내 곡 만들기, 코드 15개, 튜너·메트로놈·박자 보정·소리 점검·설정, "야간 무대" 디자인.
v0.6.1(본사 화면 검수 반영): 보정이 잘 안 되면 저장하지 않고 다시 하게 함, 시끄러운 방 먼저 알림, 누르는 영역 44px, 곡 만들기 넘침 수정(기획서 21.5).
v0.6에서 더한 것: **보정 도우미**(`#adjust`, 기기에서 재고 판정 기준을 스스로 저장), 애매한 판정은 「다시 쳐 볼까요」, 인터넷 없이 열기(`sw.js`), 밝은 화면(설정 「화면 밝기」), 업데이트 뒤 「새로 생긴 것」 한 번. 자세한 값은 `docs/기획서.md` 21장.
**실제 기타·태블릿 마이크로는 아직 보정해 보지 않았다.** 합성음과 발진기 소리로만 확인했다.

## 다음 할 일(순서대로)
1. 사용자가 실제 클래식 기타와 태블릿으로 튜닝 → 보정 도우미 1회. 결과 화면의 「녹음 WAV 저장」 파일을 받으면 `tests/`의 고정 시험 자료로 추가하고, 보정값(설정의 판정 기준 줄, 또는 「결과 복사」)을 보고 `src/js/calibrate.js`의 `CALIB_LIMITS`가 적당한지 검토
2. 디자인의 글로우(어두운 화면)와 본사 디자인 아카데미 원칙 2의 충돌: 개정 후보로 올릴지, 글로우를 뺄지 대표 결정 대기(`docs/결정사항.md`)
3. 앱 이름 확정(대표 결정 대기)
4. v0.7 후보: 내 연주 녹음해 다시 듣기, 곡 추가(곡마다 저작권 재확인), 주간 기록 화면, 아이 프로필, 두 음 동시 독주

## 재개 방법
```
node --test "tests/*.test.mjs"   # 시험 61개(약 40초)
node build.mjs                   # src → index.html + sw.js. 두 파일을 함께 커밋
node tools/serve.mjs             # http://localhost:5173 (끝에 ?dev=1 이면 합성음 시험 단추, 보정 도우미의 「합성음으로 시험」)
```
- 새 기기에서 커밋하기 전에 `git config user.email 252165118+irun20000-eng@users.noreply.github.com` (개인 메일이면 푸시가 거절됨)
- localhost에서 열면 서비스 워커가 등록된다. 화면은 늘 새 판을 먼저 받으므로 고친 뒤 새로 고침하면 바로 보인다.

## 꼭 지킬 것
1. 여러 줄이 함께 울리는 상황 때문에 음 판정은 "쳐야 할 음이 들리는가"를 확인하는 방식(`setExpected`)이다. "가장 강한 음 하나"로 되돌리지 않는다.
2. 판정 기준을 바꾸면 `tests/sim.mjs`(연주 시뮬레이터)를 쓰는 `tests/practice.test.mjs`, `tests/calibrate.test.mjs`부터 돌린다.
3. 판정 기준의 기본값은 `CALIB_DEFAULTS`(calibrate.js), 추적기 기본값은 `TRACKER_DEFAULTS`(tracker.js)에 있다. 화면 코드에서 숫자를 직접 쓰지 말고 `trackerOptions(settings)`, `chordMinScore(settings)`를 거친다.
4. 레슨·곡은 `src/js/lessons-data.js`만 고친다. `tests/content.test.mjs`가 형식, 코드 소개 순서, 마디 길이를 검사한다.
5. 곡은 저작권 보호 기간이 끝난 선율과 자체 연습곡만, 가사는 넣지 않는다.
6. `sw.js`는 빌드가 만든다. 직접 고치지 말고 `src/sw.template.js`를 고친다. 새 판을 올릴 때 `APP_VERSION`(ui-pages.js)과 `NEWS`를 함께 바꾼다.