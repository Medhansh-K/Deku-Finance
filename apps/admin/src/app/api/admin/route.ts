import { NextRequest, NextResponse } from "next/server";
import {
  getEcosystemStore,
  addPlatformAdmin,
  toggleAdminStatus,
  createDistributor,
  approveLicenseRequest,
  rejectLicenseRequest,
} from "@/lib/store";

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
        return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
      }
      const admin = addPlatformAdmin({ email, fullName, role, createdBy });
      return NextResponse.json({ success: true, admin });
    }

    if (action === "toggle_admin") {
      const { adminId, isActive } = body;
      const admin = toggleAdminStatus(adminId, Boolean(isActive));
      return NextResponse.json({ success: true, admin });
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
      if (!name || !companyName || !email) {
        return NextResponse.json({ success: false, error: "Missing distributor fields" }, { status: 400 });
      }
      const distributor = createDistributor({
        name,
        companyName,
        email,
        phone,
        assignedStates,
        assignedPincodes,
        allocatedSeatQuota,
        availableServiceCredits,
      });
      return NextResponse.json({ success: true, distributor });
    }

    if (action === "approve_license") {
      const { requestId, reviewerEmail } = body;
      const res = approveLicenseRequest(requestId, reviewerEmail || "medhanshk10@gmail.com");
      if (!res) {
        return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, license: res.license, request: res.request });
    }

    if (action === "reject_license") {
      const { requestId, reviewerEmail, reason } = body;
      const res = rejectLicenseRequest(requestId, reviewerEmail || "medhanshk10@gmail.com", reason || "Documentation criteria not met");
      if (!res) {
        return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, request: res });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process admin action" },
      { status: 500 }
    );
  }
}
