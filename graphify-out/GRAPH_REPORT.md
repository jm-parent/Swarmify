# Graph Report - jeanmarie-parent-exakisc-symmetrical-train  (2026-11-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 362 nodes · 616 edges · 18 communities (14 shown, 4 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `62c54a14`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 16

## God Nodes (most connected - your core abstractions)
1. `useBoardStore` - 18 edges
2. `compilerOptions` - 16 edges
3. `AgentCard()` - 13 edges
4. `react` - 13 edges
5. `@xyflow/react` - 12 edges
6. `BoardNode` - 9 edges
7. `steps` - 9 edges
8. `Resolve-TemplateContent()` - 9 edges
9. `CardFrame()` - 8 edges
10. `BoardCanvas()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `BoardCanvas()` --calls--> `AddBar()`  [EXTRACTED]
  src/canvas/Board.tsx → src/canvas/AddBar.tsx
- `AgentCard()` --calls--> `CardFrame()`  [EXTRACTED]
  src/canvas/cards/AgentCard.tsx → src/canvas/cards/CardFrame.tsx
- `AgentCard()` --calls--> `useBoardStore`  [EXTRACTED]
  src/canvas/cards/AgentCard.tsx → src/canvas/boardStore.ts
- `BoardCanvas()` --calls--> `ProviderRail()`  [EXTRACTED]
  src/canvas/Board.tsx → src/canvas/ProviderRail.tsx
- `BoardCanvas()` --calls--> `useBoardStore`  [EXTRACTED]
  src/canvas/Board.tsx → src/canvas/boardStore.ts

## Import Cycles
- None detected.

## Communities (18 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (45): dependencies, @lobehub/icons@^6.20.0, lucide-react@^1.80.0, react@^19.1.0, react-dom@^19.1.0, react-markdown@^10.1.0, @tauri-apps/api@^2, @tauri-apps/plugin-dialog@^2.8.4 (+37 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (32): react, @xyflow/react, App(), AddBar(), HALF_CARD, reportError(), Board(), BOARD_FILE_VERSION (+24 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (15): CliStatus, CREATE_NO_WINDOW, detect_clis(), err(), ExitEvent, FLUSH_INTERVAL, kill_session(), NEXT_TOKEN (+7 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (27): @tauri-apps/api, AgentCard(), SHELLS, ConfirmDialog(), ConfirmDialogProps, openInstallCard(), ProviderRail(), CliStatus (+19 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (30): args, inputs, integration, spec, default, prompt, type, any (+22 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (9): Db, enregistre_puis_recharge_le_board(), init(), load(), load_board(), open_db(), save(), save_board() (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.17
Nodes (17): Find-SpecifyRoot(), Format-SpecKitCommand(), Get-CurrentBranch(), Get-FeaturePathsEnv(), Get-InvokeSeparator(), Get-NormalizedPriority(), Get-Python3Command(), Get-RepoRoot() (+9 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (24): name, runs-on, steps, concurrency, cancel-in-progress, group, name, runs-on (+16 more)

### Community 8 - "Community 8"
Cohesion: 0.17
Nodes (15): vitest@^5.1.1, vitest, BoardCanvas(), isEditable(), nodeTypes, radialOffsets(), RadialItem, RadialMenu() (+7 more)

### Community 9 - "Community 9"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+10 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 11 - "Community 11"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 12 - "Community 12"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 13 - "Community 13"
Cohesion: 0.40
Nodes (4): scripts, command, name, triggers

## Knowledge Gaps
- **1 isolated node(s):** `swarmify`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 147 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Community 1` to `Community 0`, `Community 8`, `Community 3`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `swarmify` to the rest of the system?**
  _1 weakly-connected nodes found - possible missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05585106382978723 - nodes in this community are weakly interconnected._
- **Why does `@xyflow/react` connect `Community 1` to `Community 0`, `Community 8`, `Community 3`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11616161616161616 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `Community 8` to `Community 0`, `Community 1`, `Community 3`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06755260243632337 - nodes in this community are weakly interconnected._