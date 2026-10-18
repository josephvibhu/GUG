import { NextResponse } from "next/server";
import { getCurrentUser, loginUser, registerUser, switchDemoUser, depositCash } from "@/lib/auth";
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

export async function POST(request: Request) {
  try {
    await seedMarketData();
    const body = await request.json();
    const { action } = body;

    if (action === "login") {
      const { username, password } = body;
      const res = await loginUser(username, password);
      return NextResponse.json(res);
    }

    if (action === "register") {
      const { username, password, adminCode, accountType, stateInfo } = body;
      const res = await registerUser(username, password, adminCode, accountType, stateInfo);
      return NextResponse.json(res);
    }

    if (action === "logout") {
      const { logoutUser } = await import("@/lib/auth");
      await logoutUser();
      return NextResponse.json({ success: true, message: "Logged out successfully" });
    }

    if (action === "switch") {
      const { userId } = body;
      await switchDemoUser(userId);
      const user = await getCurrentUser();
      return NextResponse.json({ success: true, user });
    }

    if (action === "deposit") {
      const user = await getCurrentUser();
      if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
      const amount = Number(body.amount) || 5000;
      await depositCash(user.id, amount);
      const updated = await getCurrentUser();
      return NextResponse.json({ success: true, user: updated, message: `Deposited Ᵽ${amount.toLocaleString()} into your treasury account!` });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("API /api/auth error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
