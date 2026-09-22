# Sofia — Task ID Renumbering

**Fixes audit defects D5 (collision) and D11 (gaps).**
**Source:** `Michael-ai470/Sofia`, path `files (2)/sofia-v3/sofia/app/catalog.py`.

---

## Current state, all 29 tools

Parsed from the catalog. Line numbers are exact.

| Line | Category | Tool | Engine · Task |
|---|---|---|---|
| 87 | Career | CV Analysis | E1 · T1 |
| 94 | Career | CV Rewrite | E1 · T2 |
| 103 | Career | Cover Letter | E1 · T3 |
| 112 | Career | Interview Prep | E1 · T4 |
| 119 | Career | LinkedIn Profile | E1 · T5 |
| 128 | Recruiting | Rank Candidates | E2 · T1 |
| 137 | Recruiting | Job Description | E2 · T2 |
| 147 | Recruiting | Screening Questions | E2 · T3 |
| 156 | Business | Business Plan | E3 · T1 |
| **172** | Business | **Business Proposal** | **E3 · T1** ← collision |
| 181 | Business | Grant Application | E3 · T2 |
| 191 | Business | Pitch Deck | E3 · T6 |
| 203 | Business | Document Review | E3 · T3 |
| 211 | Business | Partner Research | E3 · T4 |
| 224 | Tax | Tax Obligations | E4 · T1 |
| 234 | Tax | Tax Computation | E4 · T2 |
| 250 | Tax | Tax Calendar | E4 · T4 |
| 260 | Tax | Filing Pack | E4 · T3 |
| **270** | Tax | **Notice Explainer** | **E4 · T6** ← T5 unused |
| 285 | Contracts | Draft Agreement | E5 · T1 |
| 309 | Contracts | Review Agreement | E5 · T2 |
| 322 | Contracts | Clause Explainer | E5 · T3 |
| 337 | Finance | Invoice | E6 · T1 |
| 360 | Finance | Quotation | E6 · T2 |
| **381** | Finance | **Financial Projections** | **E6 · T5** ← T3 unused |
| 399 | Finance | Statement of Account | E6 · T4 |
| 417 | Correspondence | Business Letter | E7 · T1 |
| 437 | Correspondence | Investor Update | E7 · T2 |
| 455 | Correspondence | Difficult Message | E7 · T3 |

**Career, Recruiting, Contracts and Correspondence are already clean.** Only Business, Tax and Finance need touching.

---

## What is actually broken, and what is only untidy

Worth separating, because it changes how much churn is justified.

**Broken: the E3 collision.** Business Plan and Business Proposal both send `Task: T1`. `_task()` builds the instruction line from this ID, and its own comment says the IDs exist *"so the prompt modules and the handlers can never disagree about it"* — yet here two tools disagree with each other. It survives today only because the handlers also pass a `Mode:` line that the delivered prompts branch on. Remove that line and the two tools become indistinguishable.

**Untidy: the three gaps.** E3 and E4 skip T5; E6 skips T3. Nothing breaks. Nothing reads sequence. The only cost is that a human reading the catalog infers the wrong ID — which happened twice in our own conversation.

**And that second cost is smaller than it looks**, which is why my recommendation below is the *smaller* change rather than the larger one. **Task IDs are internal.** No user sees them. The confusion occurred because we were using IDs as the conversational handle for tools — and the cure for that is to say "Statement of Account", not "T4". Renumbering to match display order would not have prevented it.

---

## Recommended: three lines

Fill each gap with the tool that needs moving. Minimum coordination, fixes both defects.

### `app/catalog.py`

```diff
@@ line 172 — Business Proposal @@
-        "slug": "business-proposal", "name": "Business Proposal", "engine": "E3", "task": "T1",
+        "slug": "business-proposal", "name": "Business Proposal", "engine": "E3", "task": "T5",

@@ line 270 — Notice Explainer @@
-        "slug": "notice-explainer", "name": "Notice Explainer", "engine": "E4", "task": "T6",
+        "slug": "notice-explainer", "name": "Notice Explainer", "engine": "E4", "task": "T5",

@@ line 381 — Financial Projections @@
-        "slug": "projections", "name": "Financial Projections", "engine": "E6", "task": "T5",
+        "slug": "projections", "name": "Financial Projections", "engine": "E6", "task": "T3",
```

### Resulting state

| Engine | Before | After |
|---|---|---|
| E3 Business | T1, **T1**, T2, T3, T4, T6 | T1, T2, T3, T4, **T5**, T6 |
| E4 Tax | T1, T2, T3, T4, **T6** | T1, T2, T3, T4, **T5** |
| E6 Finance | T1, T2, **T4, T5** | T1, T2, **T3**, T4 |

No collisions. No gaps. Every engine runs T1 upward.

---

## Files that must change with it

A task ID appears in three places. All three must move together, or `_task()` prints an ID the module has no heading for.

| # | File | Change |
|---|---|---|
| 1 | `app/catalog.py` | The three lines above |
| 2 | `E3_T1_BUSINESS_PROPOSAL.md` | Header → `## Task T5 — Business proposal`. Rename file to `E3_T5_…` |
| 3 | `E4_T6_NOTICE_EXPLAINER.md` | Header → `## Task T5 — Notice explainer`. Rename file to `E4_T5_…` |
| 4 | `E6_T5_FINANCIAL_PROJECTIONS.md` | Header → `## Task T3 — Financial projections`. Rename file to `E6_T3_…` |
| 5 | `E3_BUSINESS_ENGINE.md` | The `## Task T1 — Business plan, and Business proposal` heading splits: T1 keeps the plan branch, a new `## Task T5 — Business proposal` section carries the proposal branch |
| 6 | `E4_TAX_ENGINE.md` | `## Task T6 — Notice explainer` → `## Task T5` |
| 7 | `E6_FINANCE_ENGINE.md` | `## Task T5 — Financial projections` → `## Task T3` |

**Item 5 is the one to be careful with.** The E3 engine module currently has a single T1 section covering both plan and proposal, branching on the mode line — that was the workaround for the collision. Once the IDs are distinct, the branch is no longer needed: T1 becomes the plan alone, and T5 becomes the proposal alone. Both per-tool prompts I delivered are already written as separate documents, so this is a split rather than a rewrite.

You can also drop the `Mode: BUSINESS PLAN` / `Mode: BUSINESS PROPOSAL` lines from `_e3_business_plan` and `_e3_proposal` at that point — they exist only to work around the collision. I would leave them in as belt and braces; they cost a few tokens and do no harm.

---

## Verification

Run this after the change. It compares every catalog task ID against the `## Task Tn` headings in its engine module, and reports any mismatch.

```python
#!/usr/bin/env python3
"""Verify every catalog task ID has a matching heading in its engine module."""
import re, sys
from collections import defaultdict

cat = open('app/catalog.py').read()
mod = open('app/ai/prompts/engines.py').read()

tools = re.findall(
    r'"slug": "([\w-]+)", "name": "([^"]+)", "engine": "(E\d)", "task": "(T\d)"', cat)

modules = dict(re.findall(r'^(E[1-7]) = """(.*?)"""', mod, re.S | re.M))
headings = {e: set(re.findall(r'^## Task (T\d+)', b, re.M)) for e, b in modules.items()}

by_engine, problems = defaultdict(list), []

for slug, name, eng, task in tools:
    by_engine[eng].append((task, name, slug))
    if task not in headings.get(eng, set()):
        problems.append(f"  NO HEADING  {eng} {task}  {name} ({slug})")

for eng in sorted(by_engine):
    used = [t for t, _, _ in by_engine[eng]]
    dupes = {t for t in used if used.count(t) > 1}
    if dupes:
        problems.append(f"  COLLISION   {eng}: {sorted(dupes)}")
    nums = sorted(int(t[1:]) for t in set(used))
    gaps = [f"T{i}" for i in range(1, max(nums) + 1) if i not in nums]
    if gaps:
        problems.append(f"  GAP         {eng}: {gaps} unused")
    orphans = headings.get(eng, set()) - set(used)
    if orphans:
        problems.append(f"  ORPHAN      {eng}: heading {sorted(orphans)} has no tool")

if problems:
    print("FAIL"); print("\n".join(problems)); sys.exit(1)
print(f"PASS — {len(tools)} tools, all IDs unique, sequential, and matched to a heading.")
```

Run from the `sofia/` directory. It catches all four failure modes: a missing heading, a collision, a gap, and an orphaned heading with no tool pointing at it.

### What it reports today — I ran it

Against the current tree, unmodified:

```
FAIL
  NO HEADING  E2 T1  Rank Candidates (rank-candidates)
  … 24 NO HEADING lines in total, covering every tool in E2 to E7 …
  COLLISION   E3: ['T1']
  GAP         E3: ['T5'] unused
  GAP         E4: ['T5'] unused
  GAP         E6: ['T3'] unused
```

**Read it in two halves.**

The **COLLISION and GAP lines are what this document fixes.** All four appear exactly as expected, which confirms the script is looking at the right files.

The **24 NO HEADING lines are a different thing**, and they are not noise — they are the gap this whole body of work exists to close. Only E1 currently has `## Task Tn` sections in its module; E2 through E7 carry guardrails and no task procedures, so every tool in those six engines points at a heading that does not yet exist. Those lines clear as you adopt the engine modules, not as you renumber.

So expect the output to improve in two independent steps:

| After | COLLISION / GAP lines | NO HEADING lines |
|---|---|---|
| today | 4 | 24 |
| renumbering only | **0** | 24 |
| renumbering + all engine modules adopted | **0** | **0** → `PASS` |

If you want to check only the renumbering, ignore the NO HEADING block and confirm the last four lines are gone.

---

## The alternative, and why I am not recommending it

**Renumber everything to match catalog order**, so IDs run in the sequence tools appear in the file and in the tab:

| Engine | Changes |
|---|---|
| E3 | Proposal T1→T2, Grant T2→T3, Pitch Deck T6→T4, Document Review T3→T5, Partner Research T4→T6 |
| E4 | Calendar T4→T3, Filing Pack T3→T4, Notice T6→T5 |
| E6 | Projections T5→T3 |

**Nine catalog lines, nine prompt files, three engine modules.** It reads better in the catalog.

I would not do it. Three reasons:

1. **It fixes nothing the three-line version does not.** Both close the collision and the gaps. The extra six changes buy readability only.
2. **Every additional ID change is a chance for the catalog and the module to drift apart.** A mismatch means `_task()` prints an ID with no corresponding heading — degraded rather than broken, since the title is also in the task line, but you would not notice it from the output.
3. **The readability problem is not really solved by it.** Nobody outside the code sees task IDs. The confusion in our conversation came from using IDs to refer to tools; the fix is to use names. Sequential IDs would not have stopped it — I would still have said "T4" and you would still have counted to "T3".

If you do want the sequential version, say so and I will produce that diff with all nine lines and the file renames.

---

## Order of operations

1. Run the verification script. Confirm it **fails** as expected.
2. Apply the three `catalog.py` lines.
3. Update the three prompt-file headers and the three engine-module headings, splitting E3's T1 section.
4. Run the verification script. Confirm it **passes**.
5. Run one tool from each affected engine — Business Proposal, Notice Explainer, Financial Projections — and check the task line in the output matches the section the prompt intended.

Do steps 2 and 3 in a single commit. A commit where the catalog has moved and the modules have not is a commit where three tools point at nothing.
