import { describe, it, expect } from "vitest";
import {
  getEcosystemStore,
  addPlatformAdmin,
  toggleAdminStatus,
  createDistributor,
  submitLicenseRequest,
  approveLicenseRequest,
  rejectLicenseRequest,
  provisionSeatsByDistributor,
  provisionServiceByDistributor,
  routeInboundClientLead,
  validateLicenseForLogin,
} from "@/lib/ecosystem/store";

describe("Commercial 3-Tier Ecosystem Architecture & Governance", () => {
  it("initializes master super-admin as medhanshk10@gmail.com and allows adding sub-admins", () => {
    const store = getEcosystemStore();
    const masterAdmin = store.admins.find((a) => a.email === "medhanshk10@gmail.com");
    expect(masterAdmin).toBeDefined();
    expect(masterAdmin?.role).toBe("super_admin");

    // Medhansh adds another admin
    const newAdmin = addPlatformAdmin({
      email: "subadmin.finance@deku.finance",
      fullName: "Sub-Admin Associate",
      role: "license_manager",
      createdBy: "medhanshk10@gmail.com",
    });

    expect(newAdmin.email).toBe("subadmin.finance@deku.finance");
    expect(store.admins.some((a) => a.email === "subadmin.finance@deku.finance")).toBe(true);

    // Prevent deactivating master super-admin
    expect(() => toggleAdminStatus(masterAdmin!.id, false)).toThrow(
      "Cannot deactivate master super-admin account"
    );
  });

  it("registers regional distributors with territory coverage and quotas", () => {
    const newDist = createDistributor({
      name: "Pradeep Joshi",
      companyName: "Gujarat Cloud ERP Systems",
      email: "pradeep@gujaratclouderp.in",
      phone: "+91 98980 11223",
      assignedStates: ["24", "Gujarat"],
      assignedPincodes: ["380001", "380015"],
      allocatedSeatQuota: 30,
      availableServiceCredits: 60,
    });

    expect(newDist.distributorCode).toContain("DIST-24");
    expect(newDist.allocatedSeatQuota).toBe(30);
    expect(newDist.availableServiceCredits).toBe(60);
  });

  it("enforces dual-gate rule: requires both distributor request & commercial invoice/MoU proof", () => {
    // 1. Distributor submits request with Condition 2 commercial document proof
    const request = submitLicenseRequest({
      distributorId: "dist-mh-01",
      clientName: "Vikram Kothari",
      clientEmail: "vikram@kothariindustries.com",
      clientPhone: "+91 98200 44556",
      companyName: "Kothari Heavy Industries LLP",
      gstin: "27AAACK1122C1Z4",
      requestType: "activation",
      planTier: "pro",
      proofDocumentType: "invoice",
      proofDocumentNumber: "MHTECH-INV-2026-901",
      proofFileName: "Kothari_Enterprise_Annual_Tax_Invoice.pdf",
      proofAmount: 49999,
    });

    expect(request.status).toBe("pending_verification");
    expect(request.proofDocumentType).toBe("invoice");
    expect(request.proofAmount).toBe(49999);

    // 2. Deku Admin verifies commercial proof document and approves license
    const { request: approvedReq, license } = approveLicenseRequest(
      request.id,
      "medhanshk10@gmail.com"
    );

    expect(approvedReq.status).toBe("approved_issued");
    expect(license.licenseKey).toMatch(/^DEKU-PRO-2026-[A-F0-9]{4}-[A-F0-9]{4}$/);
    expect(license.managedBy).toBe("company_admin");
    expect(license.assignedClientEmail).toBe("vikram@kothariindustries.com");

    // 3. User can now validate key for login
    const loginValidation = validateLicenseForLogin(
      license.licenseKey,
      "vikram@kothariindustries.com"
    );
    expect(loginValidation.valid).toBe(true);
  });

  it("supports Sub-Type B (extra seats) managed self-service by distributor within quota", () => {
    const store = getEcosystemStore();
    const dist = store.distributors.find((d) => d.id === "dist-mh-01")!;
    const initialQuota = dist.allocatedSeatQuota;

    const { distributor, license } = provisionSeatsByDistributor(
      dist.id,
      "ananya@solardigital.in",
      "Solar Digital Technologies Pvt Ltd",
      3
    );

    expect(distributor.allocatedSeatQuota).toBe(initialQuota - 3);
    expect(license.addOnCategory).toBe("seat");
    expect(license.extraSeatsCount).toBe(3);
    expect(license.managedBy).toBe("distributor");
    // Visible in global registry
    expect(store.licenses.some((l) => l.id === license.id)).toBe(true);
  });

  it("supports Sub-Type C (implementation services) managed by distributor", () => {
    const store = getEcosystemStore();
    const dist = store.distributors.find((d) => d.id === "dist-mh-01")!;
    const initialCredits = dist.availableServiceCredits;

    const { distributor, license } = provisionServiceByDistributor(
      dist.id,
      "ananya@solardigital.in",
      "Solar Digital Technologies Pvt Ltd",
      "Tally Prime Chart of Accounts Ingestion & CA Audit Training",
      15
    );

    expect(distributor.availableServiceCredits).toBe(initialCredits - 15);
    expect(license.addOnCategory).toBe("service");
    expect(license.managedBy).toBe("distributor");
    expect(license.serviceDescription).toContain("Tally Prime");
  });

  it("routes inbound client onboarding requests to the correct territory distributor by state/pincode", () => {
    const lead = routeInboundClientLead({
      clientName: "Rahul Bajaj",
      clientPhone: "+91 98200 99887",
      clientEmail: "rahul@bajajfin.in",
      companyName: "Bajaj Financial Advisors LLP",
      stateCode: "27",
      stateName: "Maharashtra",
      city: "Pune",
      pincode: "411001",
    });

    expect(lead.assignedDistributorId).toBe("dist-mh-01");
    expect(lead.assignedDistributorName).toBe("Maharashtra Tech Enterprise Solutions");
    expect(lead.status).toBe("pending");
  });
});
