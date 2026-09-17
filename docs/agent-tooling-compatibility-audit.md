# Agent tooling compatibility audit

Status: complete (repository compatibility work; external gaps recorded below)
Owner: Codex
Opened: 2026-09-05

## Objective
Make Tumbenla's repository-local agent skills, plugin/configuration hooks, and agent instructions usable by Codex or tool-agnostic. When a tool-specific implementation is unavoidable, choose and document Codex as the supported implementation.

## Constraints
- Preserve product decisions in `PRODUCT.md` and repository conventions in `CLAUDE.md` / `AGENTS.md`.
- Do not alter application behavior, production configuration, secrets, or existing unrelated work.
- The working tree is already dirty. Do not revert, stage, or commit unrelated changes.
- Prefer portable project documentation and scripts over instructions tied to one agent runtime.
- If an equivalent Codex mechanism does not exist, replace the Claude-specific mechanism with a documented Codex-first workflow where practical; otherwise document the gap and the chosen Codex procedure.

## Required audit surface
- Root and nested `AGENTS.md`, `CLAUDE.md`, and agent instruction files.
- `.claude/`, `.agents/`, and other repository-local skills, hooks, plugins, config files, and references.
- References to Claude Code, Claude-only commands, or Claude-specific hooks.

## Acceptance criteria
1. An audit inventory identifies every relevant Claude-specific artifact and its disposition: made portable, retained but documented, removed, or replaced by a Codex-first mechanism.
2. Reusable procedures work through repository files/scripts rather than a hidden Claude-only session convention where feasible.
3. Codex has an explicit entry point and instructions for the workflows that remain tool-specific.
4. The audit’s results, decisions, verification, unresolved gaps, and next actions are recorded in this document.
5. No unrelated files are changed, staged, reverted, or committed.

## Outcome — 2026-09-05

The supported entry point is root `AGENTS.md` → `CLAUDE.md` / `PRODUCT.md` →
[`agent-workflows.md`](agent-workflows.md). Codex can run the repository procedures by reading
files and using available tools. No Claude session, named Claude agent, slash command, or hook
is required. External capabilities remain explicit prerequisites, not claimed integrations.

All five acceptance criteria are satisfied at the repository procedure/configuration level.
This is not an end-to-end certification of external services, media rendering, or agent discovery
in a fresh installation. No application behavior, product decision, deployment setting, secret,
or unrelated dirty file was changed. Nothing was staged, reverted, or committed.

## Inventory and dispositions

Scope includes hidden tracked files, repository-local ignored tooling metadata, symlink targets,
all skill entry points and their text references/assets/evaluations, and repository-wide runtime
references. Dependencies, build outputs, binary media, databases, secrets and private user sessions
are not agent instructions and were not dumped. The separate ignored worktree was inspected for
instruction/config differences, but is a separate checkout and was not modified.

| Artifact | Finding | Disposition / supported procedure |
| --- | --- | --- |
| Root `AGENTS.md` | Entry point forwarded only to a historically named guide; generated GitNexus instructions assumed MCP. | **Made portable:** explicit Codex entry and precedence for runtime mappings outside generated markers. |
| Root `CLAUDE.md` | Shared conventions, private plan references, `/experimento`, generated GitNexus block. | **Made portable:** shared-guide explanation and canonical experiment link; retain conventions and generated block, apply runtime mapping. |
| `PRODUCT.md` | References `~/.claude/plans/partitioned-crunching-hartmanis.md` and `check-our-product-guidelines-synthetic-pillow.md`. Already dirty. | **Retained but documented:** historical, not execution prerequisites. Current product doc governs; new durable plans go in `docs/plans/`. No private plan was copied. |
| `.claude/commands/experimento.md` | `$ARGUMENTS`, mandatory launches of named Claude subagents, workflow hidden in command directory. | **Replaced:** thin adapter to the full portable Experiments procedure, including no-input queue review, missing metric, veto, advancement and closing cases. |
| `.claude/agents/producto.md`, `crecimiento.md`, `datos.md` | Useful role bodies; runtime-specific `tools` and `model` frontmatter. Datos asks for document writes while declaring read-only tools. | **Retained but documented:** read bodies as role briefs; sequential labeled Codex reviews; coordinator persists Datos evidence. Optional delegation only when authorized and supported. |
| `org/ORG.md` | Links directly to those agent profiles and `CLAUDE.md`. | **Retained but documented:** links still resolve as ordinary files; authority boundaries and experiment log remain unchanged. |
| `.agents/product-marketing.md` | Canonical context already in shared location. | **Retained:** product and voice filters apply before imported skills; no content rewrite. |
| `.agents/skills/*` | 79 skills, 341 regular files; procedures, references, evaluation JSON and one HTML asset. | **Retained but documented:** all listed below; common tool substitutions and unavailable dependency procedures in the shared guide. No mass vendor rewrite. |
| `.claude/skills/*` symlinks | 79 relative links to the shared skills; all resolve. | **Retained:** one shared copy; no duplicate installation or new discovery claim. |
| `.claude/skills/gitnexus/*/SKILL.md` | Six skills: `gitnexus-cli`, `gitnexus-debugging`, `gitnexus-exploring`, `gitnexus-guide`, `gitnexus-impact-analysis`, `gitnexus-refactoring`. CLI text assumes a Claude PostToolUse freshness notification and Claude restart. | **Retained but documented:** explicit CLI status/query/context/impact/detect-changes; manual freshness checks and active MCP reconnection. No such hook is configured in this repo. |
| `.claude/skills/vercel-react-best-practices/` | 51 files including SKILL, compiled AGENTS, README, metadata, 47 rule files. Compiled AGENTS is reference material, not app-scope instructions. | **Retained:** selected reference copy; root stack rules outrank generic SWR guidance. |
| `.claude/skills/web-design-guidelines/SKILL.md` | Names WebFetch. | **Retained but documented:** use available web open/fetch capability; report unavailable source. |
| `.cursor/skills/` | Seven skills, 57 files: React/web-design duplicates plus `brainstorming`, `docs`, `frontend-design`, `rmslop`, `writing-plans`. Missing `superpowers:*`, foreign docs example, automatic worktree/commit assumptions. | **Retained but documented:** optional references; repository checklist execution replaces superpowers and session handoff. No automatic commits/worktrees. Review against actual PR base. |
| `.opencode/skill/` | Two skills, 52 files: React and web-design copies. | **Retained but documented:** use selected `.claude/skills/` reference copy to avoid divergent guidance. |
| Three vendored React `AGENTS.md` files | Under `.claude/skills/`, `.cursor/skills/`, `.opencode/skill/`; byte-identical at audit (2,249 lines each). | **Retained:** no attempt to apply their performance examples as repository-wide runtime policy. |
| `.claude/settings.json` | Only `enabledPlugins: {"brag@brag": true}`; no hook definitions. Plugin implementation absent from checkout. | **Removed** automatic plugin enablement; valid empty settings object retained. **Replaced** workflow dependency with Codex + available HyperFrames skills and local CLI. No feature-parity claim. |
| `.claude/RESUME.md` (ignored) | Old session ID, checkpoint ref, TodoWrite snapshot, `claude --resume`, `/resume`, `/rewind`. | **Retained but documented:** historical local metadata. File-based handoff replaces it; never rewind/restore it automatically. |
| `.claude/worktrees/fix+react-patterns-e2e/` (ignored separate checkout) | Root instructions differ only in generated index counts before this audit; same plugin setting; duplicate tooling. | **Retained but documented:** do not modify another checkout. Apply reviewed changes through its normal branch workflow later, if still active. |
| `.gitnexus/` (ignored) | Generated `run.cjs`, index/metadata and caches. Runner chooses installed CLI or package-manager fallback. | **Retained but documented:** local CLI works; no source symbol edits or index regeneration required. Fresh clone may need installation/indexing. |
| `skills-lock.json` | 79 entries: 50 marketing, 12 Emil Kowalski, 11 ElevenLabs, 6 taste skills. | **Retained:** provenance unchanged; inventory reconciled to installed shared directories. |
| `.gitignore`, `package.json`, `biome.json`, `.github/`, root configs | Worktree exclusion and portable package commands; no repository agent hooks. `package.json` already dirty. | **Retained:** no changes to scripts, CI, deployment, environment, formatting or dependency settings. |
| `.codex/`, `.mcp.json`, `opencode.json`, hook/plugin manifests | No local Codex directory or MCP config; ignored OpenCode config is absent; no other local hook/plugin manifest found. | **Documented absence:** explicit file procedures need no new Codex config. No global configuration inspected or altered. |
| `org/crecimiento/piezas/video-lanzamiento/composition/AGENTS.md` and `CLAUDE.md` | Identical HyperFrames guides use slash skill names and machine-installed skills. | **Made portable:** matching Codex entry notes; interpret names through available skill catalog, retain composition checks and pins. |
| `org/crecimiento/piezas/video-lanzamiento/composition-brief.md` | Private brag music cue/SFX references, `brag-output/`, `/brag` router bypass. | **Retained but documented:** historical brief; use actual tracked composition/assets and current skill routing. Do not change creative decisions or fetch private presets. |
| Composition `package.json`, `hyperframes.json`, `vert/` configuration and assets | Existing HyperFrames CLI pins (0.8.22), local checks/render and media. | **Retained:** no render, upgrade, publication or asset edits for a documentation audit. |
| `docs/react-patterns.md`, `docs/validation-harness.md` | Shared-guide reference; existing Hermes/Codex division and machine-local Codex CLI availability note. Harness doc already untracked. | **Retained but documented:** host availability statements are not guarantees for a different session. No harness or organizational responsibilities changed. |

### Runtime-specific references inside shared skills

All entries below are **retained but documented** through the tool substitutions in
`agent-workflows.md`; retaining vendor text avoids breaking its references and provenance.

| Files (relative to `.agents/skills/`) | Compatibility treatment |
| --- | --- |
| Marketing SKILL context preambles; `product-marketing/SKILL.md`; `public-relations/references/podcast-guest-prep.md`; `product-marketing/evals/evals.json` | `.agents/product-marketing.md` is canonical. `.claude/` and legacy names are upstream compatibility examples, not a migration task. |
| `marketing-loops/SKILL.md`, `references/loop-{catalog,guardrails,orchestration,state,template}.md`, `evals/evals.json` | Manual bounded Codex run with durable state, dedupe, kill switch and next due time replaces `/loop`, `ScheduleWakeup`, `CronCreate` and optional `loopify`. No unattended schedule installed. |
| `social/references/listening.md`, `listening-sources-template.md` | Replace assumed globally configured dev-browser and Claude daily loop with discovered browser or public web reads; persist sources under `.agents/`. No messaging authorization inferred. |
| `public-relations/SKILL.md`, `references/{journalist-pitching,newsjacking}.md` | Same browser/manual-cadence mapping. No automatic report delivery; voice/product restrictions remain. |
| `marketing-plan/references/{ops-stack-mapping,methodology,example-quietude}.md` | Optional Claude marketplaces, browser and diagram aliases map to available capabilities. Customer.io/Claude example is another client's story, not evidence of Tumbenla integration. |
| `aso/SKILL.md` and web-design copies | WebFetch maps to web tools; screenshots need an actual browser capability. Skill availability does not override exclusion from this product. |
| `ads/references/creative-research-automation.md` | Claude Cowork attribution retained; browser/Slack/deck examples do not imply installed tools or permission to send. Missing positioning skill uses existing product context. |
| `ad-creative/SKILL.md` | Incorrect relative ads-reference path resolves through explicit path mapping in the guide; missing tool wrappers are not executable. |
| `competitor-profiling/SKILL.md`, `references/tool-reference.md`; media/ElevenLabs installation references | MCP identifiers, SDKs and provider credentials are external capabilities. Discover before use; local draft/manual step and explicit gap if unavailable. |
| `ai-seo/SKILL.md`, `references/platform-ranking-factors.md`; `agents/SKILL.md` | Claude search/provider/model names describe research targets or API examples, not the required coding runtime. Retain; verify current claims when used. |
| `marketing-council/references/advisors/claude-hopkins.md`; `ads/references/audit-guardrails.md`; `events/references/webinar-funnel.md` | Historical person and upstream source credits, not Claude tooling. Preserve attribution. |
| `prospecting/references/data-sources.md`; `directory-submissions/references/positioning-variations.md` | Integration descriptions and sample tags, not required runtime configuration. |
| `improve-animations/SKILL.md` and other skill task/delegation language | Capability/authorization-aware delegation or explicitly labeled sequential work, never a fictional Task-tool invocation. |

### Missing imported references

A static relative Markdown-link scan found 115 unresolved occurrences (77 distinct literal
targets): 105 refer to the uninstalled upstream tools tree, three are the ads/positioning path
issues above, and seven are example application URLs or `link`/`url` placeholders. These are
classified, not silently described as valid links. No missing provider wrapper was installed.

The following sources reference the missing tools tree; the connector/API/manual procedure in
`agent-workflows.md` applies to each:

- `.agents/skills/ad-creative/SKILL.md`
- `.agents/skills/ads/SKILL.md`
- `.agents/skills/ai-seo/SKILL.md`
- `.agents/skills/analytics/SKILL.md`
- `.agents/skills/attribution/SKILL.md`
- `.agents/skills/churn-prevention/SKILL.md`
- `.agents/skills/co-marketing/SKILL.md`
- `.agents/skills/content-strategy/references/headless-cms.md`
- `.agents/skills/customer-research/references/source-guides.md`
- `.agents/skills/emails/SKILL.md`
- `.agents/skills/influencer-marketing/SKILL.md`
- `.agents/skills/launch/SKILL.md`
- `.agents/skills/prospecting/SKILL.md`
- `.agents/skills/prospecting/references/data-sources.md`
- `.agents/skills/referrals/SKILL.md`
- `.agents/skills/referrals/references/affiliate-programs.md`
- `.agents/skills/revops/SKILL.md`
- `.agents/skills/sales-enablement/SKILL.md`
- `.agents/skills/sms/SKILL.md`
- `.agents/skills/video/SKILL.md`

### Shared skill inventory

Each row covers the named `SKILL.md` and every installed file in that directory (references,
evaluations and assets). Disposition for all: **retained but documented**, subject to the mappings
and product filters above. Counts exclude symlink aliases; all 79 Claude aliases resolve to these
same directories. The lock contains exactly these names.

| Skill (`.agents/skills/`) | Files | Source |
| --- | ---: | --- |
| `ab-testing` | 4 | `coreyhaines31/marketingskills` |
| `ad-creative` | 13 | `coreyhaines31/marketingskills` |
| `ads` | 16 | `coreyhaines31/marketingskills` |
| `agents` | 8 | `elevenlabs/skills` |
| `ai-seo` | 9 | `coreyhaines31/marketingskills` |
| `analytics` | 5 | `coreyhaines31/marketingskills` |
| `animate` | 2 | `emilkowalski/skills` |
| `animate-expo` | 2 | `emilkowalski/skills` |
| `animation-vocabulary` | 1 | `emilkowalski/skills` |
| `apple-design` | 1 | `emilkowalski/skills` |
| `ask-sonner` | 2 | `emilkowalski/skills` |
| `aso` | 7 | `coreyhaines31/marketingskills` |
| `attribution` | 6 | `coreyhaines31/marketingskills` |
| `brandkit` | 1 | `Leonxlnx/taste-skill` |
| `churn-prevention` | 4 | `coreyhaines31/marketingskills` |
| `co-marketing` | 3 | `coreyhaines31/marketingskills` |
| `cold-email` | 7 | `coreyhaines31/marketingskills` |
| `community-marketing` | 3 | `coreyhaines31/marketingskills` |
| `competitor-profiling` | 4 | `coreyhaines31/marketingskills` |
| `competitors` | 4 | `coreyhaines31/marketingskills` |
| `content-strategy` | 4 | `coreyhaines31/marketingskills` |
| `copy-editing` | 5 | `coreyhaines31/marketingskills` |
| `copywriting` | 4 | `coreyhaines31/marketingskills` |
| `cro` | 4 | `coreyhaines31/marketingskills` |
| `customer-research` | 4 | `coreyhaines31/marketingskills` |
| `design-taste-frontend` | 1 | `Leonxlnx/taste-skill` |
| `directory-submissions` | 5 | `coreyhaines31/marketingskills` |
| `dubbing` | 3 | `elevenlabs/skills` |
| `emails` | 5 | `coreyhaines31/marketingskills` |
| `emil-design-eng` | 1 | `emilkowalski/skills` |
| `events` | 6 | `coreyhaines31/marketingskills` |
| `find-animation-opportunities` | 1 | `emilkowalski/skills` |
| `free-tools` | 4 | `coreyhaines31/marketingskills` |
| `full-output-enforcement` | 1 | `Leonxlnx/taste-skill` |
| `high-end-visual-design` | 1 | `Leonxlnx/taste-skill` |
| `image` | 3 | `coreyhaines31/marketingskills` |
| `improve-animations` | 3 | `emilkowalski/skills` |
| `influencer-marketing` | 3 | `coreyhaines31/marketingskills` |
| `launch` | 2 | `coreyhaines31/marketingskills` |
| `lead-magnets` | 4 | `coreyhaines31/marketingskills` |
| `marketing-council` | 15 | `coreyhaines31/marketingskills` |
| `marketing-ideas` | 4 | `coreyhaines31/marketingskills` |
| `marketing-loops` | 7 | `coreyhaines31/marketingskills` |
| `marketing-plan` | 15 | `coreyhaines31/marketingskills` |
| `marketing-psychology` | 2 | `coreyhaines31/marketingskills` |
| `music` | 3 | `elevenlabs/skills` |
| `offers` | 10 | `coreyhaines31/marketingskills` |
| `onboarding` | 5 | `coreyhaines31/marketingskills` |
| `paywalls` | 3 | `coreyhaines31/marketingskills` |
| `pick-ui-library` | 1 | `emilkowalski/skills` |
| `popups` | 2 | `coreyhaines31/marketingskills` |
| `pricing` | 6 | `coreyhaines31/marketingskills` |
| `product-marketing` | 2 | `coreyhaines31/marketingskills` |
| `programmatic-seo` | 3 | `coreyhaines31/marketingskills` |
| `prospecting` | 8 | `coreyhaines31/marketingskills` |
| `prototype` | 2 | `emilkowalski/skills` |
| `public-relations` | 8 | `coreyhaines31/marketingskills` |
| `redesign-existing-projects` | 1 | `Leonxlnx/taste-skill` |
| `referrals` | 5 | `coreyhaines31/marketingskills` |
| `review-animations` | 2 | `emilkowalski/skills` |
| `revops` | 6 | `coreyhaines31/marketingskills` |
| `sales-enablement` | 6 | `coreyhaines31/marketingskills` |
| `schema` | 3 | `coreyhaines31/marketingskills` |
| `seo-audit` | 4 | `coreyhaines31/marketingskills` |
| `setup-api-key` | 1 | `elevenlabs/skills` |
| `signup` | 2 | `coreyhaines31/marketingskills` |
| `site-architecture` | 5 | `coreyhaines31/marketingskills` |
| `sms` | 5 | `coreyhaines31/marketingskills` |
| `social` | 10 | `coreyhaines31/marketingskills` |
| `sound-effects` | 2 | `elevenlabs/skills` |
| `speech-engine` | 4 | `elevenlabs/skills` |
| `speech-to-text` | 7 | `elevenlabs/skills` |
| `stitch-design-taste` | 2 | `Leonxlnx/taste-skill` |
| `text-to-speech` | 4 | `elevenlabs/skills` |
| `update-skills-from-changelog` | 1 | `elevenlabs/skills` |
| `video` | 4 | `coreyhaines31/marketingskills` |
| `voice-changer` | 2 | `elevenlabs/skills` |
| `voice-isolator` | 2 | `elevenlabs/skills` |
| `write-swift` | 1 | `emilkowalski/skills` |

## Changes and decisions

Exactly eight files changed for this audit, relative to the initial dirty worktree:

1. `AGENTS.md` — Codex entry point and runtime-mapping precedence.
2. `CLAUDE.md` — shared-guide clarification and portable experiment link.
3. `.claude/commands/experimento.md` — command adapter to the canonical procedure.
4. `.claude/settings.json` — remove implicit brag plugin enablement; retain valid `{}`.
5. `docs/agent-workflows.md` — new canonical tool mappings and reusable procedures.
6. `org/crecimiento/piezas/video-lanzamiento/composition/AGENTS.md` — Codex media entry note.
7. `org/crecimiento/piezas/video-lanzamiento/composition/CLAUDE.md` — identical media entry note.
8. `docs/agent-tooling-compatibility-audit.md` — this inventory, results and gap record; already
   untracked at the start, updated without removing the objective or acceptance criteria.

Documentation is sufficient here: no runtime script or application symbol needed changing.
Preserving role bodies and vendor skill directories keeps one source per procedure without a
large relocation diff. Codex reads explicit paths even where filenames retain `.claude`.
The adapter makes the experiment procedure reviewable and usable without a session convention.

There is no declared one-to-one replacement for brag, Claude hooks, private session checkpoints,
or Claude scheduling. The chosen procedures are respectively: available HyperFrames skills and
local CLI; explicit GitNexus checks; repository handoff files; bounded manual Codex runs.
No speculative Codex hook/config schema, credential migration, or automatic scheduler was added.

## Validation

- Read required root guides and the complete current `PRODUCT.md` before modifications. Inspected
  root/nested instruction files, all four skill trees, lock provenance, symlinks, Claude command,
  role profiles/settings, ignored resume metadata, separate-worktree instruction differences,
  GitNexus runner/help/status, composition config and runtime references across repository text.
- Static inventory: 79 shared skill directories exactly match 79 lock entries; 79 Claude symlinks
  resolve to them. Shared tree has 341 regular files; Claude-only tree 58; Cursor 57; OpenCode 52.
  The three compiled React guides match; the two nested HyperFrames guides remain identical.
- Local CLI `--help`, `query --help`, `context --help`, `impact --help`, and
  `detect-changes --help` confirm the documented terminal syntax. `status` returned success and
  commit `2c4b71b` matched the index. This does not certify that unrelated dirty source is indexed.
- `node .gitnexus/run.cjs query 'agent tooling' --repo tumbenla --limit 1` succeeded, returning
  repository documentation definitions and no matching execution processes. No symbol edits were
  made, so application-symbol impact analysis was not applicable. No commit was requested or made;
  whole-tree detect-changes would mix the pre-existing application work with this documentation.
- `bunx --no-install biome check .claude/settings.json` passed (one file, no fixes).
- `git diff --check` passed. Markdown entry links, procedure references, command adapter,
  experiment gate preservation, and the exact change allowlist were checked locally.
- `bun run lint` ran non-destructively and **failed**: 368 files checked, 34 errors, 14 warnings,
  16 informational diagnostics. Diagnostics include untouched imported creative-review HTML and
  other existing files. No lint fixes were applied; the changed JSON passed its targeted check.
- SHA-256 comparison against the starting regular-file inventory verifies that unrelated tracked
  and untracked files, including `PRODUCT.md`, `package.json`, application edits, validation harness
  and simplification script, were preserved. Git index diff remains identical; no staging occurred.
- No build, database mutation, external service call, media render, deployment, publication,
  global setup, skill update or index regeneration was needed for these documentation/config edits.

## Unresolved gaps and next actions

| Gap | Chosen procedure now | Next action / owner |
| --- | --- | --- |
| Fresh-machine GitNexus/MCP and skill discovery are not provisioned by this checkout. | Read explicit skill files; installed CLI fallback. Stop dependent symbol edits if impact cannot run. | On a machine that needs code changes, operator verifies installed CLI/MCP and bootstraps an index using its CLI skill. No global setup run in this audit. |
| HyperFrames skills are outside this repo; private brag implementation/cue metadata unavailable. Brief names old music while tracked composition includes `perreo-melodico.mp3`. | Current brief plus actual composition/assets, available media skills and existing pinned CLI. No parity or audio-validation claim. | Before the next media edit, resolve required skills and inspect actual timing/assets. Do not substitute tracks or alter creative decisions merely to satisfy historical paths. |
| 105 imported tools-tree references point to wrappers not installed here; positioning skill absent and one ads link is misrelative. | Exact ads path mapping; existing positioning context; discover a configured connector/API or produce a local draft with manual next step. | Only when an allowed task requires an external action, verify the available integration. No bulk upstream tools install. |
| Vendor text still names Claude tools, scheduling and browser sessions. | Shared guide explicitly overrides invocation assumptions; manual runs, discovered tools and file handoffs. | Recheck compatibility after skill refreshes; preserve source credits and provider examples. |
| Older organizational profiles/charter and root gotchas describe retired metrics/payment model. | `PRODUCT.md` and current marketing context govern; do not invent metric replacements or treat old queries as current evidence. | Producto/Datos reconcile standing docs in a separate authorized product/documentation task. This audit does not change those decisions. |
| Global lint is red in untouched files. | Targeted changed-config check passes; report global failure. | Address lint in its own scoped task, preserving the user's current work. |
| Ignored separate worktree retains old tooling settings/instructions. | Leave its work intact and use this checkout for audited procedures. | Its owner can incorporate reviewed changes through the normal branch workflow if the worktree remains active. |
| No unattended loop scheduler or authenticated browser/provider guarantee. | One bounded manual run with persisted state; unavailable external actions are explicitly blocked. | Set up automation/integrations only for an explicitly requested operational task. |

No further repository compatibility edits are required by this audit. The next actions above are
conditional environment setup or separate product/quality work, not hidden claims of completion.
