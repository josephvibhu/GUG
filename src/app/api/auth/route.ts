import { NextResponse } from "next/server";
import { getCurrentUser, loginUser, registerUser, acceptTerms, dismissAdjustmentNotice, changePassword, resetPasswordWithCode } from "@/lib/auth";
import { seedMarketData } from "@/lib/seed";


export async function GET() {
  try {
    await seedMarketData();
    const user = await getCurrentUser();
    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// The caller's address as Vercel reports it, for the wrong-password limit
function clientIp(request: Request): string {
  return (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  try {
    await seedMarketData();
    const body = await request.json();
    const { action } = body;

    if (action === "login") {
      const { username, password } = body;
      const res = await loginUser(username, password, clientIp(request));
      return NextResponse.json(res);
    }

    if (action === "register") {
      const { username, password, adminCode, acceptedTerms } = body;
      const res = await registerUser(username, password, adminCode, acceptedTerms);
      return NextResponse.json(res);
    }

    if (action === "change_password") {
      const { username, currentPassword, newPassword } = body;
      const res = await changePassword(String(username || ""), String(currentPassword || ""), String(newPassword || ""), clientIp(request));
      return NextResponse.json(res, { status: res.success ? 200 : 400 });
    }

    if (action === "reset_password") {
      const { username, code, newPassword } = body;
      const res = await resetPasswordWithCode(String(username || ""), String(code || ""), String(newPassword || ""), clientIp(request));
      return NextResponse.json(res, { status: res.success ? 200 : 400 });
    }

    if (action === "accept_terms") {
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ success: false, message: "Not logged in" }, { status: 401 });
      }
      await acceptTerms(user.id);
      return NextResponse.json({ success: true, message: "Terms accepted" });
    }

    if (action === "dismiss_adjustment_notice") {
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ success: false, message: "Not logged in" }, { status: 401 });
      }
      await dismissAdjustmentNotice(user.id);
      return NextResponse.json({ success: true, message: "Adjustment notice dismissed" });
    }

    if (action === "logout") {
      const { logoutUser } = await import("@/lib/auth");
      await logoutUser();
      return NextResponse.json({ success: true, message: "Logged out successfully" });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("API /api/auth error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
