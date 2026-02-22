---
name: tofu-at-registry-schema
description: Team Registry YAML 스키마 정의 + environment 필드 + 검증 규칙 + 예시 3개. /tofu-at가 팀 템플릿을 생성/검증할 때 참조.
---

# Team Registry YAML Schema

> `/tofu-at`가 생성하는 팀 템플릿의 표준 스키마.
> 저장 위치: `.team-os/registry.yaml`

---

## 1. 전체 스키마 구조

```yaml
version: 1

defaults:
  routing_policy:
    opus:
      use_for: ["architecture", "integration", "high-risk refactor", "consensus"]
    sonnet:  # Sonnet 4.6 (v2.1.45+), sonnet[1m]으로 1M 컨텍스트 사용 가능
      use_for: ["implementation planning", "refactor steps", "tests", "scripts", "category coordination"]
    haiku:
      use_for: ["labeling", "classification", "triage", "small transforms"]

  hooks:
    teammate_idle: ".team-os/hooks/teammate_idle_gate.sh"
    task_completed: ".team-os/hooks/task_completed_gate.sh"

  artifacts_root: ".team-os/artifacts"
  bulletin_file: ".team-os/artifacts/TEAM_BULLETIN.md"
  memory_file: ".team-os/artifacts/MEMORY.md"
  consensus_root: ".team-os/consensus"

categories:
  - id: foundation
    lead_teammate: lead_foundation
    lead_model: sonnet
  - id: ingest
    lead_teammate: lead_ingest
    lead_model: sonnet
  - id: analyze
    lead_teammate: lead_pkm
    lead_model: sonnet
  - id: graph
    lead_teammate: lead_graph
    lead_model: sonnet
  - id: storage
    lead_teammate: lead_storage
    lead_model: sonnet
  - id: ops
    lead_teammate: lead_ops
    lead_model: sonnet
  - id: qa
    lead_teammate: lead_qa
    lead_model: sonnet

teams:
  - {팀 템플릿 1}
  - {팀 템플릿 2}
  ...
```

---

## 2. 팀 템플릿 필수 필드 (10개)

| # | 필드 | 타입 | 필수 | 설명 |
|---|------|------|------|------|
| 1 | `team_id` | string | O | 고유 ID. `{category}.{workflow}.{variant}` 형식 |
| 2 | `purpose` | string | O | 팀 목적 (1-2문장) |
| 3 | `environment` | object | O | 실행 환경 요구사항 (신규) |
| 4 | `models` | object | O | 역할별 모델 할당 |
| 5 | `roles` | array | O | 팀원 역할 정의 |
| 6 | `inputs` | array | O | 팀 입력 데이터 |
| 7 | `outputs` | array | O | 팀 산출물 |
| 8 | `quality_gates` | object | O | 품질 게이트 규칙 |
| 9 | `conflict_prevention` | object | O | 충돌 방지 규칙 |
| 10 | `invoke` | object | O | 호출 방법 |

---

## 3. 필드별 상세 스키마

### 3-1. team_id

```yaml
team_id: "{category}.{workflow}.{variant}"
# 예: km.ingest.web.standard, ops.dashboard.collector, wf.tofu-at.classify-and-catalog
```

네이밍 규칙:
- `{category}`: foundation | ingest | analyze | graph | storage | ops | qa | frontend | custom
- `{workflow}`: 워크플로우 이름 (소문자, 하이픈)
- `{variant}`: standard | heavy | simple | custom 등

### 3-2. environment (신규 필드)

```yaml
environment:
  teammate_mode: "tmux"        # "tmux" (Split Pane 강제) | "auto" (자동 감지)
  required_mcp:                # 필수 MCP 서버 목록
    - "obsidian"
    - "playwright"
  required_cli:                # 필수 CLI 도구 목록
    - "node"
  optional_tools:              # 선택적 도구 (있으면 사용, 없으면 대안)
    - "hyperbrowser"
    - "marker_single"
  platform_notes:              # 플랫폼별 참고사항
    windows: "WSL2 + tmux 필수"
    macos: "brew install tmux 권장"
    vscode: "Split Pane 미지원, in-process 폴백"
  shared_memory:               # 팀 공유 메모리 설정 (신규)
    layers:
      - "markdown"             # Layer 1: 항상 사용 (team_plan, bulletin, findings)
      # - "sqlite"             # Layer 2: 팀 5명+ 시 활성화
      # - "mcp_memory"         # Layer 3: 장기/엔터프라이즈 시
    markdown_files:            # Layer 1 파일 목록
      - "team_plan.md"
      - "team_bulletin.md"
      - "team_findings.md"
      - "team_progress.md"
    sqlite_path: "memory.db"   # Layer 2 (선택적)
    mcp_memory_server: ""      # Layer 3 (선택적): "server-memory" | "mem0" | "zep"
  ralph_loop:                  # Ralph Loop (리뷰-피드백-수정 반복)
    enabled: false             # 기본 OFF. AskUserQuestion으로 토글
    max_iterations: 5          # 최대 반복 횟수 (1-10)
    review_criteria:           # 리드의 SHIP/REVISE 판정 기준
      - "completeness"         # 태스크 요구사항 충족
      - "accuracy"             # 정확성
      - "format_compliance"    # 출력 형식 준수
    exit_conditions:           # 종료 조건
      - "SHIP"                 # 리드 승인
      - "max_iterations"       # 반복 제한 도달
      - "all_tasks_done"       # 전체 태스크 완료
```

**Ralph Loop 참조**: `.claude/reference/ralph-loop-research.md`
- 이름 유래: Ralph Wiggum (심슨가족). 창시자: Geoffrey Huntley
- 핵심: Lead가 Worker 결과를 SHIP(승인) 또는 REVISE(재작업) 판정
- OFF: 워커 결과 즉시 수락 (빠른 실행, 비용 절약)
- ON: 리드가 review_criteria 기준으로 리뷰 → 피드백 → 재작업 반복

**teammate_mode 결정 기준**:
- 일반 팀: `"tmux"` (Split Pane 강제)
- 대시보드 팀 (ops.dashboard.*): `"auto"` (Split Pane 불필요)
- VS Code 환경: 자동으로 `"auto"` 폴백

**shared_memory 자동 결정**:
- 팀 3명 이하: `layers: ["markdown"]`
- 팀 4-8명: `layers: ["markdown", "sqlite"]`
- 팀 8명+ 또는 장기: `layers: ["markdown", "sqlite", "mcp_memory"]`
- MCP Memory 서버 감지 시 자동 추가

### 3-3. models

```yaml
models:
  lead: opus                   # 최종 리드 (항상 opus)
  category_lead: sonnet        # 카테고리 리드 (비용 최적화)
  workers:
    default: sonnet            # 기본 워커
    low_cost: haiku            # 저비용 워커 (분류/라벨링)
    high_risk: opus            # 고위험 작업 (드물게)
```

### 3-4. roles

```yaml
roles:
  - name: "lead_{category}"   # 카테고리 리드
    type: "category_lead"      # category_lead | worker
    count: 1
    model: sonnet              # models.category_lead 참조
    subagent_type: "general-purpose"
    tools:                     # 할당 도구 (Phase D 최적 경로 기반)
      - "Read"
      - "Write"
      - "Bash"
      - "Glob"
      - "Grep"
      - "mcp__obsidian__*"
  - name: "{worker_name}"
    type: "worker"
    count: 1
    model: sonnet
    subagent_type: "general-purpose"  # general-purpose | Explore
    tools:
      - "Read"
      - "Glob"
      - "Grep"
    # source_agent (선택 필드)
    # source_agent: ".claude/agents/thread-writer.md"
```

#### source_agent (선택 필드)

```yaml
# roles[].source_agent (optional)
source_agent: string (optional)
  # 기존 에이전트/스킬 md 파일 경로 (프로젝트 루트 기준 상대 경로)
  # 설정 시 STEP 5에서 래퍼 모드 사용 (원본 파일 콘텐츠 보존)
  # 예: ".claude/agents/thread-writer.md"
  # 예: ".claude/skills/tofukyung-article-persona-v5.md"
  # STEP 3 자동 감지 시 자동 설정됨
```

**source_agent 검증 규칙**:
```
[ ] source_agent 설정 시 해당 파일이 실제 존재하는지 Glob 확인
[ ] source_agent와 subagent_type 호환:
    - agent 파일의 allowedTools에 Write 포함 → subagent_type: general-purpose
    - Write 미포함 → subagent_type: Explore
[ ] source_agent 경로는 프로젝트 루트 기준 상대 경로
```

**subagent_type 규칙**:
- `Explore`: 읽기 전용 (Read, Glob, Grep만). 검색/분석 워커에 적합.
- `general-purpose`: 전체 도구 접근. 쓰기 필요 워커에 적합.
- `Plan`: 설계/계획 전용 (읽기 전용). 아키텍처 워커에 적합.

### 3-5. quality_gates

```yaml
quality_gates:
  teammate_idle:
    require_summary_message: true     # idle 시 요약 메시지 필수
    require_bulletin_update: true     # TEAM_BULLETIN.md 업데이트 필수
    require_files_exist:              # 특정 파일 존재 확인
      - ".team-os/artifacts/findings/{team_id}/result.md"
  task_completed:
    require_no_same_file_conflicts: true  # 동일 파일 수정 충돌 없음
    require_summary_schema: true          # 요약 스키마 준수
    require_files_exist:
      - "{출력 파일 경로}"
```

### 3-6. conflict_prevention

```yaml
conflict_prevention:
  file_ownership:
    - owner: "{team_id}"
      paths:
        - ".team-os/artifacts/findings/{category}/**"
  rules:
    - "워커는 vault 파일 직접 수정 금지 (분석/저장 팀으로 넘김)"
    - "동일 파일 동시 수정 금지"
    - "쓰기는 Main/리드만 수행 (Bug-2025-12-12-2056)"
```

### 3-7. invoke

```yaml
invoke:
  command: "/tofu-at spawn {team_id}"
  alt_prompt: "Create agent team: {purpose}"
  args:                          # 선택적 인자
    - "--url <URL>"
    - "--vault <PATH>"
```

---

## 4. 검증 규칙

```
팀 템플릿 검증 체크리스트:

[ ] team_id가 {category}.{workflow}.{variant} 형식
[ ] environment.teammate_mode가 "tmux" 또는 "auto"
[ ] environment.required_mcp의 모든 서버가 .mcp.json에 존재
[ ] models.lead = opus (고정)
[ ] models.category_lead = sonnet (기본) 또는 opus (고난도)
[ ] roles에 최소 1개 category_lead 또는 worker 존재
[ ] 각 role의 subagent_type이 유효 (general-purpose | Explore | Plan)
[ ] inputs, outputs가 비어있지 않음
[ ] quality_gates에 최소 teammate_idle 또는 task_completed 존재
[ ] conflict_prevention.rules에 최소 1개 규칙 존재
[ ] invoke.command가 /tofu-at spawn 형식
```

---

## 5. 예시 3개

### 예시 1: km.ingest.web.standard

```yaml
- team_id: km.ingest.web.standard
  purpose: "웹 URL을 추출 → 정제 → KM 워크플로우 입력으로 만든다"
  environment:
    teammate_mode: "tmux"
    required_mcp: ["playwright", "hyperbrowser"]
    required_cli: ["node"]
    optional_tools: ["marker_single"]
    platform_notes:
      windows: "WSL2 + tmux"
      macos: "brew install tmux"
  models:
    lead: opus
    category_lead: sonnet
    workers:
      default: sonnet
      low_cost: haiku
  roles:
    - name: lead_ingest
      type: category_lead
      count: 1
      model: sonnet
      subagent_type: general-purpose
      tools: ["Read", "Write", "Bash", "Glob", "Grep", "SendMessage", "TaskCreate", "TaskUpdate"]
    - name: web_scraper
      type: worker
      count: 1
      model: sonnet
      subagent_type: general-purpose
      tools: ["Read", "Bash", "Glob", "Grep", "WebFetch"]
    - name: content_cleaner
      type: worker
      count: 1
      model: haiku
      subagent_type: general-purpose
      tools: ["Read", "Glob", "Grep"]
  inputs:
    - "url"
    - "km-config.json (optional)"
    - "user preferences (Phase 1.5 preset)"
  outputs:
    - ".team-os/artifacts/findings/ingest/web_extraction.md"
    - ".team-os/artifacts/findings/ingest/clean_content.md"
    - "handoff: extracted_content → km.analyze.* teams"
  quality_gates:
    teammate_idle:
      require_summary_message: true
      require_bulletin_update: true
      require_files_exist:
        - ".team-os/artifacts/findings/ingest/web_extraction.md"
    task_completed:
      require_no_same_file_conflicts: true
      require_summary_schema: true
  conflict_prevention:
    file_ownership:
      - owner: "km.ingest.*"
        paths:
          - ".team-os/artifacts/findings/ingest/**"
    rules:
      - "워커는 vault 파일 직접 수정 금지 (분석/저장 팀으로 넘김)"
      - "쓰기는 리드(lead_ingest)만 수행"
  invoke:
    command: "/tofu-at spawn km.ingest.web.standard --url <URL>"
    alt_prompt: "Create an agent team to extract and clean web content"
```

### 예시 2: km.graph.build-index

```yaml
- team_id: km.graph.build-index
  purpose: "Obsidian vault의 [[wikilink]] 그래프 인덱스를 구축/업데이트한다"
  environment:
    teammate_mode: "tmux"
    required_mcp: ["obsidian"]
    required_cli: []
    optional_tools: ["claude-mem"]
    platform_notes:
      vscode: "in-process 폴백"
  models:
    lead: opus
    category_lead: sonnet
    workers:
      default: sonnet
      low_cost: haiku
  roles:
    - name: lead_graph
      type: category_lead
      count: 1
      model: sonnet
      subagent_type: general-purpose
      tools: ["Read", "Write", "Bash", "Glob", "Grep", "mcp__obsidian__search_vault", "mcp__obsidian__read_note", "SendMessage", "TaskCreate", "TaskUpdate"]
    - name: graph_indexer
      type: worker
      count: 1
      model: sonnet
      subagent_type: Explore
      tools: ["Read", "Glob", "Grep"]
    - name: tag_folder_profiler
      type: worker
      count: 1
      model: haiku
      subagent_type: Explore
      tools: ["Read", "Glob", "Grep"]
  inputs:
    - "vault_path"
    - "note corpus (md files)"
    - "optional: folder priority rules"
  outputs:
    - ".team-os/graphrag/index/graph.json"
    - ".team-os/graphrag/index/pagerank.json"
    - ".team-os/graphrag/index/node_summaries.json"
  quality_gates:
    teammate_idle:
      require_summary_message: true
      require_bulletin_update: true
      require_files_exist:
        - ".team-os/graphrag/index/graph.json"
    task_completed:
      require_summary_schema: true
  conflict_prevention:
    file_ownership:
      - owner: "km.graph.*"
        paths:
          - ".team-os/graphrag/**"
    rules:
      - "vault 원본은 read-only, 인덱스만 생성/갱신"
      - "graph_indexer와 tag_folder_profiler는 서로 다른 출력 파일 담당"
  invoke:
    command: "/tofu-at spawn km.graph.build-index --vault <PATH>"
    alt_prompt: "Create an agent team to build GraphRAG index for vault"
```

### 예시 3: ops.dashboard.collector

```yaml
- team_id: ops.dashboard.collector
  purpose: "Agent Teams 진행상황을 로컬 데이터에서 수집해 이벤트로 만든다"
  environment:
    teammate_mode: "auto"           # Dashboard는 Split Pane 불필요
    required_mcp: []
    required_cli: ["node"]
    optional_tools: []
    platform_notes:
      all: "Split Pane 불필요. in-process 모드 권장."
  models:
    lead: opus
    category_lead: sonnet
    workers:
      default: sonnet
      low_cost: haiku
  roles:
    - name: lead_ops
      type: category_lead
      count: 1
      model: sonnet
      subagent_type: general-purpose
      tools: ["Read", "Write", "Bash", "Glob", "Grep", "SendMessage", "TaskCreate", "TaskUpdate"]
    - name: event_collector
      type: worker
      count: 1
      model: sonnet
      subagent_type: Explore
      tools: ["Read", "Glob", "Grep"]
    - name: summarizer
      type: worker
      count: 1
      model: haiku
      subagent_type: Explore
      tools: ["Read", "Glob", "Grep"]
  inputs:
    - "~/.claude/teams/{team-name}/config.json"
    - "~/.claude/tasks/{team-name}/"
    - "hook input transcript_path"
  outputs:
    - ".team-os/dashboard/events.jsonl"
    - ".team-os/dashboard/state.sqlite (optional)"
  quality_gates:
    teammate_idle:
      require_summary_message: true
      require_bulletin_update: true
    task_completed:
      require_files_exist:
        - ".team-os/dashboard/events.jsonl"
  conflict_prevention:
    rules:
      - "collector는 read-only로 ~/.claude/만 읽고, .team-os/에만 기록"
      - "event_collector와 summarizer는 서로 다른 출력 담당"
  invoke:
    command: "/tofu-at spawn ops.dashboard.collector --team <TEAM_NAME>"
    alt_prompt: "Create an agent team to build dashboard event collector"
```

### 예시 4: 기존 에이전트를 팀원으로 통합 (source_agent 활용)

```yaml
- team_id: content.thread-writing.v1
  purpose: "Threads 글 작성 + Obsidian/Notion 저장 팀"
  environment:
    teammate_mode: "tmux"
    required_mcp: ["obsidian", "notion"]
    required_cli: []
    shared_memory:
      layers: ["markdown"]
      markdown_files: ["team_plan.md", "team_bulletin.md", "team_findings.md", "team_progress.md"]
  models:
    lead: opus
    workers:
      default: sonnet
  roles:
    - name: thread-writer
      type: worker
      count: 1
      model: sonnet
      subagent_type: general-purpose
      source_agent: ".claude/agents/thread-writer.md"  # 기존 에이전트 그대로 사용
      tools: ["Read", "Write", "Bash", "mcp__obsidian__create_note", "mcp__notion__API-post-page"]
    - name: content-researcher
      type: worker
      count: 1
      model: sonnet
      subagent_type: Explore
      # source_agent 없음 → STEP 5 템플릿 파이프라인으로 생성
      tools: ["Read", "Glob", "Grep", "WebFetch"]
  inputs:
    - "topic"
    - "user preferences"
  outputs:
    - ".team-os/artifacts/findings/content/thread.md"
  quality_gates:
    teammate_idle:
      require_summary_message: true
      require_bulletin_update: true
    task_completed:
      require_summary_schema: true
  conflict_prevention:
    rules:
      - "쓰기는 리드만 수행"
  invoke:
    command: "/tofu-at spawn content.thread-writing.v1"
    alt_prompt: "Create a thread writing team with existing thread-writer agent"
```

---

## 6. team_id 네이밍 카탈로그 (30+ 템플릿)

> outline.md 기반 전체 카탈로그. 각 팀의 상세 스펙은 `/tofu-at catalog` 명령으로 생성.

| Category | team_id | 구성 요약 | 모델 정책 |
|----------|---------|----------|----------|
| Foundation | wf.tofu-at.clone-and-version | 팀장1+워커2 | Lead=Opus, 팀장=Sonnet, 워커=Haiku |
| Foundation | wf.tofu-at.classify-and-catalog | 팀장1+워커3 | Sonnet+Haiku |
| Foundation | wf.tofu-at.spawn-runbook | 팀장1+워커2 | Sonnet+Haiku |
| Foundation | wf.tofu-at.retrospective | 팀장1+워커2 | Sonnet+Haiku |
| Ingest | km.ingest.web.standard | Ingest팀장+Scraper+Cleaner | Sonnet+Sonnet+Haiku |
| Ingest | km.ingest.web.stealth | Ingest팀장+StealthScraper+QA | Sonnet+Sonnet |
| Ingest | km.ingest.pdf.simple | Ingest팀장+PDFWorker | Sonnet+Sonnet |
| Ingest | km.ingest.pdf.heavy | Ingest팀장+OCRWorker+Cleaner | Sonnet+Sonnet+Haiku |
| Ingest | km.ingest.social.thread | Ingest팀장+ThreadScraper | Sonnet+Sonnet |
| Ingest | km.ingest.batch.queue | Ingest팀장+QueueRunner+Triage | Sonnet+Haiku |
| Analyze | km.analyze.summary | PKM팀장+Summarizer | Sonnet+Sonnet |
| Analyze | km.analyze.zettelkasten | PKM팀장+Atomizer | Sonnet+Sonnet |
| Analyze | km.analyze.split-3tier | PKM팀장+Structurer | Sonnet+Sonnet |
| Analyze | km.analyze.tagging | PKM팀장+Tagger | Sonnet+Haiku |
| Analyze | km.analyze.glossary | PKM팀장+GlossaryBuilder | Sonnet+Haiku |
| Analyze | km.analyze.actionable-insights | PKM팀장+InsightExtractor | Sonnet+Sonnet |
| Graph | km.graph.build-index | Graph팀장+Indexer | Sonnet+Sonnet |
| Graph | km.graph.candidate-expand | Graph팀장+Expander | Sonnet+Haiku |
| Graph | km.graph.rank-tune | Graph팀장+RankTuner | Sonnet+Sonnet |
| Graph | km.graph.context-pack | Graph팀장+Packer | Sonnet+Sonnet |
| Graph | km.graph.retrieval-qa | Graph팀장+QAWorker | Sonnet+Sonnet |
| Graph | km.graph.feedback-loop | Graph팀장+Curator | Sonnet+Haiku |
| Storage | km.store.obsidian | Storage팀장+ObsidianWriter | Sonnet+Sonnet |
| Storage | km.store.notion | Storage팀장+NotionWriter | Sonnet+Sonnet |
| Storage | km.store.local | Storage팀장+LocalWriter | Sonnet+Haiku |
| Storage | km.store.verify-and-report | QA팀장+Verifier | Sonnet+Sonnet |
| Ops | ops.dashboard.collector | Ops팀장+Collector | Sonnet+Sonnet |
| Ops | ops.dashboard.server | Ops팀장+APIServer | Sonnet+Sonnet |
| Ops | ops.dashboard.ui-office | Ops팀장+UIBuilder | Sonnet+Sonnet |
| Ops | ops.dashboard.retrospective-board | Ops팀장+Reporter | Sonnet+Haiku |
| QA | qa.hooks.quality-gates | QA팀장+HookAuthor | Sonnet+Sonnet |
| QA | qa.conflict.file-ownership | QA팀장+Librarian | Sonnet+Haiku |
