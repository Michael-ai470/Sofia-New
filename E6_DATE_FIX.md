# E6 date bug — the code half of the fix

## Why the prompt cannot fix this

The model is not told what today is. `build_system()` assembles CORE plus the engine module, and CORE is deliberately date-free — its own docstring says *"Never interpolate anything into CORE. No f-strings, no .format(), no dates"*, because one varying character kills the prefix cache. The user message is built from the tags each handler passes, and neither `_e6_invoice` nor `_e6_quotation` passes a date.

So when the handler says *"issue date as today"*, the model has three options: invent a date, take one from training data, or refuse. No wording changes that. The prompt guard I added stops the invention; the code below supplies the fact.

## The patch

`app/engines.py` — three small changes.

**1. Add the import** (there is no `datetime` import in the file today):

```python
from __future__ import annotations

import html
import logging
import re
from datetime import date          # <-- add

from app.ai import kimi
```

**2. `_e6_invoice`** — add one tag:

```python
    return _with_ruleset(_document("E6", [
        _task(tool, "Invoice"),
        rules,
        tag("today", date.today().isoformat()),      # <-- add
        tag("seller", seller),
        tag("bill_to", client),
        tag("invoice_number", number),
        ...
```

**3. `_e6_quotation`** — the same tag:

```python
    return _with_ruleset(_document("E6", [
        _task(tool, "Quotation"),
        rules,
        tag("today", date.today().isoformat()),      # <-- add
        tag("seller", seller),
        tag("prepared_for", client),
        ...
```

That is the whole fix. It goes in the **user message**, not in CORE, so prefix caching is untouched.

## Which other tools need it

I checked every handler for a date dependency:

| Tool | Needs today's date? | Status |
|---|---|---|
| `invoice` | Yes — issue date, due date | **Patch above** |
| `quotation` | Yes — issue date, validity expiry | **Patch above** |
| `statement-of-account` | No — takes `as_of` from the user | Fine |
| `projections` | No — works in relative months | Fine |
| `tax-calendar` | Borderline | See below |
| `cover-letter` (E1) | Letters are conventionally dated | Worth adding |
| everything else | No | Fine |

**`tax-calendar`** is the one to think about. It takes `tax_year` explicitly, so it does not strictly need today. But a calendar is far more useful if it can mark which deadlines have already passed — and it cannot do that without knowing the date. If you want that behaviour, add the same tag and one line to E4's T4. Your call; I have not assumed it.

**`cover-letter`** produces a letter, and letters carry a date. Low stakes, one line, same pattern.

## The prompt half, already in E6

The module I sent handles both states correctly, so it works before and after you apply the patch:

> - Where a date is supplied, use it exactly as given.
> - Where a document needs an issue date, statement date or validity date and none was supplied, write `[NEEDS INPUT: issue date]` and stop there. Never infer one, never reason toward one, never take one from an example.
> - Never calculate a date by counting from a date you assumed.

Nothing in the module changes when you apply the patch. The tag simply satisfies the first branch instead of the second.

## Verifying it worked

1. Run an invoice **before** patching → expect `[NEEDS INPUT: issue date]` and no due date.
2. Apply the patch, run the same invoice → expect today's real date, and a due date counted from it against the stated terms.
3. Run a quotation with "valid for 14 days" → expect an expiry exactly 14 days after today, not a round-numbered date.
4. Check guardrail 4 still holds: ask for a backdated invoice and confirm it states the issue date as the creation date and notes the supply date separately.
