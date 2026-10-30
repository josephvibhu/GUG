import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getCompanyMotions,
  createCompanyMotion,
  castMotionVote,
} from "@/lib/governance";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const user = await getCurrentUser();
    const data = await getCompanyMotions(ticker, user?.id);

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error: any) {
    console.error("GET /api/companies/[ticker]/motions error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Please log in first." }, { status: 401 });
    }

    const { ticker } = await params;
    const body = await request.json();
    const { action } = body;

    if (action === "create") {
      const { title, description, quorumPct, durationDays } = body;
      const res = await createCompanyMotion({
        ticker,
        userId: user.id,
        userName: user.username,
        title,
        description,
        quorumPct: Number(quorumPct) || 10,
        durationDays: Number(durationDays) || 3,
      });

      if (!res.success) {
        return NextResponse.json({ success: false, message: res.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, motionId: res.motionId });
    }

    if (action === "vote") {
      const { motionId, choice } = body;
      if (!choice || !["YES", "NO", "ABSTAIN"].includes(choice)) {
        return NextResponse.json({ success: false, message: "Invalid vote choice." }, { status: 400 });
      }

      const res = await castMotionVote({
        motionId,
        userId: user.id,
        userName: user.username,
        choice,
      });

      if (!res.success) {
        return NextResponse.json({ success: false, message: res.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, sharesVoted: res.sharesVoted });
    }

    return NextResponse.json({ success: false, message: "Unknown action." }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/companies/[ticker]/motions error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
