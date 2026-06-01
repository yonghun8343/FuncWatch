# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test                    # Full test suite
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:coverage       # Coverage report
npm run test:watch          # Watch mode

# Run a single test file
npm run test:integration -- Test/integration/phase3.pagerank-fixtures.test.js

# Run tests matching a pattern
npm run test:unit -- --testNamePattern="phase0"

# Dev tools
node tools/dot-export.js    # Export call graph to Graphviz DOT
node tools/sensitivity.js   # Analyze PageRank sensitivity to α/β
```

## Architecture

FuncWatch analyzes JavaScript source files to rank functions by **latent change impact** using call-graph-based weighted PageRank. The pipeline has 5 phases:

1. **AST** (`src/ast/`) — Parse JS (Babel), extract function table and call-site table
2. **Call Graph** (`src/graph/`) — Build directed graph: function/module/external nodes; direct/callback/top-level edges
3. **PageRank** (`src/ranking/pagerank.js`) — Standard PageRank (Brin & Page 1998)
4. **Control Call Graph** (`src/graph/ccg/`) — Annotate each CG edge with `{ifDepth, loopDepth}` control context
5. **Weighted PageRank** (`src/ranking/weighted-pagerank.js`) — PageRank using edge weight `w = α^ifDepth × β^loopDepth` (Wu-Larus heuristic; α=0.5, β=10)

### Module map

```
src/
├── index.js              # Public API: exports { ast, graph, ranking }
├── ast/
│   ├── visitor.js        # AST traversal with FunctionContext tracking
│   ├── function-table.js # FunctionKind enum + FunctionTable
│   ├── call-site-table.js# CallSiteTable (CallExpression / NewExpression)
│   ├── node-id.js        # Generates "function:<name>:<id>" identifiers
│   └── callee-whitelist.js # map/forEach→LOOP, then/catch→IF overrides
├── graph/
│   ├── index.js          # buildFromSource(), buildCCGFromSource()
│   ├── base.js           # Graph ADT (addNode, addEdge, neighbors, etc.)
│   ├── callgraph.js      # Builds CG from parsed AST + file path
│   ├── resolver.js       # Callee resolution (FUNCTION / EXTERNAL / UNRESOLVED)
│   └── ccg/
│       ├── builder.js    # Traverses CG, annotates edges with control context
│       └── context.js    # Context model + weight function
└── ranking/
    ├── index.js          # pageRank(), weightedPageRank(), toSortedRanking()
    ├── pagerank.js       # Power-iteration PageRank
    ├── weighted-pagerank.js # Weighted variant (Xing & Ghorbani 2004)
    ├── edge-weight.js    # Edge weight: reachability × w_kind × α^if × β^loop
    └── baselines.js      # inDegree, outDegree, locScore, Spearman ρ
```

### Typical usage

```javascript
const { ast, graph, ranking } = require('./src');

const cg  = graph.buildFromSource(jsCode, '<file>');
const ccg = graph.buildCCGFromSource(jsCode, '<file>');

const { ranks }         = ranking.pageRank(cg);
const { ranks: wRanks } = ranking.weightedPageRank(ccg, { weights: { alpha: 0.3, beta: 20 } });

const top5 = ranking.toSortedRanking(wRanks).slice(0, 5);
```

## Scope & constraints

- **ES7 single-file only** — no ESM imports, CJS `require`, JSX, or TypeScript
- PageRank results are validated against a Python networkx baseline (`Test/reference/networkx/`) within ε-tolerance
- Fixture files under `Test/fixtures/` are locked per phase — do not modify expected outputs once a phase is complete
- Phase 5.5+ (multi-file/module support, PR diff integration, Stryker mutation testing, evaluation) is out of scope for the current publication target
