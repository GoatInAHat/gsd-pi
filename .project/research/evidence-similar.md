# Evidence — similar

<!-- Written by one researcher role. Consumed by the decider. -->

Dimension: similar
Questions assigned: none

Scope note: INTENT.md assigns no RESEARCH question to this dimension. The
brief asked for lessons from comparable developer tools on how they retire
compatibility/migration paths, mapped to the three deferred NEEDS-USER
rulings: (a) delete on static proof vs build telemetry evidence first; (b)
compat-window length for data-migration paths vs pure API deprecations; (c)
whether "time + releases" windows are hard gates or advisory. All sources
below were opened live on 2026-08-22.

## Finding: Kubernetes codifies "time OR releases, whichever is longer" as a hard floor, with mandatory runtime warnings

- **Claim**: The official Kubernetes deprecation policy sets minimums as hard floors — GA user-facing CLI elements "must function after their announced deprecation for no less than 12 months or 2 releases (whichever is longer)"; admin-facing GA 6 months or 1 release; features/behaviors ≥1 year — and Rule #6 requires deprecated CLI elements to emit warnings when used. Windows run from *announced deprecation*, not from replacement-ship.
- **Source**: https://kubernetes.io/docs/reference/using-api/deprecation-policy/ (Rules #4a, #5a, #5b, #6, #7)
- **Confidence**: high
- **Why it matters here**: ADR-046's "2 releases + ≥60 days" has exactly the shape of the industry-standard floor ("N releases OR M days, whichever is longer"). The comparable-tools answer to ruling (c): the *minimum* is a hard gate; the scheduled removal date is not. Note the anchor differs — K8s counts from deprecation announcement, so the decider should confirm what ADR-046's window is anchored to (import-path ship vs deprecation marker).

## Finding: Kubernetes forbids removing the ability to decode old persisted data even after API removal

- **Claim**: The K8s policy states (note under Rule #4a, pending issue #52185): "no API versions that have been persisted to storage may be removed… the API server must remain capable of decoding/converting previously persisted data from storage." Serving endpoints may be disabled on schedule; *decode/convert capability for old stored data may not*. Rule #4b additionally requires a release supporting both old and new storage versions before the preferred/storage version advances, so users can upgrade and roll back.
- **Source**: https://kubernetes.io/docs/reference/using-api/deprecation-policy/ (Rule #4a note, Rule #4b)
- **Confidence**: high
- **Why it matters here**: Direct input to ruling (b): the most rigorous comparable policy treats *data-migration* compatibility (read/import old persisted state) as permanent or near-permanent, even when the API surface that produced it is long gone. GSD Pi's legacy import path is a data-migration path for pre-cutover `.gsd/milestones/` state — the K8s precedent argues for retiring the *live* fallback (done: "Markdown is never a live-path fallback") while being far more conservative about deleting the *import/decode* capability.

## Finding: Node.js uses a four-tier deprecation ladder; removal is the last tier, and deprecations are revoked or left doc-only indefinitely

- **Claim**: Node.js defines Documentation-only → Application (warn for non-`node_modules` code) → Runtime (warn all code) → End-of-Life (removed) deprecation types, with `--pending-deprecation`/`--throw-deprecation` flags to escalate warnings early. Deprecations are occasionally *revoked* (DEP0033, DEP0037/38, DEP0089, DEP0116 legacy URL API), and some APIs remain documentation-only-deprecated for a decade+ without removal (`node:domain`, DEP0032, deprecated since ~Node 4; `fs.exists`, DEP0034).
- **Source**: https://nodejs.org/api/deprecations.html
- **Confidence**: high
- **Why it matters here**: Node — a CLI-adjacent runtime with zero usage telemetry — answers ruling (a) by never gating removal on telemetry at all: warnings precede removal, removal lands only in semver-majors, and if real-world impact emerges the deprecation is revoked rather than muscled through. "Deprecated but cheap to keep" is a legitimate terminal state in a major tool — a counterweight to any "the window elapsed so delete" argument.

## Finding: Python PEP 387 mandates ≥2 years of warnings, was amended in 2025 to *prefer 5 years*, and allows cheap deprecated code to stay indefinitely

- **Claim**: PEP 387 requires an incompatible change to carry a warning for at least two minor releases (≥2 years under the annual cadence), states "It is preferred, though, to wait 5 years before removal" (added 2025-01-27), and says "If the expected maintenance overhead and security risk of the deprecated behavior is small… it can stay indefinitely." It also defines "soft deprecation" (documented, no warning, no removal scheduled) as a distinct, legitimate state.
- **Source**: https://peps.python.org/pep-0387/
- **Confidence**: high
- **Why it matters here**: Two lessons: (1) the trend among mature tools is toward *longer* windows, driven by fallout from removals like distutils; (2) the explicit "low overhead → keep indefinitely" clause is the strongest primary-source support for a "no-delete with recorded reason" disposition of GSD Pi's legacy import machinery if its maintenance cost is low — directly feeds ruling (a) and success criterion 3's "If not: the blocker and its re-check trigger are documented."

## Finding: Django requires deprecation shims to survive at least 2 feature releases; warnings are silent by default

- **Claim**: Django's deprecation policy: a feature deprecated in A.x raises `RemovedInDjango(B+1)Warning`, survives all of A.x and B.0, and is removed in B.0/B.1 — always spanning ≥2 feature releases (~16 months at the 8-month cadence). The same policy admits the warnings "are silent by default" (require `python -Wd`).
- **Source**: https://docs.djangoproject.com/en/stable/internals/release-process/ (Deprecation policy section)
- **Confidence**: high
- **Why it matters here**: Two-release windows are common, but Django's honest caveat matters for GSD Pi: if users never see warnings, elapsed time is not evidence of migration. When the decider evaluates whether the compat window "holds," the question is whether the import path emitted *visible* warnings to pre-cutover users during the window — silent warnings make time-elapsed a weak proxy for users-migrated (echoes ADR-046's own "time alone is not a Removal Gate").

## Finding: Docker's floor is one stable release, but real removals of config/data formats run many years behind a deprecate → disable-by-default → remove ladder

- **Claim**: Docker's engine deprecation policy requires only "at least one stable release" before removal "unless specified explicitly otherwise," and its deprecated-features table marks removal releases as *tentative*. In practice: `~/.dockercfg` config-file support was superseded in v1.7 (2015), deprecated in v20.10 (2020), removed in v23.0 (2023); `-g/--graph` deprecated v17.05, removed v23.0; image manifest v2 schema 1 deprecated v19.03 → *disabled by default* v26.0 → removed v28.2; several removals carry escape-hatch env vars (`DOCKERD_DEPRECATED_CORS_HEADER`, `DOCKER_KEEP_DEPRECATED_LEGACY_LINKS_ENV_VARS`) for one release before full removal.
- **Source**: https://docs.docker.com/engine/deprecated/
- **Confidence**: high
- **Why it matters here**: Docker shows the two-speed pattern the decider needs for ruling (b): flags and behaviors go fast (1 release); *config file formats and data compatibility* go slow (years, with disable-by-default staging). Also confirms ruling (c): "Remove in vN" targets are advisory and routinely slip (multiple entries show removal landing several releases after the target), while the minimum window is the only hard part.

## Finding: Go ran the canonical opt-in → default-on-with-opt-out → removal ladder for GOPATH→modules, one release per rung

- **Claim**: Go modules shipped opt-in/experimental in 1.11 (GO111MODULE=on), became default-on in 1.16 with an explicit opt-out (`GO111MODULE=off`), with the official Go 1.16 blog announcing "We plan to drop support for GOPATH mode in Go 1.17. In other words, Go 1.17 will ignore GO111MODULE." Go 1.17 release notes show the same one-release-ahead pattern for `go get` (deprecation warning in 1.17, behavior change hard in 1.18) and removed the deprecated `go get -insecure` flag outright.
- **Source**: https://go.dev/blog/go116-module-changes ; https://go.dev/doc/go1.17
- **Confidence**: high
- **Why it matters here**: This is the staged ladder in its cleanest documented form: the rungs are separated by ~6-month releases, each rung is announced one release ahead in the release notes, and the opt-out env var is the escape hatch between default-on and removal. GSD Pi's cutover already completed the "default-on" rung (SQLite sole authority); the comparable pattern says the *import* escape hatch's final rung gets its own announced release, not a silent deletion.

## Finding: Angular deprecates for ≥1 major (~12 months), removes only in majors, and gates migration on upgrade tooling that advances one major at a time

- **Claim**: Angular's deprecation policy keeps deprecated APIs "available through their deprecated phase, which lasts a minimum one major version (approximately one year)" and removes only in major releases; `ng update` officially supports updating only "within one major version of the version you want to upgrade to" — multi-major jumps must step through each major. Breaking-change safety is gated on running the tests of Google-internal consumer apps, not on usage telemetry.
- **Source**: https://angular.dev/reference/releases
- **Confidence**: high
- **Why it matters here**: Reinforces ruling (b): even pure-code migrations get stepwise windows ("one major at a time") so no user is stranded mid-ladder. And it is a second data point (with Node) for ruling (a): a large, telemetry-capable org (Google) gates framework removal on *static* evidence (type-surface diffs + downstream test runs) — i.e., "delete on static proof" has respectable precedent when the consumer surface is enumerable.

## Finding: Homebrew runs a deprecate → disable → remove ladder gated on explicit telemetry thresholds

- **Claim**: Homebrew's formula policy: `deprecate!` warns but installs; `disable!` errors; disabled formulae are auto-removed one year after the disable date. Telemetry gates are explicit: formulae with >1000 analytics installs in 90 days "should not be disabled without a deprecation period of at least six months"; formulae under that bar "can be disabled immediately" and removed three months after disable. Zero installs in 90 days is itself grounds for deprecation.
- **Source**: https://docs.brew.sh/Deprecating-Disabling-and-Removing-Formulae
- **Confidence**: high
- **Why it matters here**: The cleanest documented "telemetry-threshold gates removal" policy found. Note what it implies for GSD Pi's ruling (a): Homebrew could only write this policy because the analytics pipeline *already existed*. The thresholds are calibrated against a known-working measurement system — not retrofit onto a missing one. If GSD Pi's removal-gate telemetry was never built, this policy offers no shortcut: its analog would be "below the measurable bar" only when measurement is real.

## Finding: Chromium/Blink builds usage measurement *before* the removal decision, states no usage level is provably safe, and un-deprecates when usage won't go to zero

- **Claim**: The Blink launch process makes "Step 1: Measure usage" (add a UseCounter; it takes 5–9 weeks to reach Stable before decisions can use it) precede the Intent to Deprecate and Remove, which needs 3 API-owner LGTMs. It states "There is no threshold for which removal is necessarily safe," warns that for older widely-implemented APIs "the cost of removing an API is not accurately reflected by the UseCounter" (long-tail legacy content), requires ≥1 milestone of deprecation before removal, offers Deprecation Trials (opt-in re-enable) as ground-truth on remaining need, and says if a deprecation trial can't make progress "it will be necessary to un-deprecate the API." Post-removal: monitor 1–2 months and be ready to re-enable via runtime flag.
- **Source**: https://www.chromium.org/blink/launching-features/ (Feature deprecations section)
- **Confidence**: high
- **Why it matters here**: The strongest primary answer to ruling (a). Where telemetry *is* the gate, the comparable practice is: (1) instrument first, wait for the data pipeline to mature, *then* decide — never decide on the promise of future telemetry; (2) even measured ~0 usage is not treated as sufficient proof for old paths; (3) inability to demonstrate disuse leads to *un-deprecation*, not deletion. If GSD Pi's `markdownFallbackUsed`-style telemetry was never built, the Chromium analog is "you have not yet reached Step 2," not "you may skip to removal."

## Finding: kubectl's generator removal — years of warnings, still produced doc drift and user breakage across version skew

- **Claim**: kubectl's `--generator` flags printed "is DEPRECATED and will be removed in a future version" from ~v1.12; removal landed in v1.18 (≈2 years, ~6 minor releases). Despite the long warned window, issue kubernetes/kubernetes#91064 documents post-removal fallout: official docs still walked users through removed flags, and "the change is on the client-side, users with newer kubectl but older Kubernetes version might also be affected."
- **Source**: https://github.com/kubernetes/kubernetes/issues/91064 ; deprecation warning evidence in https://github.com/kubernetes/kubectl/issues/778
- **Confidence**: high (primary issue tracker; warning text quoted in both issues)
- **Why it matters here**: A documented removal-after-long-warning case where the cleanup still missed doc drift — exactly GSD Pi success criterion 5's risk (docs describing the legacy layout after cutover). Also the version-skew wrinkle: users on old *states* (pre-cutover projects) with new CLIs are the population an import path serves; deleting import machinery strands that skew cohort permanently, which is why K8s keeps storage-decode forever (finding above).

## Finding: distutils removal (PEP 632) went ahead on a 2-release schedule; the ecosystem needed a permanent shim, and Python later lengthened its general policy

- **Claim**: PEP 632 deprecated distutils in Python 3.10–3.11 with removal in 3.12 (≈2 years of warnings), explicitly *rejecting* "deprecate but do not delete." Removal landed on schedule, but setuptools had to vendor a distutils copy as a compatibility shim (transitional, itself now deprecated), and fallout issues persisted into 2024 (e.g., twisted/incremental#89 tracking PEP 632 breakage under `SETUPTOOLS_USE_DISTUTILS=stdlib`). In January 2025 PEP 387 was amended to prefer 5-year deprecation periods.
- **Source**: https://peps.python.org/pep-0632/ ; https://github.com/twisted/incremental/issues/89 ; https://peps.python.org/pep-0387/ (changelog entry 2025-01-27)
- **Confidence**: high
- **Why it matters here**: The closest thing to a documented "we removed a migration path on schedule and it still hurt" arc: the removal was policy-compliant and telegraphed, yet the practical ecosystem answer was to recreate the compatibility path downstream. Feeds ruling (a): "the window elapsed" did not make deletion safe for a *migration* path; the cost just moved to users and downstream shims.

## Finding: VS Code treats deprecated extension APIs as permanent — `workspace.rootPath` deprecated in 2019 is still documented and functional

- **Claim**: VS Code deprecated `workspace.rootPath` in v1.38 (August 2019) in favor of `workspaceFolders`; the current stable API reference (2026) still documents rootPath and specifies its behavior ("the (deprecated) rootPath property is updated to point to the first workspace folder"). No removal has occurred or been scheduled in ~7 years.
- **Source**: https://code.visualstudio.com/updates/v1_38 ; https://code.visualstudio.com/api/references/vscode-api
- **Confidence**: high
- **Why it matters here**: Second major-tool data point (with Node's `domain`) that "deprecated, documented, never removed" is a stable end state for low-cost compatibility shims — legitimate precedent if the decider records a no-delete ruling for the import machinery with a re-check trigger (INTENT success criterion 3's "If not" branch).

## Finding: Terraform requires one-major-at-a-time upgrades and removes last-major upgrade tooling in the next major; state migrations are one-way

- **Claim**: Terraform's 0.13 upgrade guide: "Terraform supports upgrade tools and features only for one major release upgrade at a time" — the `0.12upgrade` command was *removed in 0.13*, so 0.11 users must install 0.12 latest, run its upgrade tool, then move to 0.13. State migrations applied by the new version make snapshots unparseable by the old version ("Terraform v0.12 cannot parse a state snapshot that was created by this command"), and the guide requires running `terraform apply` (completing the state migration) *before* removing any config blocks the state still references.
- **Source**: https://developer.hashicorp.com/terraform/language/v1.1.x/upgrade-guides/0-13
- **Confidence**: high
- **Why it matters here**: Directly informs ruling (b) for a *data-migration* path in a CLI tool: the migration tooling's lifetime is chained, not windowed — each version carries the importer from exactly one prior version, forever, so any historical state can ladder forward. Under this model GSD Pi would keep the pre-cutover importer until the oldest supported project state is past the cutover, which with no telemetry is unknowable — pushing toward "keep, or delete only with a documented floor version for importable state."

## Finding: npm's only deprecation mechanism is a registry warning with no removal semantics; no npm CLI deprecation/removal policy exists

- **Claim**: `npm deprecate <pkg> <message>` only "update[s] the npm registry entry for a package, providing a deprecation warning to all who attempt to install it" — reversible via empty message, no timeline, no removal mechanics. No published policy for deprecating/removing npm CLI commands themselves was found.
- **Source**: https://docs.npmjs.com/cli/v11/commands/npm-deprecate
- **Confidence**: high for the command's behavior; medium for the absence of a CLI policy (absence of evidence)
- **Why it matters here**: Lower bound of the spectrum: the most widely-used dev-tool registry formalizes nothing beyond "warn forever." Useful as contrast, not as a model for ADR-046's gated deletion.

## Finding: Synthesis for ruling (a) — delete on static proof vs build telemetry first: both precedents exist, but no comparable tool *retrofits* telemetry at removal time

- **Claim**: Across the tools examined, removal gates are either (i) static/time-based with no telemetry at all (Node, K8s, Django, Python, Docker, Angular — Angular's evidence is downstream test runs and API-surface diffs), or (ii) telemetry-based where the measurement pipeline predates the gate and is *built first* as an explicit step (Chromium UseCounter, Homebrew analytics). No documented case was found where a tool announced telemetry-gated removal, discovered the telemetry never existed, and then either built it just-in-time or treated the absence as proof of disuse.
- **Source**: synthesis of the sources above (Chromium Step 1; Homebrew analytics thresholds; Node/Angular static gates)
- **Confidence**: medium-high (synthesis; negative claim bounded by the tools surveyed)
- **Why it matters here**: The deferred NEEDS-USER ruling is precisely this situation. The comparable-tools evidence frames the choice as: follow the Node/Angular/Python model (drop the telemetry condition, rely on static proof + long warned window, optionally keep the cheap shim) or the Chromium model (instrument now, decide in N releases when data exists). What has no precedent is treating missing telemetry as satisfying a telemetry gate.

## Finding: Synthesis for ruling (c) — minimum windows are hard gates; scheduled removal dates are advisory

- **Claim**: Every policy examined that states a minimum treats it as a hard floor ("must function for no less than", "at least", "minimum one major version"), while scheduled removal dates/releases are explicitly tentative and routinely slip: Docker's "Remove" column is "a tentative release" with many entries landing releases later; Chromium targets "remember to keep this updated, if things change"; Node/Python/Django remove "in a future major" without a date.
- **Source**: https://docs.docker.com/engine/deprecated/ ; https://www.chromium.org/blink/launching-features/ ; https://kubernetes.io/docs/reference/using-api/deprecation-policy/
- **Confidence**: high
- **Why it matters here**: ADR-046's "2 releases + ≥60 days" reads as a hard floor in industry terms — satisfying it authorizes removal but does not *obligate* it, and slipping the actual deletion is normal practice, not process failure. This supports keeping the deletion decision evidence-driven even after the window math checks out.

## Assigned questions — answers

- none assigned → nothing to answer; the four briefed research threads (policy windows/warnings, telemetry-gated removal, staged ladders, lessons for the three deferred rulings) are covered by the findings above.

## Dead ends

- esbuild — searched for an official deprecation/removal policy; none found (esbuild documents breaking changes only per-release in its changelog; no policy page exists). Not citable for this dimension.
- npm CLI — no published policy for deprecating/removing npm's own CLI commands; only the registry `npm deprecate` command docs exist (recorded as a finding instead).
- Formal post-mortems of "removed a migration path too early" — searched; the genre is mostly vendor blogs. Primary issue-tracker evidence (kubernetes/kubernetes#91064, twisted/incremental#89, PEP 387's 2025 amendment) proved more load-bearing and was used instead.
- VS Code extension API removal schedule — does not exist as a policy; evidence of permanent deprecation (rootPath) used instead.
