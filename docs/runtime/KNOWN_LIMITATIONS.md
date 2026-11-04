# Known limitations

## Accounts and security

- **No email.** Signup has no address verification, and invitations and reset links are passed on by hand.
- **Login lockout is per address.** 10 failures lock it for 15 minutes, so someone guessing can keep an account locked. There's no IP rate limit.
- **Access tokens can't be revoked.** After logout or a password change, an existing access token works until it expires, up to one hour.
- **No two-factor sign-in.**
- **Tutorial progress and the keyboard preference** live in the browser, so they don't follow a user to another device.

## Accounting and GST

- **Direct GST filing, e-invoices and e-way bills need a GSP, and none is connected.** The app prepares returns and exports JSON for upload to the portal.
- **No GSTR-2B matching.** ITC comes from your purchase register and nothing checks it against the portal.
- **The ₹40L goods and ₹20L services limit text is general guidance.** Special-category states and your own position aren't computed.
- **Nothing verifies what an attached document says.** The app stores it; it doesn't read or validate its contents.
- **The Consultant answers from ledger figures with fixed logic.** It isn't an external AI service.
- **Report date defaults assume an April financial year,** though From and To can be changed.
- **FP&A department budget use** reads a manually maintained field, not the ledger.
- **Payroll posts employee figures only.** A run debits salaries and credits net pay, TDS and EPF payable. Employer EPF and professional tax aren't recorded anywhere, and paying staff or the government is a voucher you enter. The account choices need your accountant's review. Invited people who haven't accepted count in the headcount.
- **A completed bank reconciliation can't be corrected or redone** for that account and date. Undoing a match later makes it differ from its recorded snapshot.
- **Vouchers tied to an invoice, bill, settlement or other source can't be edited,** only resubmitted, so they stay in line with that source.

## Documents and files

- Attached documents can't be removed, by design. A wrong attachment stays, and you can attach the right one too.
- Day Book links one document per voucher, even if more are stored.
- Invoice PDFs come from the browser's print function.
- Files in Postgres grow the database and its backups. Move to object storage if volumes get large.

## Import

- The Tally parser has only been tested on sample files written for the purpose, not a real TallyPrime export. Uncertain parts are marked in `src/lib/import/tally.ts`.
- Each import type applies all-or-nothing, but a later failure doesn't undo earlier types.
- Opening balances go to the open period covering today.
- No export back to Tally format.

## Not confirmed

- Browser tests cover page loads, tutorials, keyboard and navigation, but forms aren't filled in screen by screen. Business flows are tested through the API.
- HR screens have no end-to-end test.
- No test has run on a developer machine or on GCP.
- Razorpay, GSP and KYC adapters have never been run against a real provider.

## Marketing

Claims for features that don't exist have been removed from the landing page. It still describes GO and PRO plans and a 15-day trial, which a single-customer deployment doesn't use, because that's a product decision.

## Out of scope for this delivery

Multi-tenancy, a shared hosted platform, licensing and billing, automated customer provisioning.
