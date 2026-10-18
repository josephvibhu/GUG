import { NextResponse } from "next/server";
import { pulseMarketBots } from "@/lib/engine";

export async function POST() {
  try {
    const result = await pulseMarketBots();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
