import { NextRequest, NextResponse } from "next/server";
import { validateLicenseForLogin } from "@/lib/ecosystem/store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { licenseKey, email } = body;

    if (!licenseKey || !email) {
      return NextResponse.json(
        { success: false, error: "License key and email are required to validate access." },
        { status: 400 }
      );
    }

    const check = validateLicenseForLogin(licenseKey, email);

    if (!check.valid) {
      return NextResponse.json(
        {
          success: false,
          error: check.message,
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      license: check.license,
      message: check.message,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "License validation failed" },
      { status: 500 }
    );
  }
}

