import { NextResponse } from "next/server";
import { pulseMarketBots } from "@/lib/engine";
import { getCurrentUser } from "@/lib/auth";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ success: false, message: "Operator only." }, { status: 403 });
    }
    const result = await pulseMarketBots();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
