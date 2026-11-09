import { NextRequest, NextResponse } from "next/server";
import { routeInboundClientLead } from "@/lib/ecosystem/store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clientName,
      clientPhone,
      clientEmail,
      companyName,
      gstinOrPan,
      stateCode,
      stateName,
      city,
      pincode,
    } = body;

    if (!clientName || !clientPhone || !clientEmail || !companyName || !stateName || !pincode) {
      return NextResponse.json(
        {
          success: false,
          error: "Full name, contact phone, business email, company name, state, and pincode are required.",
        },
        { status: 400 }
      );
    }

    const lead = routeInboundClientLead({
      clientName,
      clientPhone,
      clientEmail,
      companyName,
      gstinOrPan,
      stateCode: stateCode || "27",
      stateName,
      city: city || "",
      pincode,
    });

    return NextResponse.json({
      success: true,
      message:
        "Your setup request has been registered and routed to your regional authorised distributor.",
      lead,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to submit onboarding request" },
      { status: 500 }
    );
  }
}

