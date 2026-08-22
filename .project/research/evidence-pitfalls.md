# Evidence — pitfalls

<!-- Written by one researcher role. Consumed by the decider. -->

Dimension: pitfalls
Questions assigned: none

Scope covered: failure modes of retiring the legacy import compatibility path —
(1) existing behavior at HEAD for pre-cutover projects, (2) downgrade/interop,
(3) backup/restore interplay with ADR-046 Migration step 7, (4) UX/support
surfaces, (5) practitioner evidence on retiring migration paths.

## Finding: A markdown-only pre-cutover project opened at HEAD gets an empty database plus a warning that says to run `/gsd recover` — deleting the import machinery converts that warning into a dead end

- **Claim**: When a project directory has `.gsd/` markdown but no populated DB, `openWorkflowDatabase` silently creates an empty `gsd.db` (`reason: "created-empty"`), state derivation fails closed (returns `null` milestones, never parses markdown), and the startup drift check `checkMarkdownHierarchyAgainstDb` returns `recovery-required` with `recoveryCommand: "/gsd recover"` and the message "Runtime startup will not import markdown automatically; run `/gsd recover` and approve its exact Preview hash if markdown should repopulate the database." `guided-flow.ts` surfaces this as a startup warning notification. So the current failure mode is degraded-but-guided; after deleting `legacy-import-*` the same startup path would tell users to run a command that no longer exists.
- **Source**: `src/resources/extensions/gsd/db-workspace.ts:156-201` (created-empty path); `src/resources/extensions/gsd/state.ts:179-194` ("Fail closed: an unavailable DB is not a license to parse markdown (T022)"); `src/resources/extensions/gsd/migration-auto-check.ts:353-384` (recovery-required + message, opened and read); `src/resources/extensions/gsd/guided-flow.ts:2057-2108` (startup wiring + notify, opened and read).
- **Confidence**: high
- **Why it matters here**: INTENT.md success criterion 3 requires deletion to leave CI green and "no legacy import/export code paths" — but criterion 5 and the "Must not break" list require honest docs and working UX; this finding identifies the exact startup seam that must be re-pointed or it becomes the primary user-facing breakage of deletion.

## Finding: `/gsd recover` (slash + headless) is implemented entirely by the `legacy-import-*` cluster; there is no non-legacy import path

- **Claim**: The recover handler in `commands-maintenance.ts` (`/gsd recover` with `--preview=<sha256>`, `--application`, `--restore`, `--consent`, `--forward-repair`) calls `executeLegacyImportRecoveryAction` from `legacy-import-recovery-action.ts` and the `prepareVerifiedRecover*` / `applyPreparedVerifiedRecoverApplication` / `loadVerifiedRecoverApplication` family in `db-workspace.ts`, which imports `legacy-import-application`, `legacy-import-backup`, `legacy-import-preview`, `legacy-import-restore-drill`, and `legacy-import-restore-assessment` (8 import statements, lines 35-68). The headless variant `gsd headless recover` jiti-loads `db-workspace.ts` and `legacy-import-recovery-action.ts` directly. Deleting the cluster removes the only markdown→DB import path in the product.
- **Source**: `src/resources/extensions/gsd/commands-maintenance.ts:28-34, 494-665` (opened); `src/resources/extensions/gsd/db-workspace.ts:35-68, 502-606, 756-842` (opened); `src/headless-recover.ts:51-52` (opened).
- **Confidence**: high
- **Why it matters here**: INTENT.md lists "the explicit Import Preview/Application path" under "Must not break … until the ruling lands" — this pins down exactly which files and command surfaces the ruling covers.

## Finding: `/gsd migrate` (the v1 `.planning` migration promised in all shipped docs) also depends on the legacy-import cluster — deletion guts a second, separately documented migration path

- **Claim**: `src/resources/extensions/gsd/migrate/execution.ts` imports `inspectLegacyImportApplicationEvidence` (`legacy-import-application-evidence.js`), application-result types, `executeLegacyImportRecoveryAction` (`legacy-import-recovery-action.js`), `captureCurrentLegacyImportBaseSnapshot` (`legacy-import-preview-base.js`), and forward-repair choice types; `migrate/audit.ts` and `migrate/publication-store.ts` import `hashLegacyImportValue` from `legacy-import-preview.js`. The user docs describe `/gsd migrate` as using "the verified backup, retained Import Application, and retry behavior" — i.e. the same machinery. Deleting `legacy-import-*` therefore breaks not just pre-cutover markdown recovery but also the v1 gsd-core `.planning` → `.gsd` migration that `docs/user-docs/migration.md`, `gitbook/reference/commands.md:55`, and `mintlify-docs/guides/migration.mdx` all promise.
- **Source**: `src/resources/extensions/gsd/migrate/execution.ts:15-21, 63`; `src/resources/extensions/gsd/migrate/audit.ts:20-26`; `src/resources/extensions/gsd/migrate/publication-store.ts:19-20`; `docs/user-docs/migration.md:5-30` (opened); `mintlify-docs/guides/migration.mdx:8-31` (opened); `gitbook/reference/commands.md:55`.
- **Confidence**: high
- **Why it matters here**: INTENT.md scope says "Deletion of the explicit legacy import/export machinery (`legacy-import-*.ts` and dependents)" — "dependents" provably includes the v1 migration command, so the deletion ruling implicitly decides the fate of `/gsd migrate` too; the decider needs that on the table.

## Finding: The ADR-046 Migration step 7 restore window is implemented only inside the legacy-import cluster, and the ADR requires backups to outlive the import machinery by at least one stable release

- **Claim**: ADR-046 step 7 (restore the verified pre-import backup only while its Import Application remains the canonical head; any later Domain Operation or cutover permanently closes the window) is enforced by `legacy-import-live-restore.ts` ("Sole crash-convergent owner for an eligible live legacy-import database restore"; lineage check `applicationResultingAuthorityEpoch === backupAuthorityEpoch` at :874) together with `legacy-import-restore-assessment.ts` and `legacy-import-backup.ts`. The ADR also states "Backups remain available through that window and at least one later stable release." No general-purpose `gsd backup`/`gsd restore` command exists outside this machinery (repo-wide search found none). Deleting the cluster therefore strands (a) any project whose restore window is still open and (b) the documented backup-availability guarantee.
- **Source**: `docs/dev/ADR-046-database-authoritative-workflow-lifecycle.md:244-260` (opened); `src/resources/extensions/gsd/legacy-import-live-restore.ts:1-2, 539-584, 874`; Grep for `gsd backup|gsd restore|restoreLegacyImportBackup` across `src/resources/extensions/gsd` → no command implementation outside legacy-import files.
- **Confidence**: high
- **Why it matters here**: INTENT.md constraint "ADR-046's invariants and removal gates are binding" — step 7 and the backup sentence mean a compliant deletion either keeps backup/restore alive longer than import, or waits until no restore window can still be open; both options constrain the deletion ordering.

## Finding: Core non-legacy modules import shared utilities from `legacy-import-preview.js` — wholesale file deletion breaks domain operations, authority recovery, and cutover code that must survive

- **Claim**: `canonicalLegacyImportJson` and `hashLegacyImportValue` are defined in `legacy-import-preview.ts` but imported by `db/domain-operation.ts:17` (the revision-checked write boundary every domain mutation uses), `db/writers/authority-recovery.ts:17`, `project-authority-cutover-domain-operation.ts:27` (Authority Epoch cutover), `db/writers/legacy-import-application.ts:32`, and the migrate modules. A naive `git rm legacy-import-*.ts` removes functions the surviving core depends on.
- **Source**: Grep `legacy-import-preview\.js` across `src/resources/extensions/gsd` (content mode, opened results); `src/resources/extensions/gsd/db/domain-operation.ts:17`; `src/resources/extensions/gsd/db/writers/authority-recovery.ts:17`; `src/resources/extensions/gsd/project-authority-cutover-domain-operation.ts:27`.
- **Confidence**: high
- **Why it matters here**: INTENT.md success criterion 3 requires green `test:unit:compiled` + `test:integration` after deletion; this finding shows deletion is an extraction (re-home shared utilities first), not a plain removal — sizing information for the planner and the blast-radius ruling.

## Finding: Downgrade/version-skew is already handled loudly at HEAD by refuse-newer stamps — this failure mode has code, tests, and docs; it does not depend on the import machinery

- **Claim**: The engine stamps `PRAGMA application_id` (GSD_APPLICATION_ID 0x47534442) and `PRAGMA user_version` at schema V46 and throws a typed `SchemaTooNewError` ("gsd.db schema is vN, newer than the v48 this gsd-pi supports. Update gsd-pi (npm i -g @opengsd/gsd-pi) before opening this project.") when `currentVersion > SCHEMA_VERSION` (48). `openWorkflowDatabase` maps it to a distinguishable `{ ok: false, reason: "schema-too-new" }` result, and state-read seams rethrow rather than degrade to empty state. Tests cover v45→v48 stamping, the exact refuse-newer message, and the v45 backup. The gitbook troubleshooting page documents this error for users. So: imported-then-downgraded projects on any binary ≥ the V46-stamp release fail loudly with an actionable message — the safe failure mode already exists and survives import-machinery deletion. Binaries older than the V46 stamps carry no such check (unverifiable in this clone: shallow history, 57 commits).
- **Source**: `src/resources/extensions/gsd/db/engine.ts:163-199, 496-522` (opened); `src/resources/extensions/gsd/db-workspace.ts:90-118, 174-200` (opened); `src/resources/extensions/gsd/state/derive/db-open.ts:28-40` (opened); `src/resources/extensions/gsd/tests/db-open-version-stamp.test.ts:1-10, 124`; `gitbook/reference/troubleshooting.md:47`.
- **Confidence**: high for HEAD behavior; medium on which historical release first shipped the stamps (shallow clone, `git rev-parse --is-shallow-repository` → true per evidence-codebase.md)
- **Why it matters here**: Addresses the downgrade/interop failure mode the decider asked about: the Authority-Epoch/version-stamp side of interop is built and tested, so it is not a blocker for deletion — but it also means the only remaining reason to keep import machinery is pre-cutover *source* projects, not downgrades.

## Finding: All three shipped doc trees plus the zh-CN mirror promise the import/migration path; deletion without synchronized doc edits creates exactly the doc-vs-code contradiction INTENT forbids

- **Claim**: `docs/user-docs/migration.md` (the self-described "authoritative recovery contract") documents `/gsd migrate`, `/gsd recover` with the exact `--preview` hash flow, restore-window semantics, and Forward Repair; `gitbook/reference/commands.md:56` lists `/gsd recover`; `gitbook/reference/troubleshooting.md:259-261` and `mintlify-docs/guides/troubleshooting.mdx:271-275` point users at the recovery contract for a damaged database; `mintlify-docs/guides/migration.mdx` mirrors the migrate doc; `docs/zh-CN/user-docs/migration.md` is a verified Simplified-Chinese mirror. Keep-but-deprecated breaks none of these; deletion breaks all of them.
- **Source**: `docs/user-docs/migration.md:1-72` (opened); `gitbook/reference/commands.md:55-58`; `gitbook/reference/troubleshooting.md:259-261`; `mintlify-docs/guides/troubleshooting.mdx:271-275`; `mintlify-docs/guides/migration.mdx:47-57`; `.project/research/DOCS-AUDIT.md:524-528, 676-680` (migration docs verified accurate against code at audit time).
- **Confidence**: high
- **Why it matters here**: INTENT.md success criterion 5 forbids shipped docs contradicting the completed cutover; this enumerates the doc surface whose fate is bound to the deletion ruling — a deletion ship needs doc edits in 3+ trees plus a translation, not just code.

## Finding: The documented markdown-fallback escape hatch `GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK=1` has no implementation anywhere in the repo — doc drift already exists on this exact recovery surface

- **Claim**: `gitbook/reference/environment-variables.md:13` and `gitbook/core-concepts/auto-mode.md:54-55` tell users they can set `GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK=1` "for tests or explicit recovery workflows that must derive state from rendered markdown when the database is unavailable." A repo-wide content search finds the string only in those two doc files — no code reads it. Users following this guidance during a recovery get nothing.
- **Source**: `gitbook/reference/environment-variables.md:13`; `gitbook/core-concepts/auto-mode.md:54-55`; Grep `GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK` repo-wide → 2 files, both docs.
- **Confidence**: high
- **Why it matters here**: Shows the support surface around legacy recovery is already drifting even with the code alive — evidence for the pitfalls question "what breaks if the path is deleted vs kept": part of the doc promise is broken today regardless of the ruling, and belongs on the doc-drift fix list either way.

## Finding: The import/recover path has a live bug tail at HEAD — users are actively exercising it mid-window

- **Claim**: CHANGELOG entries at or after the import machinery's ship release (1.12.0, 2026-08-03) include user-filed issue fixes: migration import deadlocks (#1868), recover blocked for flat-phase drifted projects (#1830, "blocks all recovery"), migration staging resolving to the live repo `.gsd` (#1866), and closeout finding legacy `tasks/` dirs DB projects never create. The machinery shipped 2026-08-03; 1.16.1 shipped 2026-08-21; the research date is 2026-08-22 — 19 elapsed days versus the ADR's ≥60-day floor (the full window math is the removal-gates dimension's question; here the point is that mid-window users with active recover/migrate sessions demonstrably exist).
- **Source**: `CHANGELOG.md:11, 18, 41, 55, 238-268, 298` (opened; ship entries "seal public legacy import preview", "compose transactional legacy import application", "route explicit recover through import application" all under `## [1.12.0] - 2026-08-03`).
- **Confidence**: high
- **Why it matters here**: INTENT.md's user segment "GSD Pi users who migrated from pre-cutover versions (they rely on the import compatibility window being honored or explicitly ruled on)" is not hypothetical — the bug tail proves active usage; a premature-deletion failure mode would hit real, currently-served users.

## Finding: Multiple runtime error/guidance strings point users at the import path; keep-but-deprecated leaves them truthful, deletion strands them

- **Claim**: Strings surfaced to users that reference the import path: (a) `migration-auto-check.ts:383` startup drift message ("run `/gsd recover` and approve its exact Preview hash"); (b) `flat-phase-migration.ts:38` — flat-phase migration failure guidance "Recommended: run `/gsd recover` and approve its exact Preview hash to import explicitly" (asserted in tests at `flat-phase-migration.test.ts:593-606`); (c) `doctor-engine-checks.ts:1018` — doctor flags DB-open-with-completion-artifact as "Runtime will not import it silently; run explicit recovery/repair after review"; (d) `state/derive/db-open.ts:52-54` — DB-unavailable state's nextAction says "If this project only has markdown state, run /gsd migrate explicitly." Deleting import machinery requires editing all four surfaces (and their tests) or shipping commands that error.
- **Source**: files/lines as cited (all opened or grep-verified with `-n`).
- **Confidence**: high
- **Why it matters here**: INTENT.md success criteria 3+5 (green CI, no contradicting docs); these strings are the concrete checklist of user-facing seams that must change in the same ship as any deletion.

## Finding: Kubernetes' deprecation policy measures the window from *announced deprecation*, requires warnings during the window, and never removes the ability to decode persisted data

- **Claim**: Kubernetes requires GA CLI elements to "function after their announced deprecation for no less than 12 months or 2 releases (whichever is longer)" (Rule #5a), requires deprecated elements to emit warnings (Rule #6), requires new storage versions to ship in a release that still supports the old one so users can roll back (Rule #4b), and — until issue #52185 resolves — forbids removing any API version whose data may be persisted, i.e. the server "must remain capable of decoding/converting previously persisted data from storage." ADR-046's window (two stable releases + ≥60 days from *ship*, with no deprecation-warning stage) is materially weaker than the Kubernetes bar measured from deprecation; the import path works silently today and would go straight from fully-working to deleted.
- **Source**: https://kubernetes.io/docs/reference/using-api/deprecation-policy/ (opened in full)
- **Confidence**: high
- **Why it matters here**: The practitioner-standard pattern for exactly this situation (retiring a CLI-facing migration surface over a persisted store) includes a warning stage GSD Pi has not implemented; supports a keep-but-deprecate-with-warning intermediate step before deletion.

## Finding: Django keeps deprecation shims for at least two feature releases and schedules removal in a named release

- **Claim**: Django's policy: a feature deprecated in release A.x keeps working (with warnings) through all A.x and is removed in B.0, or B.1 for late-cycle deprecations — "deprecations are done over at least 2 feature releases" — and LTS-to-LTS upgrade paths explicitly extend shim lifetimes so third parties can bridge LTS versions.
- **Source**: https://docs.djangoproject.com/en/5.2/internals/release-process/#deprecation-policy (opened in full)
- **Confidence**: high
- **Why it matters here**: Independent corroboration of the "≥2 releases with live warnings" norm; GSD Pi's import path currently has no warning stage, so a two-release clock has not even started in the Django sense.

## Finding: Node.js uses graduated deprecation levels and ships codemods for removals; several removals were revoked after user pushback

- **Claim**: Node.js classifies deprecations as Documentation-only → Application → Runtime → End-of-Life, assigns permanent DEP identifiers, ships automated codemods for many End-of-Life APIs (e.g. `fs.rmdir` recursive, DEP0147), and has revoked deprecations when usage evidence warranted it (DEP0033 `listenerCount`, DEP0089 `require('assert')`, DEP0116 legacy URL API marked "Deprecation revoked").
- **Source**: https://nodejs.org/api/deprecations.html (opened in full)
- **Confidence**: high
- **Why it matters here**: Two lessons for the deferred ruling: (1) graduated stages (docs-only → warning → removal) are the norm for mature CLI runtimes, and GSD Pi is currently at "no stage"; (2) revocation precedent says "kept too long" is recoverable and cheap, while "removed too early" is what strands users — relevant to the NEEDS-USER ruling asymmetry.

## Finding: SQLite promises the on-disk format stays readable forever — the storage-authority norm GSD Pi users will assume applies to their gsd-era data

- **Claim**: SQLite commits to supporting its C API and on-disk format "fully backwards compatible" through 2050 — "Database files created today will be readable and writable by future versions of SQLite decades in the future" — and the US Library of Congress cites it as a preservation format. GSD Pi stores workflow authority in SQLite and renders markdown as projections; the legacy import path is the only bridge that moves pre-cutover *markdown-era* content into that durable store.
- **Source**: https://www.sqlite.org/lts.html (opened in full)
- **Confidence**: high (as practitioner norm; the application to GSD Pi is inference)
- **Why it matters here**: Frames the user-expectation risk: users treat `gsd.db` content as permanent; deleting the only bridge from legacy markdown before every legacy project has crossed it violates the durability norm of the very storage layer GSD Pi adopted.

## Finding: Terraform explicitly scopes what is *not* promised ("Commands That Might Change") and guarantees any-v1.x → any-later-v1.x upgrades without intermediate stops

- **Claim**: Terraform's v1 compatibility promises guarantee upgrades "from any v1.x release to any later v1.x release" with no special steps, disclaim downgrades once newer storage formats are used, treat compatibility regressions as bugs, and publish an explicit list of commands excluded from the promise. The precedent: durable-state tools either promise infinite upgrade span or explicitly mark surfaces as unpromised — they do not leave the boundary implicit.
- **Source**: https://developer.hashicorp.com/terraform/language/v1-compatibility-promises (opened in full)
- **Confidence**: high
- **Why it matters here**: GSD Pi's boundary is currently implicit; whether the ruling is delete or keep, INTENT.md criterion 2 (a recorded ruling) has a practitioner precedent: write down which compatibility surfaces are promised and for how long, in the style of Terraform's explicit exclusion list.

## Finding: GitLab's "required upgrade stops + background migrations must finish first" shows the mid-migration stranding incident pattern

- **Claim**: GitLab forces upgrades through required stops and requires batched background migrations to reach "Finished" before the next upgrade; upgrading early breaks instances, and stuck-migration upgrade failures are a recurring support incident (e.g. gitlab-org/gitlab#388094, forum reports of migrations stuck at 0%). The pattern: users who arrive mid-migration or from far behind need a supported, ordered route — deleting the route converts a slow upgrade into an impossible one.
- **Source**: https://docs.gitlab.com/update/upgrade_paths/ (content verified via the published doc mirrors returned by search, e.g. the doc/update/index.md source and docs.gitlab.co.jp background-migrations page); incident example https://gitlab.com/gitlab-org/gitlab/-/issues/388094
- **Confidence**: medium (policy text verified; incident mechanics from one issue + forum leads, not exhaustively confirmed)
- **Why it matters here**: Direct analogue to a GSD Pi user on ≤1.11.x (markdown-era) who upgrades to a post-deletion release: without the import bridge there is no ordered route left, which is precisely the failure mode the compatibility window exists to prevent.

## Assigned questions — answers

- none → nothing assigned; coverage per the dispatch: existing failure modes at HEAD (Findings 1-2, 8-10), downgrade/interop (Finding 6), backup/restore interplay (Finding 4), UX/support surfaces (Findings 3, 7-10), practitioner evidence (Findings 11-16).

## Dead ends

- `GSD_ALLOW_MARKDOWN_DERIVE_FALLBACK` implementation — searched repo-wide; exists only in two gitbook pages. Not a live escape hatch; promoted to a finding (doc drift) instead of a code path.
- Independent `gsd backup` / `gsd restore` command outside legacy import — none exists; folded into the restore-window finding rather than reported separately.
- Satellite surfaces (`vscode-extension/src`, `web/`) — grepped for `recover`/`legacy-import`/`migrate`; no references. The import path is CLI/headless-only, so deletion has no satellite blast radius.
- `scripts/legacy-state-path-proof.mjs` — does not reference `legacy-import-*` files directly; it asserts structural invariants via the `tests/parsers-legacy-importers.test.ts` registry. Gate disposition after deletion is the domain dimension's assigned question, not re-covered here.
- `.project/archive/v1-state-db-cutover/research/evidence-pitfalls.md` — prior milestone's pitfalls research (read-only per INTENT constraint). Its downgrade finding ("fails loudly at DB open — and that is the entire downgrade story") matches this file's Finding 6; not re-derived in detail, treated as corroborating historical reference only.
- Which release first shipped the V46 version stamps / refuse-newer — unverifiable: clone is shallow (57 commits) and CHANGELOG does not name the schema version per release. Recorded as medium-confidence gap inside Finding 6.
