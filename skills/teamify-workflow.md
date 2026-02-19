---
name: teamify-workflow
description: 워크플로우 분석 + 리소스 동적 탐색 + Agent Teams 분해 로직. /teamify 커맨드의 핵심 엔진.
---

# Teamify Workflow Engine

> `/teamify` 커맨드의 핵심 분석 엔진.
> 리소스 탐색 → 워크플로우 분석 → 에이전트 유닛 분해 → 팀 구성안 생성.

---

## 1. 리소스 동적 탐색 알고리즘

**팀 구성 전 반드시 현재 환경의 모든 사용 가능한 리소스를 스캔합니다.**

### Phase A: 로컬 리소스 스캔

```
1. Skills 스캔
   Glob(".claude/skills/*.md")
   → 각 파일의 첫 10줄 Read → frontmatter(name, description) 추출
   → 카테고리 자동 분류 (파일명 접두사 기반: km-*, ce-*, gpt-* 등)

2. Agents 스캔
   Glob(".claude/agents/*.md")
   → frontmatter(name, model, allowedTools) 추출

3. Commands 스캔
   Glob(".claude/commands/*.md")
   → frontmatter(description, allowedTools) 추출
   → allowedTools에 TeamCreate 포함 여부 → "Agent Teams 지원" 표시
```

### Phase B: MCP 서버 스캔

```
1. Read(".mcp.json") → 프로젝트 MCP 서버 목록 + 전송 유형(stdio/sse)
2. 각 서버별 ToolSearch("{서버명}") → 사용 가능 도구 목록
3. 도구 수 + 카테고리 정리:
   | 카테고리 | 서버 | 도구 예시 |
   |---------|------|----------|
   | vault   | obsidian | create_note, search_vault, read_note |
   | browser | playwright | browser_navigate, browser_click, browser_snapshot |
   | web     | hyperbrowser | scrape_webpage, crawl_webpages |
   | docs    | notion | API-post-search, API-post-page |
   | diagram | drawio | create_new_diagram, edit_diagram |
   | memory  | claude-mem | search, get_observations |
   | design  | stitch | create_project, generate_screen_from_text |
   | ai-notebook | notebooklm | add_notebook, ask_question |
```

### Phase C: CLI 도구 최신성 확인

```
플랫폼 감지: Bash("echo %OS%") 또는 Bash("uname -s")
  - Windows → where 명령어 사용
  - macOS/Linux → which 명령어 사용

CLI 도구 확인 목록:
  | 도구 | 확인 명령어 (Win) | 확인 명령어 (Mac/Linux) | 용도 |
  |------|-----------------|---------------------|------|
  | playwright | where playwright / npx playwright --version | which playwright / npx playwright --version | 브라우저 자동화 |
  | marker_single | where marker_single | which marker_single | PDF→MD 변환 |
  | node | node --version | node --version | 런타임 |
  | python | python --version | python3 --version | 런타임 |
  | tmux | - | which tmux | Split Pane |
  | gh | where gh | which gh | GitHub CLI |
```

### Phase D: MCP vs CLI 최적 경로 결정 매트릭스

```
각 기능에 대해 최적 도구 경로를 결정합니다.

결정 규칙:
1. CLI가 존재하고 MCP보다 토큰 효율적이면 → CLI 우선
2. MCP만 존재하면 → MCP 사용
3. 둘 다 존재하고 MCP가 도구 통합에 유리하면 → MCP 우선

| 기능 | MCP 서버 | CLI 대안 | 기본 우선순위 | 이유 |
|------|---------|---------|-------------|------|
| 브라우저 자동화 | playwright MCP | npx playwright CLI | **CLI 우선** | 10-100x 토큰 절약 |
| Obsidian vault | obsidian MCP | obsidian-cli | **MCP 우선** | vault 통합, 도구 풍부 |
| PDF 변환 | - | marker_single CLI | **CLI 유일** | 대용량 처리 |
| 웹 크롤링 | hyperbrowser MCP | - | **MCP 유일** | CLI 대안 없음 |
| 다이어그램 | drawio MCP | - | **MCP 유일** | CLI 대안 없음 |
| Notion | notion MCP | - | **MCP 유일** | API 전용 |
| AI 노트북 | notebooklm MCP | - | **MCP 유일** | CLI 대안 없음 |
| 메모리/검색 | claude-mem MCP | - | **MCP 유일** | CLI 대안 없음 |
| 디자인 | stitch MCP | - | **MCP 유일** | CLI 대안 없음 |

최적 경로 결과 저장:
  tool_paths = {
    "browser": { "method": "cli", "command": "npx playwright", "fallback": "playwright MCP" },
    "vault": { "method": "mcp", "server": "obsidian", "fallback": "file system" },
    ...
  }
```

### 리소스 인벤토리 출력 포맷

#### Agent Office 대시보드 통합

```
# 대시보드 실행 확인 (텍스트 인벤토리 전에 수행)
Bash("curl -s http://localhost:3747/api/status 2>/dev/null") → JSON 응답 여부

대시보드 실행 중:
  > **Agent Office**: http://localhost:3747
  > MCP Servers, Skills, Agents 현황을 실시간으로 확인하세요.
  > 아래 텍스트 인벤토리는 보조 참조용입니다.

대시보드 미실행 시:
  → 기존 텍스트 인벤토리 전체 출력 (아래 포맷)
```

#### 텍스트 인벤토리 (대시보드 미실행 시 또는 보조 참조)

```markdown
## 사용 가능한 리소스 인벤토리

### MCP 서버 ({N}개 활성)
| 서버 | 도구 수 | CLI 대안 | 최적 경로 | 상태 |
|------|--------|---------|----------|------|

### Skills ({N}개)
| 카테고리 | 스킬 수 | 주요 스킬 |
|---------|--------|----------|

### Agents ({N}개)
| 에이전트 | 모델 | 핵심 도구 | Agent Teams 지원 |
|---------|------|----------|----------------|

### Commands ({N}개)
| 커맨드 | Agent Teams 사용 | 설명 |
|--------|----------------|------|

### CLI 도구 ({N}개 감지)
| 도구 | 버전 | 용도 |
|------|------|------|

### 외부 리소스
- MCP Registry: https://registry.modelcontextprotocol.io/
- Skills 생태계: https://skills.sh
- Awesome MCP: https://mcpservers.org/
```

---

## 2. 워크플로우 분석 알고리즘

**대상 파일(스킬/에이전트/커맨드)을 읽어 구조를 분석하고 에이전트 유닛으로 분해합니다.**

### Step 2-1: 파일 읽기 + 구조 추출

```
Read(대상 파일) → 전문 읽기

추출 대상:
  A. frontmatter → name, description, allowedTools, model
  B. H2/H3 헤더 → Phase/Step 단위 (각각이 에이전트 유닛 후보)
  C. 도구 참조 패턴:
     - "mcp__서버명__도구명" → MCP 도구 의존성
     - "Bash(", "Read(", "Write(", "Glob(", "Grep(" → 내장 도구
     - "Task(" → 서브에이전트 패턴
     - "TeamCreate(", "SendMessage(" → Agent Teams 패턴
     - "AskUserQuestion(" → 사용자 인터랙션 포인트
  D. 입출력 패턴:
     - "inputs:", "입력:" → 입력 데이터
     - "outputs:", "출력:", "산출물:" → 출력 데이터
     - "→", "handoff:", "전달:" → 데이터 흐름
  E. 의존성 패턴:
     - "blockedBy", "이후", "완료 후" → 순차 의존
     - "병렬", "동시에", "parallel" → 병렬 가능
```

### Step 2-2: Phase 의존성 그래프 구축

```
각 Phase/Step을 노드로, 데이터 흐름을 엣지로:

예시 (knowledge-manager.md):
  STEP 0 (환경확인) → STEP 1 (선호수집) → STEP 2 (복잡도판정)
                                              ↓
  STEP 3 (팀구성) → STEP 4 (결과수집) → STEP 5 (노트생성) → STEP 6 (연결강화)
      ↓ 병렬
  [graph-navigator] [retrieval-specialist] [deep-reader]

병렬화 판정 기준:
  - 서로 다른 입력을 사용 → 병렬 가능
  - 같은 파일/리소스 수정 → 순차 필수
  - 독립적인 검색/분석 → 병렬 가능
  - 결과 통합 필요 → 이전 작업 완료 후
```

### Step 2-3: 리소스 매칭

```
워크플로우 필요 도구 ↔ Phase D 인벤토리 매칭:

1. 필요 도구 목록 추출 (Step 2-1의 C)
2. 각 도구에 대해 인벤토리에서 사용 가능 여부 확인
3. 최적 경로 할당 (Phase D 매트릭스 참조)
4. 부족한 리소스 식별 → 설치 제안

출력:
| 필요 도구 | 인벤토리 매칭 | 최적 경로 | 부족 여부 |
|----------|-------------|----------|----------|
```

---

## 3. 에이전트 유닛 분해 규칙

### 분해 기준

| 기준 | 판정 | 결과 |
|------|------|------|
| Phase가 독립적인 입출력을 가짐 | O | 독립 에이전트 유닛 |
| Phase가 읽기만 수행 | O | Explore subagent_type |
| Phase가 쓰기(Write/Edit/MCP write) 수행 | O | general-purpose, 리드/Main 전용 |
| Phase가 사용자 인터랙션 포함 (AskUserQuestion) | O | Main 전용 (위임 불가) |
| Phase가 외부 API/MCP 호출 포함 | O | 해당 MCP 접근 필요 |
| Phase가 다른 Phase 결과에 의존 | O | 순차 실행 (blockedBy) |

### subagent_type 결정

```
IF 유닛이 읽기 전용 (검색, 분석, 탐색):
  subagent_type = "Explore"
  tools = [Read, Glob, Grep] (+ ToolSearch for MCP read tools)

ELIF 유닛이 쓰기 필요:
  subagent_type = "general-purpose"
  tools = [Read, Write, Edit, Bash, Glob, Grep] + 필요 MCP 도구

ELIF 유닛이 계획/설계:
  subagent_type = "Plan"
  tools = [Read, Glob, Grep] (읽기 전용)
```

### 모델 할당 (routing_policy)

```
outline.md defaults.routing_policy 기반:

| 작업 유형 | 모델 | 이유 |
|----------|------|------|
| 아키텍처, 통합, 고위험 리팩토링, 합의 | opus | 복잡한 판단 |
| 구현 계획, 리팩토링 단계, 테스트, 스크립트 | sonnet | 균형 |
| 라벨링, 분류, 트리아지, 소규모 변환 | haiku | 비용 효율 |

역할별 기본 모델:
| 역할 | 기본 모델 | Task 파라미터 | 비고 |
|------|---------|-------------|------|
| 최종 리드 (Lead) | opus 1M | (CC 시작 시 자동) | 항상 고정 |
| 카테고리 리드 (Category Lead) | sonnet 4.6 | model: "sonnet" | 비용 최적화 |
| 카테고리 리드 (1M) | sonnet 1M | model: "sonnet[1m]" | 대규모 컨텍스트 필요 시 (v2.1.45+) |
| 워커 (읽기 전용) | haiku | model: "haiku" | 검색/분류 |
| 워커 (구현) | sonnet 4.6 | model: "sonnet" | 코드/분석 |
| 워커 (1M 분석) | sonnet 1M | model: "sonnet[1m]" | 대규모 파일 분석 시 |
| 워커 (고위험) | opus | model: "opus" | 드물게 사용 |
```

---

## 4. 카테고리 매핑 테이블

**워크플로우의 키워드/패턴에 따라 카테고리를 자동 분류합니다.**

| 키워드/패턴 | 카테고리 | team_id 접두사 | 대표 팀 예시 |
|------------|---------|---------------|------------|
| crawl, scrape, extract, fetch, url, web, pdf, social | **Ingest** | `km.ingest.*` | km.ingest.web.standard |
| analyze, summarize, tag, classify, zettelkasten, atomize | **Analyze** | `km.analyze.*` | km.analyze.zettelkasten |
| graph, link, wikilink, index, pagerank, expand, rank | **Graph** | `km.graph.*` | km.graph.build-index |
| save, export, obsidian, notion, local, store, vault | **Storage** | `km.store.*` | km.store.obsidian |
| dashboard, monitor, event, log, collect, sse, websocket | **Ops** | `ops.dashboard.*` | ops.dashboard.collector |
| test, verify, lint, quality, hook, gate, ownership | **QA** | `qa.*` | qa.hooks.quality-gates |
| design, layout, component, UI, frontend, react, css | **Frontend** | `frontend.*` | frontend.dashboard.ui |
| prompt, generate, template, teamify, clone, catalog | **Foundation** | `wf.teamify.*` | wf.teamify.classify-and-catalog |

### 카테고리 매칭 알고리즘

```
1. 대상 파일의 모든 텍스트에서 키워드 빈도 계산
2. 각 카테고리별 키워드 매칭 점수 합산
3. 최고 점수 카테고리 = 주 카테고리
4. 2개 이상 카테고리 점수가 높으면 → 다중 카테고리 (교차 팀)
5. 매칭 없으면 → "custom" 카테고리로 분류
```

---

## 5. 팀 구성안 생성

### 출력 포맷

```markdown
## 워크플로우 분석 결과: {스킬명}

### 리소스 매칭
| 필요 도구 | 사용 가능 | 최적 경로 | 비고 |
|----------|----------|----------|------|

### 식별된 에이전트 유닛 ({N}개)
| # | 유닛명 | 카테고리 | 모델 | subagent_type | 필요 도구 | 병렬 | 쓰기 |
|---|--------|---------|------|---------------|----------|------|------|

### 제안 팀 구성
| 역할 | 에이전트명 | 모델 | subagent_type | 담당 유닛 | 도구 |
|------|----------|------|---------------|----------|------|
| Lead | lead | opus | general-purpose | 전체 조율 | 전체 |
| Cat. Lead | lead-{category} | sonnet | general-purpose | 카테고리 조율 | 도메인 도구 |
| Worker | {name} | sonnet/haiku | general-purpose/Explore | {유닛} | {도구} |

### 데이터 흐름
{유닛 간 입출력 의존성 다이어그램}

### 환경 요구사항
| 항목 | 상태 |
|------|------|
| Split Pane (tmux) | ✅/❌ |
| 필수 MCP | {목록} |
| 필수 CLI | {목록} |
| 선택 도구 | {목록} |
```

---

## 5.5 /prompt 파이프라인 통합

> STEP 3 워크플로우 분석 결과가 STEP 5의 /prompt 내재화 파이프라인에 입력됩니다.
> 파이프라인 상세: `teamify-spawn-templates.md` 섹션 7.5 (매핑) + 7.6 (서브스텝) 참조.

### 데이터 흐름: 워크플로우 분석 → 프롬프트 파이프라인

| STEP 3 출력 | 파이프라인 입력 | 사용처 (서브스텝) |
|------------|--------------|-----------------|
| role.name + role.description | Step 5-1 Purpose Detection | purpose_category 결정 |
| role.tasks + team.purpose | Step 5-2 Expert Priming | domain/expert 매핑 (resolve_expert) |
| role.tasks | Step 5-3 Task Expansion | expanded_task_details 생성 |
| role.subagent_type | Step 5-5 Claude Optimization | default_to_action vs investigate 결정 |
| 전체 팀 roles[] | Step 5-6 Quick Review | 역할 충돌/중복 검증 |

### 카테고리 ↔ 도메인 교차 참조

워크플로우 분석의 카테고리(섹션 4)와 /prompt 목적, expert-domain-priming.md 도메인을 교차 매핑합니다.

| teamify 카테고리 (섹션 4) | /prompt 목적 | expert 도메인 |
|-------------------------|-------------|--------------|
| Ingest (crawl, scrape, extract) | 에이전트/자동화 | 4.1 Tech/AI |
| Analyze (analyze, summarize, tag) | 분석/리서치 | 4.5 Data/Analytics |
| Graph (graph, link, wikilink) | 에이전트/자동화 | 4.1 Tech + 4.12 Cognitive |
| Storage (save, export, obsidian) | 에이전트/자동화 | 4.1 Tech/AI |
| Ops (dashboard, monitor) | 에이전트/자동화 | 4.1 Tech/AI |
| QA (test, verify, quality) | 분석/리서치 | 4.1 Tech/AI |
| Frontend (design, component, UI) | 코딩/개발 | 4.4 UX/Design |
| Foundation (prompt, template) | 에이전트/자동화 | 4.2 Business/Strategy |

### 파이프라인 적용 예시

```
워크플로우 분석 결과:
  role: { name: "web_scraper", description: "웹 페이지 크롤링 및 데이터 추출", tasks: "URL 목록에서 콘텐츠 수집" }
  category: Ingest

파이프라인 실행:
  5-1: keywords=[scraper, web, 크롤링, 추출, 수집] → purpose=에이전트/자동화
  5-2: "scraper, web" → 4.1 Tech/AI → Martin Fowler (Microservices, Event Sourcing)
  5-3: 에이전트/자동화 확장 → "URL 순회, HTML→MD 변환, 에러 3회 재시도, JSON 출력"
  5-4: CE 체크리스트 적용
  5-5: general-purpose → <default_to_action>
  5-6: 3-Expert Review 자동 반영

최종 <role> 블록:
  당신은 Martin Fowler입니다.
  Microservices와 Event Sourcing에 입각하여 km.ingest.web.standard 팀의 워커 web_scraper으로서 작업합니다.
```

---

## 6. 팀 공유 메모리 설계

> 3계층 하이브리드 메모리 아키텍처 (Markdown + SQLite WAL + MCP Memory)

### 3계층 하이브리드 메모리 아키텍처

```
┌─────────────────────────────────────────────────────┐
│           Agent Teams 공유 메모리 아키텍처            │
│                                                      │
│  Layer 1: Markdown 파일 (항상 사용)                  │
│    team_plan.md, team_bulletin.md, team_findings.md  │
│    → 사람이 읽을 수 있음, 버전 관리, 폴백            │
│                                                      │
│  Layer 2: SQLite WAL (팀 5명 이상일 때)              │
│    memory.db (PRAGMA journal_mode=WAL 필수!)         │
│    → 구조화 쿼리, 빠른 로컬 접근                     │
│                                                      │
│  Layer 3: MCP Memory Server (장기/엔터프라이즈)       │
│    @modelcontextprotocol/server-memory (기본)        │
│    또는 Zep (시맨틱+시간) / mem0 (시맨틱)            │
│    → 시맨틱 검색, 지식 축적                          │
│                                                      │
│  쿼리 라우팅:                                        │
│    단순 상태 → Markdown (Layer 1)                    │
│    구조화 쿼리 → SQLite (Layer 2)                    │
│    시맨틱/시간 → MCP Memory (Layer 3)                │
└─────────────────────────────────────────────────────┘
```

### Layer 1: 공유 Markdown 파일 (기본 - 항상 사용)

```
팀 생성 시 자동 초기화되는 파일:

{team_artifacts_dir}/
├── team_plan.md        - 마스터 플랜, 단계 할당, 변경 이력
├── team_bulletin.md    - 발견/공지 게시판 (append-only)
├── team_findings.md    - 작업 결과 요약 (각 에이전트별)
└── team_progress.md    - 태스크 상태 체크리스트

저장 위치 결정:
  IF .team-os/ 존재:
    artifacts_dir = ".team-os/artifacts/"
  ELSE:
    artifacts_dir = 프로젝트 루트의 임시 디렉토리
```

**에이전트 메모리 프로토콜**:
```
작업 시작 전:
  1. Read team_plan.md → 할당 확인
  2. Read team_bulletin.md → 최근 발견사항 확인

작업 중:
  3. team_bulletin.md에 발견사항 Append (충돌 불가: append-only)
  4. team_progress.md 상태 업데이트

작업 완료 후:
  5. team_findings.md에 결과 요약
  6. 계획 변경 필요 시 리드에게 SendMessage
```

**Bulletin 형식**:
```markdown
## [Timestamp] - [Agent Name]
**Task**: [작업 내용]
**Findings**: [발견사항]
**Links**: [관련 태스크/파일]
```

### Layer 2: SQLite WAL (팀 5명+ 선택적)

```sql
-- CRITICAL: WAL 모드 활성화 (Bug #14124 대응)
PRAGMA journal_mode=WAL;

CREATE TABLE shared_state (
  key TEXT PRIMARY KEY,
  value TEXT,
  agent_id TEXT,
  timestamp INTEGER,
  ttl INTEGER
);

CREATE TABLE decisions (
  id INTEGER PRIMARY KEY,
  decision TEXT,
  status TEXT,        -- proposed | approved | rejected
  proposer TEXT,
  votes TEXT,         -- JSON: {"agent-a": "yes"}
  timestamp INTEGER
);

CREATE TABLE discoveries (
  id INTEGER PRIMARY KEY,
  agent_id TEXT,
  content TEXT,
  tags TEXT,           -- JSON array
  timestamp INTEGER
);
```

### Layer 3: MCP Memory Server (선택적)

```
사용 가능한 MCP Memory 서버:

| 서버 | 유형 | 멀티에이전트 | 설치 |
|------|------|-----------|------|
| @modelcontextprotocol/server-memory | Knowledge Graph | 파일 공유 | npx -y @modelcontextprotocol/server-memory |
| mem0-mcp | Vector+Cloud | API 기반 | pip install mem0-mcp-server |
| Zep | Temporal Graph | 세션 범위 | npx -y @zep-ai/zep-mcp-server |

ToolSearch로 설치된 Memory MCP 자동 감지:
  ToolSearch("memory") → 사용 가능한 메모리 도구 확인
```

### 메모리 계층 자동 결정

```
팀 규모 + 사용자 선호에 따라 메모리 계층 자동 결정:

IF team_size <= 3:
  memory_layers = [Layer1_Markdown]
ELIF team_size <= 8:
  memory_layers = [Layer1_Markdown, Layer2_SQLite]
ELSE:
  memory_layers = [Layer1_Markdown, Layer2_SQLite, Layer3_MCP]

IF 사용자가 "장기 프로젝트" 또는 "시맨틱 검색" 요청:
  memory_layers.add(Layer3_MCP)

IF ToolSearch("memory") 결과에 Memory MCP 존재:
  memory_layers.add(Layer3_MCP)  # 이미 설치됨 → 활용
```

---

## 7. 플랫폼별 Split Pane 지원

### 환경 검증 로직

```
1. 플랫폼 감지:
   - Bash("echo %OS%") → "Windows_NT" → Windows
   - 그 외 → macOS/Linux

2. 플랫폼별 tmux 확인:
   - Windows: WSL2 내부에서 tmux 확인
   - macOS: which tmux → 없으면 "brew install tmux" 안내
   - Linux: which tmux → 없으면 패키지 매니저 안내

3. 터미널 환경 확인:
   - TMUX 환경변수 존재 → 이미 tmux 세션 안
   - TERM_PROGRAM = "iTerm.app" → iTerm2 (macOS)
   - TERM_PROGRAM = "vscode" → VS Code (Split Pane 미지원)

4. 최적 모드 결정:
   | 환경 | teammateMode | 안내 |
   |------|-------------|------|
   | tmux 세션 안 | "tmux" | 최적. 바로 진행 |
   | macOS + tmux 설치됨 | "tmux" | `tmux new -s claude` 후 실행 안내 |
   | macOS + iTerm2 | "tmux" | `tmux -CC` 가능하나 불안정 경고 |
   | Windows WSL2 + tmux | "tmux" | 최적. 바로 진행 |
   | VS Code 터미널 | "auto" | Split Pane 미지원, in-process 폴백 |
   | tmux 미설치 | "auto" | in-process 모드 + 설치 안내 |
```

### 알려진 안정성 이슈 (2026-02 기준)

```
Agent Teams tmux 모드 알려진 버그:

미해결:
- #23615: 팀원이 새 창 대신 분할 패널에 스폰 (레이아웃 깨짐)
- #24108: 팀원이 idle 프롬프트에 멈춤 (메일박스 폴링 안됨)
- #24771: 분할 패널은 열리나 팀원이 메시징 시스템에서 분리
- #24292: teammateMode "tmux"가 iTerm2 분할을 생성하지 않음

v2.1.45에서 해결됨:
- Task tool 백그라운드 에이전트 ReferenceError 크래시 수정
- Skills compaction 누수 수정 (서브에이전트 스킬 → 부모 컨텍스트 잔류 문제)
- 참고: "거짓 완료 보고" 버그(Bug-2025-12-12-2056)는 별개 이슈, 미해결

대응:
- teammateMode: "auto" 사용 + 기존 tmux 세션 안에서 실행이 가장 안정적
- 문제 발생 시 in-process 모드로 폴백
- 대시보드(ops.dashboard.*) 팀은 Split Pane 불필요 → "auto" 모드 사용
```

---

## 8. Ralph 루프 적용 기준

> Ralph Loop: 에이전트 출력(에러 포함)을 다시 입력으로 넣어 만족할 때까지 반복.
> 이름 유래: Ralph Wiggum (심슨가족). 창시자: Geoffrey Huntley.
> Ralph Loop: 에이전트 출력을 만족할 때까지 반복하는 패턴.

### 적용 판단 매트릭스

```
워크플로우 분석 시 Ralph 루프 적용 여부를 판단합니다:

| 워크플로우 특성 | Ralph 루프 | 이유 |
|---------------|-----------|------|
| 품질 민감 (논문, 코드, 프로덕션) | ✅ 강력 권장 | 반복 리뷰로 품질 보장 |
| 대량 처리 (크롤링, 변환, 배치) | ❌ 비권장 | 처리량 > 품질. 속도 우선 |
| 창의적 작업 (글쓰기, 디자인) | ⚙️ 선택적 | 사용자 취향 의존 |
| 분석/리서치 | ✅ 권장 | 검증 중요. 정확도 향상 |
| 단순 CRUD | ❌ 비권장 | 오버헤드 대비 이점 없음 |
| 아키텍처/설계 | ✅ 강력 권장 | 설계 리뷰 사이클 필수 |
```

### Ralph 루프 설정값

```
| 항목 | 기본값 | 범위 | 설명 |
|------|--------|------|------|
| enabled | false | true/false | AskUserQuestion으로 사용자에게 토글 |
| max_iterations | 5 | 1-10 | 최대 반복 횟수. "지갑 보호" |
| review_criteria | completeness, accuracy | 사용자 정의 | 리드의 SHIP/REVISE 판정 기준 |
| exit_on | "SHIP" | SHIP/all_done/max | 종료 트리거 |
```

### Ralph 루프 정량 리뷰 기준

```yaml
ralph_loop:
  review_criteria:
    completeness:
      weight: 1.5
      metric: "할당 항목 중 누락 비율 (0% = 5점)"
    accuracy:
      weight: 1.0
      metric: "인용당 소스 파일 존재 비율 (100% = 5점)"
    coverage:
      weight: 1.0
      metric: "항목당 평균 분석 길이 (200자+ = 5점)"
    format:
      weight: 0.5
      metric: "출력 포맷 준수율 (100% = 5점)"
```

### Agent Teams에서의 Ralph 루프 흐름

```
┌──────────────────────────────────────────────────┐
│ Lead (루프 컨트롤러 - SHIP/REVISE 판정)            │
│                                                    │
│  1. Worker에게 태스크 할당 (SendMessage)            │
│  2. Worker 결과 수신 대기                          │
│  3. 결과 리뷰 (review_criteria 기준):              │
│     ├─ SHIP → TaskUpdate(completed) → 다음 태스크  │
│     └─ REVISE → 피드백 + SendMessage → Worker     │
│  4. iteration_count >= max → 강제 SHIP (경고)      │
│  5. 각 반복을 team_bulletin.md에 기록              │
└──────────────────────────────────────────────────┘
         ↕ SendMessage
┌──────────────────────────────────────────────────┐
│ Worker (태스크 실행자)                              │
│                                                    │
│  1. 태스크 수행 → 결과 SendMessage로 보고          │
│  2. REVISE 피드백 수신 시:                         │
│     a. 피드백 정독                                 │
│     b. team_bulletin.md에 이전 시도 기록           │
│     c. 피드백 반영하여 재작업                       │
│     d. 수정 결과 SendMessage로 재보고              │
└──────────────────────────────────────────────────┘
```

### 종료 조건

```
| 조건 | 메커니즘 | 우선순위 |
|------|---------|---------|
| SHIP 판정 | Lead가 결과 승인 | 1 (정상 종료) |
| 전체 태스크 완료 | TaskList 전부 completed | 2 |
| 반복 제한 도달 | iteration >= max_iterations | 3 (안전장치) |
| 블로킹 이슈 | Worker가 해결 불가 보고 | 4 (에스컬레이션) |
| 사용자 중단 | Ctrl+C | 5 (즉시 종료) |
```

### team_bulletin.md Ralph 기록 형식

```markdown
## [Timestamp] - Ralph Loop #{iteration}
**Worker**: {worker_name}
**Task**: {태스크}
**Verdict**: SHIP / REVISE
**Feedback**: {피드백 내용} (REVISE일 때)
**Changes**: {수정 사항 요약} (재작업 후)
```
