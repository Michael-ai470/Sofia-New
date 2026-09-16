# Sofia — Prompt Engine Build: Clarifying Questions

**Prepared for:** Michael
**Scope:** Writing full prompt engine modules for every section in the tool catalog, following the E1 reference pattern in `app/ai/prompts/engines.py`.
**Status:** Nothing written yet. These questions come first.

---

## 0. What I read before writing this

I worked from the real code, not the screenshots alone:

| File | What it told me |
|---|---|
| `app/ai/prompts/core.py` | CORE (the immutable cached prefix), `MACHINE_MODE`, `build_system()` |
| `app/ai/prompts/engines.py` | E1 fully specified; E2–E7 carry guardrails only, no task procedures |
| `app/catalog.py` | 30 tools, 8 categories, every tool's engine ID, task ID, credits, status and input fields |
| `app/engines.py` | 30 handlers, all implemented; `_task()`, `_document()`, `_ruleset()`, `system_for()` caching |
| `app/rulesets.py` | E4/E6 rule-set injection, `REQUIRED` vs `OPTIONAL` tools, 5 jurisdictions |
| `app/ai/kimi.py` | role-based model routing, prefix-cache accounting, hedged-figure gate |

**The gap, stated precisely:** E1 has guardrails + rewrite rules + task procedures T1–T5. E2, E3, E5, E7 have guardrails and domain rules but **no task procedures at all**. E4 and E6 have guardrails and a format section but no per-task procedures. Meanwhile `app/engines.py` already dispatches all 30 tools and sends a line like `Task: T6 — Pitch deck.` into the user message. So every engine module below E1 is currently telling the model *how to behave* but never *what the task is* — the task instruction is living in the handler's user message instead.

That gap is the whole job, and questions 1–3 decide how I close it.

---

## A. Decisions that affect every engine

### Q1 — Where does task procedure live: the module or the handler? **(most important)**

Right now instruction text is split across two places. Example, Screening Questions:

- **Module (E2):** guardrails only — no mention of screening questions at all.
- **Handler (`_e2_screening`):** *"Eight to ten questions that separate candidates who can do this job from candidates who can describe it. For each: the question, what a strong answer contains…"*

That handler text is a **task procedure sitting in the user message**. E1 does the opposite — its T1–T5 procedures sit in the module.

This matters for cost, not just tidiness. `system_for()` caches one system string per `(engine, machine)` pair and CORE's docstring is explicit that the whole point is a stable cached prefix. **Text in the system prompt is billed at the cached rate on every repeat call. Identical text in the user message is billed fresh, every single time.** A 250-word procedure in the handler is paid for in full on every run, forever.

| Option | Effect |
|---|---|
| **A — Procedure moves into the module** (matches E1). Handler keeps only the tagged inputs and a one-line output-shape note. | Recommended. Consistent with E1, cheaper per run, one place to edit prompt quality. |
| B — Procedure stays in the handler; module stays principles-only. | E1 becomes the odd one out; per-run cost stays high; prompt quality work is spread across two files. |
| C — Both (module has the procedure, handler restates a short version). | Duplication drifts. I'd avoid it. |

**My recommendation: A.** It also means you can tune a prompt without touching dispatch logic.

**If you pick A, I need your call on this:** do I also hand you the rewritten `app/engines.py` handlers (slimmed down to inputs + shape), or only the prompt modules, leaving the handler edit to you? Writing the module without slimming the handler means the model receives the same instruction twice, which measurably degrades adherence — it reads as emphasis and skews the output.

---

### Q2 — One module per engine, or one prefix per task?

An E3 call for an Invoice-sized job currently ships **all six** E3 task procedures (plan, proposal, grant, deck, review, research) in the system prompt, because the module is one string per engine.

| Option | Cache entries | Trade-off |
|---|---|---|
| **A — One module per engine** (current design) | 7 prefixes (14 with machine mode) | Cheapest to warm, highest hit rate. Model reads ~5 irrelevant procedures per call. |
| B — One prefix per task | ~30 prefixes | Sharper focus, less instruction dilution. 30 separate caches to warm; low-traffic tools may rarely hit a warm cache. |
| C — Hybrid: engine module holds guardrails + shared rules; task procedure appended per task | ~30 prefixes but sharing a long common head | Best quality/cost balance **if** Moonshot caches on longest-common-prefix rather than exact match. |

**My recommendation: A for now.** It is what the code already does, and instruction dilution across 5–6 sibling tasks is manageable when each task is clearly headed and the handler names the task ID explicitly. Revisit if output quality slips on the six-tool engines.

**Do you want me to keep each module under a token ceiling?** E1 is roughly 1,050 tokens; CORE is roughly 1,450. E3 with six full task procedures at E1's density lands near 2,200, so an E3 call would carry ~3,650 tokens of system prompt before any user data. Confirm that is acceptable, or give me a per-module budget and I will write tighter.

---

### Q3 — Task ID numbering is currently inconsistent, and it will bite

`_task()` prints the ID straight from the catalog, so the module's headings must match. They do not line up today:

| Engine | Catalog task IDs in use | Problem |
|---|---|---|
| E1 | T1 T2 T3 T4 T5 | Clean. Module matches. |
| E2 | T1 T2 T3 | Clean, but module has no T-sections to match. |
| **E3** | T1 (business-plan), **T1 (business-proposal)**, T2, T3, T4, **T6** | Two different tools both send `Task: T1`. T5 is skipped, T6 exists. |
| **E4** | T1, T2, T3, T4, **T6** | T5 skipped. |
| **E6** | T1, T2, T4, T5 | T3 skipped. |
| E7 | T1 T2 T3 | Clean. |

The E3 collision is the real one: Business Plan and Business Proposal are **different documents with different readers** — the module itself says so in its "Plan versus proposal" section — yet both arrive labelled `T1`. The model cannot tell them apart from the task ID alone. It would have to infer from the input tags.

| Option | |
|---|---|
| **A — Renumber the catalog** so every tool has a unique task ID within its engine, sequential, no gaps. | Recommended. One-line-per-tool change in `catalog.py`. Nothing else reads these IDs. |
| B — Keep the IDs; the module documents the collision and disambiguates on input tags. | Fragile. The prompt has to carry an apology for a data problem. |
| C — Drop numeric IDs; `_task()` prints the tool name instead (`Task: Business Proposal.`). | Cleanest to read, but breaks the "prompt modules and handlers can never disagree" comment in `_task()`. |

**My recommendation: A.** Tell me if you want me to include the `catalog.py` renumbering diff with the first engine I deliver, or keep it separate.

---

### Q4 — Which sections do you actually want, and in what order?

Your screenshots show five tabs. The catalog has eight.

| Tab shown | Engine | Tools | Live? | Module state |
|---|---|---|---|---|
| Career | E1 | 5 | live | **Done** — reference implementation |
| Recruiting | E2 | 3 | live | Guardrails only |
| Business | E3 | 6 | live | Guardrails + plan/proposal + deck notes, no T-sections |
| Tax | E4 | 5 | soon | Guardrails + computation format, no T-sections |
| Contracts | E5 | 3 | soon | Guardrails + drafting/review rules, no T-sections |
| *(not shown)* | **E6 Finance** | 4 | soon | Guardrails only |
| *(not shown)* | **E7 Correspondence** | 3 | soon | Approach + rules, no T-sections |

1. **Do you want E6 and E7 too?** They are in the catalog but absent from your screenshots.
2. **Do you want E1 left alone, or reviewed and tightened?** It is the reference, but it is also the only one written before the others existed — there may be consistency gains.
3. **Order.** My recommendation: **E2 → E3 → E7 → E6 → E5 → E4.** Rationale: E2 is live, small (3 tools) and sets the pattern cheaply, so you can approve the shape before I invest in the big ones. E3 is live and your highest-credit tool (8 credits for a Business Plan) so it earns the most. E7 and E6 are structurally simple. E5 and E4 come last because they are `soon` and carry the heaviest professional-boundary load — worth writing when you have the rule sets and can test against them.

Tell me if you want a different order, or a specific engine first because of a launch date.

---

### Q5 — Markdown or JSON per tool?

Only `cv-analysis` uses `complete_json` with a declared shape. Every other tool uses `_document()` and returns Markdown rendered by `render_markdown()`.

Machine mode exists and works (`MACHINE_MODE` in core.py). The question is whether more tools should use it. JSON is required if you want: structured PDF export with controlled layout, a scorecard UI with per-dimension bars, saved/comparable results, or a red/amber/green chip UI.

Strong candidates for JSON based on their output shape:

- `rank-candidates` — a ranking table with per-axis scores is naturally tabular
- `document-review` — "scored on eight dimensions" is a scorecard, same as CV Analysis
- `review-agreement` — per-clause Red/Amber/Green is a data structure, not prose
- `tax-computation` — line-by-line arithmetic that should be rendered, and ideally verified in Python before display
- `invoice` / `quotation` — totals that must reconcile exactly; JSON lets you assert that in code rather than trusting the model

**Question:** which of these do you want as JSON now? Each needs a declared shape in the handler, so this changes what I write. **My recommendation:** JSON for `tax-computation`, `invoice` and `quotation` — because those have arithmetic you can and should verify in code — plus `review-agreement` if the UI will render severity chips. Leave the rest as Markdown.

---

### Q6 — Worked examples: how many, and are you willing to pay for them?

E1 carries exactly one inline exemplar:

> *"Rebuilt the reconciliation process for 40,000 monthly transactions, cutting close time from 9 days to 3."*

That single line does a lot of work — it demonstrates scope-then-result-then-method far better than the rule above it states. Demonstrated format consistently beats described format, and one concrete before/after pair typically outperforms three more sentences of instruction.

But every example is tokens on every call.

| Option | |
|---|---|
| A — Current style: one short exemplar per major rule, no before/after pairs | Cheapest. Weakest on output shape. |
| **B — One before/after pair per task procedure**, 2–3 lines each | Recommended. Meaningful quality gain, bounded cost (~60–100 tokens per task). |
| C — Full worked mini-output per task | Strongest adherence, but adds 300+ tokens per task and risks the model copying the example's specifics into real output. |

**My recommendation: B**, and I will write examples that are obviously illustrative (different industry, different currency) so they do not bleed into user output.

---

### Q7 — "Ask one question and stop" conflicts with single-shot execution

E3 currently instructs:

> *"If you cannot tell which is wanted, ask exactly one question: 'Are you seeking funding…' — then stop and wait."*

But `run()` is one-shot. There is no conversational turn: the worker calls the model once, gets text, and `render_markdown()` puts it on screen. **The model has nothing to wait for.** A user who hits that path pays credits and receives a one-line question instead of a document.

Options:

| Option | |
|---|---|
| **A — Remove the "ask and stop" path.** The module states a decision rule (the catalog already has separate `business-plan` and `business-proposal` tools with different inputs, so the ambiguity is largely resolved at form level) and always produces a document. | Recommended. |
| B — Keep it, and handle it upstream: the handler detects a question-only response and refunds. | Real work in `engines.py` + `credits.py`, and users still pay the latency. |
| C — Keep it, but the model must produce the document **and** flag the ambiguity at the top. | Middle ground; user always gets value. |

**My recommendation: A**, falling back to **C** if you want the ambiguity surfaced. Either way I need your call, because it changes how I write E3's opening section — and whether the same pattern is allowed anywhere else.

---

## B. Per-engine questions

### E2 — Recruiter

**Q8.** The module says *"Never output 'Reject'. Output 'Hold' with the reason."* Should there be an explicit **positive** verdict vocabulary to match? Right now the model knows one word it cannot say but no fixed set it should say. My proposal: `Advance` / `Interview` / `Hold` / `Insufficient evidence`, stated as a closed set. Confirm or give me your own.

**Q9.** Bias handling is strong on inputs (ignore name, gender, school prestige, address, photo). Do you want an **output-side** check too — e.g. the model reviews its own ranking for whether any stated reason correlates with a protected characteristic, and flags it? This is defensible under EU AI Act Annex III thinking (recruitment is high-risk), and it is a genuine selling point for a recruiting tool. Costs maybe 80 tokens of instruction.

**Q10.** `rank-candidates` accepts 2–20 CVs. At 20, scoring quality typically degrades — positions in the middle get less attention than the ends. Do you want the procedure to force a **two-pass structure** (score each candidate independently on the stated axes first, then rank from those scores), which is more reliable than ranking holistically in one pass? It costs output tokens. `max_tokens` is currently 6000 for this tool.

**Q11.** `job-description` has no salary input in the catalog, and the handler tells the model to write `[NEEDS INPUT: ...]` for pay range. Some jurisdictions now mandate pay transparency in job ads. Should E2 state that explicitly, or stay silent and just leave the placeholder?

---

### E3 — Business Plans & Proposals

**Q12 — Partner Research has no way to do research.** This is the biggest single issue I found.

The tool promises *"an intelligence profile on the organisation you want to approach"* and the handler asks for *"what it has recently announced, who publicly owns the relevant decision."* But there is **no retrieval anywhere in the stack** — I grepped for search, browse, retrieval and the usual providers; `kimi.py` makes a plain completion call and nothing else.

So the model can only draw on training memory. CORE explicitly forbids that: Tier B requires *"a named, checkable authority"*, and rule 3 says *"'Industry reports suggest' is not Tier B. It is Tier D wearing a disguise."* Under CORE as written, a correct Partner Research output for an org the user gave no data about is **almost entirely `[UNVERIFIED]` and `[NEEDS INPUT]` placeholders** — for 3 credits.

| Option | |
|---|---|
| A — Add a retrieval tool, then write the engine for it | Right answer long-term; out of scope for prompt work. |
| **B — Repurpose the tool**: it produces the *research framework* — exactly what to find out, where to look, the questions to answer, and the approach strategy once found — rather than claiming facts. Retitle the promise. | Recommended. Honest, deliverable today, still genuinely useful. |
| C — Add a "what you already know about them" input field, and the engine works that up into a profile | Also honest. Needs a `catalog.py` field change. |
| D — Leave as-is and let placeholders dominate | Not recommended. Users will feel cheated. |

**My recommendation: B combined with C.** Tell me which way to write it, because it determines whether the task procedure is a research method or a document template.

**Q13.** Grant Application pastes the funder's questions in free text. The old v2 code had a hardcoded `GRANT_LIBRARY` (TEF, Hult, YALI, Seedstars) with per-funder tone and USP guidance — that is real domain value and it is now gone. Do you want that knowledge **rebuilt inside the E3 module** as a short funder-archetype section (impact-led / SDG-led / leadership-led / investor-led, with what each scores on), so the engine can recognise the archetype from the pasted questions? I think this is a strong, cheap win.

**Q14.** Business Plan is your most expensive tool at 8 credits and 12 sections. `_document()` defaults cap at `max_tokens=4000` unless the handler raises it. Twelve sections at CORE's stated length (3–6 paragraphs each) will not fit in 4000 tokens. **Should the Business Plan be a multi-call tool** (sections generated in 2–3 chunks and stitched), or a single call with tighter per-section length? I need to know before writing the procedure, because a chunked design needs the module to support partial generation.

---

### E4 — Tax & Compliance

**Q15.** The rule-set principle is the strongest thing in the codebase and I will not weaken it. My question is on **failure copy**: when a required rule is missing, exactly what should the user see? The module says *"STOP and say exactly which rule is missing."* Should the engine also output (a) what it *could* compute without that rule, (b) a plain-English explanation of why Sofia will not guess, and (c) what the user can do next? Currently `rulesets.py` catches most of this before charging, so the in-model stop path is the rarer edge case — worth getting right anyway.

**Q16.** `notice-explainer` handles a letter from a revenue authority — a stressed user in a time-sensitive situation. Should its procedure include an explicit **deadline-first** structure (what they want, the amount, the date, the consequence of missing it — before anything else)? And should it refuse to suggest a specific response strategy, or is "here are your options with trade-offs" within the professional boundary as you have drawn it? This is the sharpest boundary call in the whole catalog and I want your line, not my guess.

**Q17.** Five jurisdictions (NG, GH, KE, ZA, GB). Should the E4 procedures be written jurisdiction-neutral (everything from `<ruleset>`), or may they carry structural knowledge that does not change — e.g. that a self-assessment regime exists, what a PAYE reconciliation is? Structural knowledge is not a rate, so it does not violate the rule-set principle, but it does narrow the engine's portability. **My instinct: jurisdiction-neutral**, with structure carried in the rule set. Confirm.

---

### E5 — Contracts & Agreements

**Q18.** The `[...]` rule is excellent — *"blanks the parties must complete are rendered as `[...]`, NEVER as a plausible default."* Should `[...]` and CORE's `[NEEDS INPUT: ...]` be **unified**? Right now a contract can carry two different placeholder conventions, and `render_markdown()` only styles `[NEEDS INPUT:` (there is a regex for exactly that). So a `[...]` blank in a contract renders as plain text and is **easy to miss** — which the module itself calls "the worst failure this engine can produce." My recommendation: use `[NEEDS INPUT: ...]` everywhere so it gets the visual treatment, and drop `[...]`.

**Q19.** Six agreement types in the catalog. Should the module carry a **clause skeleton per type** (NDA: definition of confidential information, exclusions, permitted disclosure, term, return/destruction, remedies…), or stay generic and let the model assemble? Skeletons raise quality and consistency a lot, but six of them is roughly 600–900 tokens. Given E5 only has 3 tools, I think there is room. Your call.

**Q20.** `clause-explainer` is 1 credit and takes a single pasted clause. Should it stay purely explanatory, or also offer a **redline** (the improved wording)? Offering a redline nudges it closer to advice; explaining only is safer but less useful. Where do you want it?

---

### E6 — Financial Documents

**Q21.** Rule 2 says *"Where the caller supplies computed totals, use them and do not recompute."* I can see `_line_items()` in `engines.py` parsing the items. **Does the handler currently compute the totals in Python and pass them in, or does the model do the arithmetic?** This decides whether the procedure says "render these figures" or "compute and verify." Strongly related to Q5 — if you move invoices to JSON, Python does the arithmetic and the model never touches a number, which is the right design for money.

**Q22.** Invoice and Quotation are marked Free with `free_preview: True`. Do you want them deliberately **thin** prompts (fast, cheap, low token count) since they earn nothing, or full quality on the grounds that they are the top of your funnel? My recommendation: full quality but tight — they are the tools most likely to make someone trust the paid ones.

---

### E7 — Business Correspondence

**Q23.** The three-strategy approach (preserve / hold / force) is the best idea in the file. Should it apply to **all three** E7 tools, or only `difficult-message`? An Investor Update arguably has one correct strategy, not three. My recommendation: three strategies for `difficult-message` only, single best version for `business-letter` and `investor-update`, with the reasoning stated.

**Q24.** Should E7 carry its own **phrase blacklist**, the way E1 does for CVs? Correspondence has its own tells: "I wanted to reach out", "circling back", "per my last email", "just following up", "at your earliest convenience", "please don't hesitate". CORE already bans "I hope this finds you well" — this would extend the same idea. Cheap, and it is the single most effective anti-AI-tell device in E1.

---

## C. Two things I would fix regardless

Flagging these because they affect prompt behaviour, not just code:

1. **`render_markdown()` only styles `[NEEDS INPUT:`.** Every other placeholder convention in the prompts — `[UNVERIFIED — confirm before sending]` (E3), `[...]` (E5), `[NEEDS INPUT: % or figure…]` (E1, which does match) — either renders plain or renders inconsistently. The Evidence Tiering Protocol is the product's core promise and it should be **impossible to miss on screen**. Either the prompts converge on one convention (Q18) or the renderer learns the others.

2. **Duplicated instruction between handler and module** (Q1). Beyond cost, when the same instruction appears twice in one context the model treats the repetition as emphasis and over-weights it relative to everything else. Whichever way you answer Q1, the instruction should live in exactly one place.

---

## D. What I will deliver, per engine

So you know what "one at a time" looks like. For each engine, in one message:

1. The complete module string, drop-in ready for `app/ai/prompts/engines.py`
2. A short rationale — what each section is doing and why it is worded that way
3. Any `app/engines.py` handler changes the module implies (per your Q1 answer)
4. Token cost: the module's size, and the resulting total system prompt for that engine
5. Specific things to test it against, including the failure cases it should refuse

Then I stop and wait for your review before starting the next one.

---

## E. The fastest way to answer this

You do not need to answer all 24. The **blocking** ones are:

- **Q1** — procedure in module or handler *(changes everything)*
- **Q3** — renumber task IDs or work around them
- **Q4** — which engines, and in what order
- **Q7** — the "ask and stop" path in E3
- **Q12** — what Partner Research actually is

Everything else I can proceed on with my stated recommendation and you can correct it at review. If you reply **"recommendations accepted, start with E2"** plus your answers to Q1, Q3, Q4, Q7 and Q12, I have enough to write the first engine.
