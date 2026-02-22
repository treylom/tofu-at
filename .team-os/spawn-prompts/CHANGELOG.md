# Spawn Prompts Changelog

이 폴더의 스폰 프롬프트 파일 변경 이력을 기록합니다.

---

## [2026-02-19] - 전체 8개 파일: progress_update_rule 추가

### 수정 파일
- `vault-intel-lead.md`
- `content-proc-lead.md`
- `graph-navigator.md`
- `retrieval-specialist.md`
- `link-curator.md`
- `content-extractor.md`
- `deep-reader.md`
- `content-analyzer.md`

### 변경 내용
- [Added]: 모든 스폰 프롬프트에 `<progress_update_rule>` 섹션 추가
  - Agent Office 대시보드 실시간 진행률 업데이트용
  - 에이전트 유형별 보고 방식:

| 유형 | 에이전트 | 방식 |
|------|---------|------|
| Category Lead | vault-intel-lead, content-proc-lead | curl 직접 push + Explore 워커 진행률 중계 |
| general-purpose Worker | content-extractor, content-analyzer | curl 직접 push |
| Explore Worker | graph-navigator, retrieval-specialist, link-curator, deep-reader | SendMessage 기반 (Bash 불가 → Category Lead가 중계) |

- [Added]: 각 에이전트별 진행률 마일스톤 테이블 (10%~100%)
- [Added]: 실패 시 graceful 처리 (curl 실패해도 작업 중단 안 함)

### 영향 범위
- 영향받는 기능: /knowledge-manager-at 실행 시 Agent Office 실시간 진행률
- 기존 기능: 스폰 프롬프트의 `<task>`, `<output_format>`, `<constraints>` 변경 없음
- tofu-at2: 자체 progress_update_rule 보유, 영향 없음

---
