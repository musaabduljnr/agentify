// app/api/admin/email-config/route.ts
import { requireAdmin } from "@/lib/admin/require-admin";
import { logErrorSync } from "@/lib/monitoring/log-error";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    await request.json();
    return NextResponse.json(
      {
        success: false,
        error: "Email provider secrets must be configured as Vercel environment variables.",
      },
      { status: 501 }
    );
  } catch (err) {
    logErrorSync(err, "email-config");
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }
}
