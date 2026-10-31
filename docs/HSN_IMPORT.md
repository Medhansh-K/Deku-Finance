# Importing the HSN/SAC master

Deku ships **no HSN or SAC codes**. Until someone imports an official list, `public.hsn_sac_codes` is empty, the HSN pickers say "HSN master not loaded yet; ask an admin to import it", and users can still type a code by hand (4, 6 or 8 digits).

Descriptions and rates must never be typed by hand or from memory. Every row records the file it came from (`source`) and when it was loaded (`imported_at`).

## 1. Get the official file

Use one of these government sources:

- **GST portal, "Search HSN/SAC code"**: services.gst.gov.in, then Search Taxpayer / HSN-SAC search. The page offers a downloadable HSN and SAC list (xlsx).
- **CBIC**: the Customs Tariff / GST rate and HSN directory published at cbic.gov.in or cbic-gst.gov.in.

These sites get reorganised often. **Whoever imports must open the URL, check it is the official government site and that the file is current, and write the exact file name and download date in `--source`.** Do not use third-party "HSN list" sites.

## 2. Make a CSV

Open the file and save a sheet as UTF-8 CSV with exactly two columns and a header row:

```
code,description
```

- `code`: digits only, 2, 4, 6 or 8 long (chapter, heading, sub-heading, tariff item). SAC codes start with 99. Excel drops leading zeros; format the column as text before saving.
- `description`: the official text, unchanged.
- If the HSN and SAC lists come as separate sheets, either combine them into one CSV or run the import once per CSV.

## 3. Import

Run it with a connection that owns the table (the migrate user) or as `service_role`:

```sh
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB \
  sh db/import_hsn.sh --source "GST portal HSN_SAC.xlsx (HSN sheet), downloaded 2026-10-31" hsn.csv
```

The script loads the CSV into a temporary table and checks that every code is 2/4/6/8 digits, every description is present and no code repeats. If any check fails, nothing is written. Otherwise it upserts: new codes are added, existing codes get the new description, source and timestamp. Codes missing from the new file are kept; delete them by hand if the official list dropped them.

## 4. Rates

`public.hsn_sac_rates` (code, rate, cess, effective date, notification reference, source) stays empty. Deku never applies a GST rate from the master: the user always picks the rate on the item or invoice line. If rates are loaded later, they must come from the notified rate schedule, with the notification number in `notification_ref`.
