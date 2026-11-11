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

    // Public endpoint: cap every field so a bad actor can't fill the lead store with huge strings.
    const fields = [clientName, clientPhone, clientEmail, companyName, gstinOrPan, stateCode, stateName, city, pincode];
    if (fields.some((f) => f != null && (typeof f !== "string" || f.length > 200))) {
      return NextResponse.json({ success: false, error: "One of the fields is too long or not text." }, { status: 400 });
    }

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

