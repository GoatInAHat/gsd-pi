# Docs Audit

<!-- Written by the docs auditor (/gsd-path-inspect, docs-auditor role).
     Every verdict carries evidence; a verdict without evidence is a defect. -->

Repo root: /Users/jeremymcspadden/orca/workspaces/gsd-pi/path-fixes
Audited: 2026-08-22 (verify sidecar worktree pinned at e210e12a41df85b2f02e1de65a2afc37b348ba12, branch gsd-path-verify/inspect-docs, v1.16.1)
Alignment mode: no

## Summary

| Verdict | Count |
|---------|-------|
| verified | 212 |
| stale | 74 |
| aspirational | 0 |
| unverifiable | 12 |
| descriptive docs (no testable claims) | 854 |

Worst drift: src/resources/extensions/gsd/skills/gsd-headless/SKILL.md tells orchestrators "Exit codes: 0=complete, 1=error/timeout, 2=blocked", but the engine exits 10 for blocked and 11 for cancelled (src/headless-events.ts:29-30) — and the sibling gsd-orchestrator/SKILL.md:42 documents 10/11 correctly, so an orchestrator built on the bundled skill would never recognize a blocked run.

<!-- Conventions for this audit:
     - "catalog" = the /gsd command catalog, which moved from
       src/resources/extensions/gsd/catalog.ts (prior audit) to
       src/resources/extensions/gsd/commands/catalog.ts at this revision.
     - zh-CN and most gitbook/mintlify guide files are mirrors of an English
       source doc; their feature claims are verified once against code and the
       mirror rows cite that verification.
     - Vendored upstream docs under packages/pi-* keep upstream wording per the
       user's standing accept-drift ruling (see User rulings); their stale
       verdicts are recorded but suppressed from the remediation queue. -->

## Doc: .plans/api-key-manager.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Proposed /gsd keys command surface" | feature | verified | 'keys' in /gsd catalog (commands/catalog.ts:57,155) — plan implemented |

## Doc: .plans/autocomplete-qol-improvements.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "References packages/pi-coding-agent/src/modes/interactive/interactive-mode.ts" | structure | stale | ls packages/pi-coding-agent/src/ → no modes/ dir (bun, config.ts, core, index.ts, migrations.ts, resources, tests, theme, types, utils) |

## Doc: .plans/directory-safeguards.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Plan to block launches from dangerous directories ($HOME, /, etc.)" | feature | verified | implemented: src/resources/extensions/gsd/gsd-home.ts + src/resources/extensions/gsd/tests/gsd-root-home-guard.test.ts (test moved from tests/ since prior audit) |

## Doc: .plans/issue-125-provider-fallback.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "References packages/pi-coding-agent/src/cli/commands/settings.ts" | structure | stale | ls packages/pi-coding-agent/src/ → no cli/ dir at HEAD |

## Doc: .plans/issue-524-git2-migration.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "git2 crate already a dependency (vendored libgit2) with native read-only functions" | status | verified | native/crates/engine/Cargo.toml:43 git2 0.20 vendored-libgit2; bridge now at src/resources/extensions/gsd/native-git-bridge.ts (.ts, not the .d.ts the plan names) |

## Doc: .plans/left-native-tui-main-session-plan.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "References packages/pi-coding-agent/src/modes/interactive/interactive-mode.ts" | structure | stale | ls packages/pi-coding-agent/src/ → no modes/ dir at HEAD |

## Doc: .plans/onboarding-detection-wizard.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Phases 1/3/4/5 marked IMPLEMENTED" | status | verified | src/resources/extensions/gsd/tests/prefs-wizard-coverage.test.ts exists; wizard.ts present at src root |

## Doc: .plans/workflow-templates.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Status: In Progress — Phase 1" | status | stale | 'templates' ships in the /gsd catalog (commands/catalog.ts:87) and 24 template files exist under src/resources/extensions/gsd/workflow-templates/ |

## Doc: CHANGELOG.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Latest recorded release [1.16.1] - 2026-08-21" | status | verified | CHANGELOG.md:10 vs package.json:3 ("version": "1.16.1") — match |

## Doc: CONTEXT.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Runtime snapshot exports orchestration telemetry (orchestrationPhase, ...)" | feature | verified | src/resources/extensions/gsd/auto-runtime-state.ts:35,50 |
| "auto.ts now wires a concrete Auto Orchestration module through createWiredAutoOrchestrationModule(...)" | feature | stale | grep -rn createWiredAutoOrchestrationModule src/ → 0 hits; auto.ts:287-288 wires createAutoOrchestrator from ./auto/orchestrator.js |

## Doc: CONTRIBUTING.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Setup/day-to-day/verify commands (pnpm install --frozen-lockfile, secret-scan:install-hook, build, test, test:changed:src, verify:fast/pr/merge/full, audit:test-confidence, build:native:test)" | command | verified | package.json scripts — all present (node -e script check: none missing) |
| "CI enforces source-grep ban via scripts/check-source-grep-tests.sh" | feature | verified | scripts/check-source-grep-tests.sh exists |
| "Scope-area path table (packages/pi-*, mcp-server, src/resources/extensions/gsd/, native/, vscode-extension/, web/)" | structure | verified | ls — all present |
| "Extension SDK docs authoritative at docs/extension-sdk/" | structure | verified | docs/extension-sdk/ exists with 6 guides |
| "Recurring defect classes reference issue #4931" | integration | stale | gh issue view 4931 -R open-gsd/gsd-pi → 'Could not resolve to an issue or pull request with the number of 4931' (re-checked 2026-08-22) |

## Doc: README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Repository layout table (src/, packages/, native/, web/, docs/, scripts/)" | structure | verified | ls of repo root — all 6 paths present (table no longer lists apps//studio/, which are gone) |
| "Dev commands: pnpm install --frozen-lockfile / build / test / verify:fast / verify:pr / verify:merge" | command | verified | package.json scripts block — all present |
| "Latest release v1.16.1" | status | verified | package.json:3 version 1.16.1; npm view @opengsd/gsd-pi version → 1.16.1 |
| "gsd --web launches web mode" | feature | verified | src/cli.ts:110; src/cli-web-branch.ts:115-117 |
| "gsd upgrade command" | command | verified | src/resources/extensions/gsd/commands/handlers/ops.ts:286-287 |
| ".gsd-backups/migrate-* pruned after 30 days" | feature | verified | src/resources/extensions/gsd/flat-phase-migration.ts:384 FLAT_PHASE_BACKUP_RETENTION_MS = 30d |
| "cursor-agent default model composer-2.5; CURSOR_API_KEY supported" | config | verified | src/resources/extensions/cursor-cli/models.ts:22 model("composer-2.5", ...) |
| "Install via npx @opengsd/gsd-pi@latest" | command | verified | npm view @opengsd/gsd-pi version → 1.16.1 (package published) |
| "GSD Pi web configurator at https://pi.opengsd.net/" | integration | verified | carried per user ruling (queue #7): URL fetched live 2026-08-01, serves the cloud config editor |

## Doc: docker/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Image/compose file table (Dockerfile.sandbox, Dockerfile.ci-builder, docker-compose.yaml, docker-compose.full.yaml)" | structure | verified | ls docker/ — all four present (plus bootstrap.sh, entrypoint.sh) |
| "Requires Docker Desktop 4.58+" | config | unverifiable | external product requirement; not checkable from repo |

## Doc: docs/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "User/dev/SDK guide link tables" | structure | verified | all 30 relative links resolve to files present at HEAD (spot-verified against inventory) |
| "Release Notes link described as 'Current 1.2.0 release notes'" | status | stale | docs/README.md:37; package.json:3 and CHANGELOG.md:10 are at 1.16.1 |

## Doc: docs/agents/domain.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Single-context layout: CONTEXT.md at root, ADR-*.md in docs/dev/" | structure | verified | ls — CONTEXT.md and 48 docs/dev/ADR-*.md present |

## Doc: docs/agents/issue-tracker.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Issue tracker is GitHub open-gsd/gsd-pi via gh -R" | integration | verified | gh label list -R open-gsd/gsd-pi succeeded 2026-08-22 (auth + repo resolve) |

## Doc: docs/agents/triage-labels.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Five canonical labels map 1:1 to tracker labels" | config | verified | gh label list -R open-gsd/gsd-pi → needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix all exist (2026-08-22) |
| "ready-for-agent / ready-for-human / wontfix 'will be created on first use'" | status | stale | gh label list → all three already exist with the documented descriptions; the gh label create block (triage-labels.md:18-20) is unnecessary |

## Doc: docs/db-map.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "DB stack files: bootstrap/db-tools.ts, tools/workflow-tool-executors.ts, gsd-db.ts, db/engine.ts, db/domain-operation.ts" | structure | verified | ls src/resources/extensions/gsd/ — all five present |

## Doc: docs/dev/ADR-004-capability-aware-model-routing.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Status: Accepted (landed under different names — capability scoring lives in core model-router.ts / auto-model-selection.ts)" | status | verified | src/resources/extensions/gsd/model-router.ts and auto-model-selection.ts exist at HEAD; label was downgraded per user ruling (queue 11-15) |

## Doc: docs/dev/ADR-008-gsd-tools-over-mcp-for-provider-parity.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Status: Accepted (implemented) — GSD tools over MCP" | status | verified | packages/mcp-server exists (@opengsd/mcp-server 1.16.1, bin gsd-mcp-server at package.json:45) |

## Doc: docs/dev/ADR-009-orchestration-kernel-refactor.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Status: Accepted (landed under different names — src/resources/extensions/gsd/uok/ modules; superseded by ADR-046)" | status | verified | ls src/resources/extensions/gsd/uok/ → audit.ts, contracts.ts, dispatch-envelope.ts, execution-graph.ts, ... present; docs/dev/ADR-046-*.md exists |

## Doc: docs/dev/ADR-010-pi-clean-seam-architecture.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Status: Accepted (Phase 1 implemented) — @gsd/agent-core + @gsd/agent-modes seam packages" | status | verified | packages/gsd-agent-core and packages/gsd-agent-modes exist; scripts/apply-seam.cjs exists |

## Doc: docs/dev/ADR-011-progressive-planning-escalation.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Status: Accepted (partially landed — Phase 1 sketch planning and Phase 2 escalation verified at HEAD)" | status | verified | src/resources/extensions/gsd/prompts/sketch.md exists (Phase 1 sketch); planning-depth.ts + guided-flow.ts:2133 deep-escalation wiring present |

## Doc: docs/dev/ADR-013-memory-store-consolidation.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Status: Accepted (partially landed — Phases 0-6 cutover verified at HEAD; decisions table drop outstanding)" | status | verified | src/resources/extensions/gsd/parsers-legacy.ts no longer exists (cutover landed); state-db-cutover docs record the milestone |

## Doc: docs/dev/ADR-020-cloud-mcp-gateway-local-runtime.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Status: Superseded (2026-08-10) — cloud gateway/standalone cloud agent/monitor retired from this repository" | status | verified | grep -rln 'gsd-cloud\|cloud-runtime\|CloudRuntime' packages/ src/ (non-test) → 0 hits; remaining packages/daemon is the Discord-integration daemon, not the gateway |

## Doc: docs/dev/ADR-036-tool-surface-readiness.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Status: Accepted (partially landed — runtime readiness gate, tool-unavailable recovery kind, ...)" | status | verified | "tool-unavailable" recovery kind at src/resources/extensions/gsd/recovery-classification.ts:19,103 |

## Doc: docs/dev/ADR-047-auto-mode-liveness-backstop.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Status: Accepted — every blocked state has a reachable exit (liveness backstop)" | status | verified | src/resources/extensions/gsd/auto-liveness-backstop.ts exists; resume-wedge flow in auto.ts and commands/handlers/auto.ts; acceptance bed classifier cites its notices (tests/acceptance-bed/README.md cross-check) |

## Doc: docs/dev/ADR-048-unitrun-dispatch-row.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Status: Accepted — UnitRun is the claimed unit_dispatches row" | status | verified | UnitRun type at src/resources/extensions/gsd/auto/unit-run.ts (also unit-runtime.ts); unit_dispatches table at db-coordination-schema.ts:40 |

## Doc: docs/dev/architecture.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "System structure: loader.ts → cli.ts, extensions/gsd core, agents/ (scout, researcher, worker), GSD-WORKFLOW.md" | structure | verified | ls src/resources/ — GSD-WORKFLOW.md, agents/ (13 agents incl. scout/researcher/worker), extensions/ present; src/loader.ts, src/cli.ts confirmed |
| "'22 supporting extensions'" | structure | verified | 24 extension dirs total; 22 excluding gsd core and shared lib — consistent |
| "gsd headless / gsd --mode mcp entry modes" | feature | verified | src/headless.ts; src/cli.ts:113 |

## Doc: docs/dev/ci-cd-pipeline.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "npm publishing lives in the manual npm-publish.yml workflow; dist-tags only advance when a maintainer runs NPM Publish ('Do not wait for a dist-tag to move on its own — it will not')" | feature | verified | .github/workflows/pipeline.yml header: 'npm publishing lives in one trusted manual workflow (npm-publish.yml)'; pipeline.yml only rebuilds the CI builder image; npm-publish.yml is workflow_dispatch. Doc rewritten since prior audit — former stale auto-promotion and test:fixtures claims removed (grep 'fixtures' docs/dev/ci-cd-pipeline.md → no matches) |

## Doc: docs/dev/extending-pi/03-getting-started.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Extension sample imports ExtensionAPI from @gsd/pi-coding-agent" | config | verified | matches packages/pi-coding-agent/package.json name |
| "Uses `pi` CLI in examples (e.g. pi -e ./my-extension.ts)" | command | stale | no `pi` bin in any package.json; binary is `gsd` (package.json bin: gsd, gsd-cli, gsd-pi) |

## Doc: docs/dev/extending-pi/06-the-extension-lifecycle.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses `pi` CLI in examples (e.g. pi -e ./my-extension.ts)" | command | stale | no `pi` bin in any package.json; binary is `gsd` |

## Doc: docs/dev/extending-pi/10-custom-tools-giving-the-llm-new-abilities.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses `pi` CLI in examples (e.g. pi -e ./my-extension.ts)" | command | stale | no `pi` bin in any package.json; binary is `gsd` |

## Doc: docs/dev/extending-pi/19-packaging-distribution.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses `pi` CLI in examples (e.g. pi -e ./my-extension.ts)" | command | stale | no `pi` bin in any package.json; binary is `gsd` |

## Doc: docs/dev/lifecycle-command-integration-runbook.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Gate commands incl. node scripts/m003-s07-cutover-dossier.mjs, baseline:workflow-authority, baseline:refactor:gate, test:changed:src" | command | verified | scripts/m003-s07-cutover-dossier.mjs exists; all pnpm scripts present in package.json |

## Doc: docs/dev/pi-upstream.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Pinned upstream ref v0.75.5, scope @earendil-works, package map" | config | verified | scripts/pi-upstream.json pinnedRef 'v0.75.5', npmScope '@earendil-works', packageMap present |
| "Vendor/verify commands: build:pi, verify:pi-boundary, verify:pi-patches, test:pi-claude-schemas, test:smoke, vendor-pi*.cjs, apply-seam.cjs" | command | verified | package.json scripts present; scripts/vendor-pi.cjs, vendor-pi-deps.cjs, vendor-pi-coding-agent-core.cjs, apply-seam.cjs all exist |
| "Protected packages gsd-agent-core / gsd-agent-modes" | structure | verified | packages/gsd-agent-core, packages/gsd-agent-modes exist |

## Doc: docs/dev/proposals/698-browser-tools-feature-additions.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Status: Shipped — implemented tools incl. browser_save_pdf, browser_mock_route" | status | verified | src/resources/extensions/browser-tools/tools/pdf.ts, network-mock.ts exist; listed in extension-manifest.json:26-27 |

## Doc: docs/dev/proposals/rfc-database-authoritative-workflow-refactor.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Status: Accepted (2026-07-11), ADR-046 accepted" | status | verified | docs/dev/ADR-046-*.md present; DB-authoritative vocabulary in code (db/engine.ts:163 SCHEMA_VERSION = 48, db-coordination-schema.ts) |

## Doc: docs/dev/proposals/workflows/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Scaffold workflows create-release.yml / sync-next.yml / backmerge.yml present for review" | structure | verified | ls docs/dev/proposals/workflows/ — all three yml files present |

## Doc: docs/dev/refactor-baseline-runbook.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "npm run baseline:refactor / baseline:refactor:gate / baseline:workflow-authority" | command | verified | package.json scripts present; scripts/refactor-baseline.mjs, workflow-authority-baseline.mjs exist |

## Doc: docs/dev/refactor-foundation-runbook.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "verify:merge, typecheck:extensions, baseline:workflow-authority commands" | command | verified | package.json scripts — present |

## Doc: docs/dev/superpowers/plans/2026-03-17-cicd-pipeline.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Plan targets tests/fixtures/* replay harness and an auto Dev→Prod promotion pipeline" | structure | stale | tests/fixtures/ absent; .github/workflows/pipeline.yml is CI-builder-only; publishing manual via npm-publish.yml (docs/dev/ci-cd-pipeline.md now documents this correctly) |

## Doc: docs/dev/superpowers/specs/2026-05-27-installer-redesign-design.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Status: Approved (design review); npx @opengsd/gsd-pi@latest[ --yes] installer flow" | status | verified | scripts/install.js is the package bin gsd-pi; npm view @opengsd/gsd-pi → 1.16.1 published |

## Doc: docs/dev/test-confidence-stack.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "audit:test-confidence / audit:test-gaps / audit:test-matrix commands" | command | verified | package.json scripts — all present |

## Doc: docs/dev/tool-schema-authoring.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "npm run test:pi-claude-schemas / verify:pi-patches gates" | command | verified | package.json scripts — present |

## Doc: docs/dev/uat-process.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "UAT spec classified through src/resources/extensions/gsd/uat-policy.ts; results saved via gsd_uat_result_save" | feature | verified | uat-policy.ts exists; gsd_uat_result_save referenced in auto-dispatch.ts, auto-post-unit.ts, guidance.ts |

## Doc: docs/dev/what-is-pi/01-what-pi-is.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses `pi` as the CLI binary in command examples" | command | stale | no `pi` bin in any package.json (binary renamed `gsd`) |

## Doc: docs/dev/what-is-pi/03-the-four-modes-of-operation.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses `pi` as the CLI binary in command examples" | command | stale | no `pi` bin in any package.json (binary renamed `gsd`) |

## Doc: docs/dev/what-is-pi/06-tools-how-pi-acts-on-the-world.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses `pi` as the CLI binary in command examples" | command | stale | no `pi` bin in any package.json (binary renamed `gsd`) |

## Doc: docs/dev/what-is-pi/10-providers-models-multi-model-by-default.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses `pi` as the CLI binary in command examples" | command | stale | no `pi` bin in any package.json (binary renamed `gsd`) |

## Doc: docs/dev/what-is-pi/13-context-files-project-instructions.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses `pi` as the CLI binary in command examples" | command | stale | no `pi` bin in any package.json (binary renamed `gsd`) |

## Doc: docs/dev/what-is-pi/14-the-sdk-rpc-embedding-pi.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses `pi` as the CLI binary in command examples" | command | stale | no `pi` bin in any package.json (binary renamed `gsd`) |

## Doc: docs/dev/what-is-pi/15-pi-packages-the-ecosystem.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses `pi` as the CLI binary in command examples" | command | stale | no `pi` bin in any package.json (binary renamed `gsd`) |

## Doc: docs/dev/what-is-pi/17-file-reference-all-documentation.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Lists docs/what-is-pi/19-... and docs/session.md under the installed package root" | structure | stale | repo has docs/dev/what-is-pi/ (not docs/what-is-pi/) and packages/pi-coding-agent/docs/sessions.md + session-format.md (no docs/session.md) |

## Doc: docs/dev/what-is-pi/18-quick-reference-commands-shortcuts.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses `pi` as the CLI binary in command examples" | command | stale | no `pi` bin in any package.json (binary renamed `gsd`) |

## Doc: docs/dev/what-is-pi/19-building-branded-apps-on-top-of-pi.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses @gsd/pi-coding-agent scope in install examples" | config | verified | matches packages/pi-coding-agent/package.json name |
| "References packages/coding-agent/* and packages/web-ui/README.md" | structure | stale | upstream layout names; actual: packages/pi-coding-agent/* (docs/sdk.md exists there), no packages/web-ui |

## Doc: docs/extension-sdk/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Quick-start manifest tier 'community' + provides.tools shape" | config | verified | matches docs/extension-sdk/manifest-spec.md field table and src/extension-registry.ts:58 isManifest checks |

## Doc: docs/extension-sdk/manifest-spec.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "readManifest() in src/extension-registry.ts; isManifest() validates id/name/version/tier" | feature | verified | src/extension-registry.ts:58 isManifest, :160 readManifest |

## Doc: docs/extension-sdk/rules.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "StringEnum exported from @gsd/pi-ai" | feature | verified | packages/pi-ai/src/utils/typebox-helpers.ts:14 export function StringEnum |

## Doc: docs/prompt-db-combined-map.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "DISPATCH_RULES has 29 rules" | structure | stale | counted unitType entries inside DISPATCH_RULES (auto-dispatch.ts) → 31 at HEAD (was 28 at prior audit; doc not updated either way) |

## Doc: docs/prompt-map.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Prompt pipeline files: auto.ts, auto-dispatch.ts (DISPATCH_RULES), auto-prompts.ts, prompt-loader.ts" | structure | verified | ls src/resources/extensions/gsd/ — all present |

## Doc: docs/superpowers/plans/2026-06-21-gsd-core-pi-backwards-compat.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "References docs/how-to/switching-between-gsd-tools.md" | structure | stale | actual location docs/user-docs/switching-between-gsd-tools.md (no docs/how-to/ dir) |

## Doc: docs/superpowers/specs/2026-06-21-gsd-core-pi-backwards-compat-design.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "References docs/how-to/switching-between-gsd-tools.md" | structure | stale | actual location docs/user-docs/switching-between-gsd-tools.md |

## Doc: docs/user-docs/auto-mode.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Auto-mode state machine, crash recovery, steering" | feature | verified | auto.ts, auto-dispatch.ts (DISPATCH_RULES), recovery-classification.ts present; /gsd auto in commands/catalog.ts:20 |

## Doc: docs/user-docs/captures-triage.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | /gsd capture and /gsd triage in commands/catalog.ts:20 |

## Doc: docs/user-docs/claude-code-auth-compliance.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | claude-code-cli extension present (src/resources/extensions/claude-code-cli/) |

## Doc: docs/user-docs/claude-code-subscription.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Claude Code CLI provider integration" | feature | verified | src/resources/extensions/claude-code-cli/ present with tests |
| "curl -fsSL https://claude.ai/install.sh \| bash installer" | command | unverifiable | third-party installer; not checkable from repo |

## Doc: docs/user-docs/commands.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Headless subcommands (auto, next, query, new-milestone, dispatch, recover) and CLI examples" | command | verified | src/headless.ts:126-131 isMultiTurnHeadlessCommand, :223 --context, :461 recover; headless-query.ts; commands/catalog.ts:20 command list |

## Doc: docs/user-docs/configuration.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Preferences/model/git/token-profile configuration surface" | config | verified | preferences-validation.ts, preferences.ts present (models-json-writer moved to packages/pi-coding-agent/src/core/); /gsd prefs\|config\|model in commands/catalog.ts:20 |

## Doc: docs/user-docs/cost-management.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | cost tracking surfaced via headless query .cost.total (headless-query.ts); /gsd usage in commands/catalog.ts:20 |

## Doc: docs/user-docs/custom-models.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "models.json schema, compat flags, overrides; gsd update --models" | config | verified | models-json-writer.ts + model-resolver.ts now at packages/pi-coding-agent/src/core/; /gsd update in commands/catalog.ts:20 |

## Doc: docs/user-docs/debug.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | /gsd debug and /gsd forensics in commands/catalog.ts:20 |

## Doc: docs/user-docs/dynamic-model-routing.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | model-resolver.ts, model-registry.ts, model-discovery.ts at packages/pi-coding-agent/src/core/; gsd-side model-router.ts present |

## Doc: docs/user-docs/eval-review.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | /gsd eval-review in commands/catalog.ts:20 |

## Doc: docs/user-docs/getting-started.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Node.js >= 22.18.0 prerequisite; npx/npm/pnpm install flows; gsd upgrade" | command | verified | package.json engines node >=22.18.0; src/runtime-checks.ts:12 MIN_NODE_VERSION; npm view @opengsd/gsd-pi → 1.16.1; upgrade alias at ops.ts:286 |

## Doc: docs/user-docs/git-strategy.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | worktree-safety.ts, worktree-placement.ts, native-git-bridge.ts present; getIsolationMode at preferences.ts:1229 |

## Doc: docs/user-docs/hooks.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | /gsd hooks and /gsd run-hook in commands/catalog.ts:20; lifecycle-hooks.ts at packages/pi-coding-agent/src/core/ and packages/gsd-agent-core/src/ |

## Doc: docs/user-docs/local-runtime-contract.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Project-local script/local-runtime/ discovery convention (runtime.mjs priority order)" | feature | verified | src/resources/extensions/gsd/runtime-contract.ts + tests/runtime-contract.test.ts (user-project convention, not a repo path) |

## Doc: docs/user-docs/migration.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | flat-phase-migration.ts implements .gsd migration incl. backup pruning (:384); legacy-import-preview-planning.ts covers .planning imports |

## Doc: docs/user-docs/multi-repo-workspace.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | repository-registry.ts present; ADR-044 per-repository git isolation |

## Doc: docs/user-docs/node-lts-macos.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Node 22.18.0 minimum / 24 LTS recommended" | config | verified | package.json engines node >=22.18.0; src/runtime-checks.ts:12 |

## Doc: docs/user-docs/parallel-orchestration.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | /gsd parallel in commands/catalog.ts:20; parallel-orchestrator.ts present |

## Doc: docs/user-docs/providers.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Provider setup flows incl. Ollama localhost:11434" | integration | verified | ollama extension dir present; provider implementations in packages/pi-ai/src/providers/ |

## Doc: docs/user-docs/remote-questions.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | src/resources/extensions/remote-questions/ present; /gsd remote in commands/catalog.ts:20 |

## Doc: docs/user-docs/skills.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Bundled skills, discovery, authoring" | feature | verified | src/resources/skills/ present (34 skill dirs); discovery in packages/pi-coding-agent/src/core/package-manager.ts |
| "npx skills add/check/update third-party CLI" | command | unverifiable | external tool (not in this repo's deps) |

## Doc: docs/user-docs/subagents.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | src/resources/extensions/subagent/ present with tests |

## Doc: docs/user-docs/switching-between-gsd-tools.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | compat-marker handling referenced by docs/superpowers specs; doc exists at this path |

## Doc: docs/user-docs/token-optimization.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | token optimization plans 035-039 marked DONE in plans/README.md; context-budget.ts present |

## Doc: docs/user-docs/troubleshooting.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Migration/uninstall command sequences (npm uninstall -g, pnpm add -g, npx installer)" | command | verified | package names match package.json / npm registry (npm view → 1.16.1); pnpm dlx flow matches package presence |

## Doc: docs/user-docs/visualizer.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | /gsd visualize in commands/catalog.ts:20 |

## Doc: docs/user-docs/web-interface.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "gsd --web [--host --port --allowed-origins]" | command | verified | src/cli.ts:110; src/cli-web-branch.ts:29-35,115-117 (--host/--port/--allowed-origins/--no-auth) |

## Doc: docs/user-docs/working-in-teams.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | team mode validated in preferences-validation.ts (solo\|team) |

## Doc: docs/zh-CN/user-docs/auto-mode.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Simplified-Chinese mirror of docs/user-docs/auto-mode.md (claims inherit the English verdicts)" | feature | verified | parity spot-check: zh getting-started matches English Node 22.18.0/install claims; docs/zh-CN/README.md disclaims English priority |

## Doc: docs/zh-CN/user-docs/captures-triage.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Simplified-Chinese mirror of docs/user-docs/captures-triage.md" | feature | verified | same parity spot-check as zh-CN auto-mode |

## Doc: docs/zh-CN/user-docs/claude-code-auth-compliance.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Simplified-Chinese mirror of docs/user-docs/claude-code-auth-compliance.md" | feature | verified | same parity spot-check as zh-CN auto-mode |

## Doc: docs/zh-CN/user-docs/commands.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Simplified-Chinese mirror of docs/user-docs/commands.md" | feature | verified | same parity spot-check as zh-CN auto-mode |
| "`gsd --debug` top-level flag enables diagnostic logging (line 266)" | command | stale | no --debug parsing in src/cli.ts / src/cli-web-branch.ts; --debug exists only as a /gsd auto flag |

## Doc: docs/zh-CN/user-docs/configuration.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Simplified-Chinese mirror of docs/user-docs/configuration.md" | feature | verified | same parity spot-check as zh-CN auto-mode |

## Doc: docs/zh-CN/user-docs/cost-management.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Simplified-Chinese mirror of docs/user-docs/cost-management.md" | feature | verified | same parity spot-check as zh-CN auto-mode |

## Doc: docs/zh-CN/user-docs/custom-models.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Simplified-Chinese mirror of docs/user-docs/custom-models.md" | feature | verified | same parity spot-check as zh-CN auto-mode |

## Doc: docs/zh-CN/user-docs/debug.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Simplified-Chinese mirror of docs/user-docs/debug.md" | feature | verified | same parity spot-check as zh-CN auto-mode |

## Doc: docs/zh-CN/user-docs/dynamic-model-routing.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Simplified-Chinese mirror of docs/user-docs/dynamic-model-routing.md" | feature | verified | same parity spot-check as zh-CN auto-mode |

## Doc: docs/zh-CN/user-docs/getting-started.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Simplified-Chinese mirror of docs/user-docs/getting-started.md (Node 22.18.0, install flows)" | command | verified | zh text matches English claims; package.json engines node >=22.18.0; npm view → 1.16.1 |

## Doc: docs/zh-CN/user-docs/git-strategy.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Simplified-Chinese mirror of docs/user-docs/git-strategy.md" | feature | verified | same parity spot-check as zh-CN auto-mode |

## Doc: docs/zh-CN/user-docs/migration.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Simplified-Chinese mirror of docs/user-docs/migration.md" | feature | verified | same parity spot-check as zh-CN auto-mode |

## Doc: docs/zh-CN/user-docs/node-lts-macos.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Simplified-Chinese mirror of docs/user-docs/node-lts-macos.md" | config | verified | same parity spot-check as zh-CN auto-mode |

## Doc: docs/zh-CN/user-docs/parallel-orchestration.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Simplified-Chinese mirror of docs/user-docs/parallel-orchestration.md" | feature | verified | same parity spot-check as zh-CN auto-mode |

## Doc: docs/zh-CN/user-docs/providers.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Simplified-Chinese mirror of docs/user-docs/providers.md" | feature | verified | same parity spot-check as zh-CN auto-mode |

## Doc: docs/zh-CN/user-docs/remote-questions.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Simplified-Chinese mirror of docs/user-docs/remote-questions.md" | feature | verified | same parity spot-check as zh-CN auto-mode |

## Doc: docs/zh-CN/user-docs/skills.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Simplified-Chinese mirror of docs/user-docs/skills.md" | feature | verified | same parity spot-check as zh-CN auto-mode |

## Doc: docs/zh-CN/user-docs/token-optimization.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Simplified-Chinese mirror of docs/user-docs/token-optimization.md" | feature | verified | same parity spot-check as zh-CN auto-mode |

## Doc: docs/zh-CN/user-docs/troubleshooting.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Simplified-Chinese mirror of docs/user-docs/troubleshooting.md" | feature | verified | same parity spot-check as zh-CN auto-mode |

## Doc: docs/zh-CN/user-docs/visualizer.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Simplified-Chinese mirror of docs/user-docs/visualizer.md" | feature | verified | same parity spot-check as zh-CN auto-mode |

## Doc: docs/zh-CN/user-docs/web-interface.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Simplified-Chinese mirror of docs/user-docs/web-interface.md" | feature | verified | same parity spot-check as zh-CN auto-mode |

## Doc: docs/zh-CN/user-docs/working-in-teams.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Simplified-Chinese mirror of docs/user-docs/working-in-teams.md" | feature | verified | same parity spot-check as zh-CN auto-mode |

## Doc: gitbook/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Install + first-run commands" | command | verified | npx @opengsd/gsd-pi@latest published (npm view → 1.16.1); gsd bin in package.json |

## Doc: gitbook/SUMMARY.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "All linked pages exist" | structure | verified | every linked .md path resolves to a file at HEAD (scripted check: no MISSING lines) |

## Doc: gitbook/configuration/providers.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Provider setup via gsd config" | command | verified | /gsd config in commands/catalog.ts:20,56; provider implementations in packages/pi-ai/src/providers/ |

## Doc: gitbook/features/captures.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | mirrors docs/user-docs/captures-triage.md verified in this audit (commands/catalog.ts:20) |

## Doc: gitbook/features/cost-management.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | mirrors docs/user-docs/cost-management.md verified in this audit |

## Doc: gitbook/features/debug.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | mirrors docs/user-docs/debug.md verified in this audit |

## Doc: gitbook/features/dynamic-model-routing.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | mirrors docs/user-docs/dynamic-model-routing.md verified in this audit |

## Doc: gitbook/features/github-sync.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "GitHub sync feature with gh auth" | integration | verified | src/resources/extensions/github-sync/ present; gh CLI usage standard |

## Doc: gitbook/features/headless.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Headless mode commands incl. --json, new-milestone, query, gsd --mode mcp" | command | verified | src/headless.ts:194-245 flag parsing; src/cli.ts:113 (--mode mcp) |

## Doc: gitbook/features/parallel.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | mirrors docs/user-docs/parallel-orchestration.md verified in this audit |

## Doc: gitbook/features/remote-questions.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | mirrors docs/user-docs/remote-questions.md verified in this audit |

## Doc: gitbook/features/skills.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Skills feature" | feature | verified | src/resources/skills/ present (34 skill dirs) |
| "npx skills add/check/update third-party CLI" | command | unverifiable | external tool |

## Doc: gitbook/features/teams.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | mirrors docs/user-docs/working-in-teams.md verified in this audit |

## Doc: gitbook/features/token-optimization.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | mirrors docs/user-docs/token-optimization.md verified in this audit |

## Doc: gitbook/features/visualizer.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Documented feature exists in code" | feature | verified | mirrors docs/user-docs/visualizer.md verified in this audit |

## Doc: gitbook/features/web-interface.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "gsd --web" | command | verified | src/cli.ts:110; src/cli-web-branch.ts:115-117 |

## Doc: gitbook/features/workflow-templates.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Workflow templates feature" | feature | verified | 'templates' in /gsd command catalog (commands/catalog.ts:87) |

## Doc: gitbook/getting-started/first-project.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "gsd, gsd --continue/-c, gsd sessions commands" | command | verified | src/cli-web-branch.ts:90 (--continue\|-c); src/cli.ts:375 ('sessions') |

## Doc: gitbook/getting-started/installation.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Install flows (npx/npm/pnpm), gsd config, gsd --web, gsd-cli alias" | command | verified | package.json bins gsd + gsd-cli; src/cli.ts:110; npm view → 1.16.1 |

## Doc: gitbook/reference/cli-flags.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Core flags: --continue/-c, --model, --thinking, --web, --worktree/-w, --no-session, --extension, --append-system-prompt, --tools, --print/-p, --mode, sessions, --session, --session-dir, --list-models, headless --max-restarts" | command | verified | each flag grep-verified in src/cli.ts / src/cli-web-branch.ts:88-146 / src/headless.ts:231 |
| "`gsd --debug` top-level flag enables diagnostic logging (line 19)" | command | stale | no --debug parsing in src/cli.ts / src/cli-web-branch.ts; --debug exists only as a /gsd auto flag |

## Doc: gitbook/reference/commands.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Command reference mirrors user-docs/commands.md" | command | verified | commands/catalog.ts:20 + headless.ts verified for English counterpart |

## Doc: gitbook/reference/troubleshooting.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Recovery command sequences" | command | verified | package names/registry verified (npm view → 1.16.1); schema-version example is illustrative text, not a version claim (actual SCHEMA_VERSION=48, db/engine.ts:163) |

## Doc: gsd-orchestrator/SKILL.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Headless flags-before-command contract, JSON to stdout, exit codes 0/1/10/11" | feature | verified | src/headless-events.ts:29-30 EXIT_BLOCKED=10, EXIT_CANCELLED=11; src/headless.ts flag parsing; matches engine reality (contrast: bundled gsd-headless skill says 2=blocked — see its Doc section) |

## Doc: gsd-orchestrator/references/answer-injection.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "--answers file injection flow" | command | verified | src/headless.ts:237 --answers parsing; src/headless-answers.ts present |

## Doc: gsd-orchestrator/references/commands.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Global flags (--output-format, --bare, --resume, --timeout, --supervised, --answers, --events) and workflow commands (auto, next, new-milestone, dispatch <phase>)" | command | verified | src/headless.ts:194-245, 96-97; headless-query.ts dispatch action |

## Doc: gsd-orchestrator/references/json-result.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "query JSON shape (.state.phase, .cost.total); --resume" | command | verified | src/headless.ts:96 --resume option, query handling; headless-query.ts |

## Doc: gsd-orchestrator/workflows/build-from-spec.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Spec → headless new-milestone --auto workflow" | command | verified | src/headless.ts new-milestone handling; HEADLESS_CHAIN_AUTO_FLAG consumed in commands/handlers/workflow.ts:596 |

## Doc: gsd-orchestrator/workflows/monitor-and-poll.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "query polling, steer, stop, --answers resume flows" | command | verified | headless-events.ts:266 QUICK_COMMANDS incl. steer/stop; /gsd steer in commands/catalog.ts:20 |

## Doc: gsd-orchestrator/workflows/step-by-step.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "next/skip/undo --force/dispatch step loop" | command | verified | QUICK_COMMANDS incl. skip/undo; headless.ts:128 next |

## Doc: integrations/hermes/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "gsd hermes install --project <dir> installer command" | command | verified | src/cli.ts:261-264 hermes subcommand → hermes-integration-install.js |
| "Manual dev path pip install -e integrations/hermes" | command | verified | integrations/hermes/ package tree present with plugin.yaml |

## Doc: integrations/hermes/docs/setup.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "gsd read progress --json and npm run build:core usage" | command | verified | 'read' command at src/cli.ts:384,521; build:core in package.json |

## Doc: mintlify-docs/getting-started.mdx

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Requires Node.js 22.18+ and Git; npx @opengsd/gsd-pi@latest install" | command | verified | package.json engines node >=22.18.0; runtime-checks.ts + loader.ts:38-45 enforce node+git at startup; npm view → 1.16.1 |

## Doc: mintlify-docs/guides/auto-mode.mdx

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Mintlify mirror of the auto-mode guide (state machine, steer, pause/stop)" | feature | verified | /gsd steer, auto, stop, pause in commands/catalog.ts:20; auto.ts engine present |

## Doc: mintlify-docs/guides/captures-triage.mdx

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Mintlify mirror of docs/user-docs/captures-triage.md" | feature | verified | English counterpart verified in this audit (commands/catalog.ts:20) |

## Doc: mintlify-docs/guides/change-management.mdx

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "/gsd quick executes immediately with atomic commit; sealed completed units" | feature | verified | /gsd quick in commands/catalog.ts:20 and commands/handlers/workflow.ts:583-586 |

## Doc: mintlify-docs/guides/commands.mdx

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Headless commands (auto, next, query, recover, new-milestone --context --auto) and flags (--json, --timeout)" | command | verified | src/headless.ts:126-131,194-245,461; --context at :223 |
| "/gsd new-milestone [--deep] opts into deep planning mode" | feature | verified | commands/handlers/workflow.ts:588-595 handles new-milestone --deep → setPlanningDepth(basePath, "deep") |

## Doc: mintlify-docs/guides/configuration.mdx

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Mintlify mirror of docs/user-docs/configuration.md" | config | verified | English counterpart verified in this audit |

## Doc: mintlify-docs/guides/cost-management.mdx

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Mintlify mirror of docs/user-docs/cost-management.md" | feature | verified | English counterpart verified in this audit |

## Doc: mintlify-docs/guides/custom-models.mdx

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Mintlify mirror of docs/user-docs/custom-models.md" | config | verified | English counterpart verified in this audit |

## Doc: mintlify-docs/guides/debug.mdx

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Mintlify mirror of docs/user-docs/debug.md" | feature | verified | English counterpart verified in this audit |

## Doc: mintlify-docs/guides/dynamic-model-routing.mdx

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Mintlify mirror of docs/user-docs/dynamic-model-routing.md" | feature | verified | English counterpart verified in this audit |

## Doc: mintlify-docs/guides/git-strategy.mdx

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Default git.isolation mode is none; worktree requires explicit opt-in" | config | verified | preferences.ts:1225-1238 getIsolationMode — 'Default is "none"', worktree opt-in |
| "Changed in v2.45.0: default isolation changed from worktree to none" | status | stale | no v2.45.x exists in this repo's history/tags (baseline restarted at 1.0.0; current 1.16.1) — version label carried over from pre-baseline versioning; the behavioral claim itself is true |

## Doc: mintlify-docs/guides/migration.mdx

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Migrate .planning directories from GSD v1 (gsd-core) to gsd-pi's .gsd format" | feature | verified | src/resources/extensions/gsd/legacy-import-preview-planning.ts:40-41 handles .planning/ROADMAP.md and .planning/milestones/* |

## Doc: mintlify-docs/guides/parallel-orchestration.mdx

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Mintlify mirror of docs/user-docs/parallel-orchestration.md" | feature | verified | English counterpart verified in this audit |

## Doc: mintlify-docs/guides/remote-questions.mdx

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Mintlify mirror of docs/user-docs/remote-questions.md" | feature | verified | English counterpart verified in this audit |

## Doc: mintlify-docs/guides/skills.mdx

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Mintlify mirror of docs/user-docs/skills.md" | feature | verified | English counterpart verified in this audit |

## Doc: mintlify-docs/guides/token-optimization.mdx

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Mintlify mirror of docs/user-docs/token-optimization.md" | feature | verified | English counterpart verified in this audit |

## Doc: mintlify-docs/guides/troubleshooting.mdx

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "GSD checks Node.js >= 22.18.0 and git availability at startup" | feature | verified | src/loader.ts:38-45 + src/runtime-checks.ts:12, checkNodeVersion + gitAvailableOnPath |
| "Worktree isolation changed default in v2.45.0 / 'GSD v2.45+' (lines 202-215)" | status | stale | no v2.45.x exists in this repo's versioning (baseline restarted at 1.0.0; current 1.16.1) |

## Doc: mintlify-docs/guides/visualizer.mdx

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Mintlify mirror of docs/user-docs/visualizer.md" | feature | verified | English counterpart verified in this audit |

## Doc: mintlify-docs/guides/web-interface.mdx

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "gsd --web --host --port --allowed-origins --no-auth; GSD_WEB_ALLOW_UNAUTHENTICATED_LAN=1" | command | verified | src/cli-web-branch.ts:29-35,115-117; GSD_WEB_ALLOW_UNAUTHENTICATED_LAN read in src/web-mode.ts |

## Doc: mintlify-docs/guides/working-in-teams.mdx

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Mintlify mirror of docs/user-docs/working-in-teams.md" | feature | verified | English counterpart verified in this audit |

## Doc: mintlify-docs/introduction.mdx

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Work hierarchy Milestone → Slice → Task; auto mode loop Plan → Execute → Complete → Reassess" | feature | verified | milestone/slice/task domain in db schema (db/engine.ts) and dispatch pipeline (auto-dispatch.ts DISPATCH_RULES); reassess in /gsd dispatch phases (gsd-orchestrator/references/commands.md cross-check) |

## Doc: native/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "npm run build:native / build:native:dev / test:native; crates engine/grep/ast" | command | verified | package.json scripts present; native/crates/{engine,grep,ast} exist; git2 0.20 vendored in engine/Cargo.toml:43 |

## Doc: packages/mcp-server/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "npm install @opengsd/mcp-server / npx gsd-mcp-server" | command | verified | packages/mcp-server/package.json name @opengsd/mcp-server, bin gsd-mcp-server (:45); npm view @opengsd/mcp-server → 1.16.1 |

## Doc: packages/pi-agent-core/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Titles and install/import examples use @earendil-works/pi-agent-core" | config | stale | package.json name is @gsd/pi-agent-core; README is vendored upstream content (docs/dev/pi-upstream.md overlay policy) — accept-drift per user ruling, suppressed from queue |

## Doc: packages/pi-agent-core/docs/agent-harness.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "npm run test:harness / coverage:harness" | command | verified | packages/pi-agent-core/package.json scripts include test:harness, coverage:harness |
| "References packages/agent/test/harness/* and src/harness/env/nodejs.ts" | structure | stale | actual: packages/pi-agent-core/test/harness/* and packages/pi-agent-core/src/harness/env/nodejs.ts (upstream path names) — accept-drift per user ruling, suppressed from queue |

## Doc: packages/pi-agent-core/docs/observability.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Refers to packages/ai and packages/agent" | structure | stale | actual packages are pi-ai and pi-agent-core (upstream names) — accept-drift per user ruling, suppressed from queue |

## Doc: packages/pi-ai/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Titles and install/import examples use @earendil-works/pi-ai" | config | stale | package.json name is @gsd/pi-ai; vendored upstream content — accept-drift per user ruling, suppressed from queue |

## Doc: packages/pi-coding-agent/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Titles and install/import examples use @earendil-works/pi-coding-agent" | config | stale | package.json name is @gsd/pi-coding-agent; vendored upstream content — accept-drift per user ruling, suppressed from queue |

## Doc: packages/pi-coding-agent/docs/compaction.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc (pi-upstream.md overlay policy); fork reality: `gsd` bin, ~/.gsd/, @gsd/* scopes — accept-drift per user ruling, suppressed from queue |

## Doc: packages/pi-coding-agent/docs/custom-provider.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/development.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/extensions.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/index.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/json.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/keybindings.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/models.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/packages.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/prompt-templates.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/providers.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/quickstart.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/rpc.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/sdk.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/session-format.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/sessions.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/settings.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/shell-aliases.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/skills.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/terminal-setup.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/termux.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/themes.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/tui.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/usage.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/docs/windows.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Uses upstream `pi` binary / ~/.pi/ paths / @earendil-works scope" | command | stale | vendored upstream doc; fork reality: gsd bin, ~/.gsd/, @gsd/* — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/examples/extensions/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Upstream `pi`/`~/.pi` references" | command | stale | vendored upstream doc; fork uses gsd/~/.gsd — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/examples/sdk/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Upstream scope/binary references" | command | stale | vendored upstream doc; fork uses @gsd/* and gsd — accept-drift, suppressed |

## Doc: packages/pi-coding-agent/test/suite/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Directs to faux provider at packages/ai/src/providers/faux.ts" | structure | stale | actual: packages/pi-ai/src/providers/faux.ts (packages/ai does not exist) — accept-drift, suppressed |

## Doc: packages/pi-tui/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Titles and install/import examples use @earendil-works/pi-tui" | config | stale | package.json name is @gsd/pi-tui; vendored upstream content — accept-drift per user ruling, suppressed from queue |

## Doc: packages/rpc-client/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "@opengsd/rpc-client with RpcClient class; types shared via @opengsd/contracts" | feature | verified | packages/rpc-client/package.json name @opengsd/rpc-client; packages/contracts present in workspace |

## Doc: plans/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Status table: plans 001-039 rows consistent with present files" | status | verified | table rows 001-039 match present plan files; lost-file note matches inventory gaps (018,019,021,023,024,027,029-031 absent) |
| "Index omits rows for plans 040-045" | status | stale | plans/040..045-*.md present in repo but absent from the README table (045 added since prior audit) |
| "Note says plan 032's file was lost and is NOT recoverable" | status | stale | plans/032-lean-mean-cleanup.md exists but with different scope than the lost 032 row — plan number reused |

## Doc: scripts/archive/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Archived scripts are unreferenced; listed files present" | structure | verified | ls scripts/archive/ — listed files present |

## Doc: scripts/ci_monitor.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "node scripts/ci_monitor.cjs <command> routing table" | command | verified | scripts/ci_monitor.cjs exists |

## Doc: src/resources/extensions/gsd/docs/COORDINATION.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "DB-backed coordination tables (workers, milestone_leases, unit_dispatches, cancellation_requests, command_queue) and runtime_kv rely on shared SQLite WAL" | feature | verified | CREATE TABLE statements at db-coordination-schema.ts:20,30,40,66,80 and db-runtime-kv-schema.ts:27 |
| "claimMilestoneLease, recordDispatchClaim, claimNextCommand locking primitives" | feature | verified | present in tools/workflow-tool-executors.ts, auto/workflow-dispatch-claim.ts, auto/loop.ts, auto/orchestrator.ts |

## Doc: src/resources/extensions/gsd/docs/claude-marketplace-import.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Interactive entry point /gsd prefs import-claude [global\|project]" | command | verified | commands-prefs-wizard.ts:238,243 handle import-claude [global\|project]; catalog entry at commands/catalog.ts:194 |

## Doc: src/resources/extensions/gsd/docs/preferences-reference.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "validatePreferences() in preferences.ts deletes empty arrays; always_use_skills key" | feature | verified | validatePreferences re-exported at preferences.ts:74 from preferences-validation.js; empty-array delete at preferences-validation.ts:287-288; always_use_skills at preferences.ts:891,1125 |

## Doc: src/resources/extensions/gsd/skills/gsd-headless/SKILL.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Flags: --timeout, --json, --model, --thinking, --resume, --bare, --verbose, --supervised, --response-timeout, --max-restarts, --answers, --events" | command | verified | src/headless.ts:96-97,194-245 flag parsing — all present |
| "Exit codes: 0=complete, 1=error/timeout, 2=blocked" | feature | stale | engine defines EXIT_BLOCKED=10, EXIT_CANCELLED=11 (src/headless-events.ts:29-30); no exit-2 path in src/headless.ts; sibling gsd-orchestrator/SKILL.md:42 documents 0/1/10/11 correctly — doc contradicts both code and sibling doc |

## Doc: src/resources/extensions/gsd/skills/gsd-headless/references/answer-injection.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "gsd headless --answers answers.json auto / new-milestone --context spec.md --auto; --answers + --supervised coexist" | command | verified | src/headless.ts:237 --answers parsing; src/headless-answers.ts present; --supervised at :245 |

## Doc: src/resources/extensions/gsd/skills/gsd-headless/references/commands.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Workflow/state/unit commands (auto, next, stop, pause, new-milestone, dispatch, discuss, query, status, visualize, history, codebase, skip, undo, steer, queue, capture, triage)" | command | verified | all present in commands/catalog.ts:20 and/or headless.ts:126-131; discard-milestone --orphan-only matches db/writers/orphan-milestone-discard.ts |

## Doc: src/resources/extensions/gsd/skills/gsd-headless/references/multi-session.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "File-based IPC via .gsd/parallel/; GSD_MILESTONE_LOCK and GSD_PARALLEL_WORKER env vars; per-worker worktrees" | feature | verified | GSD_MILESTONE_LOCK/GSD_PARALLEL_WORKER referenced in auto.ts, auto-start.ts, auto-post-unit.ts, dispatch-guard.ts; parallel-orchestrator.ts present |

## Doc: src/resources/skills/agent-browser/SKILL.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Bundled skill registered for browser automation" | feature | verified | listed in src/resources/extensions/gsd/skill-catalog.data.ts; covered by bundled-skill-triggers.test.ts |
| "agent-browser CLI workflow (open, snapshot -i, click/fill via @e refs)" | command | unverifiable | external third-party CLI, not in this repo's deps — not checkable from repo |

## Doc: src/resources/skills/agent-browser/references/authentication.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "agent-browser CLI usage (session/auth commands)" | command | unverifiable | external third-party CLI reference; not checkable from repo |

## Doc: src/resources/skills/agent-browser/references/commands.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "agent-browser CLI command reference" | command | unverifiable | external third-party CLI reference; not checkable from repo |

## Doc: src/resources/skills/agent-browser/references/profiling.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "agent-browser CLI usage (profiling commands)" | command | unverifiable | external third-party CLI reference; not checkable from repo |

## Doc: src/resources/skills/agent-browser/references/proxy-support.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "agent-browser CLI usage (proxy flags)" | command | unverifiable | external third-party CLI reference; not checkable from repo |

## Doc: src/resources/skills/agent-browser/references/session-management.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "agent-browser CLI usage (session commands)" | command | unverifiable | external third-party CLI reference; not checkable from repo |

## Doc: src/resources/skills/agent-browser/references/snapshot-refs.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "agent-browser CLI usage (snapshot/@e ref model)" | command | unverifiable | external third-party CLI reference; not checkable from repo |

## Doc: src/resources/skills/agent-browser/references/video-recording.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "agent-browser CLI usage (recording commands)" | command | unverifiable | external third-party CLI reference; not checkable from repo |

## Doc: src/resources/skills/create-gsd-extension/SKILL.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Project-local extensions live at .gsd/extensions/*.ts or .gsd/extensions/*/index.ts" | structure | verified | community tier lives in .gsd/extensions/ per CONTRIBUTING.md:218; resource-loader.ts:701-714 documents the extensions sync/discovery surface |

## Doc: src/resources/skills/create-gsd-extension/references/key-rules-gotchas.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Project-local extension location .gsd/extensions/" | structure | verified | CONTRIBUTING.md:218 tier table; resource-loader.ts extension dirs |

## Doc: src/resources/skills/create-gsd-extension/workflows/add-capability.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Project-local extension location .gsd/extensions/" | structure | verified | CONTRIBUTING.md:218 tier table |

## Doc: src/resources/skills/create-gsd-extension/workflows/create-extension.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Project-local extension location .gsd/extensions/" | structure | verified | CONTRIBUTING.md:218 tier table |

## Doc: src/resources/skills/create-gsd-extension/workflows/debug-extension.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Project-local extension location .gsd/extensions/" | structure | verified | CONTRIBUTING.md:218 tier table |

## Doc: src/resources/skills/create-mcp-server/SKILL.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "/gsd mcp init scaffolds project MCP config; mcp-client extension consumes MCP" | feature | verified | /gsd mcp with init subcommand at commands/catalog.ts:90 and commands-mcp-status.ts:278-279; src/resources/extensions/mcp-client/ + gsd/mcp-project-config.ts present |

## Doc: src/resources/skills/create-skill/SKILL.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Bundled skills dir ~/.gsd/agent/skills/ is GSD-owned/read-only for user authoring" | structure | verified | resource-loader.ts:701 'extensions/ → ~/.gsd/agent/extensions/' sync model; package-manager.ts:2296 ranks bundled user-scope ~/.gsd/agent/skills |

## Doc: src/resources/skills/create-skill/references/gsd-skill-ecosystem.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Skill directories: bundled ~/.gsd/agent/skills/, user ~/.agents/skills/, project .agents/skills/, Claude-compat ~/.claude/skills/ and .claude/skills/" | structure | verified | packages/pi-coding-agent/src/core/package-manager.ts:55-56,186-188,2289-2296 handles exactly these dirs |

## Doc: src/resources/skills/create-skill/workflows/create-new-skill.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Run /reload to make the skill available in the current session" | command | verified | 'reload' slash command at packages/pi-coding-agent/src/core/slash-commands.ts:39 ('Reload keybindings, extensions, skills, prompts, and themes') |

## Doc: src/resources/skills/create-workflow/SKILL.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Workflow defs at .gsd/workflows/<name>.yaml (preferred) or legacy .gsd/workflow-defs/<name>.yaml; run via /gsd workflow run <name>; validate via /gsd workflow validate <name>" | command | verified | /gsd workflow lifecycle (new, run, list, info, install, uninstall, validate, pause, resume) at commands/catalog.ts:92,487; legacy fallback .gsd/workflow-defs/ at run-manager.ts:43,112,130 and definition-loader.ts:4 |

## Doc: src/resources/skills/create-workflow/references/feature-patterns.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Workflow definition locations and /gsd workflow run/validate commands" | command | verified | same evidence as create-workflow/SKILL.md |

## Doc: src/resources/skills/create-workflow/workflows/create-from-scratch.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Write to .gsd/workflows/<name>.yaml; /gsd workflow validate <name>" | command | verified | same evidence as create-workflow/SKILL.md |

## Doc: src/resources/skills/create-workflow/workflows/create-from-template.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Workflow definition locations and /gsd workflow run <name>" | command | verified | same evidence as create-workflow/SKILL.md |

## Doc: src/resources/skills/decompose-into-slices/SKILL.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "/gsd start spike workflow exists" | feature | verified | src/resources/extensions/gsd/workflow-templates/spike.md present; /gsd start in commands/catalog.ts:20 |
| "Milestone brief at .gsd/milestones/<MID>/<MID>-CONTEXT.md; write roadmap to .gsd/milestones/<MID>/<MID>-ROADMAP.md" | structure | stale | current layout is flat-phase: phases/NN-slug/NN-CONTEXT.md (paths.ts:208,905; auto-artifact-paths.ts:70-71); milestones/<MID>/ is the legacy pre-flat-phase layout (paths.ts:659-667,817) |

## Doc: src/resources/skills/dependency-upgrade/SKILL.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "gsd-pi ships a /gsd start dep-upgrade workflow template (workflow-templates/dep-upgrade.md)" | feature | verified | src/resources/extensions/gsd/workflow-templates/dep-upgrade.md present; refactor.md and hotfix.md templates also present for the follow-up flows it names |

## Doc: src/resources/skills/forensics/SKILL.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "/gsd forensics command; reports under .gsd/forensics/" | feature | verified | /gsd forensics in commands/catalog.ts:20 (.gsd/* paths are runtime-side, not repo-checkable) |

## Doc: src/resources/skills/handoff/SKILL.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Create .gsd/milestones/<MID>/slices/<SID>/continue.md" | structure | stale | milestones/<MID>/slices/<SID>/ is the legacy pre-flat-phase layout (paths.ts:659-667,817); current layout is phases/NN-slug/ |

## Doc: src/resources/skills/observability/SKILL.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Reuse the atomic-write.ts helpers and the .gsd/runtime/ and .gsd/forensics/ directories" | structure | verified | src/resources/extensions/gsd/atomic-write.ts present (+ tests/atomic-write.test.ts) |

## Doc: src/resources/skills/react-best-practices/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Build pipeline: pnpm install / pnpm build → AGENTS.md, pnpm validate, pnpm extract-tests → test-cases.json; src/ build scripts" | command | stale | shipped dir contains only metadata.json, README.md, SKILL.md, rules/ — no package.json, no src/, no AGENTS.md, no test-cases.json (vendored upstream README describing the full source repo) |
| "rules/ contains _sections.md and _template.md" | structure | verified | ls src/resources/skills/react-best-practices/rules/ — both present (59 files: 57 rules + 2 meta) |

## Doc: src/resources/skills/react-best-practices/SKILL.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Contains 57 rules across 8 categories" | structure | verified | rules/ has 59 files − _sections.md − _template.md = 57 rule files |

## Doc: src/resources/skills/security-review/SKILL.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "/gsd start hotfix workflow exists; findings stay in .gsd/security-reviews/" | feature | verified | workflow-templates/hotfix.md present; /gsd start in commands/catalog.ts:20 (.gsd/* paths runtime-side) |

## Doc: src/resources/skills/spike-wrap-up/SKILL.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Reads latest .gsd/workflows/spikes/ dir; writes .agents/skills/<name>/SKILL.md; tied to /gsd start spike Phase 3" | feature | verified | workflow-templates/spike.md present; .agents/skills/ is a real discovery scope (package-manager.ts:55-56); .gsd/workflows/spikes/ is runtime-side |

## Doc: src/resources/skills/tdd/SKILL.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Exploratory spikes use /gsd start spike" | feature | verified | workflow-templates/spike.md present |

## Doc: src/resources/skills/userinterface-wiki/SKILL.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Contains 152 rules across 12 categories (table rows 1-12)" | structure | verified | rules/ has 154 files − _sections.md − _template.md = 152 rule files; category table has 12 rows |
| "Frontmatter description: 'Covers 11 categories from animation principles to typography'" | status | stale | the file's own category table lists 12 categories (#11 Typography, #12 Visual Design) — internal contradiction; description predates the 12th category |

## Doc: src/resources/skills/write-milestone-brief/SKILL.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Run /gsd dispatch plan to generate the roadmap; /gsd new-milestone flow" | command | verified | dispatch and new-milestone in commands/catalog.ts:20,77 |
| "For a new milestone, use gsd_milestone_new" | feature | stale | no gsd_milestone_new tool at HEAD (grep src/ packages/ → 0 hits); existing milestone tools are gsd_milestone_generate_id / gsd_milestone_reopen / gsd_milestone_status |
| "Use the write tool to create .gsd/milestones/<MID>/<MID>-CONTEXT.md" | structure | stale | current layout is flat-phase phases/NN-slug/NN-CONTEXT.md (paths.ts:208,905; auto-artifact-paths.ts:70-71); milestones/<MID>/ is legacy (paths.ts:659-667) |

## Doc: tests/acceptance-bed/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Driver: node tests/acceptance-bed/auto-milestone-bed.mjs after pnpm run build:core with GSD_SMOKE_BINARY" | command | verified | auto-milestone-bed.mjs present; build:core in package.json; GSD_SMOKE_BINARY consumed in tests/e2e/_shared/spawn.ts |
| "Runs gsd headless recover with --preview=sha256: approval" | command | verified | recover at src/headless.ts:461; --preview=sha256: flag at src/headless-recover.ts:226,231 |
| "Scripted fake LLM via --model gsd-fake-model + GSD_FAKE_LLM_TRANSCRIPT" | feature | verified | packages/pi-ai/src/providers/fake.ts + register-builtins.ts:439-443 (env-gated fake provider) |
| "Closeout ladder gsd_task_complete → gsd_slice_complete → gsd_validate_milestone → gsd_complete_milestone" | feature | verified | all four tools present in src/resources/extensions/gsd/tools/ |
| "Exit code: 0 = COMPLETED, 10 = WEDGED, 1 = INCONCLUSIVE" | feature | verified | consistent with EXIT_BLOCKED=10 (src/headless-events.ts:29) |
| "Liveness backstop notices print /gsd auto --resume-wedge <id>" | feature | verified | resume-wedge handled in auto.ts, auto-liveness-backstop.ts, commands/handlers/auto.ts |

## Doc: tests/e2e/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "npm run build:core + GSD_SMOKE_BINARY + npm run test:e2e flow" | command | verified | build:core and test:e2e in package.json; GSD_SMOKE_BINARY used in tests/e2e/migration.e2e.test.ts:92 and _shared/spawn.ts |

## Doc: tests/live-workflow/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Live workflow layer drives real binary via gsd headless next; separate from tests/e2e and tests/live" | feature | verified | test:live-workflow in package.json; headless next verified (headless.ts:128) |

## Doc: vscode-extension/CHANGELOG.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Changelog records [1.0.0] - 2026-05-22 as the only release" | status | stale | vscode-extension/package.json version is 0.3.0 — changelog's single 1.0.0 entry never matches any released version |

## Doc: vscode-extension/README.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Requires Node >= 22.18.0, VS Code >= 1.95.0, npm i -g @opengsd/gsd-pi" | config | verified | vscode-extension/package.json engines.vscode ^1.95.0; root engines node >=22.18.0; npm view @opengsd/gsd-pi → 1.16.1 |

## Descriptive docs

<!-- Every inventoried doc with no testable claims, one path per line.
     Composition: ADR/decision records with self-labeled status only; dated research,
     plan, and essay documents; historical release/changelog records; agent prompt
     templates (src/resources/extensions/gsd/prompts/), artifact templates (templates/),
     workflow-template definitions (workflow-templates/), test fixtures
     (gsd/tests/**/*.md, schemas/__fixtures__, pi-coding-agent/test/fixtures, hermes
     fixture STATE.md), skill-rule knowledge-base entries (userinterface-wiki/rules/,
     react-best-practices/rules/, code-optimizer, make-interfaces-feel-better),
     vendored upstream Pi API references (docs/dev/pi-ui-tui/, context-and-hooks/,
     extending-pi guides without command claims, what-is-pi concept chapters),
     example-extension content, and mirror pages whose claims live in a verified
     English source. The union of this list and the Doc section paths equals the
     frozen inventory (1105) exactly. -->

- .github/PULL_REQUEST_TEMPLATE.md
- .plans/doctor-cleanup-consolidation.md
- .plans/dynamic-model-discovery.md
- .plans/extension-loading-multi-path.md
- .plans/fix-high-cpu-process-lifecycle.md
- .plans/issue-575-dynamic-model-routing.md
- .plans/issue-672-parallel-milestone-orchestration.md
- .plans/native-perf-optimizations.md
- .plans/ollama-native-provider.md
- .plans/preferences-wizard-completeness.md
- .plans/single-writer-engine-v3-control-plane.md
- .plans/startup-performance.md
- .plans/token-optimization-suite.md
- .plans/tui-dashboard-cleanup.md
- VISION.md
- docs/archive/legacy-release-history.md
- docs/dev/2026-04-24-swarm-delivery-implementation-plan.md
- docs/dev/2026-05-03-long-running-refactor-plan-of-plans.md
- docs/dev/ADR-001-branchless-worktree-architecture.md
- docs/dev/ADR-002-external-state-directory.md
- docs/dev/ADR-003-pipeline-simplification.md
- docs/dev/ADR-005-multi-model-provider-tool-strategy.md
- docs/dev/ADR-006-extension-modularization.md
- docs/dev/ADR-007-model-catalog-split.md
- docs/dev/ADR-008-IMPLEMENTATION-PLAN.md
- docs/dev/ADR-009-IMPLEMENTATION-PLAN.md
- docs/dev/ADR-012-provider-id-vs-api-shape.md
- docs/dev/ADR-014-auto-orchestration-deep-module.md
- docs/dev/ADR-015-runtime-invariant-modules.md
- docs/dev/ADR-016-phase-2-design.md
- docs/dev/ADR-016-worktree-lifecycle-and-projection.md
- docs/dev/ADR-016-worktree-safety-fail-closed.md
- docs/dev/ADR-017-state-reconciliation-drift-driven.md
- docs/dev/ADR-018-project-authority-contract.md
- docs/dev/ADR-019-unify-tui-style-system.md
- docs/dev/ADR-022-post-unit-gate-enforcement.md
- docs/dev/ADR-023-post-unit-hook-outcome-artifacts.md
- docs/dev/ADR-024-gsd-browser-primary-browser-engine.md
- docs/dev/ADR-025-closeout-consistency-gate.md
- docs/dev/ADR-026-per-phase-thinking-level.md
- docs/dev/ADR-027-source-observation-context-block.md
- docs/dev/ADR-028-preload-authoritative-discuss.md
- docs/dev/ADR-029-preload-authoritative-auto-research-validate.md
- docs/dev/ADR-030-two-altitude-state-machine.md
- docs/dev/ADR-031-worktree-placement.md
- docs/dev/ADR-032-unit-closeout-seam.md
- docs/dev/ADR-033-unit-type-registry.md
- docs/dev/ADR-034-milestone-merge-publication-split.md
- docs/dev/ADR-035-projection-dirty-scope.md
- docs/dev/ADR-037-browser-engine-proven-resolution.md
- docs/dev/ADR-038-dispatch-history-deep-module.md
- docs/dev/ADR-039-consent-question-module.md
- docs/dev/ADR-040-write-gate-two-adapter-seam.md
- docs/dev/ADR-041-engine-hook-contract.md
- docs/dev/ADR-042-three-session-types.md
- docs/dev/ADR-043-parent-workspace-mode-contract.md
- docs/dev/ADR-044-per-repository-git-isolation.md
- docs/dev/ADR-045-flat-phase-layout-completion.md
- docs/dev/ADR-046-database-authoritative-workflow-lifecycle.md
- docs/dev/FILE-SYSTEM-MAP.md
- docs/dev/FRONTIER-TECHNIQUES.md
- docs/dev/M003-S03-TASK-EXECUTION-RESEARCH.md
- docs/dev/M003-S04-TASK-RECOVERY-RESEARCH.md
- docs/dev/M003-S05-SLICE-LIFECYCLE-RESEARCH.md
- docs/dev/M003-S06-MILESTONE-LIFECYCLE-RESEARCH.md
- docs/dev/M003-S07-SEMANTIC-SHADOW-RESEARCH.md
- docs/dev/M003-S07-T06-FAULT-RESEARCH.md
- docs/dev/M003-S07-T06-NO-CUTOVER-RESEARCH.md
- docs/dev/M003-S07-T06-RESTART-RACE-RESEARCH.md
- docs/dev/M003-S07-T07-CUTOVER-DECISION-RESEARCH.md
- docs/dev/M003-S07-T07-DOSSIER-RESEARCH.md
- docs/dev/M003-S07-T07-UAT-SHIP-RESEARCH.md
- docs/dev/M004-S02-T06-CLASSIFICATION-RESEARCH.md
- docs/dev/M004-S02-T07-PUBLIC-PREVIEW-RESEARCH.md
- docs/dev/M004-S03-VERIFIED-BACKUP-RESEARCH.md
- docs/dev/M004-S04-TRANSACTIONAL-IMPORT-APPLICATION-RESEARCH.md
- docs/dev/M004-S05-AUTHORITY-EPOCH-FORWARD-REPAIR-RESEARCH.md
- docs/dev/M004-S05-T06-PID-OWNERSHIP-RESEARCH.md
- docs/dev/PRD-branchless-worktree-architecture.md
- docs/dev/PRD-pi-clean-seam-refactor.md
- docs/dev/agent-knowledge-index.md
- docs/dev/building-coding-agents/01-work-decomposition.md
- docs/dev/building-coding-agents/02-what-to-keep-discard-from-human-engineering.md
- docs/dev/building-coding-agents/03-state-machine-context-management.md
- docs/dev/building-coding-agents/04-optimal-storage-for-project-context.md
- docs/dev/building-coding-agents/05-parallelization-strategy.md
- docs/dev/building-coding-agents/06-maximizing-agent-autonomy-superpowers.md
- docs/dev/building-coding-agents/07-system-prompt-llm-vs-deterministic-split.md
- docs/dev/building-coding-agents/08-speed-optimization.md
- docs/dev/building-coding-agents/09-top-10-tips-for-a-world-class-agent.md
- docs/dev/building-coding-agents/10-top-10-pitfalls-to-avoid.md
- docs/dev/building-coding-agents/11-god-tier-context-engineering.md
- docs/dev/building-coding-agents/12-handling-ambiguity-contradiction.md
- docs/dev/building-coding-agents/13-long-running-memory-fidelity.md
- docs/dev/building-coding-agents/14-multi-agent-semantic-conflict-resolution.md
- docs/dev/building-coding-agents/15-legacy-code-brownfield-onboarding.md
- docs/dev/building-coding-agents/16-encoding-taste-aesthetics.md
- docs/dev/building-coding-agents/17-irreversible-operations-safety-architecture.md
- docs/dev/building-coding-agents/18-the-handoff-problem-agent-human-maintainability.md
- docs/dev/building-coding-agents/19-when-to-scrap-and-start-over.md
- docs/dev/building-coding-agents/20-error-taxonomy-routing.md
- docs/dev/building-coding-agents/21-cost-quality-tradeoff-model-routing.md
- docs/dev/building-coding-agents/22-cross-project-learning-reusable-intelligence.md
- docs/dev/building-coding-agents/23-evolution-across-project-scale.md
- docs/dev/building-coding-agents/24-security-trust-boundaries.md
- docs/dev/building-coding-agents/25-designing-for-non-technical-users-vibe-coders.md
- docs/dev/building-coding-agents/26-cross-cutting-themes-where-all-4-models-converge.md
- docs/dev/building-coding-agents/README.md
- docs/dev/context-and-hooks/01-the-context-pipeline.md
- docs/dev/context-and-hooks/02-hook-reference.md
- docs/dev/context-and-hooks/03-context-injection-patterns.md
- docs/dev/context-and-hooks/04-message-types-and-llm-visibility.md
- docs/dev/context-and-hooks/05-inter-extension-communication.md
- docs/dev/context-and-hooks/06-advanced-patterns-from-source.md
- docs/dev/context-and-hooks/07-the-system-prompt-anatomy.md
- docs/dev/context-and-hooks/README.md
- docs/dev/extending-pi/01-what-are-extensions.md
- docs/dev/extending-pi/02-architecture-mental-model.md
- docs/dev/extending-pi/04-extension-locations-discovery.md
- docs/dev/extending-pi/05-extension-structure-styles.md
- docs/dev/extending-pi/07-events-the-nervous-system.md
- docs/dev/extending-pi/08-extensioncontext-what-you-can-access.md
- docs/dev/extending-pi/09-extensionapi-what-you-can-do.md
- docs/dev/extending-pi/11-custom-commands-user-facing-actions.md
- docs/dev/extending-pi/12-custom-ui-visual-components.md
- docs/dev/extending-pi/13-state-management-persistence.md
- docs/dev/extending-pi/14-custom-rendering-controlling-what-the-user-sees.md
- docs/dev/extending-pi/15-system-prompt-modification.md
- docs/dev/extending-pi/16-compaction-session-control.md
- docs/dev/extending-pi/17-model-provider-management.md
- docs/dev/extending-pi/18-remote-execution-tool-overrides.md
- docs/dev/extending-pi/20-mode-behavior.md
- docs/dev/extending-pi/21-error-handling.md
- docs/dev/extending-pi/22-key-rules-gotchas.md
- docs/dev/extending-pi/23-file-reference-documentation.md
- docs/dev/extending-pi/24-file-reference-example-extensions.md
- docs/dev/extending-pi/25-slash-command-subcommand-patterns.md
- docs/dev/extending-pi/26-extension-manifest-spec.md
- docs/dev/extending-pi/27-testing-extensions.md
- docs/dev/extending-pi/README.md
- docs/dev/hermes-integration-plan.md
- docs/dev/new-milestone-discuss-flow.md
- docs/dev/pi-context-optimization-opportunities.md
- docs/dev/pi-internal-import-audit.md
- docs/dev/pi-overlay-execution-plan.md
- docs/dev/pi-ui-tui/01-the-ui-architecture.md
- docs/dev/pi-ui-tui/02-the-component-interface-foundation-of-everything.md
- docs/dev/pi-ui-tui/03-entry-points-how-ui-gets-on-screen.md
- docs/dev/pi-ui-tui/04-built-in-dialog-methods.md
- docs/dev/pi-ui-tui/05-persistent-ui-elements.md
- docs/dev/pi-ui-tui/06-ctx-ui-custom-full-custom-components.md
- docs/dev/pi-ui-tui/07-built-in-components-the-building-blocks.md
- docs/dev/pi-ui-tui/08-high-level-components-from-pi-coding-agent.md
- docs/dev/pi-ui-tui/09-keyboard-input-how-to-handle-keys.md
- docs/dev/pi-ui-tui/10-line-width-the-cardinal-rule.md
- docs/dev/pi-ui-tui/11-theming-colors-and-styles.md
- docs/dev/pi-ui-tui/12-overlays-floating-modals-and-panels.md
- docs/dev/pi-ui-tui/13-custom-editors-replacing-the-input.md
- docs/dev/pi-ui-tui/14-tool-rendering-custom-tool-display.md
- docs/dev/pi-ui-tui/15-message-rendering-custom-message-display.md
- docs/dev/pi-ui-tui/16-performance-caching-and-invalidation.md
- docs/dev/pi-ui-tui/17-theme-changes-and-invalidation.md
- docs/dev/pi-ui-tui/18-ime-support-the-focusable-interface.md
- docs/dev/pi-ui-tui/19-building-a-complete-component-step-by-step.md
- docs/dev/pi-ui-tui/20-real-world-patterns-from-examples.md
- docs/dev/pi-ui-tui/21-common-mistakes-and-how-to-avoid-them.md
- docs/dev/pi-ui-tui/22-quick-reference-all-ui-apis.md
- docs/dev/pi-ui-tui/23-file-reference-example-extensions-with-ui.md
- docs/dev/pi-ui-tui/README.md
- docs/dev/proposals/rfc-gitops-branching-strategy.md
- docs/dev/state-db-cutover-milestone-decision.md
- docs/dev/state-db-cutover-mixed-version-spike.md
- docs/dev/state-db-cutover-parsers-legacy-inventory.md
- docs/dev/state-db-cutover-projection-contract.md
- docs/dev/superpowers/specs/2026-03-17-cicd-pipeline-design.md
- docs/dev/test-evaluation-report.md
- docs/dev/warp-auto-disconnect-findings.md
- docs/dev/what-is-pi/02-design-philosophy.md
- docs/dev/what-is-pi/04-the-architecture-how-everything-fits-together.md
- docs/dev/what-is-pi/05-the-agent-loop-how-pi-thinks.md
- docs/dev/what-is-pi/07-sessions-memory-that-branches.md
- docs/dev/what-is-pi/08-compaction-how-pi-manages-context-limits.md
- docs/dev/what-is-pi/09-the-customization-stack.md
- docs/dev/what-is-pi/11-the-interactive-tui.md
- docs/dev/what-is-pi/12-the-message-queue-talking-while-pi-thinks.md
- docs/dev/what-is-pi/16-why-pi-matters-what-makes-it-different.md
- docs/dev/what-is-pi/README.md
- docs/extension-sdk/api-reference.md
- docs/extension-sdk/building-extensions.md
- docs/extension-sdk/testing.md
- docs/superpowers/plans/2026-06-21-flat-phase-layout.md
- docs/superpowers/plans/2026-06-21-planning-dir-parity.md
- docs/superpowers/specs/2026-06-21-pi-adopts-planning-layout-design.md
- docs/superpowers/specs/2026-06-21-planning-dir-parity-design.md
- docs/token-consumption-savings-evidence.md
- docs/tui-audit.md
- docs/zh-CN/README.md
- gitbook/configuration/custom-models.md
- gitbook/configuration/git-settings.md
- gitbook/configuration/mcp-servers.md
- gitbook/configuration/notifications.md
- gitbook/configuration/preferences.md
- gitbook/core-concepts/auto-mode.md
- gitbook/core-concepts/project-structure.md
- gitbook/core-concepts/step-mode.md
- gitbook/getting-started/choosing-a-model.md
- gitbook/reference/environment-variables.md
- gitbook/reference/keyboard-shortcuts.md
- gitbook/reference/migration.md
- gsd-orchestrator/templates/spec.md
- integrations/hermes/CONTEXT.md
- integrations/hermes/docs/issue-1162-grilling.md
- integrations/hermes/docs/upstream-hermes-pr.md
- integrations/hermes/tests/fixtures/minimal-project/.gsd/STATE.md
- packages/pi-agent-core/CHANGELOG.md
- packages/pi-agent-core/docs/durable-harness.md
- packages/pi-agent-core/docs/hooks.md
- packages/pi-ai/CHANGELOG.md
- packages/pi-coding-agent/CHANGELOG.md
- packages/pi-coding-agent/docs/tmux.md
- packages/pi-coding-agent/examples/README.md
- packages/pi-coding-agent/examples/extensions/doom-overlay/README.md
- packages/pi-coding-agent/examples/extensions/dynamic-resources/SKILL.md
- packages/pi-coding-agent/examples/extensions/dynamic-resources/dynamic.md
- packages/pi-coding-agent/examples/extensions/plan-mode/README.md
- packages/pi-coding-agent/examples/extensions/subagent/README.md
- packages/pi-coding-agent/examples/extensions/subagent/agents/planner.md
- packages/pi-coding-agent/examples/extensions/subagent/agents/reviewer.md
- packages/pi-coding-agent/examples/extensions/subagent/agents/scout.md
- packages/pi-coding-agent/examples/extensions/subagent/agents/worker.md
- packages/pi-coding-agent/examples/extensions/subagent/prompts/implement-and-review.md
- packages/pi-coding-agent/examples/extensions/subagent/prompts/implement.md
- packages/pi-coding-agent/examples/extensions/subagent/prompts/scout-and-plan.md
- packages/pi-coding-agent/test/fixtures/skills-collision/first/calendar/SKILL.md
- packages/pi-coding-agent/test/fixtures/skills-collision/second/calendar/SKILL.md
- packages/pi-coding-agent/test/fixtures/skills/consecutive-hyphens/SKILL.md
- packages/pi-coding-agent/test/fixtures/skills/disable-model-invocation/SKILL.md
- packages/pi-coding-agent/test/fixtures/skills/invalid-name-chars/SKILL.md
- packages/pi-coding-agent/test/fixtures/skills/invalid-yaml/SKILL.md
- packages/pi-coding-agent/test/fixtures/skills/long-name/SKILL.md
- packages/pi-coding-agent/test/fixtures/skills/missing-description/SKILL.md
- packages/pi-coding-agent/test/fixtures/skills/multiline-description/SKILL.md
- packages/pi-coding-agent/test/fixtures/skills/name-mismatch/SKILL.md
- packages/pi-coding-agent/test/fixtures/skills/nested/child-skill/SKILL.md
- packages/pi-coding-agent/test/fixtures/skills/no-frontmatter/SKILL.md
- packages/pi-coding-agent/test/fixtures/skills/root-skill-preferred/SKILL.md
- packages/pi-coding-agent/test/fixtures/skills/root-skill-preferred/nested-child/SKILL.md
- packages/pi-coding-agent/test/fixtures/skills/unknown-field/SKILL.md
- packages/pi-coding-agent/test/fixtures/skills/valid-skill/SKILL.md
- packages/pi-tui/CHANGELOG.md
- plans/001-worktree-safety-all-isolation-modes.md
- plans/002-dispatch-history-rehydrate-errors.md
- plans/003-reset-session-timeout-counter.md
- plans/004-batch-slice-queries-state-derivation.md
- plans/005-convert-source-grep-tests.md
- plans/006-auto-closeout-verdict-tests.md
- plans/007-mcp-server-gsd-bridge-seam.md
- plans/008-extract-auto-loop-phase-modules.md
- plans/009-harden-cloud-pairing-codes.md
- plans/010-redact-secrets-in-persisted-logs.md
- plans/011-buffer-websocket-sends-cloud-runtime.md
- plans/012-graceful-shutdown-sigterm-sigkill-timing.md
- plans/013-surface-workspace-link-failures.md
- plans/014-batch-task-queries-projection.md
- plans/015-bound-discord-message-batcher.md
- plans/016-dependency-security-overrides.md
- plans/017-doc-dx-quick-fixes.md
- plans/020-cloud-pairing-http-timeouts.md
- plans/022-gsd-cloud-pairing-ssrf-tests.md
- plans/026-schema-version-and-migration-safety.md
- plans/028-db-write-layer-small-fixes.md
- plans/032-lean-mean-cleanup.md
- plans/032a-dead-code-audit.md
- plans/036-stabilize-prompt-cache-prefix.md
- plans/037-dedupe-per-turn-context-messages.md
- plans/038-cheapen-compaction-calls.md
- plans/039-close-prompt-budget-gaps.md
- plans/040-m002-s04-recovery-evidence-research.md
- plans/041-m002-s05-projection-import-kernel-closeout-research.md
- plans/042-m002-s06-domain-operation-research.md
- plans/043-m003-s01-lifecycle-writer-research.md
- plans/044-m003-s02-planning-adoption-research.md
- plans/045-dead-code-cleanup-program.md
- src/resources/GSD-WORKFLOW.md
- src/resources/agents/debugger.md
- src/resources/agents/doc-writer.md
- src/resources/agents/git-ops.md
- src/resources/agents/javascript-pro.md
- src/resources/agents/planner.md
- src/resources/agents/refactorer.md
- src/resources/agents/researcher.md
- src/resources/agents/reviewer.md
- src/resources/agents/scout.md
- src/resources/agents/security.md
- src/resources/agents/tester.md
- src/resources/agents/typescript-pro.md
- src/resources/agents/worker.md
- src/resources/extensions/browser-tools/BROWSER-TOOLS-V2-PROPOSAL.md
- src/resources/extensions/gsd/prompts/add-tests.md
- src/resources/extensions/gsd/prompts/ai-integration-phase.md
- src/resources/extensions/gsd/prompts/audit-fix.md
- src/resources/extensions/gsd/prompts/audit-milestone.md
- src/resources/extensions/gsd/prompts/audit-uat.md
- src/resources/extensions/gsd/prompts/autonomous.md
- src/resources/extensions/gsd/prompts/code-review.md
- src/resources/extensions/gsd/prompts/complete-milestone.md
- src/resources/extensions/gsd/prompts/complete-slice.md
- src/resources/extensions/gsd/prompts/debug-diagnose.md
- src/resources/extensions/gsd/prompts/debug-session-manager.md
- src/resources/extensions/gsd/prompts/discuss-headless.md
- src/resources/extensions/gsd/prompts/discuss-phase.md
- src/resources/extensions/gsd/prompts/discuss.md
- src/resources/extensions/gsd/prompts/docs-update.md
- src/resources/extensions/gsd/prompts/doctor-heal.md
- src/resources/extensions/gsd/prompts/execute-phase.md
- src/resources/extensions/gsd/prompts/execute-task.md
- src/resources/extensions/gsd/prompts/explore.md
- src/resources/extensions/gsd/prompts/forensics.md
- src/resources/extensions/gsd/prompts/gate-evaluate.md
- src/resources/extensions/gsd/prompts/graphify.md
- src/resources/extensions/gsd/prompts/guided-discuss-milestone.md
- src/resources/extensions/gsd/prompts/guided-discuss-project.md
- src/resources/extensions/gsd/prompts/guided-discuss-requirements.md
- src/resources/extensions/gsd/prompts/guided-discuss-slice.md
- src/resources/extensions/gsd/prompts/guided-research-decision.md
- src/resources/extensions/gsd/prompts/guided-research-project.md
- src/resources/extensions/gsd/prompts/guided-research-slice.md
- src/resources/extensions/gsd/prompts/guided-resume-task.md
- src/resources/extensions/gsd/prompts/guided-workflow-preferences.md
- src/resources/extensions/gsd/prompts/heal-skill.md
- src/resources/extensions/gsd/prompts/health.md
- src/resources/extensions/gsd/prompts/import.md
- src/resources/extensions/gsd/prompts/inbox.md
- src/resources/extensions/gsd/prompts/ingest-docs.md
- src/resources/extensions/gsd/prompts/manager.md
- src/resources/extensions/gsd/prompts/map-codebase.md
- src/resources/extensions/gsd/prompts/milestone-summary.md
- src/resources/extensions/gsd/prompts/mvp-phase.md
- src/resources/extensions/gsd/prompts/parallel-research-slices.md
- src/resources/extensions/gsd/prompts/pause-work.md
- src/resources/extensions/gsd/prompts/phase.md
- src/resources/extensions/gsd/prompts/plan-milestone.md
- src/resources/extensions/gsd/prompts/plan-phase.md
- src/resources/extensions/gsd/prompts/plan-review-convergence.md
- src/resources/extensions/gsd/prompts/plan-slice.md
- src/resources/extensions/gsd/prompts/profile-user.md
- src/resources/extensions/gsd/prompts/progress.md
- src/resources/extensions/gsd/prompts/queue.md
- src/resources/extensions/gsd/prompts/quick-task.md
- src/resources/extensions/gsd/prompts/reactive-execute.md
- src/resources/extensions/gsd/prompts/reassess-roadmap.md
- src/resources/extensions/gsd/prompts/refine-slice.md
- src/resources/extensions/gsd/prompts/replan-slice.md
- src/resources/extensions/gsd/prompts/replan-task.md
- src/resources/extensions/gsd/prompts/research-milestone.md
- src/resources/extensions/gsd/prompts/research-slice.md
- src/resources/extensions/gsd/prompts/resume-work.md
- src/resources/extensions/gsd/prompts/rethink.md
- src/resources/extensions/gsd/prompts/review-backlog.md
- src/resources/extensions/gsd/prompts/review-migration.md
- src/resources/extensions/gsd/prompts/review.md
- src/resources/extensions/gsd/prompts/rewrite-docs.md
- src/resources/extensions/gsd/prompts/run-uat.md
- src/resources/extensions/gsd/prompts/scan.md
- src/resources/extensions/gsd/prompts/secure-phase.md
- src/resources/extensions/gsd/prompts/settings.md
- src/resources/extensions/gsd/prompts/sketch.md
- src/resources/extensions/gsd/prompts/spec-phase.md
- src/resources/extensions/gsd/prompts/spike.md
- src/resources/extensions/gsd/prompts/stats.md
- src/resources/extensions/gsd/prompts/surface.md
- src/resources/extensions/gsd/prompts/system.md
- src/resources/extensions/gsd/prompts/thread.md
- src/resources/extensions/gsd/prompts/triage-captures.md
- src/resources/extensions/gsd/prompts/ui-phase.md
- src/resources/extensions/gsd/prompts/ui-review.md
- src/resources/extensions/gsd/prompts/ultraplan-phase.md
- src/resources/extensions/gsd/prompts/validate-milestone.md
- src/resources/extensions/gsd/prompts/validate-phase.md
- src/resources/extensions/gsd/prompts/verify-work.md
- src/resources/extensions/gsd/prompts/workflow-oneshot.md
- src/resources/extensions/gsd/prompts/workflow-start.md
- src/resources/extensions/gsd/prompts/workspace.md
- src/resources/extensions/gsd/prompts/workstreams.md
- src/resources/extensions/gsd/prompts/worktree-merge.md
- src/resources/extensions/gsd/schemas/__fixtures__/valid-project.md
- src/resources/extensions/gsd/schemas/__fixtures__/valid-requirements.md
- src/resources/extensions/gsd/schemas/__fixtures__/valid-roadmap.md
- src/resources/extensions/gsd/templates/PREFERENCES.md
- src/resources/extensions/gsd/templates/context.md
- src/resources/extensions/gsd/templates/decisions.md
- src/resources/extensions/gsd/templates/knowledge.md
- src/resources/extensions/gsd/templates/milestone-summary.md
- src/resources/extensions/gsd/templates/milestone-validation.md
- src/resources/extensions/gsd/templates/plan.md
- src/resources/extensions/gsd/templates/project.md
- src/resources/extensions/gsd/templates/reassessment.md
- src/resources/extensions/gsd/templates/requirements.md
- src/resources/extensions/gsd/templates/research.md
- src/resources/extensions/gsd/templates/roadmap.md
- src/resources/extensions/gsd/templates/runtime.md
- src/resources/extensions/gsd/templates/secrets-manifest.md
- src/resources/extensions/gsd/templates/slice-context.md
- src/resources/extensions/gsd/templates/slice-summary.md
- src/resources/extensions/gsd/templates/state.md
- src/resources/extensions/gsd/templates/task-plan.md
- src/resources/extensions/gsd/templates/task-summary.md
- src/resources/extensions/gsd/templates/uat.md
- src/resources/extensions/gsd/tests/__fixtures__/flat-phase/.gsd/phases/01-foundation/01-01-PLAN.md
- src/resources/extensions/gsd/tests/__fixtures__/flat-phase/.gsd/phases/01-foundation/01-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/action-matrix/source/.gsd/STATE.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/assessment-matrix/source/.gsd/milestones/M001/M001-ROADMAP-ASSESSMENT.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/assessment-matrix/source/.gsd/milestones/M001/M001-VALIDATION.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/assessment-matrix/source/.gsd/milestones/M001/slices/S01/S01-ASSESSMENT.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/assessment-matrix/source/.gsd/milestones/M001/slices/S01/S01-UAT.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/assessment-matrix/source/.gsd/milestones/M001/slices/S05/S05-ASSESSMENT.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/assessment-matrix/source/.gsd/milestones/M001/slices/S06/S06-ASSESSMENT.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/assessment-matrix/source/.gsd/milestones/M001/slices/S07/S07-ASSESSMENT.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/assessment-matrix/source/.gsd/milestones/M001/slices/S08/S08-BACKFILL-ASSESSMENT.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/composite-capstone/source/.gsd/DECISIONS.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/composite-capstone/source/.gsd/KNOWLEDGE.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/composite-capstone/source/.gsd/REQUIREMENTS.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/composite-capstone/source/.gsd/milestones/M007-capstone-alpha/M007-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/composite-capstone/source/.gsd/milestones/M702-clean/M702-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/composite-capstone/source/.gsd/phases/07-capstone-beta/07-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/composite-capstone/source/.planning/ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/custom-workflow/source/.gsd/workflows/bugfix.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/custom-workflow/source/.gsd/workflows/phased.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-alias-hybrid/source/.gsd/milestones/M002-delivery/M002-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-alias-hybrid/source/.gsd/milestones/M003-platform/M003-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-alias-hybrid/source/.gsd/milestones/M004-payments/M004-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-alias-hybrid/source/.gsd/milestones/M007-abc123/M007-abc123-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-alias-hybrid/source/.gsd/milestones/M015-telemetry/M015-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-alias-hybrid/source/.gsd/phases/01-foundation/01-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-alias-hybrid/source/.gsd/phases/03-platform/03-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-alias-hybrid/source/.gsd/phases/03-services/03-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-alias-hybrid/source/.gsd/phases/04-billing/04-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-alias-hybrid/source/.gsd/phases/05-def456-team-search/05-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-alias-hybrid/source/.gsd/phases/07-abc123-alpha-team/07-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-alias-hybrid/source/.gsd/phases/15-observability/15-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-flat/source/.gsd/phases/01-foundation/01-01-PLAN.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-flat/source/.gsd/phases/01-foundation/01-01-SUMMARY.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-flat/source/.gsd/phases/01-foundation/01-02-SUMMARY.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-flat/source/.gsd/phases/01-foundation/01-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-flat/source/.gsd/phases/01-foundation/NOTES.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-flat/source/.gsd/phases/15-observability/15-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-flat/source/.gsd/phases/M016-delivery/M016-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-nested/source/.gsd/milestones/M001-foundation/M001-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-nested/source/.gsd/milestones/M001-foundation/slices/S01-core/S01-PLAN.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-nested/source/.gsd/milestones/M001-foundation/slices/S02-api/S02-PLAN.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-nested/source/.gsd/milestones/M001-foundation/slices/S03-client/tasks/T01-PLAN.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-nested/source/.gsd/milestones/M001-foundation/slices/S04-release/T01-PLAN.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-nested/source/.gsd/milestones/M002-delivery/M002-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-nested/source/.gsd/milestones/M002-delivery/slices/S01-ship/S01-PLAN.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-nested/source/.gsd/milestones/M003-operations/M003-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-nested/source/.gsd/milestones/M004-experiments/M004-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/gsd-nested/source/.gsd/milestones/M099-ghost/M099-CONTEXT.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/knowledge-graph/source/.gsd/KNOWLEDGE.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/knowledge-graph/source/.gsd/milestones/M001/M001-LEARNINGS.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/knowledge-graph/source/.gsd/phases/02-legacy/02-LEARNINGS.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/lifecycle-truth-matrix/source/.gsd/milestones/M001/M001-PARKED.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/lifecycle-truth-matrix/source/.gsd/milestones/M001/M001-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/lifecycle-truth-matrix/source/.gsd/milestones/M001/M001-SUMMARY.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/lifecycle-truth-matrix/source/.gsd/milestones/M001/slices/S01/S01-PLAN.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/lifecycle-truth-matrix/source/.gsd/milestones/M001/slices/S01/tasks/T01/T01-PLAN.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/lifecycle-truth-matrix/source/.gsd/milestones/M001/slices/S02/S02-SUMMARY.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/lifecycle-truth-matrix/source/.gsd/milestones/M001/slices/S02/T01-SUMMARY.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/lifecycle-truth-matrix/source/.gsd/milestones/M002/M002-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/lifecycle-truth-matrix/source/.gsd/milestones/M003/M003-PARKED.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/lifecycle-truth-matrix/source/.gsd/milestones/M004/M004-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/lifecycle-truth-matrix/source/.gsd/milestones/M004/slices/S01/S01-PLAN.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/lifecycle-truth-matrix/source/.gsd/milestones/M004/slices/S01/S01-SUMMARY.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/lifecycle-truth-matrix/source/.gsd/milestones/M004/slices/S01/tasks/T01/T01-SUMMARY.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-flat-complete/source/.planning/PROJECT.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-flat-complete/source/.planning/REQUIREMENTS.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-flat-complete/source/.planning/ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-flat-complete/source/.planning/phases/01-foundation/01-01-PLAN.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-flat-complete/source/.planning/phases/01-foundation/01-01-SUMMARY.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-loss-surfaces/source/.planning/.archive/03-retired/03-01-PLAN.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-loss-surfaces/source/.planning/ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-loss-surfaces/source/.planning/STATE.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-loss-surfaces/source/.planning/decisions/D001-storage.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-loss-surfaces/source/.planning/phases/01-checked/01-01-PLAN.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-loss-surfaces/source/.planning/phases/01-checked/01-02-PLAN.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-loss-surfaces/source/.planning/phases/01-checked/01-EXTRA.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-loss-surfaces/source/.planning/phases/01-checked/01-VERIFICATION.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-loss-surfaces/source/.planning/phases/02-unchecked/02-01-SUMMARY.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-loss-surfaces/source/.planning/quick/001-fix/001-PLAN.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-loss-surfaces/source/.planning/research/NOTES.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-loss-surfaces/source/.planning/seeds/idea.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-milestone-dirs/source/.planning/milestones/v1.0-REQUIREMENTS.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-milestone-dirs/source/.planning/milestones/v1.0-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-milestone-dirs/source/.planning/milestones/v1.0-SUMMARY.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-milestone-dirs/source/.planning/milestones/v1.0-phases/01-foundation-duplicate/01-PLAN.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-milestone-dirs/source/.planning/milestones/v1.0-phases/01-foundation/01-PLAN.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-milestone-dirs/source/.planning/milestones/v1.0-phases/01-foundation/01-SUMMARY.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-milestone-dirs/source/.planning/milestones/v1.0-phases/01-foundation/NOTES.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-multi-milestone-completed-range/source/.planning/ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-multi-milestone-details/source/.planning/ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-multi-milestone-emoji-range/source/.planning/ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-multi-milestone-heading/source/.planning/ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-multi-milestone-summary/source/.planning/ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-multi-milestone/source/.planning/ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-number-aliases/source/.planning/ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-number-aliases/source/.planning/phases/01.2-alias-ordering/01.2-03-PLAN.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-number-aliases/source/.planning/phases/01.2-alias-ordering/01.2-03b-PLAN.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-number-aliases/source/.planning/phases/01.2-alias-ordering/01.2-04-PLAN.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/planning-number-aliases/source/.planning/phases/01.2-alias-ordering/01.2-05-PLAN.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/registries-lowercase/source/.gsd/decisions.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/registries-lowercase/source/.gsd/requirements.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/registries/source/.gsd/DECISIONS.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/registries/source/.gsd/REQUIREMENTS.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/root-external-boundaries/source/.gsd/PROJECT.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/root-external-boundaries/source/.gsd/QUEUE.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/root-external-boundaries/source/.gsd/SECRETS-MANIFEST.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/synthetic-smoke/source/.gsd/DECISIONS.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/synthetic-smoke/source/.gsd/STATE.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/worktree-topology/source/active-guard/project/.gsd/PREFERENCES.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/worktree-topology/source/interrupted-conflict/project/.gsd.migrating/PREFERENCES.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/worktree-topology/source/interrupted-conflict/project/.gsd/PREFERENCES.md
- src/resources/extensions/gsd/tests/__fixtures__/legacy-import-corpus/v1/worktree-topology/source/interrupted/project/.gsd.migrating/PREFERENCES.md
- src/resources/extensions/gsd/tests/__fixtures__/round-trip/m001-basic/.gsd/milestones/M001/M001-ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/round-trip/m001-basic/.gsd/milestones/M001/slices/S01/S01-PLAN.md
- src/resources/extensions/gsd/tests/__fixtures__/round-trip/planning-flat-phases/.planning/PROJECT.md
- src/resources/extensions/gsd/tests/__fixtures__/round-trip/planning-flat-phases/.planning/ROADMAP.md
- src/resources/extensions/gsd/tests/__fixtures__/round-trip/planning-flat-phases/.planning/STATE.md
- src/resources/extensions/gsd/tests/__fixtures__/round-trip/planning-flat-phases/.planning/phases/01-foundation/01-01-PLAN.md
- src/resources/extensions/gsd/tests/fixtures/pr-body/commands-ship-basic.md
- src/resources/extensions/gsd/tests/fixtures/pr-body/commands-ship-empty-optionals.md
- src/resources/extensions/gsd/tests/fixtures/pr-body/swarm-lane-no-blockers.md
- src/resources/extensions/gsd/tests/fixtures/pr-body/swarm-lane-with-blockers.md
- src/resources/extensions/gsd/workflow-templates/accessibility-audit.md
- src/resources/extensions/gsd/workflow-templates/api-breaking-change.md
- src/resources/extensions/gsd/workflow-templates/bugfix.md
- src/resources/extensions/gsd/workflow-templates/changelog-gen.md
- src/resources/extensions/gsd/workflow-templates/ci-bootstrap.md
- src/resources/extensions/gsd/workflow-templates/dead-code.md
- src/resources/extensions/gsd/workflow-templates/dep-upgrade.md
- src/resources/extensions/gsd/workflow-templates/full-project.md
- src/resources/extensions/gsd/workflow-templates/hotfix.md
- src/resources/extensions/gsd/workflow-templates/issue-triage.md
- src/resources/extensions/gsd/workflow-templates/observability-setup.md
- src/resources/extensions/gsd/workflow-templates/onboarding-check.md
- src/resources/extensions/gsd/workflow-templates/performance-audit.md
- src/resources/extensions/gsd/workflow-templates/pr-review.md
- src/resources/extensions/gsd/workflow-templates/pr-triage.md
- src/resources/extensions/gsd/workflow-templates/refactor.md
- src/resources/extensions/gsd/workflow-templates/release.md
- src/resources/extensions/gsd/workflow-templates/security-audit.md
- src/resources/extensions/gsd/workflow-templates/small-feature.md
- src/resources/extensions/gsd/workflow-templates/spike.md
- src/resources/extensions/ttsr/ttsr-interrupt.md
- src/resources/skills/accessibility/SKILL.md
- src/resources/skills/accessibility/references/WCAG.md
- src/resources/skills/api-design/SKILL.md
- src/resources/skills/best-practices/SKILL.md
- src/resources/skills/btw/SKILL.md
- src/resources/skills/code-optimizer/SKILL.md
- src/resources/skills/code-optimizer/references/algorithmic-complexity.md
- src/resources/skills/code-optimizer/references/build-compilation.md
- src/resources/skills/code-optimizer/references/bundle-dependencies.md
- src/resources/skills/code-optimizer/references/caching-memoization.md
- src/resources/skills/code-optimizer/references/concurrency-async.md
- src/resources/skills/code-optimizer/references/config-infra.md
- src/resources/skills/code-optimizer/references/data-structures.md
- src/resources/skills/code-optimizer/references/database-queries.md
- src/resources/skills/code-optimizer/references/dead-code-redundancy.md
- src/resources/skills/code-optimizer/references/error-resilience.md
- src/resources/skills/code-optimizer/references/io-network.md
- src/resources/skills/code-optimizer/references/logging-observability.md
- src/resources/skills/code-optimizer/references/memory-resources.md
- src/resources/skills/code-optimizer/references/rendering-ui.md
- src/resources/skills/code-optimizer/references/security-performance.md
- src/resources/skills/core-web-vitals/SKILL.md
- src/resources/skills/core-web-vitals/references/LCP.md
- src/resources/skills/create-gsd-extension/references/compaction-session-control.md
- src/resources/skills/create-gsd-extension/references/custom-commands.md
- src/resources/skills/create-gsd-extension/references/custom-rendering.md
- src/resources/skills/create-gsd-extension/references/custom-tools.md
- src/resources/skills/create-gsd-extension/references/custom-ui.md
- src/resources/skills/create-gsd-extension/references/events-reference.md
- src/resources/skills/create-gsd-extension/references/extension-lifecycle.md
- src/resources/skills/create-gsd-extension/references/extensionapi-reference.md
- src/resources/skills/create-gsd-extension/references/extensioncontext-reference.md
- src/resources/skills/create-gsd-extension/references/mode-behavior.md
- src/resources/skills/create-gsd-extension/references/model-provider-management.md
- src/resources/skills/create-gsd-extension/references/packaging-distribution.md
- src/resources/skills/create-gsd-extension/references/remote-execution-overrides.md
- src/resources/skills/create-gsd-extension/references/state-management.md
- src/resources/skills/create-gsd-extension/references/system-prompt-modification.md
- src/resources/skills/create-skill/references/api-security.md
- src/resources/skills/create-skill/references/be-clear-and-direct.md
- src/resources/skills/create-skill/references/common-patterns.md
- src/resources/skills/create-skill/references/core-principles.md
- src/resources/skills/create-skill/references/executable-code.md
- src/resources/skills/create-skill/references/iteration-and-testing.md
- src/resources/skills/create-skill/references/recommended-structure.md
- src/resources/skills/create-skill/references/skill-structure.md
- src/resources/skills/create-skill/references/use-xml-tags.md
- src/resources/skills/create-skill/references/using-scripts.md
- src/resources/skills/create-skill/references/using-templates.md
- src/resources/skills/create-skill/references/workflows-and-validation.md
- src/resources/skills/create-skill/templates/router-skill.md
- src/resources/skills/create-skill/templates/simple-skill.md
- src/resources/skills/create-skill/workflows/add-reference.md
- src/resources/skills/create-skill/workflows/add-script.md
- src/resources/skills/create-skill/workflows/add-template.md
- src/resources/skills/create-skill/workflows/add-workflow.md
- src/resources/skills/create-skill/workflows/audit-skill.md
- src/resources/skills/create-skill/workflows/get-guidance.md
- src/resources/skills/create-skill/workflows/upgrade-to-router.md
- src/resources/skills/create-skill/workflows/verify-skill.md
- src/resources/skills/create-workflow/references/verification-policies.md
- src/resources/skills/create-workflow/references/yaml-schema-v1.md
- src/resources/skills/debug-like-expert/SKILL.md
- src/resources/skills/debug-like-expert/references/debugging-mindset.md
- src/resources/skills/debug-like-expert/references/hypothesis-testing.md
- src/resources/skills/debug-like-expert/references/investigation-techniques.md
- src/resources/skills/debug-like-expert/references/verification-patterns.md
- src/resources/skills/debug-like-expert/references/when-to-research.md
- src/resources/skills/design-an-interface/SKILL.md
- src/resources/skills/frontend-design/SKILL.md
- src/resources/skills/github-workflows/SKILL.md
- src/resources/skills/github-workflows/references/gh/SKILL.md
- src/resources/skills/github-workflows/references/gh/references/issue-stories.md
- src/resources/skills/github-workflows/references/gh/references/labels.md
- src/resources/skills/github-workflows/references/gh/references/milestones.md
- src/resources/skills/github-workflows/references/gh/references/projects-v2.md
- src/resources/skills/grill-me/SKILL.md
- src/resources/skills/lint/SKILL.md
- src/resources/skills/make-interfaces-feel-better/SKILL.md
- src/resources/skills/make-interfaces-feel-better/animations.md
- src/resources/skills/make-interfaces-feel-better/performance.md
- src/resources/skills/make-interfaces-feel-better/surfaces.md
- src/resources/skills/make-interfaces-feel-better/typography.md
- src/resources/skills/react-best-practices/rules/_sections.md
- src/resources/skills/react-best-practices/rules/_template.md
- src/resources/skills/react-best-practices/rules/advanced-event-handler-refs.md
- src/resources/skills/react-best-practices/rules/advanced-init-once.md
- src/resources/skills/react-best-practices/rules/advanced-use-latest.md
- src/resources/skills/react-best-practices/rules/async-api-routes.md
- src/resources/skills/react-best-practices/rules/async-defer-await.md
- src/resources/skills/react-best-practices/rules/async-dependencies.md
- src/resources/skills/react-best-practices/rules/async-parallel.md
- src/resources/skills/react-best-practices/rules/async-suspense-boundaries.md
- src/resources/skills/react-best-practices/rules/bundle-barrel-imports.md
- src/resources/skills/react-best-practices/rules/bundle-conditional.md
- src/resources/skills/react-best-practices/rules/bundle-defer-third-party.md
- src/resources/skills/react-best-practices/rules/bundle-dynamic-imports.md
- src/resources/skills/react-best-practices/rules/bundle-preload.md
- src/resources/skills/react-best-practices/rules/client-event-listeners.md
- src/resources/skills/react-best-practices/rules/client-localstorage-schema.md
- src/resources/skills/react-best-practices/rules/client-passive-event-listeners.md
- src/resources/skills/react-best-practices/rules/client-swr-dedup.md
- src/resources/skills/react-best-practices/rules/js-batch-dom-css.md
- src/resources/skills/react-best-practices/rules/js-cache-function-results.md
- src/resources/skills/react-best-practices/rules/js-cache-property-access.md
- src/resources/skills/react-best-practices/rules/js-cache-storage.md
- src/resources/skills/react-best-practices/rules/js-combine-iterations.md
- src/resources/skills/react-best-practices/rules/js-early-exit.md
- src/resources/skills/react-best-practices/rules/js-hoist-regexp.md
- src/resources/skills/react-best-practices/rules/js-index-maps.md
- src/resources/skills/react-best-practices/rules/js-length-check-first.md
- src/resources/skills/react-best-practices/rules/js-min-max-loop.md
- src/resources/skills/react-best-practices/rules/js-set-map-lookups.md
- src/resources/skills/react-best-practices/rules/js-tosorted-immutable.md
- src/resources/skills/react-best-practices/rules/rendering-activity.md
- src/resources/skills/react-best-practices/rules/rendering-animate-svg-wrapper.md
- src/resources/skills/react-best-practices/rules/rendering-conditional-render.md
- src/resources/skills/react-best-practices/rules/rendering-content-visibility.md
- src/resources/skills/react-best-practices/rules/rendering-hoist-jsx.md
- src/resources/skills/react-best-practices/rules/rendering-hydration-no-flicker.md
- src/resources/skills/react-best-practices/rules/rendering-hydration-suppress-warning.md
- src/resources/skills/react-best-practices/rules/rendering-svg-precision.md
- src/resources/skills/react-best-practices/rules/rendering-usetransition-loading.md
- src/resources/skills/react-best-practices/rules/rerender-defer-reads.md
- src/resources/skills/react-best-practices/rules/rerender-dependencies.md
- src/resources/skills/react-best-practices/rules/rerender-derived-state-no-effect.md
- src/resources/skills/react-best-practices/rules/rerender-derived-state.md
- src/resources/skills/react-best-practices/rules/rerender-functional-setstate.md
- src/resources/skills/react-best-practices/rules/rerender-lazy-state-init.md
- src/resources/skills/react-best-practices/rules/rerender-memo-with-default-value.md
- src/resources/skills/react-best-practices/rules/rerender-memo.md
- src/resources/skills/react-best-practices/rules/rerender-move-effect-to-event.md
- src/resources/skills/react-best-practices/rules/rerender-simple-expression-in-memo.md
- src/resources/skills/react-best-practices/rules/rerender-transitions.md
- src/resources/skills/react-best-practices/rules/rerender-use-ref-transient-values.md
- src/resources/skills/react-best-practices/rules/server-after-nonblocking.md
- src/resources/skills/react-best-practices/rules/server-auth-actions.md
- src/resources/skills/react-best-practices/rules/server-cache-lru.md
- src/resources/skills/react-best-practices/rules/server-cache-react.md
- src/resources/skills/react-best-practices/rules/server-dedup-props.md
- src/resources/skills/react-best-practices/rules/server-parallel-fetching.md
- src/resources/skills/react-best-practices/rules/server-serialization.md
- src/resources/skills/review/SKILL.md
- src/resources/skills/test/SKILL.md
- src/resources/skills/userinterface-wiki/rules/_sections.md
- src/resources/skills/userinterface-wiki/rules/_template.md
- src/resources/skills/userinterface-wiki/rules/a11y-reduced-motion-check.md
- src/resources/skills/userinterface-wiki/rules/a11y-toggle-setting.md
- src/resources/skills/userinterface-wiki/rules/a11y-visual-equivalent.md
- src/resources/skills/userinterface-wiki/rules/a11y-volume-control.md
- src/resources/skills/userinterface-wiki/rules/appropriate-confirmations-only.md
- src/resources/skills/userinterface-wiki/rules/appropriate-errors-warnings.md
- src/resources/skills/userinterface-wiki/rules/appropriate-no-decorative.md
- src/resources/skills/userinterface-wiki/rules/appropriate-no-high-frequency.md
- src/resources/skills/userinterface-wiki/rules/appropriate-no-punishing.md
- src/resources/skills/userinterface-wiki/rules/container-callback-ref.md
- src/resources/skills/userinterface-wiki/rules/container-guard-initial-zero.md
- src/resources/skills/userinterface-wiki/rules/container-no-excessive-use.md
- src/resources/skills/userinterface-wiki/rules/container-overflow-hidden.md
- src/resources/skills/userinterface-wiki/rules/container-transition-delay.md
- src/resources/skills/userinterface-wiki/rules/container-two-div-pattern.md
- src/resources/skills/userinterface-wiki/rules/container-use-resize-observer.md
- src/resources/skills/userinterface-wiki/rules/context-cleanup-nodes.md
- src/resources/skills/userinterface-wiki/rules/context-resume-suspended.md
- src/resources/skills/userinterface-wiki/rules/context-reuse-single.md
- src/resources/skills/userinterface-wiki/rules/design-filter-for-character.md
- src/resources/skills/userinterface-wiki/rules/design-noise-for-percussion.md
- src/resources/skills/userinterface-wiki/rules/design-oscillator-for-tonal.md
- src/resources/skills/userinterface-wiki/rules/duration-max-300ms.md
- src/resources/skills/userinterface-wiki/rules/duration-press-hover.md
- src/resources/skills/userinterface-wiki/rules/duration-shorten-before-curve.md
- src/resources/skills/userinterface-wiki/rules/duration-small-state.md
- src/resources/skills/userinterface-wiki/rules/easing-entrance-ease-out.md
- src/resources/skills/userinterface-wiki/rules/easing-exit-ease-in.md
- src/resources/skills/userinterface-wiki/rules/easing-for-state-change.md
- src/resources/skills/userinterface-wiki/rules/easing-linear-only-progress.md
- src/resources/skills/userinterface-wiki/rules/easing-natural-decay.md
- src/resources/skills/userinterface-wiki/rules/easing-no-linear-motion.md
- src/resources/skills/userinterface-wiki/rules/easing-transition-ease-in-out.md
- src/resources/skills/userinterface-wiki/rules/envelope-exponential-decay.md
- src/resources/skills/userinterface-wiki/rules/envelope-no-zero-target.md
- src/resources/skills/userinterface-wiki/rules/envelope-set-initial-value.md
- src/resources/skills/userinterface-wiki/rules/exit-key-required.md
- src/resources/skills/userinterface-wiki/rules/exit-matches-initial.md
- src/resources/skills/userinterface-wiki/rules/exit-prop-required.md
- src/resources/skills/userinterface-wiki/rules/exit-requires-wrapper.md
- src/resources/skills/userinterface-wiki/rules/impl-default-subtle.md
- src/resources/skills/userinterface-wiki/rules/impl-preload-audio.md
- src/resources/skills/userinterface-wiki/rules/impl-reset-current-time.md
- src/resources/skills/userinterface-wiki/rules/mode-pop-layout-for-lists.md
- src/resources/skills/userinterface-wiki/rules/mode-sync-layout-conflict.md
- src/resources/skills/userinterface-wiki/rules/mode-wait-doubles-duration.md
- src/resources/skills/userinterface-wiki/rules/morphing-aria-hidden.md
- src/resources/skills/userinterface-wiki/rules/morphing-consistent-viewbox.md
- src/resources/skills/userinterface-wiki/rules/morphing-group-variants.md
- src/resources/skills/userinterface-wiki/rules/morphing-jump-non-grouped.md
- src/resources/skills/userinterface-wiki/rules/morphing-reduced-motion.md
- src/resources/skills/userinterface-wiki/rules/morphing-spring-rotation.md
- src/resources/skills/userinterface-wiki/rules/morphing-strokelinecap-round.md
- src/resources/skills/userinterface-wiki/rules/morphing-three-lines.md
- src/resources/skills/userinterface-wiki/rules/morphing-use-collapsed.md
- src/resources/skills/userinterface-wiki/rules/native-backdrop-styling.md
- src/resources/skills/userinterface-wiki/rules/native-placeholder-styling.md
- src/resources/skills/userinterface-wiki/rules/native-selection-styling.md
- src/resources/skills/userinterface-wiki/rules/nested-consistent-timing.md
- src/resources/skills/userinterface-wiki/rules/nested-propagate-required.md
- src/resources/skills/userinterface-wiki/rules/none-context-menu-entrance.md
- src/resources/skills/userinterface-wiki/rules/none-high-frequency.md
- src/resources/skills/userinterface-wiki/rules/none-keyboard-navigation.md
- src/resources/skills/userinterface-wiki/rules/param-click-duration.md
- src/resources/skills/userinterface-wiki/rules/param-filter-frequency-range.md
- src/resources/skills/userinterface-wiki/rules/param-q-value-range.md
- src/resources/skills/userinterface-wiki/rules/param-reasonable-gain.md
- src/resources/skills/userinterface-wiki/rules/physics-active-state.md
- src/resources/skills/userinterface-wiki/rules/physics-no-excessive-stagger.md
- src/resources/skills/userinterface-wiki/rules/physics-spring-for-overshoot.md
- src/resources/skills/userinterface-wiki/rules/physics-subtle-deformation.md
- src/resources/skills/userinterface-wiki/rules/prefetch-hit-slop.md
- src/resources/skills/userinterface-wiki/rules/prefetch-keyboard-tab.md
- src/resources/skills/userinterface-wiki/rules/prefetch-not-everything.md
- src/resources/skills/userinterface-wiki/rules/prefetch-touch-fallback.md
- src/resources/skills/userinterface-wiki/rules/prefetch-trajectory-over-hover.md
- src/resources/skills/userinterface-wiki/rules/prefetch-use-selectively.md
- src/resources/skills/userinterface-wiki/rules/presence-disable-interactions.md
- src/resources/skills/userinterface-wiki/rules/presence-hook-in-child.md
- src/resources/skills/userinterface-wiki/rules/presence-safe-to-remove.md
- src/resources/skills/userinterface-wiki/rules/pseudo-content-required.md
- src/resources/skills/userinterface-wiki/rules/pseudo-first-line-styling.md
- src/resources/skills/userinterface-wiki/rules/pseudo-hit-target-expansion.md
- src/resources/skills/userinterface-wiki/rules/pseudo-marker-styling.md
- src/resources/skills/userinterface-wiki/rules/pseudo-over-dom-node.md
- src/resources/skills/userinterface-wiki/rules/pseudo-position-relative-parent.md
- src/resources/skills/userinterface-wiki/rules/pseudo-z-index-layering.md
- src/resources/skills/userinterface-wiki/rules/spring-for-gestures.md
- src/resources/skills/userinterface-wiki/rules/spring-for-interruptible.md
- src/resources/skills/userinterface-wiki/rules/spring-params-balanced.md
- src/resources/skills/userinterface-wiki/rules/spring-preserves-velocity.md
- src/resources/skills/userinterface-wiki/rules/staging-dim-background.md
- src/resources/skills/userinterface-wiki/rules/staging-one-focal-point.md
- src/resources/skills/userinterface-wiki/rules/staging-z-index-hierarchy.md
- src/resources/skills/userinterface-wiki/rules/timing-consistent.md
- src/resources/skills/userinterface-wiki/rules/timing-no-entrance-context-menu.md
- src/resources/skills/userinterface-wiki/rules/timing-under-300ms.md
- src/resources/skills/userinterface-wiki/rules/transition-name-cleanup.md
- src/resources/skills/userinterface-wiki/rules/transition-name-required.md
- src/resources/skills/userinterface-wiki/rules/transition-name-unique.md
- src/resources/skills/userinterface-wiki/rules/transition-over-js-library.md
- src/resources/skills/userinterface-wiki/rules/transition-style-pseudo-elements.md
- src/resources/skills/userinterface-wiki/rules/type-antialiased-on-retina.md
- src/resources/skills/userinterface-wiki/rules/type-disambiguation-stylistic-set.md
- src/resources/skills/userinterface-wiki/rules/type-font-display-swap.md
- src/resources/skills/userinterface-wiki/rules/type-justify-with-hyphens.md
- src/resources/skills/userinterface-wiki/rules/type-letter-spacing-uppercase.md
- src/resources/skills/userinterface-wiki/rules/type-no-font-synthesis.md
- src/resources/skills/userinterface-wiki/rules/type-oldstyle-nums-for-prose.md
- src/resources/skills/userinterface-wiki/rules/type-opentype-contextual-alternates.md
- src/resources/skills/userinterface-wiki/rules/type-optical-sizing-auto.md
- src/resources/skills/userinterface-wiki/rules/type-proper-fractions.md
- src/resources/skills/userinterface-wiki/rules/type-slashed-zero.md
- src/resources/skills/userinterface-wiki/rules/type-tabular-nums-for-data.md
- src/resources/skills/userinterface-wiki/rules/type-text-wrap-balance-headings.md
- src/resources/skills/userinterface-wiki/rules/type-text-wrap-pretty.md
- src/resources/skills/userinterface-wiki/rules/type-underline-offset.md
- src/resources/skills/userinterface-wiki/rules/type-variable-weight-continuous.md
- src/resources/skills/userinterface-wiki/rules/ux-aesthetic-usability.md
- src/resources/skills/userinterface-wiki/rules/ux-cognitive-load-reduce.md
- src/resources/skills/userinterface-wiki/rules/ux-common-region-boundaries.md
- src/resources/skills/userinterface-wiki/rules/ux-doherty-perceived-speed.md
- src/resources/skills/userinterface-wiki/rules/ux-doherty-under-400ms.md
- src/resources/skills/userinterface-wiki/rules/ux-fitts-hit-area.md
- src/resources/skills/userinterface-wiki/rules/ux-fitts-target-size.md
- src/resources/skills/userinterface-wiki/rules/ux-goal-gradient-progress.md
- src/resources/skills/userinterface-wiki/rules/ux-hicks-minimize-choices.md
- src/resources/skills/userinterface-wiki/rules/ux-jakobs-familiar-patterns.md
- src/resources/skills/userinterface-wiki/rules/ux-millers-chunking.md
- src/resources/skills/userinterface-wiki/rules/ux-pareto-prioritize-features.md
- src/resources/skills/userinterface-wiki/rules/ux-peak-end-finish-strong.md
- src/resources/skills/userinterface-wiki/rules/ux-postels-accept-messy-input.md
- src/resources/skills/userinterface-wiki/rules/ux-pragnanz-simplify.md
- src/resources/skills/userinterface-wiki/rules/ux-progressive-disclosure.md
- src/resources/skills/userinterface-wiki/rules/ux-proximity-grouping.md
- src/resources/skills/userinterface-wiki/rules/ux-serial-position.md
- src/resources/skills/userinterface-wiki/rules/ux-similarity-consistency.md
- src/resources/skills/userinterface-wiki/rules/ux-teslers-complexity.md
- src/resources/skills/userinterface-wiki/rules/ux-uniform-connectedness.md
- src/resources/skills/userinterface-wiki/rules/ux-von-restorff-emphasis.md
- src/resources/skills/userinterface-wiki/rules/ux-zeigarnik-show-incomplete.md
- src/resources/skills/userinterface-wiki/rules/visual-animate-shadow-pseudo.md
- src/resources/skills/userinterface-wiki/rules/visual-border-alpha-colors.md
- src/resources/skills/userinterface-wiki/rules/visual-button-shadow-anatomy.md
- src/resources/skills/userinterface-wiki/rules/visual-concentric-radius.md
- src/resources/skills/userinterface-wiki/rules/visual-consistent-spacing-scale.md
- src/resources/skills/userinterface-wiki/rules/visual-layered-shadows.md
- src/resources/skills/userinterface-wiki/rules/visual-no-pure-black-shadow.md
- src/resources/skills/userinterface-wiki/rules/visual-shadow-direction.md
- src/resources/skills/userinterface-wiki/rules/visual-shadow-matches-elevation.md
- src/resources/skills/userinterface-wiki/rules/weight-duration-matches-action.md
- src/resources/skills/userinterface-wiki/rules/weight-match-action.md
- src/resources/skills/verify-before-complete/SKILL.md
- src/resources/skills/web-design-guidelines/SKILL.md
- src/resources/skills/web-quality-audit/SKILL.md
- src/resources/skills/write-docs/SKILL.md

## Alignment (alignment mode only)

Not applicable — alignment mode is off (`.project/` artifacts were excluded from the inventory by the brief).

## User rulings

<!-- Appended after the ruling walk (standalone runs). Verbatim, append-only.
     accept-drift rulings suppress the item in future audits.
     `planned: no` rows are the alignment queue: /gsd-path and /gsd-path-plan offer
     to absorb them until drained. When a ruling becomes a task, set
     planned to the task id — never delete the row. -->

| Queue # | Ruling | User's words | Planned |
|---------|--------|--------------|---------|
| 7 | verified (reclassified) | Configurator URL fetched live 2026-08-01 during grill: pi.opengsd.net serves the cloud config editor — claim stands | n/a |
| 11, 12, 13, 14, 15 | fix-doc | ADR-004/-009/-011/-013/-036 status labels not confirmable from code → downgrade labels to match reality ("an ADR labeled Implemented that the auditor can't find is worse than one honestly labeled Accepted, partially landed"); lean presented 2026-08-01, no user objection | n/a (verified fixed in code by v1 T018; 2026-08-22 re-audit confirms labels now verify; user ruled skip+close 2026-08-22) |
| 36, 37, 39 (and 8) | no ruling needed | External vendor/tool references (claude.ai installer, npx skills CLI, Docker Desktop 4.58+) — remediation already "None — external" | n/a |
| 41–70 | accept-drift | Vendored upstream docs (packages/pi-*) keep upstream pi / ~/.pi/ / @earendil-works wording per overlay policy: "Patching vendored docs creates merge friction on every upstream sync for zero runtime benefit"; lean presented 2026-08-01, no user objection | n/a (accept-drift) |
| ci-cd-pipeline.md row | fix-doc | Document the manual npm-publish.yml reality; automatic Dev→Test→Prod promotion "will burn the next person who waits for a promotion that never fires"; lean presented 2026-08-01, no user objection | n/a (verified fixed in code by v1 T017; 2026-08-22 re-audit confirms the manual-publish reality is documented; user ruled skip+close 2026-08-22) |
| 8, 29, 30, 32, 45–52 | no ruling needed | External vendor/tool references (Docker Desktop 4.58+, claude.ai installer, npx skills CLI, agent-browser CLI) — "No ruling needed — external" (2026-08-22, adr-046-completion synthesis checkpoint; same class as v1 rows 36–39) | n/a |

## Remediation queue

<!-- Every non-verified claim, classified. The user rules on this queue;
     the auditor never fixes anything. Vendored packages/pi-* upstream-wording
     stale items are suppressed here per the standing accept-drift ruling.
     External vendor/tool references carry "None — external" per the standing
     no-ruling-needed row. -->

| # | Doc | Claim | Verdict | Class | Suggested action |
|---|-----|-------|---------|-------|------------------|
| 1 | src/resources/extensions/gsd/skills/gsd-headless/SKILL.md | "Exit codes: 0=complete, 1=error/timeout, 2=blocked" | stale | fix-doc | Correct to 0/1/10/11 to match src/headless-events.ts:29-30 and gsd-orchestrator/SKILL.md:42 |
| 2 | .plans/autocomplete-qol-improvements.md | References packages/pi-coding-agent/src/modes/interactive/interactive-mode.ts | stale | fix-doc | Refresh the referenced paths or mark the plan historical |
| 3 | .plans/issue-125-provider-fallback.md | References packages/pi-coding-agent/src/cli/commands/settings.ts | stale | fix-doc | Refresh the referenced paths or mark the plan historical |
| 4 | .plans/left-native-tui-main-session-plan.md | References packages/pi-coding-agent/src/modes/interactive/interactive-mode.ts | stale | fix-doc | Refresh the referenced paths or mark the plan historical |
| 5 | .plans/workflow-templates.md | Status: In Progress — Phase 1 | stale | fix-doc | Update status to reflect shipped state |
| 6 | CONTEXT.md | auto.ts wires a concrete module through createWiredAutoOrchestrationModule(...) | stale | fix-doc | Update snapshot to the current wiring (createAutoOrchestrator, auto.ts:287) or mark the snapshot historical |
| 7 | CONTRIBUTING.md | Recurring defect classes reference issue #4931 | stale | fix-doc | Re-link to the equivalent open-gsd/gsd-pi issue or drop the number |
| 8 | docker/README.md | Requires Docker Desktop 4.58+ | unverifiable | NEEDS-USER | None — external requirement |
| 9 | docs/README.md | Release Notes link described as 'Current 1.2.0 release notes' | stale | fix-doc | Update or de-version the description |
| 10 | docs/agents/triage-labels.md | ready-for-agent / ready-for-human / wontfix 'will be created on first use' | stale | fix-doc | Drop the create-on-first-use note and the gh label create block |
| 11 | docs/dev/extending-pi/03-getting-started.md | Uses `pi` CLI in examples (e.g. pi -e ./my-extension.ts) | stale | fix-doc | Rename command examples to `gsd` |
| 12 | docs/dev/extending-pi/06-the-extension-lifecycle.md | Uses `pi` CLI in examples | stale | fix-doc | Rename command examples to `gsd` |
| 13 | docs/dev/extending-pi/10-custom-tools-giving-the-llm-new-abilities.md | Uses `pi` CLI in examples | stale | fix-doc | Rename command examples to `gsd` |
| 14 | docs/dev/extending-pi/19-packaging-distribution.md | Uses `pi` CLI in examples | stale | fix-doc | Rename command examples to `gsd` |
| 15 | docs/dev/superpowers/plans/2026-03-17-cicd-pipeline.md | Plan targets tests/fixtures/* replay harness and an auto Dev→Prod promotion pipeline | stale | fix-doc | Archive the plan or annotate superseded-by current pipeline |
| 16 | docs/dev/what-is-pi/01-what-pi-is.md | Uses `pi` as the CLI binary in command examples | stale | fix-doc | Rename command examples to `gsd` (or note the upstream binary name explicitly) |
| 17 | docs/dev/what-is-pi/03-the-four-modes-of-operation.md | Uses `pi` as the CLI binary in command examples | stale | fix-doc | Rename command examples to `gsd` |
| 18 | docs/dev/what-is-pi/06-tools-how-pi-acts-on-the-world.md | Uses `pi` as the CLI binary in command examples | stale | fix-doc | Rename command examples to `gsd` |
| 19 | docs/dev/what-is-pi/10-providers-models-multi-model-by-default.md | Uses `pi` as the CLI binary in command examples | stale | fix-doc | Rename command examples to `gsd` |
| 20 | docs/dev/what-is-pi/13-context-files-project-instructions.md | Uses `pi` as the CLI binary in command examples | stale | fix-doc | Rename command examples to `gsd` |
| 21 | docs/dev/what-is-pi/14-the-sdk-rpc-embedding-pi.md | Uses `pi` as the CLI binary in command examples | stale | fix-doc | Rename command examples to `gsd` |
| 22 | docs/dev/what-is-pi/15-pi-packages-the-ecosystem.md | Uses `pi` as the CLI binary in command examples | stale | fix-doc | Rename command examples to `gsd` |
| 23 | docs/dev/what-is-pi/17-file-reference-all-documentation.md | Lists docs/what-is-pi/19-... and docs/session.md under the installed package root | stale | fix-doc | Correct the relative paths |
| 24 | docs/dev/what-is-pi/18-quick-reference-commands-shortcuts.md | Uses `pi` as the CLI binary in command examples | stale | fix-doc | Rename command examples to `gsd` |
| 25 | docs/dev/what-is-pi/19-building-branded-apps-on-top-of-pi.md | References packages/coding-agent/* and packages/web-ui/README.md | stale | fix-doc | Repoint to the gsd-pi layout |
| 26 | docs/prompt-db-combined-map.md | DISPATCH_RULES has 29 rules | stale | fix-doc | Update the rule count (31 at HEAD) or drop the number |
| 27 | docs/superpowers/plans/2026-06-21-gsd-core-pi-backwards-compat.md | References docs/how-to/switching-between-gsd-tools.md | stale | fix-doc | Repoint the link to docs/user-docs/ |
| 28 | docs/superpowers/specs/2026-06-21-gsd-core-pi-backwards-compat-design.md | References docs/how-to/switching-between-gsd-tools.md | stale | fix-doc | Repoint the link to docs/user-docs/ |
| 29 | docs/user-docs/claude-code-subscription.md | curl -fsSL https://claude.ai/install.sh \| bash installer | unverifiable | NEEDS-USER | None — external vendor command |
| 30 | docs/user-docs/skills.md | npx skills add/check/update third-party CLI | unverifiable | NEEDS-USER | None — external tool reference |
| 31 | docs/zh-CN/user-docs/commands.md | `gsd --debug` top-level flag enables diagnostic logging | stale | fix-doc | Remove the row or scope it to /gsd auto --debug |
| 32 | gitbook/features/skills.md | npx skills add/check/update third-party CLI | unverifiable | NEEDS-USER | None — external tool reference |
| 33 | gitbook/reference/cli-flags.md | `gsd --debug` top-level flag enables diagnostic logging | stale | fix-doc | Remove the row or scope it to /gsd auto --debug |
| 34 | plans/README.md | Index omits rows for plans 040-045 | stale | fix-doc | Add the missing rows (045 added since the prior audit) |
| 35 | plans/README.md | Note says plan 032's file was lost and is NOT recoverable | stale | fix-doc | Reword the note — plan number 032 was reused for a different scope |
| 36 | vscode-extension/CHANGELOG.md | Changelog records [1.0.0] - 2026-05-22 as the only release | stale | fix-doc | Reconcile the changelog with package.json version 0.3.0 |
| 37 | src/resources/skills/decompose-into-slices/SKILL.md | Milestone artifacts at .gsd/milestones/<MID>/<MID>-CONTEXT.md / -ROADMAP.md | stale | fix-doc | Update to the flat-phase layout (phases/NN-slug/NN-*.md) or note legacy-only |
| 38 | src/resources/skills/handoff/SKILL.md | Create .gsd/milestones/<MID>/slices/<SID>/continue.md | stale | fix-doc | Update to the flat-phase layout or note legacy-only |
| 39 | src/resources/skills/write-milestone-brief/SKILL.md | "use gsd_milestone_new" | stale | fix-doc | Point at the real milestone-creation flow (/gsd new-milestone / gsd_milestone_generate_id) |
| 40 | src/resources/skills/write-milestone-brief/SKILL.md | Write .gsd/milestones/<MID>/<MID>-CONTEXT.md | stale | fix-doc | Update to the flat-phase layout or note legacy-only |
| 41 | src/resources/skills/react-best-practices/README.md | Vendored README build pipeline (pnpm build/validate/extract-tests, src/, AGENTS.md output) | stale | fix-doc | Trim the README to what actually ships (metadata.json, SKILL.md, rules/) or mark it upstream-only |
| 42 | src/resources/skills/userinterface-wiki/SKILL.md | Frontmatter description says "Covers 11 categories" | stale | fix-doc | Bump to 12 to match the file's own category table |
| 43 | mintlify-docs/guides/git-strategy.mdx | "Changed in v2.45.0" default-isolation note | stale | fix-doc | Re-label with a version that exists in this repo's versioning (or drop the version) |
| 44 | mintlify-docs/guides/troubleshooting.mdx | "v2.45+" version references (lines 202-215) | stale | fix-doc | Re-label with a version that exists in this repo's versioning (or drop the version) |
| 45 | src/resources/skills/agent-browser/SKILL.md | agent-browser CLI workflow commands | unverifiable | NEEDS-USER | None — external tool reference |
| 46 | src/resources/skills/agent-browser/references/authentication.md | agent-browser CLI usage | unverifiable | NEEDS-USER | None — external tool reference |
| 47 | src/resources/skills/agent-browser/references/commands.md | agent-browser CLI command reference | unverifiable | NEEDS-USER | None — external tool reference |
| 48 | src/resources/skills/agent-browser/references/profiling.md | agent-browser CLI usage | unverifiable | NEEDS-USER | None — external tool reference |
| 49 | src/resources/skills/agent-browser/references/proxy-support.md | agent-browser CLI usage | unverifiable | NEEDS-USER | None — external tool reference |
| 50 | src/resources/skills/agent-browser/references/session-management.md | agent-browser CLI usage | unverifiable | NEEDS-USER | None — external tool reference |
| 51 | src/resources/skills/agent-browser/references/snapshot-refs.md | agent-browser CLI usage | unverifiable | NEEDS-USER | None — external tool reference |
| 52 | src/resources/skills/agent-browser/references/video-recording.md | agent-browser CLI usage | unverifiable | NEEDS-USER | None — external tool reference |
