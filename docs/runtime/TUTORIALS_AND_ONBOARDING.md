# Tutorials and onboarding

**How it works:** a guide card walks through the real screens and highlights the element each step is about. It explains and points; it never fills in or saves anything, and every step says so on a real company. Help & Tutorials (`/help`, the book icon in the header, or the command palette) lists all paths with search, progress and start, resume or restart. Opened from a page, it lists the paths covering that page first.

New users are offered the setup tour on first sign-in, and can decline.

| Part | File |
|---|---|
| Content | `src/lib/tutorials/paths.ts` |
| Progress rules | `src/lib/tutorials/progress.ts` |
| Guide card | `src/components/tutorial/TutorialCoach.tsx` |
| Help page | `src/modules/help/HelpCentreView.tsx` |
| Highlight targets | `data-tour` attributes on the screens |

`InteractivePlanTutorialModal.tsx` is separate: it compares the GO and PRO plans from the login page and demo banner.

## Paths

Each path's prerequisites and outcome are in its entry in `paths.ts` and shown on the help page.

| Path | Who sees it | Steps | Live data? |
|---|---|---|---|
| First-time setup | Everyone | 10 | Real screens; nothing saved by the tutorial |
| Accounting fundamentals | Everyone | 11 | Fictional example explained; the user enters anything themselves |
| Sales and invoicing | Everyone | 8 | As above |
| Purchases and expenses | Everyone | 6 | As above |
| Banking and reconciliation | Everyone | 6 | As above |
| Reports and financial control | Everyone | 8 | Read only |
| Documents and operations | Everyone | 7 | As above |
| Administrator | Owners and admins | 10 | As above |
| Developer and implementer | Owners and admins | 10 | Concept only, with no screens |

The help page hides admin paths from other roles as guidance only; the server enforces what each role can do. Progress is stored per user in the browser, so it doesn't follow someone to another device.

## Where the plan's steps differ from the app

These steps describe what exists rather than what plan §22 assumed.

| Plan step | What the tutorial says instead |
|---|---|
| Create the organisation, set legal details and financial year | The company is created at signup. Settings has no field for company name, PAN or financial-year start month; fiscal periods are managed there |
| Download the invoice | Print only |
| Bank statement import | CSV, read in the browser and not kept, so it's chosen again each visit |
| Upload a document | No document library; files attach to a voucher |
| Backup, update and health screens | None in the app; these steps are explanations |

## Keeping it accurate

`tests/tutorials.test.ts` fails if a step points at a page or `data-tour` target that no longer exists, so removed screens are caught in CI. It can't tell whether the words are still true, so when a gap above gets fixed, update the matching step.

**Last verified:** commit `2e32342`. CI walks every step of every path in Chromium at desktop width, confirming each page opens and each highlighted element is visible, and checks pause, resume, restart, search and that a viewer doesn't see administrator paths. At phone width it checks the guide card fits, on the first path only. Whether the words are right is still a human review.
