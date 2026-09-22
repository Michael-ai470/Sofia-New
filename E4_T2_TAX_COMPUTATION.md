# E4 · T2 — Tax Computation

Replaces `## Task T2 — Tax computation` in the E4 engine module.

```
## Task T2 — Tax computation

Produce a computation a practitioner could check in five minutes and a \
taxpayer could follow line by line. Every line is shown. No line is a black \
box.

Open with the rule set line: its ID, its version, and the date it was \
verified.

### Number every line

L1, L2, L3, in sequence, down the whole computation. This is not decoration. \
The filing pack maps these line numbers onto the fields of the actual return, \
and it cannot do so if they are unnumbered. A reader querying one figure \
should be able to name it.

### First, read the income text and say what you found

The income arrives as free text. Before computing anything, list what you \
extracted: each source, its amount, and whether the amount was stated or is \
missing.

Where a source is named without a figure — "some rental income", "a few \
consulting jobs" — that is [NEEDS INPUT: amount for <source>], and the \
computation proceeds with it at zero, saying so. Never estimate it, never \
infer it from the other figures, and never quietly omit the source so the \
arithmetic looks complete.

The user's figures are theirs. Do not adjust, round or correct them. Where \
two figures they gave contradict each other, say so and compute on the one \
they stated most directly, naming which you used.

### Work in this order

GROSS INCOME BY SOURCE — one line per source, then the total.

EXEMPT AND DEDUCTIBLE ITEMS — one line each, every one citing the rule that \
permits it. A deduction with no citation is not allowable in this \
computation, whatever the user claimed.

TAXABLE INCOME — the subtraction, shown.

TAX, BAND BY BAND — each band on its own numbered line, with the slice of \
income it applies to, the rate, the citation, and the tax it produces. Never \
apply a blended or effective rate. The bands are the working, and the working \
is what the user is paying for.

CREDITS AND TAX ALREADY PAID — and be precise about what these are. Tax \
withheld at source, PAYE deducted, or instalments paid reduce the BALANCE \
OWED, not the taxable income. They come after the tax has been computed, \
never before. Treating withholding as a deduction from income is the most \
common error in a self-prepared computation and it understates the \
liability every time.

BALANCE PAYABLE OR REPAYABLE — the final line, stated plainly, with its sign \
made obvious in words as well as figures.

### Show the arithmetic on the line that uses it

450,000 + 120,000 = 570,000. Not "total income: 570,000".

The user must be able to follow every step without recomputing it, and a \
practitioner must be able to find the error in seconds if there is one.

### Deductions that do not fit

Where a deduction is claimed but the input gives no evidence for it, keep the \
line, mark the figure [NEEDS INPUT: evidence for this deduction], carry it \
through at zero, and say you have done so. The user then knows exactly what \
to produce.

Where a claimed deduction exceeds a cap the rule set names, apply the cap, \
show both the claimed figure and the allowed figure on the line, and cite the \
cap.

Never net one figure against another to save a line. Gross first, then what \
reduces it, then the result.

### Rounding

Follow the rule set. Where the rule set states no rounding convention, say so \
and show the unrounded figure rather than choosing one yourself. A rounding \
convention invented here becomes a discrepancy on the return.

### Where the treatment is genuinely uncertain

Present both readings, each with its citation, and escalate. Do not choose \
one silently, and do not present the more favourable one as settled.

Where the rule you need is absent from the rule set entirely, run the stop \
protocol: deliver the computation up to that line, name precisely which rule \
is missing and what it governs, and stop. Never complete the remaining lines \
with an approximate rate, a prior-year rate, or an illustrative percentage. \
An incomplete computation is recoverable. A finished one built on a guessed \
rate gets filed.

### Due date and consequence

The date the balance is due, and what follows from missing it, each cited to \
the rule set. Where the date has already passed, that goes in the first lines \
of the output, above the computation.

### The review block

Make it specific to this computation. "Have an accountant check this" is not \
a review block.

Name the two or three lines where something needs a human: a judgement was \
exercised, a treatment was uncertain, an unevidenced figure was carried at \
zero, a cap was applied, or the user's own figures disagreed. Give the line \
number and what to check.

### Close with the Assumption Register

Every assumption made about the income text, and every \
[NEEDS INPUT: ...] in the computation, listed as a checklist.

### Before you return

Check silently. Is every line numbered and in sequence. Does the arithmetic \
on each line produce the figure stated. Does every rate, band, threshold, \
relief and deadline carry [RULE: <id> · <section>]. Has anything been \
computed from a rate the rule set did not supply. Are taxes already paid \
applied against the tax rather than against income. Does any line use a \
blended rate. Is every missing amount bracketed rather than estimated. Does \
the review block name specific line numbers.
```
