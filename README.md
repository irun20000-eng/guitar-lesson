# guitar-lesson

초급자를 위한 기타 레슨 웹앱. 클래식 기타를 처음 잡는 사람이 마이크 앞에서 치면 맞았는지 바로 알려 주는 무료 한국어 연습 앱을 목표로 한다.

## 지금 상태
- 1~5단계 구현 완료, 전체 디자인 개편 완료 (2026-11-12, v0.5).
- v0.6 (2026-11-13): 보정 도우미(기기에서 재고 판정 기준을 스스로 맞춤), 애매한 판정은 「다시 쳐 볼까요」, 인터넷 없이 열기, 밝은 화면, 새로 생긴 것 안내. v0.6.1: 본사 화면 검수 반영(보정 실패 처리, 시끄러운 방 알림, 누르는 영역, 넘침).
- 화면: 홈(오늘의 연습, 연속 연습일), 배우기(0~10단계 레슨 39개), 곡(멜로디 4곡, 반주 3곡, 내 곡 만들기), 도구(튜너, 코드표 15개, 메트로놈, 보정 도우미, 박자 보정, 소리 점검, 설정).
- 판정: 단음(기다려 주기, 박자 맞추기), 코드 한 줄씩 점검, 코드 확인, 1분 코드 전환, 스트로크 박자.
- 남은 일: 실제 기타와 태블릿으로 보정 도우미를 한 번 돌려 보고, 받은 녹음을 시험 자료로 추가.

## 열어 보기 (태블릿·휴대폰·PC 공통)
- https://irun20000-eng.github.io/guitar-lesson/
- main 브랜치에 올리면 1~2분 뒤 자동으로 반영된다.

## 열어 보기 (PC, 인터넷 없이)
- `PC에서_열기.bat` 을 두 번 누르면 브라우저에서 http://localhost:5173 이 열린다. 검은 창을 닫으면 끝난다.
- 또는 `node tools/serve.mjs` 실행 후 같은 주소를 연다.
- 마이크는 https 주소나 localhost 주소에서만 켜진다.
- 주소 끝에 `?dev=1` 을 붙이면 합성한 줄 소리로 튜너를 시험하는 단추가 나온다.

## 구조
```
index.html        빌드 결과. 이 파일 하나가 앱 전체다
src/app.html      화면 뼈대
src/style.css     모양
src/js/           엔진: notes pitch tuner tracker(음 추적) judge(채점) chroma chords calibrate(보정) score progress(기록)
                  자료: lessons-data(레슨·곡) diagram(코드표·지판 그림)
                  화면: audio listen ui-tuner ui-check ui-play ui-chord ui-lesson ui-adjust ui-pages main
src/sw.template.js 인터넷 없이 열기(빌드가 sw.js로 만듦)
build.mjs         src를 index.html 하나로 합치고 sw.js를 만듦
tests/            node 단위 시험
tools/serve.mjs   PC용 작은 서버
spike/            기획 단계 타당성 실험
docs/             기획서, 결정사항
```

## 명령
```
node build.mjs                    # index.html 다시 만들기
node --test "tests/*.test.mjs"    # 시험 61개
node spike/feasibility.mjs        # 타당성 실험 다시 돌리기
```
src를 고친 뒤에는 반드시 빌드해서 index.html과 sw.js를 함께 커밋한다.

## 문서
- [HANDOFF.md](HANDOFF.md): 인계(현재 상태, 다음 할 일, 재개 방법, 꼭 지킬 것)
- [docs/기획서.md](docs/기획서.md): 목표, 참고 앱 분석, 기술 타당성, 커리큘럼, 기능, 판정 설계, 화면, 진행 단계
- [docs/결정사항.md](docs/결정사항.md): 정해진 것과 정해야 할 것

## 진행 단계
| 단계 | 내용 | 상태 |
|---|---|---|
| 0 | 기획 | 완료 |
| 1 | 소리 엔진과 튜너 | 완료 |
| 2 | 단음 판정 연습 | 완료 |
| 3 | 흘러가는 TAB | 완료 |
| 4 | 코드 | 완료 |
| 5 | 완성(레슨 채우기, 곡, 기록) | 완료 |
| 디자인 | 야간 무대(어두운 그라디언트, 유리 패널) | 완료 |
| 6 v0.6 | 보정 도우미, 애매한 판정, 인터넷 없이 열기, 밝은 화면 | 완료 |
| 확인 | 실제 기타·태블릿으로 보정 도우미 실행 | 대기 |
