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

    if (user.isManager) {
      return NextResponse.json({ success: false, message: "Manager accounts cannot apply for or start an IPO." }, { status: 403 });
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
      parlamentumName,
      discordId,
      businessType,
      weeklyRevenue,
      factoryLevel,
      workersCount,
      productionOutput,
      pressViewers,
      pressFrequency,
      specialNotes,
    } = body;

    if (!ticker || !name || !description || !sector || !proposedTotalShares || !proposedIpoPrice) {
      return NextResponse.json({ success: false, message: "All IPO charter core fields are required." }, { status: 400 });
    }

    if (!discordId || !discordId.trim()) {
      return NextResponse.json({ success: false, message: "Please provide your Discord ID (e.g. username) so the High Registrar can coordinate your listing." }, { status: 400 });
    }

    let retainPercent = 50;
    if (proposedFounderRetainPercent !== undefined && !isNaN(Number(proposedFounderRetainPercent))) {
      retainPercent = Number(proposedFounderRetainPercent);
    } else if (body.proposedFloatPercent !== undefined && !isNaN(Number(body.proposedFloatPercent))) {
      retainPercent = 100 - Number(body.proposedFloatPercent);
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
      proposedFounderRetainPercent: retainPercent,
      logoUrl: logoUrl || "🏛️",
      discordId: discordId.trim(),
      businessType: businessType || "FACTORY",
      weeklyRevenue: weeklyRevenue !== undefined && !isNaN(Number(weeklyRevenue)) ? Math.max(0, Number(weeklyRevenue)) : 0,
      factoryLevel: factoryLevel !== undefined && !isNaN(Number(factoryLevel)) ? Number(factoryLevel) : undefined,
      workersCount: workersCount !== undefined && !isNaN(Number(workersCount)) ? Number(workersCount) : undefined,
      productionOutput: productionOutput ? String(productionOutput).trim() : undefined,
      pressViewers: pressViewers ? String(pressViewers).trim() : undefined,
      pressFrequency: pressFrequency ? String(pressFrequency).trim() : undefined,
      specialNotes: specialNotes ? String(specialNotes).trim() : undefined,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    console.error("API /api/ipo error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
