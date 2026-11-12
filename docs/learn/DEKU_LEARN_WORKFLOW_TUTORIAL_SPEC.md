# Deku Learn workflow tutorial spec

How a Learn Centre workflow is defined, how its steps are proved, and how the in-app coach should run it. The pieces:

| Piece | File | Owner |
|---|---|---|
| Format | `apps/platform/src/lib/learn/workflows/types.ts` | shared |
| The 18 workflows | `lib/learn/workflows/catalogue.ts` (`LEARN_WORKFLOWS`, `getLearnWorkflow`) | workflows |
| Activity log and step matching | `lib/learn/activity.ts` (`DEMO_ACTIVITY_TYPES`, `isSatisfied`) | shared |
| Progress, resume, skip, filters, Start link | `lib/learn/workflows/runner.ts` | runtime |
| Coach UI, catalogue cards, workspace | `components/tutorial/TutorialCoach.tsx`, `components/learn/*`, `context/LearnDemoContext.tsx` | runtime |
| Writes and their activities | `lib/learn/demo-api.ts`, `lib/learn/engine/*` | engine |
| Checks | `tests/learn-workflows.test.ts` | workflows |

## Format

A workflow (`LearnWorkflow`) carries its card (`code`, `name`, `description`, `category`, `difficulty`, `estimatedMinutes`, `modules`), who it is for (`primaryRole`, `supportingRoles`), where it fits (`industries`, `industryNote` when a company is left out, `recommendedCompany`), what it needs (`minPlan`, `startingData`), where it starts (`startRoute`, always the first step's route), when it is done (`completion`, in words) and its docs (`docs`, `category/slug` in `docs-data.ts`).

A step (`LearnWorkflowStep`):

| Field | Meaning |
|---|---|
| `id` | unique within the workflow |
| `title`, `body` | sentence case, plain words: what to click and what will change |
| `route` | the screen the coach opens when the step starts; must be a route `LearnDemoWorkspace` renders |
| `target` | a `data-tour` value on that screen to highlight |
| `role` | the role the step is done as; the coach offers the switch first |
| `expect` | what proves the step was done (below); omitted for a read step |
| `impact` | for action steps: what changes in the books (debits and credits, or "no ledger change") |

## Validation semantics

A step's expectation is checked against the activity log of the current company, counting only activities recorded **after the step started** (`stepStartedSeq`).

- **Read step** (`expect` omitted, or `{ kind: "visit", route }`): satisfied by a `route.visited` for that route (query string ignored), or when the visitor is already on that screen. An omitted `expect` means a visit to the step's own `route`. A visit expectation may name a different screen from `route`: WF-01 and WF-16 open Day Book and wait for `/gst`, which is only reached by clicking the voucher's Open invoice link, so the step proves the link was followed.
- **Action step** (`{ kind: "event", type, match?, role? }`): satisfied by an activity of that `type` from `DEMO_ACTIVITY_TYPES`, whose `refs` contain every `match` key with an equal value, recorded while previewing `role` when one is given. Workflows never invent event types; the engine records exactly those types, once per write it actually applied, and none for a write it refused.
- One activity satisfies one step. When a step completes, the next step starts at that activity's sequence number, so a later activity (not the same one) is needed for the next step. Two consecutive "submit" steps need two submissions.
- Completion never comes from a toast, a button press or a timer. If the engine refuses the write (wrong role, unbalanced voucher, closed period, maker approving their own voucher), nothing is recorded and the step stays open.
- **Skip** moves on and records the step as skipped, never as completed. A workflow is "done" only when every step is completed or explicitly skipped; the card shows how many were skipped.

Rules the tests enforce on every workflow: codes WF-01 to WF-18, at least three steps, unique step ids, start route and step routes rendered by the workspace, each target present on its own screen's source, event types from `DEMO_ACTIVITY_TYPES`, valid roles, `step.role` equal to `expect.role` when the latter is set, approvals only by Owner, CFO or Admin, invoice issuing only by Owner or Admin, no writes in Analyst or Auditor workflows except asking Deku Consultant, and docs that exist.

## Role switching

- `step.role` says who does the step. When it differs from the role being previewed (`roleSwitchFor`), the coach shows "This step is done as CFO" with a one-click switch. It does not switch silently: seeing the role change is part of the lesson.
- When `expect.role` is set, the step completes only on an activity recorded in that role. Used for checker steps (`journal.posted` as CFO) and throughout WF-18, where who did what is the point.
- A visitor who tries a step in the wrong role sees the engine's refusal (the real reason, e.g. "Approve needs the Owner, CFO or Admin role"), and the step stays open. That refusal is useful: the coach may add "Switch to CFO to approve".
- WF-08 has steps whose proof is the switch itself (`role.switched` with `match: { role: "analyst" }`).
- Start opens the workflow in its `primaryRole` at its `minPlan` (`workspaceHref`). If the visitor previews a plan below `minPlan`, the coach says which plan the workflow needs instead of letting steps fail mysteriously (GO has no CFO, Analyst or Auditor seat; inventory, bank reconciliation and ITC are PRO; a free seat for WF-08 is Enterprise).

## Resume and reset

- Progress is kept per company in localStorage (`deku-learn:workflows:v1:{company}`), next to that company's books and activity log. Start resumes an unfinished run; a finished one restarts.
- Leaving the workflow (exit) keeps its progress. Reloading the page keeps it.
- Switching company switches to that company's progress; a workflow started in Aster stays with Aster.
- Reset clears the company's books, activity log and workflow progress together, so no step can be "complete" against books that no longer contain its record.
- Steps that build on an earlier workflow say what to use when the earlier record is missing: WF-03 and WF-16 fall back to the seeded AST/26-27/002 if WF-01 was not done.

## How the coach should behave

1. **Open the screen.** When a step starts, navigate to `step.route` through the workspace's `navigateTo` (which records the visit). Do not navigate again on every render; the visitor may wander and come back.
2. **Highlight, or say where.** Find `[data-tour="<target>"]`. Several targets live inside content that appears only after a click: the invoice form (`invoice-*`) after Create GST invoice, `invoice-issue` inside the invoice modal, `voucher-drawer-*` after a Day Book row is opened, `approvals-approve` after a voucher is selected, `inventory-adjust-form` and `recon-tabs` after a tab or file. When the target is not in the page yet, show the step card unanchored and keep watching (a `MutationObserver` or a short poll); highlight it as soon as it appears. Never fail the step because a target is missing.
3. **Say what is being waited for.** Under the body, show "Waiting for you to submit the voucher for approval" (`describeExpectation`), and the `impact` line for action steps.
4. **React at once.** Listen for `DEMO_ACTIVITY_EVENT` (`deku-learn-activity`) and re-check the step on each activity; when it is satisfied, mark it done and offer Next (or advance automatically for read steps after a short beat). Next is disabled until the step is satisfied; Skip is always available and labelled as skipping.
5. **Show refusals.** When the engine blocks a write it raises a "blocked" notice with the reason; the coach keeps the step open and, if the step has a `role`, offers the switch.
6. **Finish honestly.** The completion screen lists what changed in the books during the run (`summariseChanges` from the run's start) and the workflow's `completion` sentence, and says how many steps were skipped. A run with skipped steps is "finished with N skipped", not "complete".
7. **Stay in the workspace.** Navigation inside the demo must never leave `/learn/demo/workspace`. Links are intercepted today; `router.push` calls from report rows and "Open in Day Book" buttons are not, and must be (see the audit, WF-09).
8. **Never act for the visitor.** The coach highlights and explains; it does not fill forms, click buttons or call the API. Autofill buttons on the screens themselves are fine because the visitor clicks them.

## Runtime requirements raised by the workflows

- Per-role demo user ids (`u-owner`, `u-cfo`, `u-admin`, `u-acc`, `u-analyst`, `u-aud`, `u-viewer`) in the demo auth context, so `canApprove` and the approval trail distinguish the maker from the checker.
- A download for the company's demo bank statement (WF-06), from the step card or the demo bar.
- `router.push` interception inside the workspace.
- `/gst?invoice=<id>` must open that invoice: `GstTaxHubView` reads `window.location.search`, so the workspace URL needs the invoice query when the demo route carries one.

## Authoring a new workflow

1. Walk the screens in the demo first; write only steps a visitor can do there.
2. Read steps for looking, action steps for anything that should change the books; one action per step, proved by the activity the engine records for it.
3. Give every action step an `impact` with ledger codes, and set `role` where the database requires a particular role.
4. If a step needs an element without a `data-tour`, add the attribute to that screen (attribute only), and run `npx vitest run tests/learn-workflows.test.ts`.
5. If the screen cannot do it, don't write the step; record the gap in `DEKU_LEARN_WORKFLOW_IMPLEMENTATION_AUDIT.md`.
6. Regenerate `DEKU_LEARN_WORKFLOW_CATALOGUE.md` from the catalogue.
