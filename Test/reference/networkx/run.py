#!/usr/bin/env python3
"""
test/reference/networkx/run.py

test/fixtures/known-graphs/ 의 각 fixture 를 networkx 로 다시 계산하여
.expected.json 과 ε 안에서 일치하는지 확인.

요구사항:
    pip install networkx>=3.0

사용법:
    python3 test/reference/networkx/run.py
    python3 test/reference/networkx/run.py --update    # 결과로 expected JSON 갱신
    python3 test/reference/networkx/run.py --tol 1e-4  # tolerance 변경

목적:
    FuncWatch 자체 PageRank 구현이 networkx 의 표준 결과와 ε 안에서 일치함을
    publication-grade 로 입증.
"""

import argparse
import json
import os
import sys
from pathlib import Path

try:
    import networkx as nx
except ImportError:
    print("[ERROR] networkx 미설치. `pip install networkx` 후 다시 실행.", file=sys.stderr)
    sys.exit(2)


FIXTURE_DIR = Path(__file__).resolve().parents[2] / "fixtures" / "known-graphs"


def load_fixture(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def build_graph(spec: dict, *, with_weight: bool = False) -> nx.MultiDiGraph:
    # MultiDiGraph: multi-edge 보존, self-loop 허용
    g = nx.MultiDiGraph()
    for node in spec["nodes"]:
        g.add_node(node["id"], **{k: v for k, v in node.items() if k != "id"})
    for e in spec["edges"]:
        attrs = {"kind": e.get("kind")}
        if with_weight:
            # unreachable edge → weight 0 (effectively excluded)
            attrs["weight"] = float(e.get("weight", 1.0))
        g.add_edge(e["from"], e["to"], **attrs)
    return g


def compute_pagerank(g: nx.MultiDiGraph, damping: float, tol: float, *, weight: str = None):
    """
    수렴 조건 차이 보정:
      - FuncWatch: err = sum_v |dr(v)|   (전체 L1)        →  err < tol
      - networkx : err = sum_v |dr(v)|   (전체 L1)        →  err < N * tol

    즉 networkx 는 같은 tol 값으로 호출하면 우리보다 N 배 빨리 종료한다.
    공평한 비교를 위해 networkx 의 tol 을 tol/N 으로 보정.

    또한 max_iter 도 충분히 크게 (500) 두어 수렴 보장.
    """
    N = max(g.number_of_nodes(), 1)
    nx_tol = tol / N
    return nx.pagerank(g, alpha=damping, tol=nx_tol, max_iter=500, weight=weight)


def compare(expected: dict, actual: dict, tol: float):
    """expected 와 actual 의 각 노드별 차이를 검사. (max_diff, mismatches) 반환."""
    keys = set(expected.keys()) | set(actual.keys())
    max_diff = 0.0
    mismatches = []
    for k in keys:
        e = expected.get(k, None)
        a = actual.get(k, None)
        if e is None or a is None:
            mismatches.append((k, e, a, "missing"))
            continue
        d = abs(e - a)
        max_diff = max(max_diff, d)
        if d > tol:
            mismatches.append((k, e, a, d))
    return max_diff, mismatches


def is_weighted_fixture(spec_path) -> bool:
    """이름이 'weighted-' 로 시작하면 weighted PR 검증 대상."""
    return spec_path.stem.startswith("weighted-")


def expected_path_for(spec_path) -> "Path":
    if is_weighted_fixture(spec_path):
        return FIXTURE_DIR / f"{spec_path.stem}.expected.weighted.json"
    return FIXTURE_DIR / f"{spec_path.stem}.expected.json"


def expected_key_for(spec_path) -> str:
    if is_weighted_fixture(spec_path):
        return "expectedWeightedPageRank"
    return "expectedPageRank"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tol", type=float, default=5e-4,
                    help="비교 tolerance (default: 5e-4 — 알고리즘 수렴 tolerance "
                         "1e-4 보다 한 자리 큰 값. publication 시 더 줄여서 검증).")
    ap.add_argument("--update", action="store_true",
                    help="networkx 결과로 .expected.json 을 갱신")
    args = ap.parse_args()

    spec_files = sorted(FIXTURE_DIR.glob("*.json"))
    spec_files = [p for p in spec_files
                  if not p.name.endswith(".expected.json")
                  and not p.name.endswith(".expected.weighted.json")]

    all_ok = True
    for spec_path in spec_files:
        spec = load_fixture(spec_path)
        weighted = is_weighted_fixture(spec_path)
        expected_path = expected_path_for(spec_path)
        expected_key = expected_key_for(spec_path)

        g = build_graph(spec, with_weight=weighted)
        weight_attr = "weight" if weighted else None
        nx_ranks = compute_pagerank(
            g, spec["damping"], spec["tolerance"], weight=weight_attr
        )

        tag = "[WEIGHTED]" if weighted else "[PLAIN]"
        print(f"=== {tag} {spec['name']} ===")
        print(f"  nodes={g.number_of_nodes()}  edges={g.number_of_edges()}")

        if args.update or not expected_path.exists():
            out = {
                "name": spec["name"],
                "damping": spec["damping"],
                "tolerance": spec["tolerance"],
                "iterations": None,
                "converged": True,
                "source": "networkx.pagerank()" + (
                    "  (weighted via edge 'weight')" if weighted else ""
                ),
                "note": "Reference computed by networkx via test/reference/networkx/run.py.",
                expected_key: {k: round(v, 6) for k, v in nx_ranks.items()},
            }
            if weighted and "weights" in spec:
                out["weights"] = spec["weights"]
            with expected_path.open("w", encoding="utf-8") as f:
                json.dump(out, f, indent=2, ensure_ascii=False)
                f.write("\n")
            print(f"  [WRITE] {expected_path.name}")
            continue

        with expected_path.open(encoding="utf-8") as f:
            expected = json.load(f)[expected_key]
        max_diff, mismatches = compare(expected, nx_ranks, args.tol)
        print(f"  max diff vs expected: {max_diff:.2e}  tol: {args.tol:.2e}")
        if mismatches:
            all_ok = False
            for k, e, a, d in mismatches:
                print(f"  [MISMATCH] {k}: expected={e}  networkx={a}  diff={d}")
        else:
            print(f"  [OK] all ranks within tolerance")

    print()
    print("SUMMARY:", "PASS" if all_ok else "FAIL")
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
