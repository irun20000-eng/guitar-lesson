# guitar-lesson

초급자를 위한 기타 레슨 웹앱. 클래식 기타를 처음 잡는 사람이 마이크 앞에서 치면 맞았는지 바로 알려 주는 무료 한국어 연습 앱을 목표로 한다.

## 지금 상태
- 0단계 기획 완료, 1단계(소리 엔진과 튜너) 구현 완료 (2026-11-12).
- 남은 일: 실제 기타와 태블릿 마이크로 확인.
- 쓸 수 있는 화면: 홈, 튜너, 소리 점검.

## 열어 보기 (PC)
- `PC에서_열기.bat` 을 두 번 누르면 브라우저에서 http://localhost:5173 이 열린다. 검은 창을 닫으면 끝난다.
- 또는 `node tools/serve.mjs` 실행 후 같은 주소를 연다.
- 마이크는 https 주소나 localhost 주소에서만 켜진다. 태블릿에서 쓰려면 HTTPS 호스팅이 필요하다(docs/결정사항.md 6번).
- 주소 끝에 `?dev=1` 을 붙이면 합성한 줄 소리로 튜너를 시험하는 단추가 나온다.

## 구조
```
index.html        빌드 결과. 이 파일 하나가 앱 전체다
src/app.html      화면 뼈대
src/style.css     모양
src/js/           notes(음 이름) pitch(피치 검출) tuner(튜너 판단) check(소리 점검 분석)
                  wav synth(합성 기준음) audio(마이크·스피커) ui-tuner ui-check main
build.mjs         src를 index.html 하나로 합침
tests/            node 단위 시험
tools/serve.mjs   PC용 작은 서버
spike/            기획 단계 타당성 실험
docs/             기획서, 결정사항
```

## 명령
```
node build.mjs                    # index.html 다시 만들기
node --test "tests/*.test.mjs"    # 시험 21개
node spike/feasibility.mjs        # 타당성 실험 다시 돌리기
```
src를 고친 뒤에는 반드시 빌드해서 index.html을 함께 커밋한다.

## 문서
- [docs/기획서.md](docs/기획서.md): 목표, 참고 앱 분석, 기술 타당성, 커리큘럼, 기능, 판정 설계, 화면, 진행 단계
- [docs/결정사항.md](docs/결정사항.md): 정해진 것과 정해야 할 것

## 진행 단계
| 단계 | 내용 | 상태 |
|---|---|---|
| 0 | 기획 | 완료 |
| 1 | 소리 엔진과 튜너 | 구현 완료, 실제 기타 확인 대기 |
| 2 | 단음 판정 연습 | 대기 |
| 3 | 흘러가는 TAB | 대기 |
| 4 | 코드 | 대기 |
| 5 | 완성(레슨 채우기, 곡, 기록) | 대기 |
