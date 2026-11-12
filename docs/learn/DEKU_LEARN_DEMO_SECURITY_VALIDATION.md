# Deku Learn: demo security validation

The Learn Centre demo runs entirely in the visitor's browser. It has no backend, no login and no server session. This document covers:

- what keeps it isolated from the real product;
- what is simulated;
- how roles and plans are enforced;
- the risks that remain.

## Isolation

- **No server.** `LearnDemoProvider` registers `setDemoApiInterceptor`. While it is registered, every `apiClient` call is answered by `dispatchDemoApi` (`lib/learn/demo-api.ts`) and never reaches `/api/backend`. That includes absolute paths starting `/api/v1/...`; only full `http…` URLs bypass the interceptor, and none of the demo's calls use them. The interceptor is removed when the provider unmounts.
- **No real organisation IDs.** The demo companies have the IDs `demo-aster-trading`, `demo-northstar-consulting`, `demo-urbannest-retail` and `demo-meridian-retail`. They are not UUIDs, so the real database could never resolve them. The engine answers only for the active demo company: a write to any other organisation ID is refused, and a read returns an empty list. The visitor's real active-organisation selection is saved before the demo starts and restored when it ends (`LearnDemoContext`).
- **Per browser, per company.** Each company's books and activity log live in localStorage under `deku-learn:v2:<company>` (`demo-store.ts`). Nothing is shared between visitors or devices. If storage is blocked or full, the demo still works for the session and simply starts fresh next time.
- **Fictional data only.** The seed contains no real people, emails, GSTINs or banks:
  - members have `.example` emails;
  - the bank is "Demo Co-operative Bank (fictional)" with IFSC `DEMO0000123`, and the UPI handle is `@demobank`;
  - the marketplace operator is "ShopSphere";
  - `sales_channel` keeps the product's enum value `amazon`, which is a channel key, not a party.
- **No credentials.** `tests/learn-centre.test.ts` checks that no Learn file contains shared demo credentials or `/api/auth/demo`.

## Reset

"Reset demo" clears the company's localStorage entry and reseeds from `createInitialDemoDataset(slug)`. The seed is deterministic and reconciles: `tests/learn-engine-seed.test.ts` checks every company. Bumping `DEMO_STORE_VERSION` (now 2) discards every older save.

## External actions (always simulated)

| Action | Endpoint(s) | Demo behaviour |
|---|---|---|
| GST portal: IRN, e-way bill, OTP, direct filing | `/gsp/*` | GET status returns `configured: false`, `simulated: true` with a reason. Any POST returns 501 "…are simulated in the demo: nothing was sent and no live result exists", plus a notice. |
| Recording a GST return as prepared or filed | `POST /gst/{p}/{type}/record`, `PATCH …/filed` | Stored in the demo company only, with `simulated: true`. The ARN is whatever the visitor typed, and the notice says nothing was sent to GSTN. |
| Payment links / Razorpay | `/payments/*`, `POST /invoices/{id}/payment-link` | Status shows not configured and `simulated: true`. Creating a link returns a 501 "simulated" error. No URL is ever fabricated. |
| KYC (PAN, GSTIN, Udyam, DigiLocker) | `/kyc/*` | Status shows not configured. Actions return a 501 "simulated" error. |
| Invitations (email) | `POST /invitations` | Recorded as a pending invitation with `simulated: true` and a notice saying no email was sent. The token works nowhere. |
| Password-reset links | `POST /workbench-members/{id}/password-reset` | 501 "not available in the demo": the members are fictional and have no logins. |
| WhatsApp reminders | Collect screen (`wa.me` links built in the browser) | Opens only if the visitor clicks it. The demo customers' phone numbers are empty, so there is no real recipient. |
| Notifications | `/notifications` | Derived from the demo books. Nothing is sent. |
| Document upload | `POST /files` | Only the name and size are kept. The file never leaves the device. |
| Consultant | `POST /consultant/chat` | A rule-based answer from the demo books. No AI model or external API is called, and the reply says so. |

## Roles and plans vs the backend

- **Roles.** The role preview is a browser control, so anyone can pick any role. What matters is that each role can do no more than the database would let it. `lib/learn/engine/rbac.ts` copies the `has_role` sets from the SQL functions and RLS policies; where one function calls another (issue → post, reverse → post), it uses the intersection. Every write checks its rule before changing anything, and a refusal is a 403 the screen shows.
- **Role table aligned.** `lib/learn/demo-roles.ts` was aligned with the SQL rules: the CFO no longer drafts, issues or reverses, and the accountant no longer issues. A test fails if the role table ever allows more than SQL does.
- **Separation of duties.** Maker-checker is enforced the same way as in `post_journal_entry`. With approval on (the seed default), a voucher must be submitted first, and its maker or submitter can't approve it. The acting member's ID (`u-owner`, `u-cfo`, `u-admin`, `u-acc`, …) is stamped on created, submitted, posted and rejected entries, and on the activity log.
- **Plans.**
  - Seat limit on invitations (GO 2, PRO 5, Enterprise unlimited).
  - GO plan monthly invoice limit when issuing.
  - GO catalogue limit when adding items.
  - GO GST JSON gating (a warning notice; the returns are still computed).
- **Read-only roles.** Analyst, auditor and viewer are refused on every write (tested). Their reads are not restricted by module in the engine; the screens limit them. A determined visitor previewing "viewer" can still request any report through the shell. The data is fictional, so the consequence is nil.

## Residual risks

1. **Audit export used raw `fetch`. Fixed.** `downloadSecureAuditExport` (`lib/logging/activity-logger.ts`) now calls `apiClient`, so in the demo the interceptor answers from the demo log (`GET /audit-events/export`) and no request leaves the browser. In production it goes through the same `/api/backend` proxy as before.
2. **Attachment download link (`filesApi.downloadUrl`) is a plain `href`** to `/api/backend/.../files/{id}`. In the demo it would hit the real proxy with a demo ID; there is no session, or the ID would be rejected as not a UUID, so it fails closed and exposes nothing. It is not routed through the interceptor; the screen owner should hide the link in demo mode.
3. **`acceptInvitation` (`/api/v1/organisations/invitations/accept`)** is refused by the engine ("not available in the demo").
4. **Other raw `fetch` calls** (`lib/auth/session.ts`, `ChangePasswordCard`, `AuthContext`) belong to the authenticated app. They are not rendered in the demo workspace, but if one were, it would talk to the real auth endpoints with no demo session. Recommend keeping those screens out of the Learn routes.
5. **Visitor-entered data stays in plain localStorage.** Any script on the same origin can read it. The data is demo-only and fictional by default, but a visitor could type real details into a demo form. A notice saying "don't enter real data" in the demo bar is advisable (UI owner).
6. **The engine is a re-implementation.** If the SQL rules change, the demo can drift. The role-table test and the engine tests catch drift in the rules they cover, not all of it. See "What is NOT mirrored" in `DEKU_LEARN_WORKFLOW_ACCOUNTING_VALIDATION.md`.
