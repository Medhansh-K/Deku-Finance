import { NextRequest, NextResponse } from "next/server";
import {
  getEcosystemStore,
  addPlatformAdmin,
  toggleAdminStatus,
  createDistributor,
  approveLicenseRequest,
  rejectLicenseRequest,
} from "@/lib/ecosystem/store";

export async function GET(req: NextRequest) {
  try {
    const store = getEcosystemStore();

    const totalRevenue = store.licenseRequests
      .filter((r) => r.status === "approved_issued")
      .reduce((sum, r) => sum + (r.proofAmount || 0), 0);

    const pendingRequestsCount = store.licenseRequests.filter(
      (r) => r.status === "pending_verification"
    ).length;

    const activeLicensesCount = store.licenses.filter((l) => l.status === "active").length;
    const totalDistributorsCount = store.distributors.filter((d) => d.status === "active").length;

    return NextResponse.json({
      success: true,
      metrics: {
        totalDistributors: totalDistributorsCount,
        activeLicenses: activeLicensesCount,
        pendingVerifications: pendingRequestsCount,
        totalSalesVolumeINR: totalRevenue,
        inboundLeadsCount: store.onboardingRequests.length,
      },
      admins: store.admins,
      distributors: store.distributors,
      licenseRequests: store.licenseRequests,
      licenses: store.licenses,
      onboardingRequests: store.onboardingRequests,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch admin ecosystem data" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "add_admin") {
      const { email, fullName, role, createdBy } = body;
      if (!email || !fullName) {
        return NextResponse.json(
          { success: false, error: "Email and Full Name are required" },
          { status: 400 }
        );
      }
      const newAdmin = addPlatformAdmin({
        email,
        fullName,
        role: role || "license_manager",
        createdBy: createdBy || "medhanshk10@gmail.com",
      });
      return NextResponse.json({ success: true, admin: newAdmin });
    }

    if (action === "toggle_admin") {
      const { adminId, isActive } = body;
      const updated = toggleAdminStatus(adminId, Boolean(isActive));
      return NextResponse.json({ success: true, admin: updated });
    }

    if (action === "create_distributor") {
      const {
        name,
        companyName,
        email,
        phone,
        assignedStates,
        assignedPincodes,
        allocatedSeatQuota,
        availableServiceCredits,
      } = body;

      const dist = createDistributor({
        name,
        companyName,
        email,
        phone,
        assignedStates: assignedStates || [],
        assignedPincodes: assignedPincodes || [],
        allocatedSeatQuota: Number(allocatedSeatQuota) || 20,
        availableServiceCredits: Number(availableServiceCredits) || 50,
      });

      return NextResponse.json({ success: true, distributor: dist });
    }

    if (action === "approve_request") {
      const { requestId, reviewedBy } = body;
      const result = approveLicenseRequest(requestId, reviewedBy || "medhanshk10@gmail.com");
      return NextResponse.json({
        success: true,
        message: "License generated and issued successfully",
        result,
      });
    }

    if (action === "reject_request") {
      const { requestId, reviewedBy, reason } = body;
      const result = rejectLicenseRequest(
        requestId,
        reviewedBy || "medhanshk10@gmail.com",
        reason || "Incomplete commercial document proof"
      );
      return NextResponse.json({
        success: true,
        message: "License request rejected",
        result,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process request" },
      { status: 400 }
    );
  }
}

