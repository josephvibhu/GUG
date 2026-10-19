import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getCompanyLedger,
  addCompanyLedgerEntry,
  deleteCompanyLedgerEntry,
} from "@/lib/companyLedger";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const res = await getCompanyLedger(ticker);

    if (!res.success) {
      return NextResponse.json({ success: false, message: res.message || "Company not found" }, { status: 404 });
    }

    return NextResponse.json(res);
  } catch (error: any) {
    console.error("GET /api/companies/[ticker]/ledger error:", error);
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

    if (action === "add") {
      const { entryType, category, amount, description, entryDate } = body;
      const res = await addCompanyLedgerEntry(user.id, !!user.isAdmin, ticker, {
        entryType,
        category,
        amount: Number(amount),
        description,
        entryDate,
      });

      return NextResponse.json(res, { status: res.success ? 200 : 400 });
    }

    if (action === "delete") {
      const { entryId } = body;
      if (!entryId) {
        return NextResponse.json({ success: false, message: "Entry ID is required." }, { status: 400 });
      }

      const res = await deleteCompanyLedgerEntry(user.id, !!user.isAdmin, String(entryId));
      return NextResponse.json(res, { status: res.success ? 200 : 400 });
    }

    return NextResponse.json({ success: false, message: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/companies/[ticker]/ledger error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
