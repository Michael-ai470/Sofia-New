# Sofia — Developer Handoff

This is the engineering README for the Sofia codebase. It explains how the code
fits together, what works, what is stubbed or missing, and how the remaining work
is divided between the two developers. If you want the product/marketing overview
(tiers, palette, feature copy), see the separate product `README.md`. This file is
about the code.

> **One thing to internalise first:** the three engines are built and the security
> hardening is done, but **nothing here has ever been run in a browser against a
> live server**, and **there is no real authentication or billing yet** — those
> functions are deliberate stubs. "Structurally complete" is not "working in
> production." Read the Status and Stubs sections before you trust anything.

---

## File map

```
app.py            Flask backend. ALL server logic. One file by design.
SofiaApp.jsx      Frontend shell. One mount point; tab-switches the 3 engines.
CVApp.jsx         Engine 1 — Personal CV (job seekers).
RecruiterApp.jsx  Engine 2 — Recruiter CV ranking.
PlanApp.jsx       Engine 3 — Business plan generation.
README.md         Product overview (separate from this file).
```

Mount the whole frontend with one component:

```jsx
import SofiaApp from "./SofiaApp.jsx";
<SofiaApp backendUrl="http://localhost:5000" />
```

`SofiaApp` owns nothing but which engine is visible. Each engine is self-contained
and talks to the backend directly. The engines do **not** import each other.

---

## How the pieces interact

```
Browser                              Flask (app.py)                 Anthropic
-------                              --------------                 ---------
SofiaApp.jsx
  ├─ CVApp.jsx ─────────────────────► /extract-text   (no AI)
  │                                   /analyse-cv      ──────────►  Haiku
  │                                   /rewrite-cv      ──────────►  Sonnet
  │                                   /cover-letter    ──────────►  Sonnet
  │                                   /generate-pdfs   (no AI, ReportLab)
  │                                   /generate-docx   (no AI, python-docx)
  ├─ RecruiterApp.jsx ──────────────► /extract-text   (per file, no AI)
  │                                   /rank-cvs        ──────────►  Sonnet
  └─ PlanApp.jsx ───────────────────► /generate-plan   ──────────►  Sonnet
                                       /health         (GET, no AI)
```

Key rules baked into this design:

- **The Anthropic API key never leaves the server.** All AI calls go through Flask.
  The frontend has no key and never calls Anthropic directly.
- **Files are converted to text before any AI call.** `/extract-text` does the PDF/
  Word parsing; binary never reaches the model.
- **Model split:** Haiku for scoring (Stage 1), Sonnet for all writing/ranking/plans.
- **Prompt caching:** large static instructions live in the *system* prompt with an
  ephemeral cache marker; only per-request user text varies.

### Frontend → backend contract (don't break these)

| Engine | Calls | Sends | Reads back |
|--------|-------|-------|-----------|
| CV | `/extract-text` then `/analyse-cv` → `/rewrite-cv` → `/cover-letter` → `/generate-pdfs` + `/generate-docx` | `cvText`, optional `jdText`, `stage1Summary` | scorecard, rewrite, cover letter, base64 files |
| Recruiter | `/extract-text` per file, then `/rank-cvs` | `cvTexts[]`, optional `jdText` | `data.rankings[]`, `top3Summary`, `commonWeaknesses` |
| Plan | `/generate-plan` | `grantId`, `formData{}` | `data{}`, `gated{}`, `paid`, `freeSections`, `warnings` |

Two contract details that are easy to get wrong:

- **AI-written flag (Recruiter):** the backend returns `rankings[i].rulesEngine.ai_flag`
  (a boolean). It is rendered as a neutral "Possible AI-written CV" notice, never a
  score. Do not turn it into a percentage.
- **Plan gating (Plan):** the server decides free vs paid. For a non-paying user it
  sets the body of paid sections to `null` and marks them in `gated`. The frontend
  shows a locked-section prompt for those — it must never assume it has gated content.
  This is enforced server-side on purpose; keep it that way.

---

## Backend internals (app.py)

It's one file, organised top to bottom roughly as:

1. **Config from env** (lines ~55–95) — `SOFIA_DEBUG`, `SOFIA_ALLOWED_ORIGINS`,
   `SOFIA_MAX_UPLOAD_MB`, `SOFIA_ENFORCE_CREDITS`, `ANTHROPIC_API_KEY`, input caps.
2. **Credit / auth scaffold** (lines ~99–145) — `CreditError`, `lookup_user`,
   `charge_credits`, `require_credits`, `user_is_paid`. **These are STUBS.** See below.
3. **System prompts + shapes** — the cached instruction blocks for each AI call.
4. **Grant library** (lines ~347–391) — 5 grants, each declaring its own
   `free_sections`. Static JSON; the AI fills content, never structure.
5. **Rules engine** (lines ~434–490) — ATS/verb/metric/AI-detection scoring on plain
   text. No AI cost. Returns `ai_flag`, `ats_score`, etc.
6. **AI helpers** — `call_claude` (timeout + caching) and `ai_json` (parse + one retry
   + max-tokens handling).
7. **Routes** (lines ~610–1590) — the 9 endpoints above.
8. **PDF/Word builders** — ReportLab + python-docx. These were sound in the original
   and carried over.

Error handling: every route funnels failures through `fail()`, which logs the real
detail server-side and returns a generic message plus an error ID. **Stack traces are
never sent to the client.** Don't undo this.

---

## Status: what works vs what doesn't

### Built and structurally verified
- All 9 routes exist and are internally consistent.
- All 3 engine frontends, wired to the correct routes with matching field names.
- Security hardening: debug off by default, CORS not wide-open by default, no
  traceback leakage, input size caps, 413 handler, startup API-key guard.
- Token-reduction pipeline: text-first, Stage 1 compression, model split, working
  system-prompt caching.
- Server-side plan gating and use-of-funds total validation.

### NOT verified
- **Nothing has been run.** No `pip install`, no Flask boot, no `npm start`, no
  browser render, no end-to-end click-through. Structural checks (Python `ast`,
  JSX bracket balance, field-name matching) do **not** catch runtime errors or
  layout problems. Assume there are bugs that only a live run will reveal.

### Stubbed or missing entirely
- **Authentication** — does not exist. Every request is anonymous.
- **Real credits / payments** — stubbed (see below). No balances, no Paystack/
  Flutterwave, no deduction.
- **Database** — none. No persistence for users, credits, or generated documents.
- **Production server** — currently Flask's dev server via `app.run()`.
- **Rate limiting, error monitoring, automated tests** — none.

---

## The stubs (read before touching billing)

In `app.py`:

- `lookup_user(token)` (line ~105) — **STUB.** Returns a permissive dev user. Replace
  with a real lookup against your user store.
- `charge_credits(user, amount)` (line ~111) — **STUB.** Replace with an **atomic**
  datastore update.
- `require_credits(amount)` / `user_is_paid()` — wrap the AI routes and drive plan
  gating. They behave permissively while `SOFIA_ENFORCE_CREDITS=0` (the default).

**Important:** flipping `SOFIA_ENFORCE_CREDITS=1` against these stubs will either lock
everyone out or charge no one. Enforcement only becomes meaningful once the stubs are
replaced with real auth + a real credit store.

---

## Running it locally (first thing to do)

Backend:

```bash
pip install flask flask-cors reportlab python-docx pdfplumber anthropic python-dotenv
# create .env in the same dir as app.py:
#   ANTHROPIC_API_KEY=sk-ant-...
#   SOFIA_DEBUG=0
#   SOFIA_ALLOWED_ORIGINS=http://localhost:3000
#   SOFIA_ENFORCE_CREDITS=0
python app.py        # http://localhost:5000
```

If `ANTHROPIC_API_KEY` is missing the server still starts; AI routes return a clean
error, non-AI routes (extract, pdf, docx, health) still work. Hit `GET /health` to
confirm it's up and whether AI is configured.

Frontend:

```bash
npm install
npm start
# mount <SofiaApp backendUrl="http://localhost:5000" /> and click through all 3 engines
```

---

## Work division

Two developers. The split is along a clean seam: **A owns "can a user exist, pay, and
have their data stored"; B owns "does it run, stay up, and can we see when it breaks."**
The only shared file is `app.py` (A edits the credit/auth functions; B edits run config
and adds rate limiting) — coordinate on that file or use separate branches.

### Person A — Accounts, Billing & Data
- Build authentication (sign-up, sign-in, token sent with each request).
- Replace the `lookup_user` / `charge_credits` stubs with real logic + Paystack/
  Flutterwave.
- Make credit deduction atomic; define the refund path when an AI call fails after
  charging.
- Choose and wire a database for users, credits, and tiers (build this first — the
  other three depend on it).
- Legal/compliance: terms of service, privacy policy, data-handling/retention
  statement (personal CV data is routed to a third-party AI).

### Person B — Runtime, Infrastructure & Operations
- **Live smoke test** — run everything, click through all 3 engines, log every bug.
  Start with the no-login flows; finish the authenticated flows once A's auth lands.
- Replace the dev server with a production WSGI server (gunicorn/uwsgi) + reverse proxy.
- Add rate limiting on AI routes (per-user once auth exists; per-IP before then) and
  guard `/extract-text` from abuse as a free parsing API.
- Wire error monitoring (Sentry or similar) so logged errors are actually visible.
- Document production env/secrets; confirm correct `SOFIA_*` config per environment.
- Watch `ai_json` failure rate under load; add resilience if plans/rankings fail too
  often. Add a few smoke tests per route.

### Dependency note
B's authenticated-flow testing can't complete until A's auth exists. B has plenty of
auth-independent work to start with (local run, prod server, monitoring, rate limiting),
so the two can proceed in parallel and converge for the final end-to-end test.

---

## Hard rules — don't regress these

- API key stays server-side. Never expose it to the browser.
- Never return stack traces to the client.
- Plan gating stays server-side (paid bodies withheld for non-payers).
- The recruiter AI flag stays a neutral flag, never a score.
- No "estimate", "est.", "approximately", or "roughly" in any AI output — the prompts
  forbid it and the product depends on it.
- The rules engine stays separate from AI calls (it's free and must not call the model).
