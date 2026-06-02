# ilsanroom2 — 자동화 시스템 (Self-Running SEO Ops)

내가 신경 쓰지 않아도 사이트가 스스로 점검·교정·보고하도록 구성한 자동화 전체 지도.

## 1. 무인 자동화 (GitHub Actions — 항상 실행)

| 워크플로 | 주기 | 하는 일 | 문제 시 |
|---|---|---|---|
| `gsc-monitor.yml` | 매일 12:20 KST | 사이트맵 API 제출 + 색인/순위/카니발리제이션/CTR/순위하락 점검 | 📧 이메일 |
| `live-health-check.yml` | 6시간마다 | 전 페이지 200 OK + 핵심 메타 존재 확인 | 📧 이메일 |
| `seo-watchdog.yml` | 매시 :15 | 키워드 밀도·제목 유니크·죽은 링크·스키마 | Actions 실패 알림 |
| `seo-daily-cron.yml` | 매일 12:00 KST | sitemap lastmod 갱신 + IndexNow(8페이지) 핑 | — |
| `schema-validate.yml` | 매일 13:00 KST | JSON-LD 문법 + 가짜 별점 금지 룰 | Actions 실패 알림 |
| `lighthouse.yml` / `lighthouse-ci.yml` | 매일 | 모바일/PC 성능·SEO 점수 | Actions 실패 알림 |

### 한 번만 등록하면 되는 시크릿 (GitHub → Settings → Secrets → Actions)

1. **`GSC_CREDENTIALS`** — `theasset-gsc` 서비스계정 키 JSON 전체
   (Gmail "[GSC 키]" 메일에 있는 그 JSON. 이 값이 있어야 GSC 모니터가 동작.)
2. **`GMAIL_USER`** — `theassetsquare@gmail.com`
3. **`GMAIL_APP_PASSWORD`** — 구글 계정 → 보안 → 앱 비밀번호(16자리).
   (일반 로그인 비번 아님. 이게 있어야 문제 발생 시 이메일이 발송됨.)
4. *(선택)* **`INDEXNOW_KEY`** — Bing/Yandex 즉시 색인용 키.

> 시크릿이 없으면 워크플로는 조용히 건너뛰고(`continue`/`warning`), 사이트는 정상 동작합니다.
> 이메일 알림만 비활성화될 뿐입니다.

## 2. GSC 진단 도구 (수동/에이전트 공용)

```bash
node scripts/gsc.js sites                 # 인증된 GSC 속성 목록
node scripts/gsc.js query [days]          # 키워드·순위·CTR·카니발리제이션
node scripts/gsc.js inspect <url>         # URL 색인 상태
node scripts/gsc.js submit-sitemap        # 사이트맵 강제 제출(색인 촉진)
node scripts/gsc_monitor.js               # 전 페이지 종합 점검 → 문제 시 exit 1
```

크리덴셜: `.secrets/theasset-gsc.json` (gitignore됨, 절대 커밋 안 됨) 또는
`GOOGLE_APPLICATION_CREDENTIALS` 환경변수.

## 3. Gmail 문제 자동 해결 루프 (에이전트 런북)

Gmail로 들어온 사이트 문제 메일을 읽고 → 고치고 → 해결된 메일을 삭제하는 절차.
Gmail 연동(MCP)이 있는 세션/스케줄에서 다음을 순서대로 수행:

1. `is:unread (subject:[ilsanroom2] OR subject:[🚨] OR "not indexed" OR "장애" OR "문제")` 검색
2. 각 메일 본문에서 문제 종류 파악:
   - **색인 안 됨 / URL unknown** → `node scripts/gsc.js submit-sitemap`, 중복 제목·H1 점검,
     `node scripts/gsc_monitor.js`로 재확인
   - **카니발리제이션** → 충돌 키워드의 페이지 중 1개로 canonical/내부링크 정리,
     형제 도메인(ilsanroom/ilsanroom1/ilsanroom3)과 제목 중복 제거
   - **순위 하락** → 해당 쿼리 페이지 제목/메타/본문 보강
   - **사이트 다운/메타 누락** → 해당 파일 수정
   - **죽은 링크/스키마 오류** → `python3 scripts/dead_link_check.py`,
     `python3 scripts/seo_audit.py`로 위치 확인 후 수정
3. 수정 → `python3 scripts/seo_audit.py` 통과 확인 → 커밋·푸시(자동 배포)
4. 문제가 해결되면 해당 Gmail 스레드를 **삭제**(또는 `처리완료` 라벨)
5. 처리 요약을 theassetsquare@gmail.com로 발송(선택)

> 주의: 원격 스케줄(cron) 실행에는 claude.ai Gmail MCP가 없을 수 있음.
> Gmail 읽기/삭제가 필요한 단계는 대화형 세션 또는 Gmail MCP가 연결된 환경에서 실행.
> 무인 알림(이메일 발송)은 1번 GitHub Actions가 담당하므로, 문제는 항상 메일로 통지됨.

## 4. 형제 도메인 카니발리제이션 (영구 규칙)

`ilsanroom2`는 다음 정체성으로 고정 — 형제 도메인과 절대 제목/H1 중복 금지:

- **ilsanroom2 (이 사이트)** = "라페스타 vs 웨스턴돔 점수표/순위" — 15년 현지인, 점수·순위 각도
- ilsanroom1 = "예약 전 읽을 글 / 첫 방문 후회 3가지"
- ilsanroom3 = "10년차 진짜 후기 / 정발산·마두·백석"
- ilsanroom = 놀쿨 브랜드 허브

새 콘텐츠 추가 시 위 각도를 유지하고, 제목/H1/메타가 형제와 겹치지 않는지
`node scripts/gsc.js query`의 카니발리제이션 섹션으로 상시 확인.
