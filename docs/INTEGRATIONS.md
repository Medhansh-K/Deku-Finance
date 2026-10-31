# Third-party integrations: GSP and KYC

No GST Suvidha Provider (GSP) or KYC provider has been chosen yet (IMPLEMENTATION_PLAN §6). Both areas are
fully built behind a provider-neutral trait and stay **switched off** until a server sets a provider.

| | GSP (M33) | KYC (M6) |
|---|---|---|
| Trait | `backend/src/integrations/gsp.rs` `GspProvider` | `backend/src/integrations/kyc.rs` `KycProvider` |
| Routes | `backend/src/routes/gsp.rs`, `/api/v1/organisations/:org_id/gsp/...` | `backend/src/routes/kyc.rs`, `/api/v1/organisations/:org_id/kyc/...` |
| Tables | migration 037: `gsp_connections`, `e_invoices`, `eway_bills`, `gsp_requests` | migration 038: `kyc_verifications`, view `organisation_trust_level` |
| Switch | `GSP_PROVIDER` plus `DATA_ENCRYPTION_KEY` | `KYC_PROVIDER` |
| Off | every action answers `503 {error: "gsp_not_configured"}` | `503 {error: "kyc_not_configured"}` |
| UI | Settings "GST portal (GSP)", wizard "File directly", invoice IRN / e-way bill | Settings "Identity (KYC)", `/kyc` hub |

## Switches

- Unset or empty: `NotConfigured`. Nothing leaves Deku, and the UI says why each button is disabled.
- `sandbox`: a local demo that makes no network calls. Every identifier it invents starts with `SANDBOX`
  (IRN `SANDBOX-…`, ARN `SANDBOX…`, e-way bill `SANDBOX-…`), its KYC rows have `provider = 'sandbox'` and
  never count towards the trust level, and the UI shows "Sandbox, not legally valid". The backend refuses to
  start with a sandbox when `DEKU_ENV=production`, which the GCP deploy sets.
- Any other value stops startup until an adapter of that name exists, so a typo can't silently turn an
  integration off.

## Data rules (apply to every adapter)

- Writes to the tables above use the backend's service token, after the backend checks the caller's role
  with the caller's own token. Members can only read their company's rows; `gsp_connections.credentials_enc`
  isn't readable by `authenticated` at all.
- GSP credentials (portal username, session token) are encrypted with `crypto::Cipher` and decrypted only in
  memory for one request. Never log them; `gsp_requests` holds what was called, when, by whom and whether it
  worked, never request or response bodies.
- KYC stores the outcome and the provider's reference only. The table refuses 12-digit (Aadhaar) and 16-digit
  (Virtual ID) numbers and anything over 4 KB in `raw_minimal`, so don't try to keep documents or images.
- Share only the fields the call needs. The Settings cards list what goes to the provider; update their text
  if an adapter sends more.

## Adding a real provider

1. Create `backend/src/integrations/gsp/<name>.rs` (or `kyc/<name>.rs`) with a struct holding its HTTP client
   and platform credentials (read from env, e.g. `ACME_GSP_CLIENT_ID` / `ACME_GSP_CLIENT_SECRET` from Secret
   Manager). Use `reqwest` with a timeout, as `postgrest.rs` does.
2. Implement every trait method. Return `ProviderError::Rejected(msg)` for the provider saying no (wrong OTP,
   invalid PAN, IRN already cancelled) and `ProviderError::Upstream(msg)` for network or parsing failures;
   routes map these to 400 and 502. Keep the messages free of secrets: they go into `gsp_requests.error`.
   - `generate_irn` gets the `sales_invoices` row with `parties` and `sales_invoice_lines` embedded; map it to
     the e-invoice schema (INV-01) the provider expects. Return the signed QR string as issued: the invoice
     view encodes it into the printed QR.
   - `file_return` gets the JSON stored in `gst_return_filings` (exactly what `backend/src/gst` built and the
     user recorded). Return the ARN in capitals and digits; the route marks the filing filed with it.
   - `start_digilocker` returns an authorise URL whose redirect is the URI registered with the provider
     (normally `https://<frontend>/kyc`). The `/kyc` page completes the flow from the `code` query parameter.
3. Add the name to `integrations::choose` and the `match` in `main.rs`, then unit-test the adapter's request
   mapping and error mapping against recorded sandbox responses (no live calls in CI).
4. Deploy: secrets in Secret Manager, `GSP_PROVIDER=<name>` / `KYC_PROVIDER=<name>` on `deku-backend`, and
   Cloud NAT with a static IP for the provider's allow-list (`deploy/gcp/README.md` §5).
5. Acceptance (IMPLEMENTATION_PLAN M33 / M6): end-to-end in the provider's sandbox, the IRN QR printed on the
   invoice, and the Settings text matching exactly what is shared.

## Choosing a provider (IMPLEMENTATION_PLAN §6)

GSP:
- Partner with an existing GSP rather than apply to become one (long and regulated).
- Price per GSTIN and per API call (returns, IRN, e-way bill), and minimum commitments.
- Sandbox quality: a realistic test environment with test GSTINs, documented error codes.
- Coverage: GSTR-1 / GSTR-3B save-submit-file with EVC, e-invoice (IRN generate / cancel / get by IRN),
  e-way bill (generate / cancel / update Part B), and GSTR-2B download for ITC timing.
- Auth model: taxpayer OTP sessions, session length, IP allow-listing, and whether e-invoice / e-way bill
  need separate API credentials per GSTIN.
- Data handling: where data is stored, retention, a DPA, and no reuse of company data.

KYC:
- Direct DigiLocker / EntityLocker requester registration (via API Setu) vs an aggregator.
- Which checks are covered: PAN (with name match), Udyam, GSTIN, DigiLocker, EntityLocker.
- Price per check, sandbox quality, and consent flow / redirect URI rules.
- Data handling: no Aadhaar numbers returned (masked at most), retention, a DPA.

Both: the per-company opt-in wording (§6 "Third-party data policy wording") must name the provider and list
exactly what it receives before the switch is turned on in production.

## Known gaps

- No adapter maps invoices to the INV-01 schema yet; that depends on the provider's API.
- Session renewal: when a GSP session expires the user verifies a new OTP in Settings. Providers that offer
  refresh tokens can extend `verify_otp`'s session instead.
- IRP rules such as "cancel within 24 hours" are left to the provider's rejection message.
