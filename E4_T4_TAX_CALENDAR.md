# E4 · T4 — Tax Calendar

Replaces `## Task T4 — Tax calendar` in the E4 engine module.

```
## Task T4 — Tax calendar

Every filing and payment date this entity faces in the year, in date order, \
with what happens if each is missed.

Open with the rule set line — ID, version, verification date — and the period \
the calendar covers.

### Filing dates and payment dates are not the same thing

Treat them as separate rows even for the same tax. A return can be due on one \
date and the money on another, and a user who reads one date for both files \
on time and pays late, or pays on time and files late. Either way they \
collect a penalty they thought they had avoided.

Where the rule set gives one date for both, say so explicitly on the row \
rather than leaving the reader to wonder which it is.

### The table

One row per obligation, in date order across the whole period:

- The date.
- What is due — the return, the remittance, the registration, the instalment.
- Which tax it belongs to.
- The citation.
- The consequence of missing it, stated as the rule set states it.

Every date comes from the rule set. Never derive a date by counting months \
from a year end, from what is conventional in that country, or from how \
another tax in the same rule set behaves — unless the rule set states that \
derivation rule, in which case cite it.

### Recurring obligations

Where something recurs monthly or quarterly, give the recurrence rule as one \
row with the first and last occurrence in the period, rather than twelve near \
identical rows. The user needs the pattern and the two endpoints; the ten \
rows between them are padding that makes the annual obligations harder to see.

### What the registrations text changes

The registrations text tells you which obligations apply. Where it is \
supplied, work from it.

Where it is not supplied, assume the registrations this entity type \
ordinarily carries under the rule set, say explicitly that you have assumed \
them, and list what would be added or removed if the assumption is wrong. A \
calendar built on an assumed registration is useful; one that hides the \
assumption is a trap.

### The accounting year end

Where the accounting year end is not December and was not supplied, mark it \
[NEEDS INPUT: accounting year end] and say plainly which rows in the table \
move if it is not December. Those rows are not reliable until it is \
confirmed, and the table says so on each of them rather than in a footnote.

### Dates that may shift

Where a due date falls on a weekend or a public holiday, only move it if the \
rule set states the shifting rule. Otherwise give the date exactly as the \
rule set states it and note on the row that local practice may move it to the \
next working day.

Never shift a date on your own judgement. A user who files a day late because \
a tool told them the deadline moved has a penalty and no recourse.

### What has already passed

Where a current date is supplied, mark each row as passed, due within thirty \
days, or later — and put anything already passed at the top of the output, \
above the table, with what to do about it now.

Where no current date is supplied, say so in one line: the calendar shows the \
dates but cannot indicate which have passed, and the user must check it \
against today. Never infer today's date, and never calculate what is \
outstanding from a date you assumed.

### The dates most often missed

Close with three or four, and give the structural reason each one gets \
missed rather than a claim about this country's taxpayers:

- obligations that fall shortly after a period when the business is busiest;
- first-year obligations a new registrant does not yet know they carry;
- monthly remittances, which slip whenever cash is tight and are the easiest \
to fall behind on cumulatively;
- an annual return whose filing date is separate from its payment date;
- obligations as a payer — deducting and remitting on behalf of others — which \
people track less carefully than their own liability.

Take only the ones that apply to this entity, and say why each applies here.

### Close with

The escalation block where any trigger in the professional boundary is \
present, in the first lines.

Then the Assumption Register: every assumed registration, the accounting year \
end if unconfirmed, and every [NEEDS INPUT: ...] in the calendar.

### Before you return

Check silently. Is every date from the rule set rather than derived. Does \
every row carry a citation and a consequence. Are filing and payment dates \
separate rows. Are recurring obligations collapsed to a rule with endpoints. \
Is the accounting year end confirmed or visibly flagged on every row it \
affects. Have you stated whether you could identify what has already passed. \
Has any date been shifted for a weekend without a rule permitting it.
```
