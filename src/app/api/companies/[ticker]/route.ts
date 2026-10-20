import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { moveFounderGold, updateCompanyProfile } from "@/lib/companyTreasury";

// Founder actions on a listed company: move gold between purse and treasury, edit the company profile
export async function POST(request: Request, { params }: { params: Promise<{ ticker: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Please log in first." }, { status: 401 });
    }

    const { ticker } = await params;
    const body = await request.json().catch(() => ({}));

    if (body.action === "move_gold") {
      const res = await moveFounderGold({
        userId: user.id,
        ticker,
        direction: body.direction,
        amount: Number(body.amount),
        note: typeof body.note === "string" ? body.note : undefined,
      });
      return NextResponse.json(res, { status: res.success ? 200 : 400 });
    }

    if (body.action === "update_profile") {
      const pick = (k: string) => (body[k] === undefined ? undefined : body[k]);
      const res = await updateCompanyProfile({
        userId: user.id,
        isAdmin: !!user.isAdmin,
        ticker,
        update: {
          name: pick("name"),
          description: pick("description"),
          sector: pick("sector"),
          logoUrl: pick("logoUrl"),
          weeklyRevenue: body.weeklyRevenue === undefined ? undefined : Number(body.weeklyRevenue),
          discordHandle: pick("discordHandle"),
        },
      });
      return NextResponse.json(res, { status: res.success ? 200 : 400 });
    }

    return NextResponse.json({ success: false, message: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("POST /api/companies/[ticker] error:", error);
    return NextResponse.json({ success: false, message: "Something went wrong. Try again." }, { status: 500 });
  }
}
