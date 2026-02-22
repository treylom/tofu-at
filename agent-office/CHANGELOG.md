# Agent Office Changelog

---

## [2026-02-22] - v3.6 (Tofu Theme Complete + 3-State Status + Agent Flow LTR)

### 수정 파일
- `public/style.css` — `.theme-tofu` 전체 오버라이드, 3-state status, status legend/badge
- `public/app.js` — v3.3, setTheme() html 요소 기반, Agent Flow LTR 방향 전환, icon opacity Tofu 대응
- `public/index.html` — Tofu mascot, status legend HTML, theme toggle 업데이트
- `server.js` — 마이너 개선

### 변경 내용

#### Tofu Theme Complete (body.tofu → html.theme-tofu)
- [Changed]: 테마 적용 방식 — `body.tofu` 클래스 → `.theme-tofu` (html 요소에 적용)
- [Changed]: CSS 변수 전면 재정의 — accent: `#8b6f47` (따뜻한 갈색), bg-primary: `#faf7f2`
- [Added]: `--text-primary: #2c1f14` — Team Plan/Checkpoint/Bulletin 등 진한 검정 폰트
- [Added]: `.mc-plan-subject`, `.checkpoint-name`, `.item`, `.mc-search` 등 진한 색 오버라이드
- [Added]: `.report-card-subject`, `.report-detail-title` 진한 색 오버라이드
- [Added]: Tofu 마스코트 (`.tofu-mascot` — Tofu 테마에서만 표시)
- [Added]: Tofu agent-tile 상태별 색상 강화 (working=green, waiting=amber, done=blue)
- [Changed]: Agent Icon fill-opacity Tofu 대응 (0.2 → 0.35)
- [Changed]: localStorage 키 `ao-theme` → `agent-office-theme`

#### 3-State Agent Status (active/completed → working/waiting/done)
- [Changed]: 에이전트 타일 2-state → 3-state 전환
  - `.status-working` (green #22c55e, glow)
  - `.status-waiting` (yellow #fbbf24, glow)
  - `.status-done` (blue #3b82f6, glow)
- [Added]: Status Badge — 진행률 바 대신 큰 폰트 상태 배지 (18px, 700 weight)
- [Added]: Status Legend — Working/Waiting/Done 범례 표시
- [Changed]: Legacy `.active`/`.completed` 클래스 하위 호환 유지

#### Agent Flow LTR 방향 전환
- [Changed]: 그래프 방향 — Lead → Workers (star) → Workers → CatLeads → DA → Lead (left-to-right)
- [Changed]: Category Lead 계층 구조 — hierarchy 테이블 기반 매칭 유지, edge 방향 반전

### 영향 범위
- 영향받는 기능: 전체 UI (Dashboard, Agent Flow, Results)
- Classic 테마: 변경 없음 (기존 :root 변수 유지)
- 하위 호환: `.active`/`.completed` 레거시 클래스 지원

---

## [2026-02-19] - v3.4 (Category Lead Hierarchy + Hierarchy Table Parsing)

### 수정 파일
- `public/app.js` — buildAgentGraph() category_lead 지원, 계층 엣지 빌딩, CAT.LEAD 배지
- `lib/team-os-parser.js` — parseTeamPlan()에 `## Hierarchy` 테이블 파싱 추가

### 변경 내용

#### category_lead 노드 타입 (신규)
- [Added]: `category_lead` 노드 타입 감지 — role에 `category`/`cat.`/`카테고리` 또는 name에 `-intel-lead`/`-proc-lead` 포함 시
- [Added]: CAT.LEAD 배지 (orange `#f97316`, font-size 9, font-weight 700)
- [Changed]: strokeColor에 `isCatLead ? '#f97316'` 추가, strokeWidth 2.5
- [Changed]: DA 감지에 한국어(`반론`) + name 패턴(`devil`/`advocate`) 추가 — star/step/Phase1.5 모두 동기화

#### 계층 그래프 엣지 빌딩
- [Changed]: star topology에서 categoryLeads 존재 시 계층 구조 빌딩
  - Lead → Category Leads (직접 연결)
  - Category Leads → Workers (hierarchy 테이블 매칭 또는 name 패턴 fallback)
  - Lead → DA (hierarchy 테이블의 Lead 엔트리에서 비-CatLead children으로)
- [Changed]: categoryLeads 없으면 기존 flat star 유지 (하위 호환)
- [Added]: `plan.hierarchy` 데이터 사용 — parent/children 매칭으로 정확한 계층 구성

#### Hierarchy 테이블 파싱 (team-os-parser.js)
- [Added]: parseTeamPlan()에 `## Hierarchy` 섹션 파싱
  - `| parent | children |` 테이블 → `{ parent, children }[]` 배열
  - plan 객체에 `hierarchy` 필드 추가

### 영향 범위
- 영향받는 기능: Agent Flow 그래프 (Mission Control), KM Workflow API
- 기존 기능: flat star topology 팀 — 변경 없음 (categoryLeads.length === 0 시 기존 로직)
- 테스트: node -c 구문 검증 통과, hierarchy 파싱 테스트 통과, graph 빌드 테스트 통과

---

## [2026-02-17] - v3.3 (Live Team Inbox Bridging)

### 수정 파일
- `lib/team-os-parser.js` — `getActiveTeamLiveStatus()` 함수 추가, exports 업데이트
- `server.js` — 라이브 팀 상태 import, chokidar 워치 경로 추가, KM workflow 머지 로직

### 변경 내용

#### Live Team Inbox Bridging (신규 기능)
- [Added]: `getActiveTeamLiveStatus()` — `~/.claude/teams/` 디렉토리에서 실시간 팀 상태 읽기
  - 가장 최근 수정된 팀 디렉토리의 `config.json` 파싱
  - `inboxes/` 폴더의 JSON 메시지 파일 읽기
  - 팀 멤버별 상태 (active/completed/pending) 자동 판별
  - 메시지 내용에서 `completed`, `ship`, `done` 키워드로 완료 감지
- [Added]: chokidar 워치에 `~/.claude/teams/` 경로 추가 → 팀 상태 변경 시 SSE 브로드캐스트
- [Added]: `/api/km-workflow` 응답에 라이브 팀 상태 자동 머지
  - `progress.agents`가 비어있으면 라이브 멤버로 대체
  - `liveTeam` 메타데이터 (이름, 총 메시지 수, 마지막 활동 시각) 추가
- [Added]: `getFullStatus()` (`/api/status`)에도 동일한 라이브 상태 머지 적용
- [Added]: 파일 워처 이벤트 분류에 `.claude/teams` 경로 → `team_os` 타입 매핑

### 영향 범위
- 영향받는 기능: Mission Control (Live Agents), KM Workflow API, Full Status API
- 기존 기능 변경 없음 — 라이브 팀이 없으면 null 반환으로 기존 동작 유지

### 테스트 결과
- node -c 구문 검사: team-os-parser.js, server.js 모두 통과

---

## [2026-02-16] - v3.2 (Live Agents Fallback + Pixel Scale-Up + Launch Shortcut)

### 수정 파일
- `public/app.js` — renderLiveAgents() plan.team fallback 추가, v3.2
- `public/pixel-office.js` — 캔버스/캐릭터/폰트 전면 확대, plan.team fallback, v1.1
- `public/index.html` — 캔버스 1000x600, 버전 v3.2
- `launch.bat` (NEW) — 원클릭 서버+브라우저 실행 배치파일
- `C:\Users\treyl\OneDrive\Desktop\Agent-Office.bat` (NEW) — 바탕화면 바로가기

### 변경 내용

#### Live Agents Fallback (핵심 버그 수정)
- [Fixed]: TEAM_PROGRESS.md Status Board가 비어있을 때 Live Agents가 표시되지 않던 문제
- [Added]: `renderLiveAgents()` — progress.agents 비어있으면 plan.team + bulletin.entries로 에이전트 생성
- [Added]: bulletin 매칭 로직 — @prefix 제거 + case-insensitive includes
- [Added]: 동일 fallback을 pixel-office.js `updateAgents()`에도 적용

#### Pixel Office Scale-Up (v1.1)
- [Changed]: 캔버스 200x125 → 250x150 (논리), 800x500 → 1000x600 (실제)
- [Changed]: 캐릭터 4x7 → ~6x10 (머리+턱+입 힌트 + 몸통 + 다리)
- [Changed]: 책상 18 → 24 wide, 모니터 6x4 → 8x5, 의자 확대
- [Changed]: 폰트 — 이름 2.2→3.0, 태스크 1.8→2.5, 점 2.0→2.8, 제목 3→3.5
- [Changed]: 진행바 14x1 → 20x2, 작업 로그 모니터 75x28 → 85x32
- [Changed]: 배치 — deskSpacingX 8→10, startY 42→52, rowSpacing 30→38
- [Changed]: 벽 높이 35→42, 장식물 좌표 전면 재조정

#### Launch Shortcut
- [Added]: `launch.bat` — `start http://localhost:3747` + `node server.js` 원클릭 실행
- [Added]: 바탕화면 `Agent-Office.bat` — 절대경로 버전

### 테스트 결과
- node -c 구문 검사: app.js, pixel-office.js, server.js 모두 통과
- API 확인: plan.team 8명, bulletin 3건 정상 반환
- 서버 실행: localhost:3747 정상 응답

---

## [2026-02-15] - v3.1 (Pixel Office Mode)

### 수정 파일
- `public/pixel-office.js` (NEW) — 스타듀밸리 스타일 픽셀 아트 오피스 뷰
- `public/index.html` — Pixel Office 모드 토글 + canvas 추가
- `public/app.js` — 모드 전환 로직 (Dashboard ↔ Pixel Office)
- `public/style.css` — Pixel Office 컨테이너/컨트롤 스타일

### 변경 내용
- [Added]: Pixel Office 모드 — 캔버스 기반 픽셀 아트 에이전트 시각화
- [Added]: 4가지 시간대 (Morning/Afternoon/Evening/Night) 배경 전환
- [Added]: 에이전트별 책상 배치, 상태 말풍선, 진행바
- [Added]: 장식 요소 (식물, 시계, 화이트보드, 커피, 별)
- [Added]: 작업 로그 모니터 (bulletin 최근 항목 표시)
- [Added]: 에이전트 클릭 시 상세 정보 팝업

---

## [2026-02-15] - v3.0 (Agent Flow Graph + Agent Icons)

### 수정 파일
- `public/app.js` — n8n 스타일 노드 그래프 렌더링, 에이전트 아이콘, 타일 확대
- `public/index.html` — Agent Flow SVG 섹션 추가
- `public/style.css` — 노드 그래프 스타일, 타일 크기 확대

### 변경 내용
- [Added]: Agent Flow — SVG 기반 n8n 스타일 노드 그래프 (에이전트 간 의존성 시각화)
- [Added]: 에이전트 아이콘 — 역할 키워드 기반 자동 매칭 (연구=돋보기, 검증=방패 등)
- [Changed]: 에이전트 타일 크기 확대 (더 큰 아이콘, 넓은 정보 영역)
- [Added]: 노드 클릭 시 에이전트 상세 정보 표시

---

## [2026-02-14] - v2.0 (Mission Control + Team OS Auto-Install)

### 수정 파일
- `server.js` — POST /api/team-os/bootstrap 엔드포인트 추가, JSON body parser 추가
- `lib/team-os-parser.js` — 전체 재작성: 구조화된 Markdown 파싱 추가
- `lib/team-os-bootstrap.js` (NEW) — Team OS 자동 스캐폴딩 스크립트
- `public/index.html` — Mission Control 뷰 추가, 레이아웃 재구성
- `public/app.js` — Mission Control 렌더링 (에이전트 타일, 체크포인트, 게시판)
- `public/style.css` — Mission Control 스타일 추가

### 변경 내용

#### Part 1: 대시보드 자동 시작
- [Added]: `/knowledge-manager`, `/teamify` 실행 시 대시보드 자동 시작 로직
  - curl로 포트 3747 확인 → 미실행 시 `node server.js --open` 백그라운드 시작
  - npm install 미완료 시 자동 설치 후 재시작

#### Part 2: Mission Control (실시간 에이전트 모니터링)
- [Added]: `team-os-parser.js` — 5개 Markdown 아티팩트 구조화 파싱
  - `parseTeamProgress()` — Status Board 테이블 → agents[], checkpoints[], blockers[]
  - `parseTeamBulletin()` — 타임스탬프 엔트리 → entries[] (최신순)
  - `parseTeamPlan()` — subject, complexity, team[], steps[]
  - `parseTeamFindings()` — crossValidation[], coreNotes[], insights[]
  - `parseMemory()` — sessions[]
  - `parseMarkdownTable()` — 범용 Markdown 테이블 파서
- [Added]: Mission Control UI (index.html 상단 영역)
  - Live Agents: 각 에이전트 타일 (이름, 태스크, 진행률 바, 상태)
  - Checkpoints: 파이프라인 진행 바 (V/~/O 아이콘, 화살표 연결)
  - Bulletin: 실시간 발견사항 피드 (최신 위, 스크롤)
- [Added]: 에이전트 타일 상태 (active=cyan glow, completed=green, idle=gray)
- [Added]: 체크포인트 pulse 애니메이션 (in-progress 상태)
- [Added]: SSE team_os_updated 이벤트 시 Mission Control 하이라이트
- [Added]: `escHtml()` XSS 방지 유틸리티

#### Part 3: Team OS 자동 설치
- [Added]: `lib/team-os-bootstrap.js` — .team-os/ 전체 디렉토리 스캐폴딩
  - 10개 디렉토리, 14개 파일, 4개 .gitkeep 생성
  - 내장 템플릿: registry.yaml, 5 spawn-prompts, 5 artifacts, 2 hooks, 1 consensus
  - CLI 진입점: `node agent-office/lib/team-os-bootstrap.js`
  - 리포트 반환: { created[], skipped[], errors[] }
- [Added]: `POST /api/team-os/bootstrap` 엔드포인트
  - 스캐폴딩 실행 + SSE 브로드캐스트 (team_os_updated)
  - `/knowledge-manager` 환경 감지에서 자동 호출 가능

### 테스트 결과
- /api/status: OK (Agents 7, Skills 69, Commands 11, MCP 5, TeamOS active)
- /api/km-workflow: OK (checkpoints 4, parsed structure)
- bootstrap module: OK (function exported correctly)

---

## [2026-02-13] - v1.0 (초기 릴리즈)

### 생성 파일
- `server.js` — Express 서버 (포트 3747), SSE, chokidar 파일 와칭
- `config.js` — 크로스 플랫폼 경로 설정 (Windows + WSL)
- `lib/scanner.js` — .claude/ 디렉토리 스캐너 (agents, skills, commands)
- `lib/team-os-parser.js` — Team OS 상태 파서 (v1)
- `lib/settings-parser.js` — MCP, hooks, permissions, plugins 파서
- `public/index.html` — 대시보드 HTML (9-카드 그리드)
- `public/app.js` — 프론트엔드 렌더링 (인벤토리 카드)
- `public/style.css` — 다크 테마 스타일 (60-30-10 컬러 규칙)
- `package.json` — 의존성 (express, chokidar, js-yaml)

### 기능
- 정적 인벤토리 대시보드 (Agents, Skills, Commands, MCP, Hooks, Permissions, Plugins, Team OS)
- SSE 실시간 파일 변경 감지
- 9-카드 BentoGrid 레이아웃

---
