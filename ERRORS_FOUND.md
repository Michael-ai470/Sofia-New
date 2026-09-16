# Sofia — Defects found while building the prompt engines

Every item below was found by reading the source, not inferred. Line numbers are from `Michael-ai470/Sofia`, path `files (2)/sofia-v3/sofia/`.

Two categories. **Category A cannot be fixed by prompt wording** — they need code. **Category B was fixable in the prompt**, and is already fixed in the engine modules delivered.

---

# CATEGORY A — code fixes required

## A1. The model is never told today's date · **HIGH**

**Where:** `app/engines.py:741` (invoice), `app/engines.py:780` (quotation)

`_e6_invoice` instructs *"issue date as today"*. `_e6_quotation` instructs *"validity date computed from today"*. Nothing supplies the date:

- `core.py` is deliberately date-free — its docstring forbids interpolation to protect the prefix cache.
- Neither handler passes a date tag. `grep` for `date.today` across `engines.py` and `kimi.py` returns nothing.

**Consequence:** the model invents a date, most plausibly from training data. Wrong issue date → wrong due date → wrong ageing on the statement → possibly the wrong tax period on a tax document. Invoice and Quotation are both free tools, so this is the first thing a new user sees.

**Fix:** add `from datetime import date` to the imports, then `tag("today", date.today().isoformat())` in both handlers. It belongs in the user message, so caching is unaffected. Full patch in `E6_DATE_FIX.md`.

**Same dependency, lower stakes:** `cover-letter` (E1) — letters carry a date. `tax-calendar` (E4) — cannot mark which deadlines have already passed without it.

---

## A2. Two different tools send the same task ID · **HIGH**

**Where:** `app/catalog.py:156` and `app/catalog.py:172`

```python
"slug": "business-plan",     "engine": "E3", "task": "T1",
"slug": "business-proposal", "engine": "E3", "task": "T1",
```

`_task()` builds the instruction from this ID, and its own comment says the IDs exist *"so the prompt modules and the handlers can never disagree about it"*. Here they disagree with each other. The E3 module states at length that a plan and a proposal are different documents for different readers — and then both arrive labelled T1.

**Worked around, not fixed:** the E3 module I delivered branches on the task *title* (`Business plan` vs `Business proposal`), which the handler does pass distinctly. So E3 works as shipped. The clean fix is still renumbering.

**Fix:** give `business-proposal` its own ID. While you are there, the gaps: E3 skips T5, E4 skips T5, E6 skips T3.

---

## A3. Three of the four placeholder conventions render invisibly · **HIGH**

**Where:** `app/engines.py:984`

```python
_MD_NEEDS_INPUT = re.compile(r"\[NEEDS INPUT:([^\]]*)\]")
```

That is the only placeholder the renderer styles. But the prompts use four:

| Convention | Used in | Rendered? |
|---|---|---|
| `[NEEDS INPUT: ...]` | CORE, E1, E2 | ✅ styled |
| `[...]` | E5, `engines.py:293` | ❌ plain text |
| `[UNVERIFIED — confirm before sending]` | E3, `engines.py:170` | ❌ plain text |
| `[ADD METRIC]`, `[VERIFY CLAIM]` | legacy v2 prompts | ❌ plain text |

The E5 module says an unnoticed blank is *"the worst failure this engine can produce"* — and then specifies the one convention the interface does not highlight. The Evidence Tiering Protocol is the product's core promise; it should be impossible to miss on screen.

**Half-fixed in the prompt:** E5's working rules now write blanks in the `[NEEDS INPUT: ...]` form so they get styled. `[UNVERIFIED]` in E3 is still unstyled.

**Fix:** widen the regex to cover all conventions, e.g. `\[(NEEDS INPUT|UNVERIFIED|ADD METRIC|VERIFY CLAIM)[:\s—][^\]]*\]`, or converge the prompts on one.

---

## A4. Task instructions live in the user message, not the cached prefix · **MEDIUM (cost)**

**Where:** every handler in `app/engines.py`

Each handler appends 150–250 words of task instruction to the user message — e.g. `_e2_screening` carries the entire screening-questions procedure. E1 does the opposite: its procedures live in the module.

Two consequences:

1. **Cost.** `system_for()` caches one system string per engine, and that is the point of CORE's design. Text in the system prompt hits the prefix cache; identical text in the user message is billed fresh on every single run, forever.
2. **Adherence.** Once the modules carry the procedures too, the model receives each instruction twice. Duplication reads as emphasis and skews output relative to everything else.

**Fix:** collapse each handler's instruction string to `"Output Markdown."` once its engine module ships. Per-engine detail in each delivered file.

---

## A5. `max_tokens` too low in five handlers · **MEDIUM**

Reasoned from what the task procedures now require, not measured. Test before settling.

| Handler | Line | Now | Suggested | Why |
|---|---|---|---|---|
| `_e3_document_review` | 482 | 3500 | 5000 | 8 scored dimensions with quoted evidence, arithmetic check, 5 weaknesses, 3 strengths |
| `_e2_rank` | — | 6000 | 8000 | two-pass scoring is visible work; truncates at 20 CVs |
| `_e4_computation` | 561 | 5000 | 6500 | numbered lines, visible arithmetic, per-band citations |
| `_e5_draft` | 666 | 6000 | 8000 | "Before you sign" note plus full agreement with skeleton |
| `_e6_invoice` | 748 | 2000 | 2500 | withholding presentation plus compliance flags |

---

# CATEGORY B — design problems, fixed in the prompts

## B1. Partner Research promises retrieval that does not exist · **HIGH**

**Where:** `app/engines.py:485-503`, `app/catalog.py:211`

The tool sells *"an intelligence profile on the organisation you want to approach"* and the handler asks for *"what it has recently announced, who publicly owns the relevant decision"*. There is no retrieval anywhere — I grepped for search, browse, retrieval and the usual providers; `kimi.py` makes a plain completion call.

So the model can only use training memory, which CORE Tier B forbids: *"'Industry reports suggest' is not Tier B. It is Tier D wearing a disguise."* A correct output under CORE is almost entirely placeholders — for 3 credits.

**Fixed as:** E3 T4 is now a research framework — what to establish, where it is published, the case with target claims bracketed, and the findings that would kill the approach. Honest and deliverable today.

**Still open:** the card blurb still promises a profile. Reword it, or add retrieval and I will rewrite T4.

---

## B2. "Ask one question — then stop and wait" in a single-shot system · **MEDIUM**

**Where:** `app/ai/prompts/engines.py:154`

`run()` calls the model once and renders the text. There is no conversational turn, so nothing to wait for. A user hitting that path pays credits and receives a one-line question.

**Fixed as:** E3 T1 branches on the task title, so the ambiguity resolves before the model is asked to. The instruction is still live in the module — I preserved it as instructed — but should now be unreachable. Remove it when you are satisfied.

---

## B3. E5 is told to recall statutory figures it has no rule set for · **HIGH**

**Where:** `app/ai/prompts/engines.py` boundary rule 6, vs `core.py` §2.4

Boundary rule 6: *"State execution formalities where the jurisdiction imposes them — stamping, witnessing, notarisation, registration."*

CORE §2.4: *"Rates, thresholds, statutory figures and deadlines are NEVER recalled from memory. They are supplied to you in the request."*

But `rulesets.py` `REQUIRED`/`OPTIONAL` cover tax tools and invoices only. **There is no contract rule set.** So the module instructs behaviour CORE forbids, and the model resolves the contradiction however it happens to that run.

**Fixed as:** E5's working rules split it — the engine may describe clause structure and ordinary effect (stable across common-law jurisdictions); it may not state a stamp duty rate, filing fee, notice period, limitation period or interest cap. Those become named categories with bracketed figures.

---

## B4. VAT and withholding offered on one select, though they move money oppositely · **MEDIUM**

**Where:** `app/catalog.py` invoice `tax` field

Options: *"Add VAT from the verified rule set"* and *"Show withholding tax deduction from the verified rule set"*. VAT is **added** to the subtotal and increases what the customer pays. Withholding is **deducted** by the customer before paying. Conflating them means the seller expects the wrong amount.

**Fixed as:** E6 T1 presents them differently — withholding as gross, deducted with its rule ID, net expected, plus the note that the customer remits it.

---

## B5. A prohibition with no replacement · **LOW**

**Where:** `app/ai/prompts/engines.py`, E2 guardrail 7

*"Never output 'Reject'. Output 'Hold' with the reason."* The model is told one word it may not use and given one it may — but no closed set, so it invents the rest, differently each run.

**Fixed as:** E2 T1 defines the set: Advance, Interview, Hold, Insufficient evidence.

---

# Priority

**Before E6 goes live:** A1 (date). Every invoice currently shows a bracketed placeholder where the date belongs.

**Before E5 goes live:** A3 (renderer) — or contract blanks render as ordinary text, which is the failure the module itself names.

**Whenever convenient:** A2, A4, A5, and the B1 blurb.

**Nothing here blocks E2, E3 or E4** as delivered.
