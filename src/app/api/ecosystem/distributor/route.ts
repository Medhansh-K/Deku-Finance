import { NextRequest, NextResponse } from "next/server";
import {
  getEcosystemStore,
  submitLicenseRequest,
  provisionSeatsByDistributor,
  provisionServiceByDistributor,
} from "@/lib/ecosystem/store";

export async function GET(req: NextRequest) {
  try {
    const store = getEcosystemStore();
    const { searchParams } = new URL(req.url);
    const distributorId = searchParams.get("distributorId") || "dist-mh-01";

    const dist = store.distributors.find((d) => d.id === distributorId || d.distributorCode === distributorId);

    if (!dist) {
      return NextResponse.json(
        { success: false, error: "Distributor not found" },
        { status: 404 }
      );
    }

    const assignedLeads = store.onboardingRequests.filter(
      (r) => r.assignedDistributorId === dist.id
    );

    const requests = store.licenseRequests.filter((r) => r.distributorId === dist.id);

    const clientLicenses = store.licenses.filter(
      (l) => l.distributorId === dist.id
    );

    return NextResponse.json({
      success: true,
      distributor: dist,
      leads: assignedLeads,
      requests,
      clientLicenses,
      quota: {
        allocatedSeatQuota: dist.allocatedSeatQuota,
        availableServiceCredits: dist.availableServiceCredits,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch distributor data" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "submit_license_request") {
      const {
        distributorId,
        clientName,
        clientEmail,
        clientPhone,
        companyName,
        gstin,
        requestType,
        planTier,
        moduleName,
        proofDocumentType,
        proofDocumentNumber,
        proofFileName,
        proofAmount,
      } = body;

      // Condition 1 & Condition 2 validation
      if (!distributorId || !clientName || !clientEmail || !companyName) {
        return NextResponse.json(
          { success: false, error: "Client and company details are required" },
          { status: 400 }
        );
      }

      if (!proofDocumentType || !proofDocumentNumber || !proofFileName) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Condition 2 Unmet: A verified copy of Invoice, MoU, or Quote with document number is strictly required to issue an activation license.",
          },
          { status: 400 }
        );
      }

      const newRequest = submitLicenseRequest({
        distributorId,
        clientName,
        clientEmail,
        clientPhone: clientPhone || "",
        companyName,
        gstin,
        requestType: requestType || "activation",
        planTier: planTier || "pro",
        moduleName,
        proofDocumentType,
        proofDocumentNumber,
        proofFileName,
        proofAmount: Number(proofAmount) || 0,
      });

      return NextResponse.json({
        success: true,
        message: "Request submitted and queued for Deku Admin commercial verification",
        request: newRequest,
      });
    }

    if (action === "provision_seats") {
      const { distributorId, clientEmail, companyName, extraSeatsCount } = body;
      const count = Number(extraSeatsCount);
      if (isNaN(count) || count <= 0) {
        return NextResponse.json(
          { success: false, error: "Invalid seat count" },
          { status: 400 }
        );
      }

      const res = provisionSeatsByDistributor(distributorId, clientEmail, companyName, count);
      return NextResponse.json({
        success: true,
        message: `Successfully provisioned ${count} extra seats`,
        result: res,
      });
    }

    if (action === "provision_service") {
      const {
        distributorId,
        clientEmail,
        companyName,
        serviceDescription,
        creditsUsed,
      } = body;

      const credits = Number(creditsUsed) || 10;
      const res = provisionServiceByDistributor(
        distributorId,
        clientEmail,
        companyName,
        serviceDescription || "Implementation & CA Training Service",
        credits
      );

      return NextResponse.json({
        success: true,
        message: "Service add-on provisioned successfully",
        result: res,
      });
    }

    if (action === "update_lead_status") {
      const { leadId, status, notes } = body;
      const store = getEcosystemStore();
      const lead = store.onboardingRequests.find((l) => l.id === leadId);
      if (!lead) {
        return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
      }
      if (status) lead.status = status;
      if (notes) lead.notes = notes;
      return NextResponse.json({ success: true, lead });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process distributor request" },
      { status: 400 }
    );
  }
}

