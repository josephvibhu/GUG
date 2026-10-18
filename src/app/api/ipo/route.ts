import { NextResponse } from "next/server";
import { submitIPOApplication, getUserIPOApplications } from "@/lib/market";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, applications: [] });
    }

    const applications = await getUserIPOApplications(user.id);
    return NextResponse.json({ success: true, applications });
  } catch (error: any) {
    console.error("GET /api/ipo error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Please log in to apply for an IPO charter" }, { status: 401 });
    }

    const body = await request.json();
    const { 
      ticker, 
      name, 
      description, 
      sector, 
      proposedTotalShares, 
      proposedIpoPrice, 
      proposedFounderRetainPercent, 
      logoUrl, 
      parlamentumName 
    } = body;

    if (!ticker || !name || !description || !sector || !proposedTotalShares || !proposedIpoPrice) {
      return NextResponse.json({ success: false, message: "All IPO charter request fields are required" }, { status: 400 });
    }

    const res = await submitIPOApplication({
      userId: user.id,
      parlamentumName: (parlamentumName || user.parlamentumName || user.username).trim(),
      ticker,
      name,
      description,
      sector,
      proposedTotalShares: Number(proposedTotalShares),
      proposedIpoPrice: Number(proposedIpoPrice),
      proposedFounderRetainPercent: Number(proposedFounderRetainPercent) || 50,
      logoUrl: logoUrl || "🏛️",
    });

    return NextResponse.json(res);
  } catch (error: any) {
    console.error("API /api/ipo error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
