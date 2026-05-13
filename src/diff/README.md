# `src/diff/` — Phase 6: PR Diff & Risk Ranking

(2단계 진입 시 본격 구현)

## 책임

- PR diff에서 변경된 함수 식별 (AST-level diff, regex 폐기)
- 변경 함수에 importance score를 매핑하여 risk-ranked 알림 생성
