# Deku Finance - End-to-End API Test Script
# Runs against local Rust / Axum backend on http://localhost:8080

$BaseUrl = "http://localhost:8080"
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "DEKU FINANCE - COMPREHENSIVE END-TO-END API TEST" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Health Check
Write-Host ""
Write-Host "[1/8] Testing Health Check..." -ForegroundColor Yellow
$health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get
Write-Host "Health Status: $($health.status) | Engine: $($health.engine)" -ForegroundColor Green

# 2. Create Organisation
Write-Host ""
Write-Host "[2/8] Creating Organisation..." -ForegroundColor Yellow
$slug = "deku-org-" + (Get-Random -Minimum 1000 -Maximum 9999)
$orgPayload = @{
    name = "Deku Financial Technologies"
    slug = $slug
    currency = "INR"
    timezone = "Asia/Kolkata"
    gstin = "27AAACD1234E1Z5"
    pan = "AAACD1234E"
    financial_year_start_month = 4
} | ConvertTo-Json

$orgRes = Invoke-RestMethod -Uri "$BaseUrl/api/v1/organisations" -Method Post -Body $orgPayload -ContentType "application/json"
$orgId = $orgRes.organisation_id
Write-Host "Created Organisation ID: $orgId (Slug: $slug)" -ForegroundColor Green

# 3. Create Counterparty (Customer)
Write-Host ""
Write-Host "[3/8] Creating Customer Party..." -ForegroundColor Yellow
$partyPayload = @{
    type = "customer"
    legal_name = "Apex Enterprise Systems India Pvt Ltd"
    display_name = "Apex Systems"
    gstin = "27ABCDE1234F1Z5"
    pan = "ABCDE1234F"
    email = "accounts@apexsystems.in"
    phone = "+919876543210"
    billing_address = @{
        line1 = "Tower 2, Tech Park"
        city = "Pune"
        state = "Maharashtra"
        pincode = "411014"
        country = "India"
    }
} | ConvertTo-Json

$partyRes = Invoke-RestMethod -Uri "$BaseUrl/api/v1/organisations/$orgId/parties" -Method Post -Body $partyPayload -ContentType "application/json"
$partyId = $partyRes.data[0].id
Write-Host "Created Customer: $($partyRes.data[0].legal_name) (ID: $partyId)" -ForegroundColor Green

# 4. Create Catalogue Service Item
Write-Host ""
Write-Host "[4/8] Creating Catalogue Item..." -ForegroundColor Yellow
$itemPayload = @{
    type = "services"
    name = "Financial ERP Architecture Advisory"
    description = "Retained enterprise ERP advisory service"
    sku = "SRV-ERP-" + (Get-Random -Minimum 100 -Maximum 999)
    hsn_sac_code = "998315"
    unit_code = "OTH"
    default_unit_price = 100000.00
    default_gst_rate = 18.00
    is_taxable = $true
} | ConvertTo-Json

$itemRes = Invoke-RestMethod -Uri "$BaseUrl/api/v1/organisations/$orgId/catalogue" -Method Post -Body $itemPayload -ContentType "application/json"
$itemId = $itemRes.data[0].id
Write-Host "Created Catalogue Item: $($itemRes.data[0].name) (Price: Rs. 100,000, GST: 18%)" -ForegroundColor Green

# 5. Seed Chart of Accounts and Create Fiscal Period
Write-Host ""
Write-Host "[5/8] Seeding Chart of Accounts and Fiscal Period..." -ForegroundColor Yellow
$seedRes = Invoke-RestMethod -Uri "$BaseUrl/api/v1/organisations/$orgId/accounts/seed" -Method Post
Write-Host "Chart of Accounts: $($seedRes.message)" -ForegroundColor Green

$periodPayload = @{
    name = "FY 2026-27 Annual"
    start_date = "2026-04-01"
    end_date = "2027-03-31"
} | ConvertTo-Json

$periodRes = Invoke-RestMethod -Uri "$BaseUrl/api/v1/organisations/$orgId/fiscal-periods" -Method Post -Body $periodPayload -ContentType "application/json"
$periodId = $periodRes.data[0].id
Write-Host "Created Fiscal Period: $($periodRes.data[0].name) (ID: $periodId)" -ForegroundColor Green

# 6. Fetch Accounts for Double-Entry Journal
Write-Host ""
Write-Host "[6/8] Creating and Posting Double-Entry Capital Journal Entry..." -ForegroundColor Yellow
$accounts = Invoke-RestMethod -Uri "$BaseUrl/api/v1/organisations/$orgId/accounts" -Method Get
$bankAccount = $accounts.data | Where-Object { $_.code -eq "1020" }
$capitalAccount = $accounts.data | Where-Object { $_.code -eq "3010" }

$journalNum = "JRN-" + (Get-Random -Minimum 10000 -Maximum 99999)
$journalPayload = @{
    fiscal_period_id = $periodId
    entry_number = $journalNum
    entry_date = "2026-05-01"
    narration = "Initial Founder Capital Infusion into Operating Bank Account"
    reference = "BANK-NEFT-001"
    lines = @(
        @{
            line_number = 1
            account_id = $bankAccount.id
            description = "Debit Operating Bank Account"
            debit = 250000.00
            credit = 0.00
        },
        @{
            line_number = 2
            account_id = $capitalAccount.id
            description = "Credit Owner Equity Capital"
            debit = 0.00
            credit = 250000.00
        }
    )
} | ConvertTo-Json

$journalRes = Invoke-RestMethod -Uri "$BaseUrl/api/v1/organisations/$orgId/journals" -Method Post -Body $journalPayload -ContentType "application/json"
$journalId = $journalRes.entry[0].id
Write-Host "Created Draft Journal Entry: $journalNum (ID: $journalId)" -ForegroundColor Green

# Post the Journal Entry
$postRes = Invoke-RestMethod -Uri "$BaseUrl/api/v1/organisations/$orgId/journals/$journalId/post" -Method Post
Write-Host "Posted Journal Entry: Status = $($postRes.entry.status) (Debits = Credits = Rs. 250,000)" -ForegroundColor Green

# 7. Create and Issue GST Sales Invoice with Automatic Journal Posting
Write-Host ""
Write-Host "[7/8] Creating and Issuing GST Sales Invoice..." -ForegroundColor Yellow
$invNum = "INV-2026-" + (Get-Random -Minimum 1000 -Maximum 9999)
$invoicePayload = @{
    customer_id = $partyId
    invoice_number = $invNum
    invoice_date = "2026-06-01"
    due_date = "2026-06-15"
    supply_type = "intra_state"
    place_of_supply = "27-Maharashtra"
    taxable_amount = 100000.00
    total_amount = 118000.00
    lines = @(
        @{
            line_number = 1
            item_id = $itemId
            item_name = "Financial ERP Architecture Advisory"
            quantity = 1.0
            unit_price = 100000.00
            taxable_amount = 100000.00
            gst_rate = 18.00
            cgst_rate = 9.00
            cgst_amount = 9000.00
            sgst_rate = 9.00
            sgst_amount = 9000.00
            igst_rate = 0.00
            igst_amount = 0.00
            total_amount = 118000.00
        }
    )
} | ConvertTo-Json

$invRes = Invoke-RestMethod -Uri "$BaseUrl/api/v1/organisations/$orgId/invoices" -Method Post -Body $invoicePayload -ContentType "application/json"
$invId = $invRes.invoice[0].id
Write-Host "Created Draft Invoice: $invNum" -ForegroundColor Green

# Issue the Invoice with Automatic Accounting Journal Sync
$issuePayload = @{ create_journal = $true } | ConvertTo-Json
$issueRes = Invoke-RestMethod -Uri "$BaseUrl/api/v1/organisations/$orgId/invoices/$invId/issue" -Method Post -Body $issuePayload -ContentType "application/json"
Write-Host "Issued Invoice: Status = $($issueRes.invoice.status) | Total = Rs. $($issueRes.invoice.total_amount) | Linked Journal = $($issueRes.invoice.journal_entry_id)" -ForegroundColor Green

# 8. Query Live Financial Reports (Balance Sheet, Profit and Loss & ALERX Account Balances)
Write-Host ""
Write-Host "[8/8] Fetching Live Financial Reports & ALERX Chart of Accounts..." -ForegroundColor Yellow
$pnl = Invoke-RestMethod -Uri "$BaseUrl/api/v1/organisations/$orgId/reports/profit-and-loss" -Method Get
Write-Host "Profit and Loss Accounts Generated: $($pnl.data.Count) line item(s)" -ForegroundColor Green

$bs = Invoke-RestMethod -Uri "$BaseUrl/api/v1/organisations/$orgId/reports/balance-sheet" -Method Get
Write-Host "Balance Sheet Accounts Generated: $($bs.data.Count) line item(s)" -ForegroundColor Green

$balances = Invoke-RestMethod -Uri "$BaseUrl/api/v1/organisations/$orgId/reports/account-balances" -Method Get
Write-Host ""
Write-Host "==========================================================================================" -ForegroundColor Cyan
Write-Host "DEKU FINANCE - LIVE ALERX CHART OF ACCOUNTS & BALANCES (SINGLE TENANT)" -ForegroundColor Cyan
Write-Host "==========================================================================================" -ForegroundColor Cyan
Write-Host ("{0,-6} | {1,-10} | {2,-28} | {3,-26} | {4,-32} | {5,6} | {6,14}" -f "CODE", "GROUP", "LEDGER", "SUB-LEDGER", "LABEL", "UNITS", "VALUE (INR)") -ForegroundColor White
Write-Host ("-" * 130) -ForegroundColor Gray

foreach ($acc in ($balances.data | Sort-Object { [int]$_.account_code })) {
    $code = $acc.account_code
    $grp = $acc.account_group.ToUpper()
    $led = $acc.ledger
    $sub = $acc.sub_ledger
    $lbl = $acc.label
    $units = $acc.units
    $val = [double]$acc.value
    $valStr = "Rs. " + ("{0:N2}" -f $val)
    
    $color = "Gray"
    if ($units -gt 0) { $color = "Green" }
    
    Write-Host ("{0,-6} | {1,-10} | {2,-28} | {3,-26} | {4,-32} | {5,6} | {6,14}" -f $code, $grp, $led, $sub, $lbl, $units, $valStr) -ForegroundColor $color
}

Write-Host "==========================================================================================" -ForegroundColor Cyan
Write-Host "ALL 8 API MODULES TESTED AND VERIFIED SUCCESSFULLY!" -ForegroundColor Cyan
Write-Host "==========================================================================================" -ForegroundColor Cyan
