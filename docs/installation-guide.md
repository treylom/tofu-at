# tofu-at 설치 가이드 (초보자용)

> 이 가이드는 **AI를 처음 접하는 분**도 따라할 수 있도록 모든 단계를 설명합니다.
> Windows(WSL) 설치부터 tofu-at 실행까지 전 과정을 다룹니다.

---

## 시작하기 전에

### Claude Code란?
터미널에서 AI(Claude)와 대화하며 코딩, 분석, 자동화 작업을 수행하는 CLI 도구입니다.

### Agent Teams란?
여러 AI 에이전트가 **동시에 협업**하여 복잡한 작업을 병렬 처리하는 기능입니다.
하나의 Claude가 여러 개로 나뉘어 각각 다른 역할을 수행합니다.

### 이 가이드에서 할 일
1. 필수 소프트웨어 설치 (Node.js, tmux, Claude Code)
2. tofu-at 설치 (`install.sh` 한 줄 실행)
3. 첫 실행 및 확인

### 내 환경은?

| 환경 | 시작 섹션 |
|------|----------|
| **Windows** (WSL 미설치) | → [Part 0: WSL 설치](#part-0-wsl-설치-windows-사용자만) |
| **Windows** (WSL 설치됨) | → [Part 1: tofu-at 설치](#part-1-tofu-at-설치) |
| **macOS** | → [Part 1: tofu-at 설치](#part-1-tofu-at-설치) |
| **Linux** | → [Part 1: tofu-at 설치](#part-1-tofu-at-설치) |

---

## Part 0: WSL 설치 (Windows 사용자만)

> macOS/Linux 사용자는 이 섹션을 건너뛰세요.

### 0.1 WSL2 설치

1. **PowerShell을 관리자 권한으로 실행**
   - 시작 메뉴에서 "PowerShell" 검색
   - "관리자 권한으로 실행" 클릭

   ![PowerShell 관리자 실행](screenshots/step0-powershell-admin.png)

2. **WSL 설치 명령어 실행**
   ```powershell
   wsl --install
   ```

3. **컴퓨터 재부팅** (필수!)

4. 재부팅 후 Ubuntu 터미널이 자동으로 열립니다.

### 0.2 Ubuntu 초기 설정

Ubuntu가 처음 열리면 사용자명과 비밀번호를 설정합니다:

```
Enter new UNIX username: 원하는이름
New password: 비밀번호 (입력 시 화면에 안 보임 — 정상)
Retype new password: 비밀번호 재입력
```

> **팁**: 비밀번호 입력 시 화면에 아무것도 안 나타나는 것은 정상입니다.

### 0.3 기본 패키지 설치

Ubuntu 터미널에서 실행:

```bash
sudo apt update && sudo apt install -y tmux git curl
```

![기본 패키지 설치](screenshots/step0-apt-install.png)

### 0.4 nvm + Node.js 설치

**nvm (Node Version Manager) 설치:**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

**터미널 재시작** (중요!):
```bash
source ~/.bashrc
```

**Node.js LTS 설치:**
```bash
nvm install --lts
```

**설치 확인:**
```bash
node --version   # v20.x.x 이상이면 OK
npm --version    # 10.x.x 이상이면 OK
```

> **주의**: `nvm: command not found` 오류가 나오면 터미널을 닫았다 다시 열어주세요.

### 0.5 Claude Code 설치

```bash
npm install -g @anthropic-ai/claude-code
```

**인증 (Anthropic 계정 필요):**
```bash
claude auth login
```
- 브라우저가 열리면 Anthropic 계정으로 로그인
- 인증 완료 후 터미널로 돌아옴

**설치 확인:**
```bash
claude --version
```

![Claude Code 설치 완료](screenshots/step0-claude-installed.png)

> WSL 설치 완료! 이제 Part 1로 진행하세요.

---

## Part 1: tofu-at 설치

### 1.1 사전 준비 확인

먼저 필요한 소프트웨어가 설치되어 있는지 확인합니다:

```bash
claude --version   # Claude Code
node --version     # Node.js (v18+)
tmux -V            # tmux
git --version      # git
```

| 항목 | 최소 버전 | 확인 명령어 |
|------|----------|------------|
| Claude Code | v2.1.45+ | `claude --version` |
| Node.js | v18+ | `node --version` |
| tmux | 2.0+ | `tmux -V` |
| git | 2.0+ | `git --version` |

> 하나라도 없으면? [Part 0](#part-0-wsl-설치-windows-사용자만) 또는 OS별 설치 가이드 참고

### 1.2 tofu-at 다운로드

#### 방법 A: 원라인 설치 (가장 간단)

프로젝트 폴더에서 실행:

```bash
cd ~/my-project
curl -fsSL https://raw.githubusercontent.com/treylom/tofu-at/main/install.sh | bash
```

#### 방법 B: Git Clone 후 설치

```bash
# 1. tofu-at 다운로드
git clone https://github.com/treylom/tofu-at.git /tmp/tofu-at

# 2. 프로젝트 폴더로 이동
cd ~/my-project

# 3. 설치 실행
bash /tmp/tofu-at/install.sh
```

### 1.3 설치 실행

설치 스크립트가 7단계를 자동으로 진행합니다:

```
╔══════════════════════════════════════════╗
║        tofu-at installer v2.1.0         ║
╚══════════════════════════════════════════╝

[1/7] Checking prerequisites... / 사전요구사항 확인 중...
  [OK] git 2.43.0
  [OK] Node.js v20.18.0
  [OK] tmux 3.4
  [OK] Claude Code 2.1.45
  [OK] All prerequisites met / 모든 사전요구사항 충족

[2/7] Detected environment / 환경 감지...
  [OK] OS: WSL (Windows Subsystem for Linux)
  [OK] Package manager: apt

[3/7] Installing tofu-at files... / tofu-at 파일 설치 중...
  [OK] .claude/commands/tofu-at.md
  [OK] .claude/skills/tofu-at-*.md (3 files)

[4/7] Setting up .team-os infrastructure... / .team-os 인프라 설정 중...
  [OK] .team-os/ (registry, hooks, artifacts) — fresh install

[5/7] Configuring settings.local.json... / 설정 파일 구성 중...
  [OK] settings.local.json configured (via Python3)

[6/7] Verifying installation... / 설치 검증 중...
  [OK] .claude/commands/tofu-at.md exists
  [OK] .claude/skills/tofu-at-*.md (3 files)
  [OK] .team-os/ directory structure
  [OK] settings.local.json is valid JSON
  [OK] All checks passed / 모든 검증 통과

[7/7] Done! / 완료!

╔══════════════════════════════════════════════════════╗
║  tofu-at v2.1.0 installed! / 설치 완료!             ║
╚══════════════════════════════════════════════════════╝

  OS: WSL  |  tmux: 3.4  |  Node: v20.18.0

  Next steps / 다음 단계:
    1. claude --model=opus[1m]
    2. Type /tofu-at / /tofu-at 입력

  (Optional / 선택) ai/ain shortcuts / 단축키 설정:
    bash /tmp/tofu-at/setup-bashrc.sh /home/user/my-project
```

![설치 완료 화면](screenshots/step1-install-complete.png)

### 1.4 설치 확인

설치 후 다음 파일들이 프로젝트에 생성됩니다:

```
my-project/
├── .claude/
│   ├── commands/
│   │   └── tofu-at.md          ← /tofu-at 명령어
│   ├── skills/
│   │   ├── tofu-at-workflow.md
│   │   ├── tofu-at-registry-schema.md
│   │   └── tofu-at-spawn-templates.md
│   └── settings.local.json     ← 자동 구성됨
└── .team-os/
    ├── registry.yaml
    ├── hooks/
    │   ├── teammate-idle-gate.js
    │   └── task-completed-gate.js
    └── artifacts/
        ├── TEAM_PLAN.md
        ├── TEAM_BULLETIN.md
        ├── TEAM_FINDINGS.md
        ├── TEAM_PROGRESS.md
        └── MEMORY.md
```

**settings.local.json 확인:**
```bash
cat .claude/settings.local.json
```

다음 항목이 포함되어 있어야 합니다:
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "teammateMode": "tmux",
  "hooks": {
    "TeammateIdle": [...],
    "TaskCompleted": [...]
  }
}
```

---

## Part 2: 첫 실행

### 2.1 Claude Code 시작

```bash
claude --model=opus[1m]
```

> `opus[1m]`은 1M 토큰 컨텍스트 모드입니다. Agent Teams에 권장됩니다.

### 2.2 /tofu-at 실행

Claude Code 프롬프트에서:

```
/tofu-at
```

메뉴가 표시됩니다:

```
tofu-at — Agent Team Builder

Choose an action:
  1. Scan a workflow → analyze & propose team
  2. Inventory → list available resources
  3. Spawn a team → run from registry
  4. Catalog → save team to registry
```

![tofu-at 메뉴](screenshots/step2-tofu-at-menu.png)

### 2.3 성공 확인

메뉴가 정상적으로 표시되면 설치 성공입니다!

**간단한 테스트:**
```
/tofu-at inventory
```
→ 프로젝트의 skills, agents, MCP 서버 목록이 표시됩니다.

---

## Part 3: ai/ain 명령어 설정 (선택)

> 이 섹션은 선택사항입니다. tmux 세션 관리를 편리하게 해주는 단축 명령어를 설치합니다.

### 3.1 ai/ain이란?

터미널에서 Claude Code를 더 쉽게 실행하고 관리하는 명령어입니다:

| 명령어 | 설명 | 효과 |
|--------|------|------|
| `ai` | Claude Code 기본 실행 | tmux 세션 "claude" 생성 → opus[1m] 실행 |
| `ai pass` | 권한 확인 건너뛰기 | `--dangerously-skip-permissions` 추가 |
| `ain` | 이름 지정 세션 | 여러 Claude 인스턴스 동시 실행 |
| `ain pass myname` | 이름 + 권한 건너뛰기 | 이름과 옵션 조합 |
| `cleanup` | 세션 관리 | tmux 세션 목록/종료 |
| `ai-sync` | Git 동기화 | add → commit → pull → push |

### 3.2 설치 방법

```bash
# 기본 설치 (auto-push OFF — 안전 모드)
bash setup-bashrc.sh ~/my-project

# auto-push 활성화 (Claude 종료 시 자동 git push)
bash setup-bashrc.sh ~/my-project --with-auto-push

# zsh 사용자
bash setup-bashrc.sh ~/my-project --shell=zsh
```

설치 후 셸 재시작:
```bash
source ~/.bashrc   # 또는 source ~/.zshrc
```

### 3.3 사용 예시

**기본 실행:**
```bash
ai          # tmux 세션 "claude" 생성 → Claude Code 실행
```

**권한 스킵 모드:**
```bash
ai pass     # 파일 수정/명령어 실행 시 확인 건너뛰기
```

**여러 인스턴스 동시 실행:**
```bash
ain pass research    # 세션 "research" 생성
ain pass coding      # 세션 "coding" 생성

# tmux 안에서 실행하면 새 window로 생성됨 (세션이 아닌 탭)
```

**세션 관리:**
```bash
cleanup              # 모든 tmux 세션 목록 + 전체 종료 옵션
cleanup research     # "research" 세션만 종료
```

### 3.4 auto-push 연동 (선택)

기본적으로 auto-push는 **OFF**입니다 (안전을 위해).

활성화하면 Claude Code 종료 시 자동으로:
1. `git add -A`
2. `git commit`
3. `git pull --rebase`
4. `git push`

```bash
# 활성화
bash setup-bashrc.sh ~/my-project --with-auto-push
```

> **주의**: 팀 프로젝트에서는 신중하게 사용하세요. 의도하지 않은 코드가 push될 수 있습니다.

---

## Part 4: 문제 해결 (FAQ)

### "Agent Teams not available" 오류

**원인**: Agent Teams 환경변수가 설정되지 않음

**해결**:
```bash
# settings.local.json 확인
cat .claude/settings.local.json | grep AGENT_TEAMS
```

결과에 `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"`이 없으면:
```bash
# install.sh 재실행
bash install.sh
```

### tmux 관련 오류

**"tmux: command not found"**
```bash
# WSL/Ubuntu
sudo apt install -y tmux

# macOS
brew install tmux
```

**"sessions should be nested with care"**
이미 tmux 세션 안에 있을 때 나타납니다. 정상입니다.
`ain` 명령어를 사용하면 새 window로 생성됩니다.

### hooks 오류

**"Cannot find module .team-os/hooks/..."**
```bash
# hooks 파일 존재 확인
ls -la .team-os/hooks/

# 없으면 install.sh 재실행
bash install.sh
```

**hooks 실행 권한 오류:**
```bash
chmod +x .team-os/hooks/*.js
```

### settings.local.json 충돌

**JSON 파싱 오류:**
```bash
# JSON 유효성 검사
python3 -c "import json; json.load(open('.claude/settings.local.json'))"
```

오류가 나면 파일을 백업하고 install.sh 재실행:
```bash
cp .claude/settings.local.json .claude/settings.local.json.bak
bash install.sh
```

### "nvm: command not found"

터미널을 닫았다 다시 열거나:
```bash
source ~/.bashrc
```

여전히 안 되면 nvm 재설치:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install --lts
```

### WSL 특유 문제

**브라우저가 안 열림 (claude auth login 시)**
WSL에서 브라우저 열기가 안 되면:
1. 터미널에 표시된 URL을 복사
2. Windows 브라우저에서 직접 열기
3. 인증 완료 후 터미널로 돌아오기

**파일 권한 문제:**
```bash
# WSL에서 chmod가 안 먹을 때
sudo chmod +x .team-os/hooks/*.js
```

**느린 파일 시스템:**
WSL에서는 Windows 파일시스템(`/mnt/c/...`)보다 Linux 파일시스템(`~/...`)이 훨씬 빠릅니다.
프로젝트를 `~` 아래에 두는 것을 권장합니다.

---

## 추가 자료

- **GitHub**: https://github.com/treylom/tofu-at
- **README**: 영어 문서 및 상세 아키텍처
- **Claude Code 공식 문서**: https://docs.anthropic.com/en/docs/claude-code

---

*이 가이드에 대한 피드백이나 문제점은 [GitHub Issues](https://github.com/treylom/tofu-at/issues)에 남겨주세요.*
