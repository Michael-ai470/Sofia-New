# E6 · T2 — Quotation

Replaces `## Task T2 — Quotation` in the E6 engine module.

```
## Task T2 — Quotation

A quotation is an offer. An invoice is a demand. This document must never be \
mistakable for the other.

Label it clearly as a quotation, and state in the header that no payment is \
due and that this is not an invoice. A buyer who files a quotation as a \
payable has a problem, and so does the seller waiting to be paid against a \
document nobody treated as a bill.

### Same arithmetic discipline as an invoice

Where <computed_totals> is supplied, reproduce those figures exactly. Do not \
recompute or re-round them.

Read what the computed subtotal covers: it is the subtotal of the lines that \
PARSED. Where any line arrives as an unparsed note, itemise it separately \
with the arithmetic shown, add it to the total on its own visible line, and \
say at the top that the total must be checked before sending. A quotation \
that omits two items wins work at a price that loses money.

### The tax line appears only when both conditions hold

The treatment must ask for it AND the rule set must supply the rate. Where a \
tax line is requested and no rule set was supplied, add no tax line of any \
kind and say plainly that the applicable tax must be added by the user from \
the current rules.

Where tax is shown, say whether the quoted total is inclusive or exclusive of \
it, in words. "Total: 450,000" tells the buyer nothing about whether their \
budget of 450,000 covers it.

### Valid until

Compute the expiry from the supplied validity period and the supplied date.

Where no date was supplied, write [NEEDS INPUT: date of issue] and state the \
validity as a period — "valid for 14 days from issue" — rather than inventing \
a date to count from. A quotation whose expiry was calculated from a guessed \
start either expires early, which loses the work, or late, which commits the \
seller to a price they intended to withdraw.

Put the expiry where the buyer will see it, not in a footer. Its whole purpose \
is to create a reason to decide.

### The four things that stop a quotation becoming an argument

WHAT IS INCLUDED — as specifics, not as a category. "Website design" is a \
category. "Five page templates, two rounds of revisions, mobile layouts" is \
a scope.

WHAT IS EXCLUDED — stated explicitly, under its own heading. This is the \
highest-value part of the document and the part sellers habitually leave out. \
Almost every quotation dispute is about something the seller assumed was \
obviously outside the price and the buyer assumed was obviously inside it. \
Name hosting, content, third-party licences, travel, training, ongoing \
support, anything beyond the stated revision count — whichever of these the \
work implies.

WHAT THE PRICE ASSUMES — quantity, timeline, access, approvals, and anything \
the buyer must provide. State that if an assumption does not hold, the price \
is revisited. Saying this now is what makes that conversation possible later; \
saying it after the work starts reads as a renegotiation.

DELIVERY — when the work would start and how long it would take, from the \
terms supplied. Where the terms give no timeline, mark it \
[NEEDS INPUT: delivery timeline] rather than implying immediate availability.

### Where a deposit is required

If the terms mention a deposit or staged payment, state it as a condition of \
acceptance, not as a payment now due. "Work begins on receipt of a 40% \
deposit" is a term of the offer. An amount presented as payable turns the \
quotation back into an invoice.

### The number

Use the quotation number exactly as given. Never renumber or reformat it. It \
is what the buyer will quote back when they accept, and what the invoice will \
reference.

### How to accept

One line, at the end: what the buyer does to accept — reply confirming, sign \
and return, issue a purchase order — and what happens next when they do.

Then one further line: on acceptance this becomes an invoice, carrying the \
same items and totals, with an invoice number, payment terms and a due date \
added. The buyer then knows what to expect and the seller knows the document \
converts cleanly.

### Before you return

Check silently. Is it unmistakably a quotation, with no payment stated as due. \
Are the computed totals reproduced rather than recomputed. Is every unparsed \
line itemised and flagged. Is the expiry either a real date or a stated period \
from a bracketed issue date. Is there an explicit exclusions section. Are the \
price's assumptions stated. Is inclusive or exclusive of tax said in words. Is \
a deposit, if any, framed as a condition rather than a demand. Does the close \
say how to accept.
```
