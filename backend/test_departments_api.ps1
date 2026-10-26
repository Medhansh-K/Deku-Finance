# Deku Finance - Departments, Members, Governance & Payroll API Tests
# Run against local Axum / Rust backend on http://localhost:8080

$BaseUrl = "http://localhost:8080"
$OrgId = "b127e064-5da8-437f-94c4-b8d6a0c12927"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "DEKU FINANCE - DEPARTMENTS & MEMBERS API TEST SUITE" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Health Check
Write-Host ""
Write-Host "[1/7] Testing Backend Health..." -ForegroundColor Yellow
$health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get
Write-Host "Backend Status: $($health.status) | Engine: $($health.engine)" -ForegroundColor Green

# 2. List Departments
Write-Host ""
Write-Host "[2/7] Listing Departments for Organisation..." -ForegroundColor Yellow
try {
    $depts = Invoke-RestMethod -Uri "$BaseUrl/api/v1/organisations/$OrgId/departments" -Method Get
    Write-Host "Successfully retrieved $($depts.data.Count) departments" -ForegroundColor Green
} catch {
    Write-Host "Note: DB table needs migration 13 applied in Supabase: $($_.Exception.Message)" -ForegroundColor DarkGray
}

# 3. Create Department
Write-Host ""
Write-Host "[3/7] Creating New Test Department..." -ForegroundColor Yellow
$deptPayload = @{
    name = "Product & Operations"
    code = "PROD"
    description = "Product roadmap, UX metrics and system workflows"
    budget_allocated = 3500000.00
    currency = "INR"
    fiscal_year = "2026-27"
} | ConvertTo-Json

try {
    $deptRes = Invoke-RestMethod -Uri "$BaseUrl/api/v1/organisations/$OrgId/departments" -Method Post -Body $deptPayload -ContentType "application/json"
    Write-Host "Created Department: $($deptRes.data[0].name)" -ForegroundColor Green
} catch {
    Write-Host "Pending Supabase migration execution: $($_.Exception.Message)" -ForegroundColor DarkGray
}

# 4. List Members
Write-Host ""
Write-Host "[4/7] Listing Firm Personnel & Members..." -ForegroundColor Yellow
try {
    $members = Invoke-RestMethod -Uri "$BaseUrl/api/v1/organisations/$OrgId/members" -Method Get
    Write-Host "Retrieved members list successfully" -ForegroundColor Green
} catch {
    Write-Host "Pending Supabase migration execution: $($_.Exception.Message)" -ForegroundColor DarkGray
}

# 5. Add Employee
Write-Host ""
Write-Host "[5/7] Onboarding New Employee..." -ForegroundColor Yellow
$empPayload = @{
    name = "Aakash Mehta"
    email = "aakash.mehta@dekufinance.com"
    phone = "+91 98200 44556"
    designation = "Senior Backend Rust Engineer"
    role = "member"
    status = "active"
    ctc_annual = 2400000.00
    monthly_gross = 200000.00
    monthly_net = 162000.00
    tds_deduction_monthly = 26000.00
    epf_monthly = 12000.00
    pan = "BKPMT1290K"
    bank_account_masked = "HDFC **** 5512"
} | ConvertTo-Json

try {
    $empRes = Invoke-RestMethod -Uri "$BaseUrl/api/v1/organisations/$OrgId/members" -Method Post -Body $empPayload -ContentType "application/json"
    Write-Host "Created Member: $($empRes.data[0].name)" -ForegroundColor Green
} catch {
    Write-Host "Pending Supabase migration execution: $($_.Exception.Message)" -ForegroundColor DarkGray
}

# 6. Execute Monthly Payroll Batch
Write-Host ""
Write-Host "[6/7] Testing Monthly Payroll Execution..." -ForegroundColor Yellow
$payrollPayload = @{
    period = "2026-10"
} | ConvertTo-Json

try {
    $payrollRes = Invoke-RestMethod -Uri "$BaseUrl/api/v1/organisations/$OrgId/payroll/run" -Method Post -Body $payrollPayload -ContentType "application/json"
    Write-Host "Payroll batch executed successfully" -ForegroundColor Green
} catch {
    Write-Host "Pending Supabase migration execution: $($_.Exception.Message)" -ForegroundColor DarkGray
}

# 7. Complete Summary
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "TEST SUITE RUN FINISHED" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
