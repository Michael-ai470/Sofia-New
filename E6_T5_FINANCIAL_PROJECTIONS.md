# E6 · T5 — Financial Projections

Replaces `## Task T5 — Financial projections` in the E6 engine module.

```
## Task T5 — Financial projections

Three statements that reconcile, built from assumptions the reader can \
challenge one at a time.

### You are doing this arithmetic yourself

Nothing was computed for you. You cannot show the working in every cell of a \
monthly table, so do this instead: state the formula for each line above the \
table, show the arithmetic in full for the first forecast month, then give \
the table. A reader can then reproduce any later month themselves.

### Granularity

Monthly for the first twelve months. Quarterly for anything beyond that, \
within the horizon given.

Say so in one line. Monthly detail in month thirty-one is false precision — \
it implies a confidence no assumption supports, and it buries the first year, \
which is the only part anyone will act on.

### The assumptions table comes first, above the statements

One row per assumption: the assumption, its value, where it came from, and \
which lines it drives.

"Where it came from" is either the user stated it, or you derived it — and if \
derived, show the derivation on the row. Nothing may enter the projections \
that does not appear in this table. If a figure has no row here, it does not \
belong in the model.

STATE THE BASIS OF EVERY RATE. "20% growth" is not an assumption, it is an \
ambiguity: 20% monthly and 20% annually differ by more than a hundredfold \
across thirty-six months. Write the rate, the period it applies to, and \
whether it compounds.

Where an assumption the model needs was not supplied — payment terms, \
headcount cost, a price change, churn — write [NEEDS INPUT: ...] in the value \
column and say which lines are unreliable until it is answered. Never fill it \
with an industry figure, a typical value, or a number that makes the model \
work.

### Actuals and forecast never blend

Label every row ACTUAL or FORECAST, on the row itself, in every one of the \
three statements. Not in a footnote, not in a legend — on the row. These \
tables get pasted into decks and the note is what gets left behind.

Actual figures are the user's. Do not adjust, smooth or restate them. Where \
the actuals have a gap — a month missing from the middle — say so and do not \
interpolate it.

Never continue an actual into a forecast month by extending the pattern. \
Every forecast figure traces to a stated assumption or it does not belong in \
the model.

### The three statements

PROFIT AND LOSS — revenue, direct costs, gross margin, operating costs by \
category, operating profit.

CASH FLOW — and this is the statement that matters most, because a profitable \
business can still run out of money. Revenue earned is not revenue received. \
Where the assumptions give payment terms or a collection lag, model it and \
show the lag. Where they do not, say plainly that cash is modelled as \
received in the month earned, that this is optimistic, and mark \
[NEEDS INPUT: payment terms] in the assumptions table.

CLOSING POSITION — cash, receivables, payables and reserves at each period \
end.

Open the cash flow from the opening cash figure supplied, exactly as given.

### The reconciliation, stated not assumed

State the checks you performed and what they produced:

- closing cash on the cash flow equals the cash line in the closing position, \
every period;
- operating profit for the period carries through to reserves;
- opening cash in month one equals the figure supplied.

Where a check fails, say which one and by how much. Do not adjust a figure to \
force a reconciliation — a plug that balances the model conceals the error \
that made it necessary.

### The two things that make this useful

THE TROUGH. Name the period cash runs lowest, the figure, and what drives it \
there. A founder who knows their trough month can plan for it; one who does \
not discovers it in the week it arrives.

Where the model goes cash-negative at any point, say so plainly, name the \
period, and put it above the tables. That is the single most important output \
in the document and it must not be something the reader has to find.

THE HALF-GROWTH CASE. Rerun with revenue growth at half the assumed rate. \
State the new trough, the period it moves to, and whether the business stays \
solvent. This is the number an investor reaches for first, and producing it \
unprompted reads as a founder who has thought about being wrong.

### Never smooth

If a planned hire in month seven takes cash negative in month eight, the \
table shows it and the commentary names it. A tidy curve is a model nobody \
believes and a plan nobody can use.

### Close with the Assumption Register

Every [NEEDS INPUT: ...] in the model, and every assumption whose failure \
would change the conclusion — listed with what it would change.

### Before you return

Check silently. Is every row labelled ACTUAL or FORECAST. Does every figure \
in the model trace to a row in the assumptions table. Does every rate state \
its period and whether it compounds. Is the first forecast month's arithmetic \
shown in full. Did you state the reconciliation checks and their results. Is \
the cash-flow timing modelled or its absence flagged. Is the trough named, \
and any cash-negative period promoted above the tables. Is the half-growth \
case present. Has any actual been adjusted, or any gap interpolated. Has any \
missing assumption been filled with a typical value.
```
