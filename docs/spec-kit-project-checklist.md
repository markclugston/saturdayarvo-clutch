# Spec Kit Setup Checklist

How to set up the Spec Kit agent architecture in a new project, for Claude Code and GitHub Copilot, and why each piece exists. Based on Spec Kit 1.3.2 on Windows with PowerShell.

`<project>` is a short lower-case prefix, `<Project>` the display name, `<author>` the author name and `<area>` a topic such as security. This file is self-contained: the files to create are in the appendix.

## How To Use This File

1. Create the project folder.
2. Initialise Spec Kit:

   ```powershell
   specify init --here --integration claude --script ps
   ```

3. Copy this file to `docs/spec-kit-setup.md` in the new project.
4. Start Claude Code in the project and say: **Set up my Spec Kit architecture as defined in docs/spec-kit-setup.md.**

## Instructions For Claude

When asked to set up this architecture, follow these steps in order.

### Step 1: Check, Without Changing Anything

- Read this whole file, including the appendix.
- Confirm `.specify/` and `.claude/skills/speckit-*` exist. If not, give the user the init command above and stop.
- Run `specify version` and `specify integration status`. This setup was tested on 1.3.2; say so if the version differs.
- Look for existing files that this setup would create or change. Never overwrite one without asking.
- Learn what you can from the project itself, such as its languages and folders, so that you don't ask about it.

### Step 2: Ask Questions

Use the question tool, a few related questions at a time, with a recommended answer first where there is a sensible one. Ask follow-ups until you can write every file without guessing. Skip anything already answered.

| Ask about | Needed for |
|---|---|
| Project prefix, display name and author | File names, preset, skills |
| What the project is, and its planned stack and layout if the folder is empty | Skills, path rules, code map |
| Claude Code only, or GitHub Copilot as well | Sections 6 and 10 |
| Binding requirements: architecture, data, security, sensitive data, accessibility, operations, performance | Constitution IDs and their rules |
| Testing obligations and when tests run | ENG-001, area skills |
| Areas that need their own process, and the reviews or checklists each requires | `<project>-<area>` skills, gate tasks |
| Which folders and file patterns belong to each area | Path rules |
| Defaults when a feature description is silent | Code map |
| Workspace safety rules | `CLAUDE.md` |

Do not invent obligations. Offer suggestions, and include only what the user accepts. Two requirements are always present because the preset refers to them:

- **ARC-001**: includes "Do not add unrequested features."
- **ENG-001**: includes "Behaviour changes require automated tests" and "Every feature explicitly requests tests: tasks.md must include test tasks for every behaviour change."

### Step 3: Agree The Plan

Show the list of files you will create, the requirement IDs with their rules and owning skills, and the path patterns. Wait for approval.

### Step 4: Create The Files

Create them in this order. Where the appendix gives content, copy it exactly, then replace the placeholders. Square-bracket placeholders in templates, such as `[FEATURE NAME]`, stay: Spec Kit fills them. Replace angle-bracket placeholders such as `<project>`, `<ID>` and `<area>` with real values, adding or removing table rows to match the agreed IDs. Placeholders that describe a feature, such as `<Entity>` or `<test path>`, stay.

| Order | Create | Source |
|---|---|---|
| 1 | `docs/code-map.md` | Appendix A; section 2 |
| 2 | `.specify/templates/overrides/` (four templates) | Appendix B |
| 3 | Constitution, by running the `speckit-constitution` skill with the agreed requirements | Section 3 |
| 4 | `<project>-constitution-check` and area skills | Appendix C; section 4 |
| 5 | `.claude/rules/` | Section 5 |
| 6 | `CLAUDE.md`, and `.github/copilot-instructions.md` if using Copilot | Appendix D; section 6 |
| 7 | `scripts/check-spec-artifacts.ps1` | Appendix E, using the command below |
| 8 | `scripts/sync-agent-config.ps1`, only if using Copilot | Appendix F, using the command below |
| 9 | `presets/<project>/`, then the install commands in section 8 | Appendix G |
| 10 | `assumptions.md`, recording the choices made and why | Appendix D |

**Create the scripts with this command, not by retyping them.** It copies each script exactly from this file and fills in the prefix. Run it in PowerShell from the project root. Set `$prefix` to the agreed prefix. If the project does not use Copilot, remove `'sync-agent-config'` from the list. If this file is saved elsewhere, change the path.

```powershell
$prefix = '<project>'
$names = 'check-spec-artifacts', 'sync-agent-config'
$doc = [IO.File]::ReadAllText((Resolve-Path 'docs\spec-kit-setup.md')).Replace("`r`n", "`n")
New-Item -ItemType Directory -Force -Path scripts | Out-Null
foreach ($name in $names) {
    $pattern = '(?ms)^### `scripts/{0}\.ps1`\n\n````powershell\n(.*?)\n````$' -f $name
    $match = [regex]::Match($doc, $pattern)
    if (-not $match.Success) { throw "No code block for $name" }
    # The placeholder is built in two parts so that replacing placeholders cannot change this line.
    $code = $match.Groups[1].Value.Replace('<' + 'project>', $prefix)
    [IO.File]::WriteAllText((Join-Path $PWD "scripts\$name.ps1"), $code + "`n")
}
```

### Step 5: Verify And Report

- No unfilled setup placeholder remains (search for `<project>`, `<Project>`, `<author>`, `<area>` and `<ID>` outside this file).
- Run every check in section 12 except the trial feature.
- Run `.\scripts\check-spec-artifacts.ps1 -FeatureDir <folder>` on a temporary, deliberately incomplete feature folder, confirm it reports errors, then remove the folder.
- If using Copilot, run `.\scripts\sync-agent-config.ps1 -From claude`, then `-Check`.
- Report what was created, what failed or was skipped, and any open questions.
- Tell the user to start a new session so the new skills are loaded, then try one small feature.

## How The Pieces Fit

```text
CLAUDE.md                              always loaded: Claude Code
.github/copilot-instructions.md        always loaded: Copilot
docs/code-map.md                       where to look
assumptions.md                         why the setup is the way it is
.specify/
  memory/constitution.md               what must be true
  templates/overrides/                 shape of spec, plan, tasks, constitution
  presets/<project>/                   installed preset (generated)
presets/<project>/                     your rules for Spec Kit commands
.claude/
  skills/<project>-*/                  how to meet the rules, per area
  skills/speckit-*/                    Spec Kit commands (generated)
  rules/                               "touching these files? load this skill"
.github/
  skills/, instructions/               Copilot copies
scripts/
  check-spec-artifacts.ps1             mechanical checks
  sync-agent-config.ps1                keeps the two tools in step
```

```text
constitution heading  ->  names a skill  <-  path rule loads the same skill
        |                      |
        v                      v
  templates carry the IDs      skill holds process and points to code (via the code map)
```

## The Core Principle

**Say each thing once, in the place that loads it only when needed.** Text that is always loaded costs tokens on every request. Text that is repeated drifts apart, and the differences become findings to fix.

## Where Does A New Rule Go?

| The rule is… | Put it in | Why there |
|---|---|---|
| A mechanical check on Spec Kit documents | Check script | Same answer every time, almost no tokens |
| A binding obligation | Constitution | It governs every feature and violations are critical |
| How to meet or review an obligation | A `<project>-<area>` skill | Loaded only when that area is in play |
| "When touching these files, do this" | A path rule | Triggered by the work itself |
| True for every session | `CLAUDE.md` and Copilot instructions | Worth paying for every time |
| Where something is | Code map | A pointer does not go stale as content changes |
| The shape of a spec, plan or task list | Template override | Applied when the document is written |
| A change to how a Spec Kit command behaves | Preset | Survives upgrades |
| Why a decision was made | `assumptions.md` | Kept for people, not loaded for agents |

## 1. Foundation

- [ ] **Initialise Spec Kit** (add `--force` if the folder is not empty):

  ```powershell
  specify init --here --integration claude --script ps
  ```

  Why: it creates `.specify/` and the `speckit-*` skills.
- [ ] **Treat everything Spec Kit generated as read-only**: `speckit-*` skills, `.specify/scripts/` and the core templates.
  Why: upgrades refuse to run over hand edits, and forcing an upgrade discards them. Use overrides (section 7) and a preset (section 8).

## 2. Code Map

**Why use it:** without a map, an agent searches the repository to answer basic questions, in every session. A file of copied facts solves that but goes stale. Pointers solve both.

- [ ] **State that the code is the source of truth for how things are built.**
  Why: one authority for implementation, and it cannot drift from itself.
- [ ] **Create `docs/code-map.md` as a "to find X, read Y" table, with no facts in it.**
  Why: it only changes when a file moves, and a broken pointer is easy to see.
- [ ] **Add "convention by example": open the nearest similar file before adding one.**
  Why: it replaces pages of written conventions.
- [ ] **Add "Settled decisions": existing behaviour is an assumption, not a question.**
  Why: specify, clarify and plan stop reopening decided matters.
- [ ] **Add defaults for what a feature description leaves unsaid, choosing the simplest option.**
  Why: silence does not turn into new scope.

In an empty project, start with a few rows and add one as each pattern appears.

## 3. Constitution

**Why keep it small:** specify, clarify, plan, tasks and analyze each read it. Every extra line is paid for repeatedly, and analyze treats any conflict with it as critical. A short constitution is also easier to obey and amend.

- [ ] **Add the constitution template override first** (`.specify/templates/overrides/constitution-template.md`), stating the rules below.
  Why: later amendments keep to them without being reminded.
- [ ] **Run `/speckit-constitution`.**
  Why: it builds the document from your override.
- [ ] **Write obligations only, one short binding statement per bullet.**
  Why: this is the part that must always be applied.
- [ ] **Leave out how-to steps, commands, examples, rationale and implementation values.**
  Why: process belongs in skills, values in code, reasons in `assumptions.md`.
- [ ] **Give each requirement an ID and name its skill in the heading:**

  ```markdown
  ## SEC-001 Security · `<project>-security-review`
  - Security enforced at system boundaries.
  ```

  Why: the ID can be traced through plans, tasks and reviews. The skill name tells the agent where the detail is without carrying it. The check script expects three capital letters and three digits.
- [ ] **Add a Governance section**: source of truth, order of precedence (constitution, then skills and rules, then reference documents), conflicts must be raised, violations are critical, and which skill explains how to apply it.
  Why: contradictions and violations have a defined handling.
- [ ] **Include a rule against unrequested features.**
  Why: it limits scope growth in every step.
- [ ] **Require test tasks for every behaviour change, in words.**
  Why: the core tasks command treats tests as optional unless requested. Missing tests surface late, at converge, and cost another implement run.
- [ ] **Add Workflow and Delivery Gates**: mandatory commands, a Constitution Check in every plan, a task for every gate, and what completion requires.
  Why: gates become tasks at planning time instead of surprises at the end.
- [ ] **Require rationale, a version change and review for amendments; keep the impact note under 10 lines.**
  Why: changes stay deliberate and the file stays short.

## 4. Skills

**Why use skills instead of one large constitution:** a session lists only each skill's name and description. The body is read when it is needed. Database guidance costs almost nothing during UI work, and detail can grow without growing what every step reads. Each rule also gets a single home.

- [ ] **Create skills in `.claude/skills/<project>-<name>/SKILL.md`.**
  Why: the prefix separates your skills from generated `speckit-*` and plugin skills, and the sync script finds them by it.
- [ ] **Create `<project>-constitution-check` first**, covering: when each ID applies and which skill to load; how to write the Constitution Check; which gate tasks to create; the completion review; the command order.
  Why: the constitution says what is required; this one place says how to apply it.
- [ ] **Create one skill per area that has its own process.**
  Why: work loads only its own area.
- [ ] **Write each description as: what it holds, the IDs, and when to use it.**
  Why: it is the only part always visible and decides whether the skill loads.
- [ ] **List the governed IDs in each skill.**
  Why: the link back to the constitution can be checked.
- [ ] **Keep in a skill: pointers to the authoritative files, rules that need judgement, review steps and test timing.**
  Why: these need written guidance, while copied values go stale.
- [ ] **Move long material into a `references/` folder with a "load only what you need" table.**
  Why: one section loads instead of everything.
- [ ] **Reference a skill by name from other files; do not copy its text.**
  Why: one edit updates every use.

## 5. Path Instruction Files

**Why use them:** a skill loads only if the agent chooses it. A path rule is applied automatically when matching files are involved, so the right skill is not left to chance. It is also cheaper than putting every area's reminder in the always-loaded file.

- [ ] **Create `.claude/rules/<area>.md` with `paths:`:**

  ```markdown
  ---
  paths:
    - "src/<folder>/**"
  ---
  # SEC-001 Security

  Never expose secrets. Load the `<project>-security-review` skill for this work.
  ```

  Why: this is the trigger that connects files to guidance.
- [ ] **Create the Copilot equivalent, `.github/instructions/<area>.instructions.md`, with `applyTo:`** (the sync script generates it).
  Why: Copilot uses its own folder and frontmatter.
- [ ] **Keep each to a few lines: the IDs, the must-never rules, and the skill to load.**
  Why: it is a trigger. A second copy of the skill would drift.
- [ ] **Use narrow patterns.**
  Why: a broad pattern behaves like always-loaded text.
- [ ] **Revisit patterns when folders move.**
  Why: these are real paths, and a stale one stops triggering silently.

## 6. `CLAUDE.md` And `copilot-instructions.md`

**Why use them:** each is the one file its tool loads in every session. They orient the agent and point to everything else. **Why both:** each tool reads its own, so keeping both lets you switch tools without losing the setup.

- [ ] **Include only these:**

  | Content | Why it must always be present |
  |---|---|
  | Spec Kit is mandatory | Stops work bypassing the process |
  | Where the constitution is, and read it before planning outside Spec Kit | Ordinary chat does not load it automatically |
  | Constitution headings name the skill with the detail | Explains how to follow the references |
  | Code is the source of truth; use the code map | Prevents exploring and guessing |
  | Where path rules live | Makes the layout discoverable |
  | How to keep the two tools' files in step | Prevents drift at the moment of editing |
  | Never edit `speckit-*`; change the preset | Protects upgrades |
  | Workspace safety rules | Applies to any action |

- [ ] **Keep each file to about a page.**
  Why: it is paid for in every session.
- [ ] **Mirror every change between the two.**
  Why: they are maintained by hand and the script does not sync them.
- [ ] **Do not add a third always-loaded file such as `AGENTS.md`.**
  Why: it splits or duplicates the same guidance.

## 7. Template Overrides

**Why use them:** files in `.specify/templates/overrides/` are used instead of the core templates and survive upgrades. Templates control what gets generated, so they control document size and consistency.

- [ ] **Remove generic samples and ask for brevity.**
  Why: samples are copied into output, and every later command rereads the documents.
- [ ] **`spec-template.md`**: one line per requirement, requirements as `- **FR-001**: …`, an "Out Of Scope" section, and "Constitution Scope" tick boxes mapped to IDs.
  Why: scope is explicit, plan can pick IDs quickly, and the script can read requirements.
- [ ] **`plan-template.md`**: record only what changes; Constitution Check rows for applicable IDs, one `N/A:` line for the rest; name checklists instead of copying them; research only for open unknowns.
  Why: restated baselines and copied lists add size and conflicts.
- [ ] **`tasks-template.md`**: tests required; one line per task of about 200 characters; cite requirement IDs; a final completion-gates phase.
  Why: without a limit, tasks restate the spec and grow very large.
- [ ] **`constitution-template.md`**: the rules from section 3.
  Why: it protects the small constitution over time.
- [ ] **Point to the code map and skills from templates; do not copy project facts into them.**
  Why: templates then stay correct as the project changes.

## 8. Preset For Spec Kit Commands

**Why use it:** you need to change how some commands behave, but editing generated skills breaks upgrades. A preset wraps the core command with your rules and Spec Kit rebuilds the skill.

- [ ] **Create `presets/<project>/` with `preset.yml`, `commands/` and a README of upkeep steps.**
  Why: one reviewed source for all command changes.
- [ ] **Declare each overridden command with `strategy: "wrap"`:**

  ```yaml
  schema_version: "1.0"
  preset:
    id: "<project>"
    name: "<Project> Spec Kit Rules"
    version: "1.0.0"
    description: "Project rules layered over the core Spec Kit commands"
    author: "<author>"
  requires:
    speckit_version: ">=1.3.2"
  provides:
    templates:
      - type: "command"
        name: "speckit.clarify"
        file: "commands/speckit.clarify.md"
        description: "Ask only material questions"
        strategy: "wrap"
  ```

  Why: wrapping keeps receiving core improvements. Replacing would freeze a copy.
- [ ] **In each command file, state that your rules take precedence, list them, then add `{CORE_TEMPLATE}`:**

  ```markdown
  ---
  description: "<the core command's description>"
  strategy: wrap
  ---

  ## <Project> Rules

  These take precedence over any conflicting instruction below.

  - <rule>

  {CORE_TEMPLATE}
  ```

  Why: the core text remains, so the winner of a conflict must be clear.
- [ ] **Add these rules:**

  | Command | Rule | Why |
  |---|---|---|
  | specify | Record an optional "Out of scope:"; add nothing unrequested; apply settled decisions | Limits scope at the start |
  | clarify | Skip settled and out-of-scope items; ask only what changes data, behaviour or security; mark options that add machinery; say when no material questions remain | Keeps clarify useful and gives it an end |
  | plan | Research only real unknowns, without research agents; one fact in one file | Saves effort and prevents drift |
  | tasks | Tests required; cite IDs, do not copy constraints; run the check script | Removes conflicts with your templates |
  | analyze | Run the script; report CRITICAL and HIGH only; one approved batch of fixes, then a limited re-check | Stops endless analyze loops |

- [ ] **Give each fact one owner**: behaviour in `spec.md`, fields in `data-model.md`, API and UI shapes in `contracts/`, decisions in `research.md`.
  Why: fixes touch one place.
- [ ] **Install, record and check:**

  ```powershell
  specify preset add --dev presets/<project>
  ```

  ```powershell
  specify integration upgrade claude --force
  ```

  ```powershell
  specify integration status
  ```

  Why: installing rewrites the skills; the forced upgrade records them as expected. It also discards hand edits, so make none.
- [ ] **Keep `presets/<project>/` and `.specify/presets/` together.**
  Why: the first is the source you edit; the second is the installed copy.

## 9. Check Script

**Why use it:** counting coverage, formats and missing entries needs no judgement. A script does it with almost no tokens and the same answer every time.

- [ ] **Add `scripts/check-spec-artifacts.ps1`** (Appendix E).
  Why: the preset's tasks and analyze rules call it.
- [ ] **Check requirement coverage, task format, constitution IDs in the plan, gate tasks and placeholders; warn on size.**
  Why: these are the common mechanical gaps.
- [ ] **Match it to your templates' headings and ID formats, and test it on a deliberately broken feature.**
  Why: a script that reads the wrong shape passes or fails for the wrong reason.

## 10. Sync Script

**Why use it:** keeping two copies by hand fails sooner or later. Skip this section if you use only one tool.

- [ ] **Add `scripts/sync-agent-config.ps1`** (Appendix F) and set `$SkillPrefix` to your prefix.
  Why: it copies your skills, converts `paths:` to `applyTo:`, and creates Copilot's `speckit-*` skills.
- [ ] **Pick one side as the usual source (`-From claude` or `-From copilot`).**
  Why: editing both sides leads to one overwriting the other.
- [ ] **Do not add Copilot as a second Spec Kit integration beside Claude.**
  Why: it was refused without `--force` in testing; the script covers the need.

## 11. Decision Record

- [ ] **Keep `assumptions.md`: a short dated entry for each change to the setup, with the reason.**
  Why: reasons stay available without being loaded as rules, and you avoid undoing a fix you have forgotten the purpose of.

## 12. Verify The Wiring

- [ ] **Every constitution heading names a skill that exists** (where it names one).
  Why: a broken reference loses the detail.
- [ ] **Every ID appears in the spec scope list, plan table, tasks gates, constitution-check skill, its owning skill and any path rule.**
  Why: an ID added to the constitution alone gets missed when planning.
- [ ] **Nothing is stated in two places, and nothing contradicts.**
  Why: this is the source of most rework.
- [ ] **Spec Kit and sync checks pass:**

  ```powershell
  specify integration status
  ```

  ```powershell
  .\scripts\sync-agent-config.ps1 -Check
  ```

  Why: they show that generated files are recorded and both tools match.
- [ ] **Run one small feature through the process.**
  Why: wiring faults show up cheaply.

## 13. Upgrade Spec Kit Without Losing Customisations

**Why this works:** an upgrade regenerates Spec Kit's own files. Your changes live outside them, and the preset is applied again to the regenerated skills.

| Item | On upgrade | Why |
|---|---|---|
| Constitution | Kept | It is your document |
| `.specify/templates/overrides/` | Kept | Spec Kit does not manage it |
| `presets/<project>/` and `.specify/presets/` | Kept, and applied again | The preset wraps the new core commands |
| `<project>-*` skills, path rules, instruction files, your scripts, code map | Kept | Spec Kit did not create them |
| `speckit-*` skills | Regenerated with your preset rules | Any hand edit is lost |
| Core templates and `.specify/scripts/` | Replaced when forced | They belong to Spec Kit |

This was tested by repeating the upgrade on version 1.3.2. Moving to a newer version has not been tested, so do every step, in order, in one terminal so that `$backup` stays set.

- [ ] **See whether a newer version exists.**
  Why: this check changes nothing.

  ```powershell
  specify self check
  ```

- [ ] **Confirm there are no unrecorded changes: status OK and zero modified files.**
  Why: forcing the upgrade discards hand edits. If files show as modified, move your change into the preset or an override first. After a preset edit, record it as described in section 8.

  ```powershell
  specify integration status
  ```

- [ ] **Copy the setup folders to a backup outside the project.**
  Why: you can compare what changed and put things back.

  ```powershell
  $backup = "..\speckit-backup-$(Get-Date -Format yyyyMMdd-HHmm)"
  New-Item -ItemType Directory -Path $backup | Out-Null
  Get-Item .specify, .claude, .github, presets, scripts -ErrorAction SilentlyContinue |
      Copy-Item -Destination $backup -Recurse
  ```

- [ ] **Upgrade the command-line tool.** On Windows it may print a `uv` command instead; run that command.
  Why: project files are upgraded from the version of the tool you have installed.

  ```powershell
  specify self upgrade
  ```

- [ ] **Upgrade the project files.**
  Why: `--force` is needed to refresh the shared scripts and core templates as well as the skills. It is safe only after the status check above. Do not upgrade with `specify init --here --force`, which overwrites with fewer checks.

  ```powershell
  specify integration upgrade claude --force
  ```

- [ ] **Confirm the customisations are applied: status OK, preset enabled, and five skills containing your rules.**
  Why: a successful upgrade message does not prove your rules are there.

  ```powershell
  specify integration status
  ```

  ```powershell
  specify preset list
  ```

  ```powershell
  Select-String -Path .claude\skills\speckit-*\SKILL.md -Pattern '## <Project> Rules'
  ```

- [ ] **If rules are missing, apply the preset again, then repeat the upgrade command and the checks.**
  Why: this rebuilds the skills from your source folder.

  ```powershell
  specify preset update <project> --dev presets/<project>
  ```

- [ ] **Check that your preset rules still fit the new commands.** The sections they name must still exist: "Phase 0" and "Phase 1" in plan, and the detection passes and "Offer Remediation" in analyze.
  Why: a rule that refers to a renamed section may be ignored. Compare each skill with the backup:

  ```powershell
  foreach ($n in 'specify', 'clarify', 'plan', 'tasks', 'analyze') {
      "== $n"
      Compare-Object (Get-Content "$backup\.claude\skills\speckit-$n\SKILL.md") (Get-Content ".claude\skills\speckit-$n\SKILL.md")
  }
  ```

- [ ] **Compare the new core templates with the old ones, and copy wanted changes into your overrides.**
  Why: an override hides the core template, so improvements do not reach you on their own.

  ```powershell
  foreach ($n in 'spec', 'plan', 'tasks', 'constitution') {
      "== $n"
      Compare-Object (Get-Content "$backup\.specify\templates\$n-template.md") (Get-Content ".specify\templates\$n-template.md")
  }
  ```

- [ ] **Run the check script on a recent feature.**
  Why: it shows whether document formats or `.specify/feature.json` handling still match.

  ```powershell
  .\scripts\check-spec-artifacts.ps1
  ```

- [ ] **If using Copilot, sync and check.**
  Why: Copilot's copies are not upgraded by Spec Kit.

  ```powershell
  .\scripts\sync-agent-config.ps1 -From claude
  ```

  ```powershell
  .\scripts\sync-agent-config.ps1 -Check
  ```

- [ ] **Add an `assumptions.md` entry with the version and anything you changed.**
  Why: the next upgrade starts from a known state.

| Problem | Likely cause | Action |
|---|---|---|
| Upgrade refuses because files were modified | A hand edit, or a preset change not yet recorded | Move edits into the preset or an override, then use `--force` |
| A file you did not edit shows as modified | Its line endings changed | Confirm the content is unchanged, then use `--force` |
| Your rules are missing | The preset is disabled or was not applied | Update the preset, then upgrade again |
| The new version misbehaves | An incompatible change | Restore the folders from the backup and reinstall the earlier version with `specify self upgrade --tag v<version>` |

## When You Change Something

| You change | Also do | Why |
|---|---|---|
| A constitution ID | Repeat the ID check in section 12; add an `assumptions.md` entry | Keeps references complete |
| A `<project>-*` skill or path rule | Run the sync script | Keeps Copilot current |
| `CLAUDE.md` or Copilot instructions | Edit the other one | Not synced automatically |
| The preset | `specify preset update <project> --dev presets/<project>`, then `specify integration upgrade claude --force`, then sync | Rebuilds and records the skills |
| Spec Kit version | Follow section 13 | Keeps your customisations |
| A folder name | Update the code map and path patterns | Pointers and triggers use real paths |

## Appendix: Files To Create

Copy each block into the path in its heading, then replace the placeholders as step 4 describes.

## Appendix A: Code Map

### `docs/code-map.md`

````markdown
# <Project> Code Map

The source code is the only source of truth. This file holds no facts, only where to look, so
it doesn't need updating when code changes. If a pointer is missing, or the file no longer
contains what's described, search for the concern and update the pointer.

**Convention by example:** before adding a file, open its nearest sibling in the same area
and follow its pattern. Don't invent structure.

| To find… | Read |
|---|---|
| <concern> | <path> |

**Settled decisions:** a behaviour already implemented in the code is settled. Specify, clarify
and plan record it as an assumption, citing the file above, and never raise it as NEEDS
CLARIFICATION. Only a feature that changes it should discuss it.

**Defaults when the feature description is silent** (also settled):

- <topic>: <the simplest existing mechanism, or the constitution's requirements>
````

## Appendix B: Template Overrides

### `.specify/templates/overrides/spec-template.md`

````markdown
# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`

**Created**: [DATE]

**Status**: Draft

**Input**: User description: "$ARGUMENTS"

<!--
  <Project> override. Be concise: one line per requirement or scenario, no repetition across
  sections. Behaviour already implemented in the code is settled (see docs/code-map.md):
  record it as an assumption, never as NEEDS CLARIFICATION.
-->

## User Scenarios & Testing *(mandatory)*

<!-- Prioritise stories (P1 most critical). Each must be independently testable and deliver value alone. -->

### User Story 1 - [Brief Title] (Priority: P1)

[The journey in 1–3 sentences]

**Why this priority**: [One sentence]

**Independent Test**: [One sentence]

**Acceptance Scenarios**:

1. **Given** [state], **When** [action], **Then** [outcome]

---

[Add more user stories as needed, each with a priority]

### Edge Cases

- [Boundary or error condition → expected behaviour]

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST [capability]

### Key Entities *(include if feature involves data)*

- **[Entity]**: [What it represents, key attributes]

### Constitution Scope

Tick each that applies, so plan can pick requirement IDs without rereading the spec:

- [ ] <Situation that makes a requirement apply> (<ID>)

## Success Criteria *(mandatory)*

<!-- Measurable and technology-agnostic. -->

- **SC-001**: [Measurable outcome]

## Out Of Scope

- [From the "Out of scope:" statement and clarify answers, or "None"]

## Assumptions

- [Reasonable defaults chosen where the description was silent]
````

### `.specify/templates/overrides/plan-template.md`

````markdown
# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

<!--
  <Project> override. Be concise: bullets over prose, no restating the spec.
  The code is the source of truth. Use docs/code-map.md to find the files that answer a
  question, and record only what this feature changes or adds.
  State each fact in one file; elsewhere cite the ID or file.
  research.md: only when NEEDS CLARIFICATION items exist; one short entry per decision.
  contracts/: schema only. quickstart.md: runnable validation commands only.
-->

## Summary

[2–4 sentences: primary requirement and technical approach]

## Technical Context

**Baseline**: The existing stack and settled decisions in the code (see `docs/code-map.md`).
Do not restate them.

**Feature-specific changes**: [New packages, data changes, new interfaces, or "None beyond baseline"]

**Performance Goals**: [Feature-specific targets, or "Constitution defaults"]

**Constraints**: [Feature-specific constraints only]

**Scale/Scope**: [Brief]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*
*Procedure: `<project>-constitution-check` skill. Keep rows only for IDs that apply, one sentence per cell. List every other ID on the N/A line with a short reason.*

| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | | Review | |
| ENG-001 | Yes | | Test tasks, quality gates | |
| <ID> | | | <gate for this ID> | |

N/A: [ID (reason), ...]

[If a requirement has a checklist, name its file as a gate. Do not copy the checklist here.]

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md
├── research.md          # only if there were open unknowns
├── data-model.md        # only if entities or schema change
├── quickstart.md
├── contracts/           # only if interfaces change
└── tasks.md             # /speckit-tasks output
```

### Source Code (files this feature touches)

<!-- List only new or changed paths, placed beside their nearest existing siblings. -->

```text
[new or changed paths]
```

**Structure Decision**: Existing layout, following sibling files. [Note any deviation]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
````

### `.specify/templates/overrides/tasks-template.md`

````markdown
---

description: "<Project> task list template"
---

# Tasks: [FEATURE NAME]

**Input**: `specs/[###-feature-name]/` (plan.md, spec.md, and data-model.md / contracts/ when present)

**Tests**: REQUIRED. ENG-001 makes every behaviour change an explicit request for tests. Write
tests first and confirm they fail before implementing.

## Format: `- [ ] T### [P?] [US#?] Description with exact file path`

- **[P]**: parallel-safe (different files, no dependency). **[US#]**: user story label.
- One line per task, at most about 200 characters. State the file and the outcome. Do not
  restate spec or plan text; reference it (e.g. `per data-model.md <Entity>`, `FR-004`).
- Paths and patterns follow the nearest existing sibling file (`docs/code-map.md`).
- Cite every FR, and every success criterion needing buildable work, by ID in at least one task.
- Each gate task cites every PENDING Constitution Check ID it closes.

<!--
  Replace every sample below with real tasks. Omit Setup or Foundational phases when the
  feature needs none. Do not keep sample tasks.
-->

## Phase 1: Setup

- [ ] T001 [Only if needed: new package or configuration]

## Phase 2: Foundational (blocks all stories)

- [ ] T002 [Shared change needed by every story]

**Checkpoint**: fast tests pass.

---

## Phase 3: User Story 1 - [Title] (Priority: P1) 🎯 MVP

**Goal**: [One sentence] | **Independent Test**: [One sentence]

- [ ] T003 [P] [US1] Tests in `<test path>`
- [ ] T004 [US1] Implementation in `<source path>`

**Checkpoint**: story's tests pass; phase gates per test cadence.

---

[Repeat the user story phase for each story in priority order]

---

## Phase N: Completion Gates

Include each applicable row from the plan's Constitution Check. Delete rows that are N/A there.

- [ ] TXXX <Independent review or checklist for one requirement> (<ID>, `<project>-<area>`)
- [ ] TXXX Run completion quality gates and record results (ENG-001, <IDs>, test cadence in `<project>-<area>`)

---

## Dependencies & Execution Order

- Setup → Foundational → user stories in priority order → Completion Gates.
- [List only cross-story or non-obvious task dependencies]

## Parallel Opportunities

- [One line per story]

## Implementation Strategy

MVP = User Story 1. Deliver stories incrementally; each must pass its own tests before the next starts.
````

### `.specify/templates/overrides/constitution-template.md`

````markdown
# [PROJECT_NAME] Constitution

**Version**: [CONSTITUTION_VERSION] | **Last Amended**: [LAST_AMENDED_DATE]

<!--
  <Project> override. This file is read by the Spec Kit steps, so keep it lean:
  - Keep every requirement ID and its heading format: `## <ID> <Name> · \`<project>-* skill(s)\``.
  - One short binding statement per bullet. No rationale paragraphs, examples or how-to detail.
    State obligations, not mechanisms. The code is authoritative for implementation; process goes
    in the named <project>-* skill; rationale goes in assumptions.md.
  - Never drop or merge an existing requirement ID without an explicit instruction to do so.
  - Keep the Sync Impact Report to 10 lines or fewer. It is removed after review.
-->

## Governance
[GOVERNANCE_RULES]
<!-- Source of truth (code for implementation, constitution for obligations, specs for intent),
     precedence for obligations (constitution > <project>-* skills and path-scoped instructions >
     reference docs), conflicts must be raised, violations are CRITICAL, skill names in headings
     hold the detail, and <project>-constitution-check holds the procedure. -->

## [REQUIREMENT_ID] [REQUIREMENT_NAME] · `[REQUIREMENT_SKILLS]`
- [REQUIREMENT_RULE]
<!-- Repeat this section once per requirement ID. ARC-001 and ENG-001 are always present.
     Omit the `· skill` suffix only when no skill holds detail for that ID. -->

## Workflow and Delivery Gates
- [WORKFLOW_RULE]
<!-- Mandatory Spec Kit commands, Constitution Check, required gate tasks, delivery gates. -->

## Amendments
[AMENDMENT_RULES]
````

## Appendix C: Skills

### `.claude/skills/<project>-constitution-check/SKILL.md`

````markdown
---
name: "<project>-constitution-check"
description: "How to apply the <Project> constitution: Constitution Check, gate tasks, completion review. Use when planning, checking compliance, or before declaring work complete."
metadata:
  author: "<author>"
  governs: "Constitution governance, ENG-001 completion"
---

# <Project> Constitution Check

The constitution (`.specify/memory/constitution.md`) holds the binding rules. This skill holds the
procedure for applying them. Constitutional violations are CRITICAL findings.

## 1. Identify applicable requirement IDs (before planning)

| ID | Applies when the feature… | Load skill |
|---|---|---|
| ARC-001 | always | — |
| ENG-001 | always | `<project>-<area>` for test tooling |
| <ID> | <situation> | `<project>-<area>` |

Load only the skills for the IDs that apply. When unsure whether an ID applies, include it and
say why it is marginal.

## 2. Write the Constitution Check (plan)

Fill the plan's Constitution Check section with one row per applicable ID, then name every other
ID on one N/A line with a short reason:

```markdown
| ID | Applies | How the plan complies | Gate / evidence | Status |
|----|---------|-----------------------|-----------------|--------|
| ARC-001 | Yes | <how> | Review | PASS |
| ENG-001 | Yes | <how> | Test tasks, quality gates | PENDING |

N/A: <ID> (<reason>)
```

- Where a requirement has a checklist, name its file as a gate. Do not copy it into the plan.
- Any deviation goes in the plan's Complexity Tracking table with a justification. An unjustified
  deviation is a CRITICAL finding.
- Re-evaluate the Constitution Check after design (Phase 1).

## 3. Tasks

Every gate marked PENDING in the Constitution Check needs a task that cites its ID. Add them when
tasks.md is generated, not later. Missing gate tasks make `/speckit-converge` create fix-up tasks,
which means another implement and converge run.

- Every user story phase includes its test tasks (ENG-001 counts as an explicit request for tests).
- Independent reviews run once per feature over the full change, in the final phase.

## 4. Completion review (delivery gates)

Work is complete only when all of these hold. Record each with evidence:

- [ ] Applicable requirement IDs identified
- [ ] Constitution Check completed, with no unjustified deviations
- [ ] All applicable automated tests and quality gates pass
- [ ] Required independent reviews completed and findings remediated and verified
- [ ] Every item of each applicable checklist has a recorded result
- [ ] No blocking findings remain

Reporting rules:

- Validation must be agent-executable. Manual testing is not a required gate.
- After a fix, rerun the gates whose covered code changed.
- Report every failed or blocked check. Never claim a check passed when it failed or could not run.

## Spec Kit order

specify → (clarify) → plan → tasks → (analyze, checklist) → implement → converge. Converge is
required before completion.
````

One per area. Remove sections an area does not need.

### `.claude/skills/<project>-<area>/SKILL.md`

````markdown
---
name: "<project>-<area>"
description: "<Project> <area> rules, tests and review (<IDs>). Use when planning, writing, testing or reviewing <what>."
metadata:
  author: "<author>"
  governs: "<IDs>"
---

# <Project> <Area>

## Source of truth

| Concern | Authoritative implementation | Enforced by |
|---|---|---|
| <concern> | <path, or "see docs/code-map.md"> | <check or Review> |

Follow the nearest sibling's pattern. If the code and this skill disagree, raise it; do not pick a side.

## Rules to review

- <rule>

## Test cadence

| When | Run |
|---|---|
| After each task | Affected tests only |
| End of each phase | <fast checks>, once |
| Completion | All quality gates, once |

Show failures only. Never report a check as passed when it failed or could not run.

## Independent review (where required)

Run as a separate pass over the full change.

- [ ] <check>
````

## Appendix D: Instructions And Decision Record

If Claude Code only, remove the Copilot sentence from `CLAUDE.md`.

### `CLAUDE.md`

````markdown
# <Project>

Spec Kit workflow is mandatory. Outside Spec Kit commands, read `.specify/memory/constitution.md` before planning or reviewing changes. Constitutional violations are CRITICAL. Each constitution heading names the `<project>-*` skill that holds its detail.

The code is the source of truth. Use `docs/code-map.md` to find the file that answers a question instead of exploring the repository.

Path-scoped rules live in `.claude/rules/`.

The GitHub Copilot copies in `.github/` are kept in sync. After editing a `<project>-*` skill or a rule, run `.\scripts\sync-agent-config.ps1 -From claude`. Mirror any change to this file in `.github/copilot-instructions.md`.

Never edit `speckit-*` skills: they are generated. Change their <Project> rules in `presets/<project>/` and follow its README.

## Workspace operations

<the user's workspace safety rules>
````

### `.github/copilot-instructions.md`

````markdown
# Copilot Instructions

Spec Kit workflow is mandatory. Outside Spec Kit commands, read `.specify/memory/constitution.md` before planning or reviewing changes. Constitutional violations are CRITICAL. Each constitution heading names the `<project>-*` skill that holds its detail.

The code is the source of truth. Use `docs/code-map.md` to find the file that answers a question instead of exploring the repository.

The Claude Code copies in `.claude/` are kept in sync. After editing a `<project>-*` skill or an instructions file, run `.\scripts\sync-agent-config.ps1 -From copilot`. Mirror any change to this file in `CLAUDE.md`.

Never edit `speckit-*` skills: they are generated. Change their <Project> rules in `presets/<project>/` and follow its README.

## Workspace operations

<the user's workspace safety rules>
````

### `assumptions.md`

````markdown
# <Project> Setup Decisions

Why the Spec Kit and agent setup is built this way. Add a dated entry for each change. Not loaded by agents.

## Constitution <version> (<date>): initial setup

- <decision>: <reason>
````

## Appendix E: Check Script

### `scripts/check-spec-artifacts.ps1`

````powershell
<#
.SYNOPSIS
    Mechanical checks of a feature's spec.md, plan.md and tasks.md.

.DESCRIPTION
    Replaces checks an agent would otherwise make by reading the files.

    ERROR (exit 1):
      - a required file is missing
      - an FR is defined twice, or no task cites it
      - a task is malformed, a task ID repeats, or a user story task has no [US#]
      - a constitution ID is missing from the plan's Constitution Check
      - a PENDING Constitution Check ID is cited by no task
      - a template placeholder or open marker remains
    WARN (exit code unchanged):
      - a success criterion no task cites, long tasks, large documents

    IDs may be written as FR-001, as a list (FR-007/008/009) or as a range (SEC-001..003).

.PARAMETER FeatureDir
    Feature folder. Defaults to the one in .specify/feature.json.

.EXAMPLE
    .\scripts\check-spec-artifacts.ps1
.EXAMPLE
    .\scripts\check-spec-artifacts.ps1 -FeatureDir specs/029-asset-register
#>
[CmdletBinding()]
param(
    [string]$FeatureDir,
    [string]$Root,
    [int]$MaxTaskLength = 220,
    [int]$MaxTotalKB = 35
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Not a parameter default: under "powershell -File", $PSScriptRoot is empty there.
if (-not $Root) { $Root = Split-Path -Parent $PSScriptRoot }

$errors = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

function Read-Text([string]$Path) {
    [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8)
}

# Every ID in the text, with lists (A-001/002) and ranges (A-001..003) expanded.
function Get-Ids([string]$Text) {
    $ids = @{}
    # The en dash is built from its code: Windows PowerShell misreads it as a literal in this file.
    $separators = '/|\.\.|' + [char]0x2013
    $pattern = '\b(?<p>[A-Z]{2,3})-(?<n>\d{3})(?<s>[a-z]?)(?<rest>(?:\s*(?:' + $separators + ')\s*(?:[A-Z]{2,3}-)?\d{3}[a-z]?)*)'
    $partPattern = '(?<sep>' + $separators + ')\s*(?:(?<p>[A-Z]{2,3})-)?(?<n>\d{3})(?<s>[a-z]?)'
    foreach ($m in [regex]::Matches($Text, $pattern)) {
        $prefix = $m.Groups['p'].Value
        $last = [int]$m.Groups['n'].Value
        $ids["$prefix-$($m.Groups['n'].Value)$($m.Groups['s'].Value)"] = $true
        foreach ($part in [regex]::Matches($m.Groups['rest'].Value, $partPattern)) {
            if ($part.Groups['p'].Success) { $prefix = $part.Groups['p'].Value }
            $next = [int]$part.Groups['n'].Value
            if ($part.Groups['sep'].Value -ne '/') {
                for ($i = $last + 1; $i -lt $next; $i++) { $ids[('{0}-{1:000}' -f $prefix, $i)] = $true }
            }
            $ids[('{0}-{1:000}{2}' -f $prefix, $next, $part.Groups['s'].Value)] = $true
            $last = $next
        }
    }
    $ids
}

if (-not $FeatureDir) {
    $featureJson = Join-Path $Root '.specify/feature.json'
    if (-not (Test-Path $featureJson)) { Write-Host 'ERROR no .specify/feature.json; pass -FeatureDir'; exit 1 }
    $FeatureDir = (Read-Text $featureJson | ConvertFrom-Json).feature_directory
}
if (-not [IO.Path]::IsPathRooted($FeatureDir)) { $FeatureDir = Join-Path $Root $FeatureDir }

$text = @{}
$bytes = 0
foreach ($name in 'spec', 'plan', 'tasks') {
    $path = Join-Path $FeatureDir "$name.md"
    if (-not (Test-Path $path)) { $errors.Add("$name.md is missing"); continue }
    $bytes += (Get-Item $path).Length
    # HTML comments hold template guidance, not content.
    $text[$name] = [regex]::Replace((Read-Text $path), '(?s)<!--.*?-->', '')
}

if ($errors.Count -eq 0) {
    # Placeholders
    $markers = '\[NEEDS CLARIFICATION', 'NEEDS CLARIFICATION:', '\bTXXX\b', '\bTODO\b', '\bTKTK\b', '\?\?\?',
        '\[FEATURE', '\[###', '\[DATE\]', '\[Brief Title\]', '\[ID \(reason\)'
    foreach ($name in 'spec', 'plan', 'tasks') {
        foreach ($marker in $markers) {
            $found = [regex]::Match($text[$name], $marker)
            if ($found.Success) { $errors.Add("$name.md still contains '$($found.Value)'") }
        }
    }

    # Requirement coverage
    $defined = @([regex]::Matches($text.spec, '(?m)^\s*-\s*\*\*(?<id>(?:FR|SC)-\d{3}[a-z]?)\*\*') |
        ForEach-Object { $_.Groups['id'].Value })
    if (-not ($defined -like 'FR-*')) { $errors.Add('spec.md defines no requirements as "- **FR-001**:"') }
    $defined | Group-Object | Where-Object { $_.Count -gt 1 -and $_.Name -like 'FR-*' } |
        ForEach-Object { $errors.Add("spec.md defines $($_.Name) $($_.Count) times") }
    $cited = Get-Ids $text.tasks
    $uncovered = @($defined | Sort-Object -Unique | Where-Object { -not $cited.ContainsKey($_) })
    $frs = @($uncovered | Where-Object { $_ -like 'FR-*' })
    $scs = @($uncovered | Where-Object { $_ -like 'SC-*' })
    if ($frs.Count) { $errors.Add("no task cites: $($frs -join ', ')") }
    if ($scs.Count) { $warnings.Add("no task cites (fine if nothing to build): $($scs -join ', ')") }

    # Task format
    $seen = @{}
    $long = @()
    $inStory = $false
    foreach ($line in ($text.tasks -split '\r?\n')) {
        if ($line -match '^##\s') { $inStory = $line -match 'User Story' }
        if ($line -notmatch '^\s*- \[') { continue }
        if ($line -notmatch '^- \[[ xX]\] (?<id>T\d{3,}) ') {
            $errors.Add("malformed task: $($line.Substring(0, [Math]::Min(60, $line.Length)))")
            continue
        }
        $id = $Matches['id']
        if ($seen.ContainsKey($id)) { $errors.Add("task ID $id is used twice") }
        $seen[$id] = $true
        if ($inStory -and $line -notmatch '\[US\d+\]') { $errors.Add("$id is in a user story phase but has no [US#]") }
        if ($line.Length -gt $MaxTaskLength) { $long += $id }
    }
    if ($seen.Count -eq 0) { $errors.Add('tasks.md has no tasks') }
    if ($long.Count) {
        $shown = ($long | Select-Object -First 10) -join ', '
        $warnings.Add("$($long.Count) task(s) over $MaxTaskLength characters: $shown$(if ($long.Count -gt 10) { ', ...' })")
    }

    # Constitution Check
    $section = [regex]::Match($text.plan, '(?ms)^## Constitution Check\s*$(?<body>.*?)(?=^## |\z)')
    if (-not $section.Success) {
        $errors.Add('plan.md has no "## Constitution Check" section')
    }
    else {
        $body = $section.Groups['body'].Value
        $constitution = Read-Text (Join-Path $Root '.specify/memory/constitution.md')
        $required = @([regex]::Matches($constitution, '(?m)^## (?<id>[A-Z]{3}-\d{3})\b') |
            ForEach-Object { $_.Groups['id'].Value })
        # Only table rows and the N/A line count, not prose that happens to name an ID.
        $rows = @($body -split '\r?\n' | Where-Object { $_ -match '^\s*\|' })
        $notApplicable = [regex]::Match($body, '(?ms)^N/A:.*?(?=\r?\n[ \t]*\r?\n|\z)').Value
        $listed = Get-Ids (($rows + $notApplicable) -join "`n")
        $missing = @($required | Where-Object { -not $listed.ContainsKey($_) })
        if ($missing.Count) { $errors.Add("Constitution Check omits: $($missing -join ', ')") }

        foreach ($row in [regex]::Matches($body, '(?m)^\|\s*(?<id>[A-Z]{3}-\d{3})\s*\|.*\|\s*PENDING[^|]*\|\s*$')) {
            $id = $row.Groups['id'].Value
            if (-not $cited.ContainsKey($id)) { $errors.Add("PENDING gate $id is cited by no task") }
        }
    }

    $kb = [Math]::Round($bytes / 1KB)
    if ($kb -gt $MaxTotalKB) { $warnings.Add("spec, plan and tasks total $kb KB (budget $MaxTotalKB KB)") }
}

foreach ($e in $errors) { Write-Host "ERROR $e" }
foreach ($w in $warnings) { Write-Host "WARN  $w" }
Write-Host "$(Split-Path -Leaf $FeatureDir): $($errors.Count) error(s), $($warnings.Count) warning(s)."
if ($errors.Count) { exit 1 }
exit 0
````

## Appendix F: Sync Script

Only if using Copilot. Replace `<project>` in `$SkillPrefix` and the comments.

### `scripts/sync-agent-config.ps1`

````powershell
<#
.SYNOPSIS
    Keeps the Claude Code and GitHub Copilot agent configuration in sync.

.DESCRIPTION
    Pairs kept in sync:
      .claude/skills/<project>-*/**   <->  .github/skills/<project>-*/**              (identical files)
      .claude/rules/<name>.md      <->  .github/instructions/<name>.instructions.md
                                        (same body; `paths:` list <-> `applyTo:` string)

      .claude/skills/speckit-*/SKILL.md -> .github/skills/speckit-*/SKILL.md
                                        (one way; Claude Code-only front matter removed)

    Spec Kit generates the .claude speckit-* skills, including the rules in presets/<project>.
    -From copilot never changes them.
    CLAUDE.md and .github/copilot-instructions.md are maintained by hand.

    Files that exist only on the target side are reported, never deleted.

.PARAMETER Check
    Report drift and exit 1 if any pair differs. Changes nothing.

.PARAMETER From
    Copy from this side to the other: 'claude' or 'copilot'.

.EXAMPLE
    .\scripts\sync-agent-config.ps1 -Check
.EXAMPLE
    .\scripts\sync-agent-config.ps1 -From claude
#>
[CmdletBinding(DefaultParameterSetName = 'Check')]
param(
    [Parameter(ParameterSetName = 'Check', Mandatory = $true)]
    [switch]$Check,

    [Parameter(ParameterSetName = 'Sync', Mandatory = $true)]
    [ValidateSet('claude', 'copilot')]
    [string]$From,

    [string]$Root
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Not a parameter default: under "powershell -File", $PSScriptRoot is empty there.
if (-not $Root) { $Root = Split-Path -Parent $PSScriptRoot }

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# Prefix of the project's own skills.
$SkillPrefix = '<project>'

$Sides = @{
    claude  = @{ Skills = Join-Path $Root '.claude/skills';  Rules = Join-Path $Root '.claude/rules' }
    copilot = @{ Skills = Join-Path $Root '.github/skills';  Rules = Join-Path $Root '.github/instructions' }
}

function Get-RelativePath([string]$Base, [string]$Path) {
    $Path.Substring($Base.Length).TrimStart('\', '/').Replace('\', '/')
}

function Get-SkillFiles([string]$SkillsRoot) {
    $result = @{}
    if (-not (Test-Path $SkillsRoot)) { return $result }
    Get-ChildItem -Path $SkillsRoot -Directory -Filter "$SkillPrefix-*" | ForEach-Object {
        Get-ChildItem -Path $_.FullName -File -Recurse | ForEach-Object {
            $result[(Get-RelativePath $SkillsRoot $_.FullName)] = $_.FullName
        }
    }
    $result
}

function Split-FrontMatter([string]$Text, [string]$Path) {
    $m = [regex]::Match($Text, '\A---\r?\n(?<fm>.*?)\r?\n---\r?\n(?<body>.*)\z', 'Singleline')
    if (-not $m.Success) { throw "No front matter found in $Path" }
    @{ FrontMatter = $m.Groups['fm'].Value; Body = $m.Groups['body'].Value }
}

function Get-RulePatterns([string]$FrontMatter, [string]$Side, [string]$Path) {
    if ($Side -eq 'claude') {
        $patterns = @([regex]::Matches($FrontMatter, '(?m)^\s*-\s*"(?<p>[^"]+)"\s*$') |
            ForEach-Object { $_.Groups['p'].Value })
    }
    else {
        $m = [regex]::Match($FrontMatter, '(?m)^applyTo:\s*"(?<p>[^"]*)"\s*$')
        if (-not $m.Success) { throw "No applyTo in $Path" }
        $patterns = @($m.Groups['p'].Value.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    }
    if ($patterns.Count -eq 0) { throw "No file patterns in $Path" }
    $patterns
}

function Format-Rule([string[]]$Patterns, [string]$Body, [string]$Side) {
    if ($Side -eq 'claude') {
        $lines = @('---', 'paths:') + ($Patterns | ForEach-Object { "  - `"$_`"" }) + @('---')
    }
    else {
        $lines = @('---', "applyTo: `"$($Patterns -join ',')`"", '---')
    }
    ($lines -join "`n") + "`n" + $Body
}

function Get-RuleFiles([string]$RulesRoot, [string]$Side) {
    $result = @{}
    if (-not (Test-Path $RulesRoot)) { return $result }
    $suffix = if ($Side -eq 'claude') { '.md' } else { '.instructions.md' }
    Get-ChildItem -Path $RulesRoot -File -Filter "*$suffix" | ForEach-Object {
        $name = $_.Name.Substring(0, $_.Name.Length - $suffix.Length)
        $result[$name] = $_.FullName
    }
    $result
}

function Get-RulePath([string]$RulesRoot, [string]$Name, [string]$Side) {
    $suffix = if ($Side -eq 'claude') { '.md' } else { '.instructions.md' }
    Join-Path $RulesRoot "$Name$suffix"
}

function Convert-Rule([string]$SourcePath, [string]$SourceSide, [string]$TargetSide) {
    $text = [IO.File]::ReadAllText($SourcePath)
    $parts = Split-FrontMatter $text $SourcePath
    $patterns = Get-RulePatterns $parts.FrontMatter $SourceSide $SourcePath
    Format-Rule $patterns $parts.Body $TargetSide
}

function Test-SameFile([string]$A, [string]$B) {
    (Get-FileHash -LiteralPath $A).Hash -eq (Get-FileHash -LiteralPath $B).Hash
}

function Write-TextFile([string]$Path, [string]$Text) {
    $dir = Split-Path -Parent $Path
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

function Get-SpeckitSkills([string]$SkillsRoot) {
    $result = @{}
    if (-not (Test-Path $SkillsRoot)) { return $result }
    Get-ChildItem -Path $SkillsRoot -Directory -Filter 'speckit-*' | ForEach-Object {
        $file = Join-Path $_.FullName 'SKILL.md'
        if (Test-Path $file) { $result[$_.Name] = $file }
    }
    $result
}

function Convert-SpeckitSkill([string]$SourcePath) {
    $text = [IO.File]::ReadAllText($SourcePath).Replace("`r`n", "`n")
    $parts = Split-FrontMatter $text $SourcePath
    $kept = $parts.FrontMatter -split "`n" |
        Where-Object { $_ -notmatch '^(argument-hint|user-invocable|disable-model-invocation):' }
    "---`n$($kept -join "`n")`n---`n" + $parts.Body
}

function Test-SpeckitCopy([string]$Path, [string]$Expected) {
    (Test-Path $Path) -and ([IO.File]::ReadAllText($Path).Replace("`r`n", "`n") -ceq $Expected)
}

# ---------------------------------------------------------------- check

if ($PSCmdlet.ParameterSetName -eq 'Check') {
    $problems = New-Object System.Collections.Generic.List[string]

    $claudeSkills = Get-SkillFiles $Sides.claude.Skills
    $copilotSkills = Get-SkillFiles $Sides.copilot.Skills
    foreach ($rel in ($claudeSkills.Keys + $copilotSkills.Keys | Sort-Object -Unique)) {
        if (-not $copilotSkills.ContainsKey($rel)) { $problems.Add("skill  only in .claude : $rel"); continue }
        if (-not $claudeSkills.ContainsKey($rel)) { $problems.Add("skill  only in .github : $rel"); continue }
        if (-not (Test-SameFile $claudeSkills[$rel] $copilotSkills[$rel])) { $problems.Add("skill  differs         : $rel") }
    }

    $claudeRules = Get-RuleFiles $Sides.claude.Rules 'claude'
    $copilotRules = Get-RuleFiles $Sides.copilot.Rules 'copilot'
    foreach ($name in ($claudeRules.Keys + $copilotRules.Keys | Sort-Object -Unique)) {
        if (-not $copilotRules.ContainsKey($name)) { $problems.Add("rule   only in .claude : $name"); continue }
        if (-not $claudeRules.ContainsKey($name)) { $problems.Add("rule   only in .github : $name"); continue }
        $expected = Convert-Rule $claudeRules[$name] 'claude' 'copilot'
        $actual = [IO.File]::ReadAllText($copilotRules[$name])
        if ($expected -cne $actual) { $problems.Add("rule   differs         : $name") }
    }

    $claudeSpeckit = Get-SpeckitSkills $Sides.claude.Skills
    $copilotSpeckit = Get-SpeckitSkills $Sides.copilot.Skills
    foreach ($name in ($claudeSpeckit.Keys + $copilotSpeckit.Keys | Sort-Object -Unique)) {
        if (-not $copilotSpeckit.ContainsKey($name)) { $problems.Add("speckit only in .claude : $name"); continue }
        if (-not $claudeSpeckit.ContainsKey($name)) { $problems.Add("speckit only in .github : $name"); continue }
        if (-not (Test-SpeckitCopy $copilotSpeckit[$name] (Convert-SpeckitSkill $claudeSpeckit[$name]))) {
            $problems.Add("speckit differs         : $name")
        }
    }

    if ($problems.Count -eq 0) {
        Write-Host 'Agent config in sync.'
        exit 0
    }
    Write-Host 'Agent config drift:'
    $problems | ForEach-Object { Write-Host "  $_" }
    Write-Host 'Fix with: .\scripts\sync-agent-config.ps1 -From claude   (or -From copilot)'
    exit 1
}

# ---------------------------------------------------------------- sync

$To = if ($From -eq 'claude') { 'copilot' } else { 'claude' }
$src = $Sides[$From]
$dst = $Sides[$To]
$changed = 0
$orphans = New-Object System.Collections.Generic.List[string]

$srcSkills = Get-SkillFiles $src.Skills
$dstSkills = Get-SkillFiles $dst.Skills
foreach ($rel in ($srcSkills.Keys | Sort-Object)) {
    $target = Join-Path $dst.Skills $rel
    if ((Test-Path $target) -and (Test-SameFile $srcSkills[$rel] $target)) { continue }
    $dir = Split-Path -Parent $target
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Copy-Item -LiteralPath $srcSkills[$rel] -Destination $target -Force
    Write-Host "  skill  $rel"
    $changed++
}
foreach ($rel in ($dstSkills.Keys | Where-Object { -not $srcSkills.ContainsKey($_) } | Sort-Object)) {
    $orphans.Add("skill  $rel")
}

$srcRules = Get-RuleFiles $src.Rules $From
$dstRules = Get-RuleFiles $dst.Rules $To
foreach ($name in ($srcRules.Keys | Sort-Object)) {
    $target = Get-RulePath $dst.Rules $name $To
    $text = Convert-Rule $srcRules[$name] $From $To
    if ((Test-Path $target) -and ([IO.File]::ReadAllText($target) -ceq $text)) { continue }
    Write-TextFile $target $text
    Write-Host "  rule   $name"
    $changed++
}
foreach ($name in ($dstRules.Keys | Where-Object { -not $srcRules.ContainsKey($_) } | Sort-Object)) {
    $orphans.Add("rule   $name")
}

if ($From -eq 'claude') {
    $srcSpeckit = Get-SpeckitSkills $src.Skills
    $dstSpeckit = Get-SpeckitSkills $dst.Skills
    foreach ($name in ($srcSpeckit.Keys | Sort-Object)) {
        $target = Join-Path $dst.Skills "$name/SKILL.md"
        $text = Convert-SpeckitSkill $srcSpeckit[$name]
        if (Test-SpeckitCopy $target $text) { continue }
        Write-TextFile $target $text
        Write-Host "  speckit $name"
        $changed++
    }
    foreach ($name in ($dstSpeckit.Keys | Where-Object { -not $srcSpeckit.ContainsKey($_) } | Sort-Object)) {
        $orphans.Add("speckit $name")
    }
}

Write-Host "Synced $From -> $To : $changed file(s) updated."
if ($orphans.Count -gt 0) {
    Write-Host "Only in $To (not deleted; remove by hand if obsolete):"
    $orphans | ForEach-Object { Write-Host "  $_" }
}
````

## Appendix G: Preset

### `presets/<project>/preset.yml`

````yaml
schema_version: "1.0"

preset:
  id: "<project>"
  name: "<Project> Spec Kit Rules"
  version: "1.0.0"
  description: "<Project> rules layered over the core Spec Kit commands"
  author: "<author>"

requires:
  speckit_version: ">=1.3.2"

provides:
  templates:
    - type: "command"
      name: "speckit.specify"
      file: "commands/speckit.specify.md"
      description: "Optional Out of scope statement; add nothing unrequested"
      strategy: "wrap"
    - type: "command"
      name: "speckit.clarify"
      file: "commands/speckit.clarify.md"
      description: "Ask only material questions"
      strategy: "wrap"
    - type: "command"
      name: "speckit.plan"
      file: "commands/speckit.plan.md"
      description: "No research agents; one fact in one file"
      strategy: "wrap"
    - type: "command"
      name: "speckit.tasks"
      file: "commands/speckit.tasks.md"
      description: "Required tests, citations and the artifact check"
      strategy: "wrap"
    - type: "command"
      name: "speckit.analyze"
      file: "commands/speckit.analyze.md"
      description: "Reporting bar, one batch of fixes and a bounded re-check"
      strategy: "wrap"
````

### `presets/<project>/commands/speckit.specify.md`

````markdown
---
description: "Create or update the feature specification from a natural language feature description."
strategy: wrap
---

## <Project> Rules

These take precedence over any conflicting instruction below.

- An "Out of scope:" statement in the description is optional. Do not ask for one. If present, record it in the spec's Out Of Scope section; if absent, write "None" there. Never guess exclusions.
- Specify nothing listed as out of scope, and no mechanism the description did not ask for (ARC-001).
- Apply "Settled decisions" in `docs/code-map.md` as assumptions.

{CORE_TEMPLATE}
````

### `presets/<project>/commands/speckit.clarify.md`

````markdown
---
description: "Identify underspecified areas in the current feature spec by asking up to 5 highly targeted clarification questions and encoding answers back into the spec."
strategy: wrap
---

## <Project> Rules

These take precedence over any conflicting instruction below.

- Before scanning, read "Settled decisions" in `docs/code-map.md`. Never ask about anything it settles.
- Never ask about anything in the spec's Out Of Scope section, or repeat a question answered under `## Clarifications`.
- Ask only where the answer changes stored data, user-visible behaviour or security. Look first for scenarios the description missed within the requested scope: failure, empty, boundary and conflicting actions.
- Recommend the option that adds the least scope. Start any option that adds a mechanism (table, endpoint, background job, protocol) with "Adds:" and name it. Offer "Out of scope" where possible, and record that choice under Out Of Scope.
- Five questions is a limit, not a target. When nothing qualifies, reply "No material questions remain" and stop. Tell the user another run is not needed.

{CORE_TEMPLATE}
````

### `presets/<project>/commands/speckit.plan.md`

````markdown
---
description: "Execute the implementation planning workflow using the plan template to generate design artifacts."
strategy: wrap
---

## <Project> Rules

These take precedence over any conflicting instruction below.

- Phase 0 replaces the version below: take only the NEEDS CLARIFICATION items in Technical Context. If there are none, skip the phase and write no `research.md`. Otherwise resolve each from the code (`docs/code-map.md`) and record it in a few lines. Do not research dependencies or technology choices, and do not dispatch research agents.
- Phase 1 needs no `research.md`, only that no NEEDS CLARIFICATION remains.
- State each fact in one file only: behaviour and rules stay in `spec.md`, fields and constraints go in `data-model.md`, API and UI shapes in `contracts/`, decisions in `research.md`. Elsewhere cite the ID or file.

{CORE_TEMPLATE}
````

### `presets/<project>/commands/speckit.tasks.md`

````markdown
---
description: "Generate an actionable, dependency-ordered tasks.md for the feature based on available design artifacts."
strategy: wrap
---

## <Project> Rules

These take precedence over any conflicting instruction below.

- Tests are REQUIRED, not optional: ENG-001 requires test tasks for every behaviour change.
- Cite, do not restate: every FR, and every success criterion needing buildable work, is cited by ID in at least one task. Never quote or copy a constraint into a task, even where the instructions below say to; cite the entity or FR ID.
- After writing `tasks.md`, run `.\scripts\check-spec-artifacts.ps1` and fix its ERROR lines before reporting completion. If errors remain after two runs, report them.

{CORE_TEMPLATE}
````

### `presets/<project>/commands/speckit.analyze.md`

````markdown
---
description: "Perform a non-destructive cross-artifact consistency and quality analysis across spec.md, plan.md, and tasks.md after task generation."
strategy: wrap
---

## <Project> Rules

These take precedence over any conflicting instruction below, including the read-only constraint, the findings limit, the report format and the remediation steps.

**Before the detection passes**, run `.\scripts\check-spec-artifacts.ps1`. It checks requirement coverage, task format and length, Constitution Check rows, gate tasks and placeholders. Do not repeat those checks by reading; report each of its ERROR lines as a finding. Warnings are not findings.

**Reporting bar**: report only CRITICAL and HIGH findings. A finding qualifies only if implement would build the wrong thing, miss a requirement, or break a constitution requirement, and its Summary says which. Do not report wording, style, terminology or duplication unless two statements contradict each other. List every qualifying finding in this one pass. No findings is a valid result. Report MEDIUM and LOW only if the user input asks for them.

**Report**: the findings table, then one line with the script result and the count of findings by severity. Output no coverage table, unmapped task list or other metrics. Make each Recommendation a concrete edit.

**Fix and re-check** (replaces "Offer Remediation"): with no findings, say the feature is ready for `/speckit-implement` and stop. Otherwise ask once: "Apply all fixes?" Change no file before approval. On approval, in this same session:

1. Apply the fixes as one batch. Change each fact only in the file that owns it: behaviour and rules in `spec.md`, fields and constraints in `data-model.md`, API and UI shapes in `contracts/`, decisions in `research.md`. Elsewhere cite the ID or file instead of repeating the text.
2. Run the check script again.
3. Re-check **only** the findings just fixed and the lines just edited. Do not run a new analysis or raise unrelated findings.
4. If the re-check fails, fix and re-check once more. Then stop, list what remains and let the user decide. CRITICAL findings must be resolved before `/speckit-implement`.

Do not suggest another `/speckit-analyze` run unless a requirement changed.

{CORE_TEMPLATE}
````

### `presets/<project>/README.md`

````markdown
# <Project> Spec Kit Preset

<Project> rules for `speckit-specify`, `clarify`, `plan`, `tasks` and `analyze`. Each command file wraps the core Spec Kit command at `{CORE_TEMPLATE}`, with the <Project> rules first.

Edit the files here. Never edit `.claude/skills/speckit-*` or `.github/skills/speckit-*`: both are generated. `.specify/presets/` is the installed copy.

## After Editing This Preset

```powershell
specify preset update <project> --dev presets/<project>
```

Spec Kit now sees the regenerated skills as modified, and a plain upgrade would refuse to run. Record them (this overwrites any hand edits to Spec Kit's files):

```powershell
specify integration upgrade claude --force
```

```powershell
.\scripts\sync-agent-config.ps1 -From claude
```

## Upgrading Spec Kit

Follow "Upgrade Spec Kit Without Losing Customisations" in `docs/spec-kit-setup.md`.

`specify integration upgrade` refuses to overwrite files edited by hand. Move such edits into this preset before using `--force`.

Skip the sync step if this project does not use Copilot.
````
