import { NextResponse } from "next/server";
import { getCurrentUser, loginUser, registerUser } from "@/lib/auth";
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
      const { username, password, adminCode } = body;
      const res = await registerUser(username, password, adminCode);
      return NextResponse.json(res);
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
