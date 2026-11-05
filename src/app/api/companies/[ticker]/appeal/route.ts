import { NextResponse } from "next/server";
import { getDb, initDb, scheduleBlobPersist } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  request: Request,
  props: { params: Promise<{ ticker: string }> }
) {
  try {
    await initDb();
    const db = getDb();
    const { ticker } = await props.params;
    const tickerUpper = ticker.toUpperCase();

    const compRes = await db.execute({
      sql: "SELECT id, ticker, name, creator_id, status FROM companies WHERE UPPER(ticker) = ?",
      args: [tickerUpper],
    });

    if (compRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Company not found" }, { status: 404 });
    }

    const company = compRes.rows[0];
    const user = await getCurrentUser();

    // Fetch decree settings
    const decreeRes = await db.execute({
      sql: "SELECT value FROM settings WHERE key = ?",
      args: [`${tickerUpper.toLowerCase()}_liquidation_decree`],
    });
    const decree = decreeRes.rows[0]?.value ? JSON.parse(String(decreeRes.rows[0].value)) : null;

    // Fetch existing appeal
    const appealRes = await db.execute({
      sql: "SELECT value FROM settings WHERE key = ?",
      args: [`${tickerUpper.toLowerCase()}_founder_appeal`],
    });
    const appeal = appealRes.rows[0]?.value ? JSON.parse(String(appealRes.rows[0].value)) : null;

    let isFounder = false;
    let shareholderPayout: { shares: number; amount: number; txId: string } | null = null;

    if (user) {
      isFounder = String(user.id) === String(company.creator_id);

      // Check if user was a public shareholder who received liquidation payout
      const txRes = await db.execute({
        sql: `
          SELECT * FROM wallet_transactions 
          WHERE user_id = ? AND method = 'LIQUIDATION_RESTITUTION' AND recipe_note LIKE ?
          ORDER BY created_at DESC LIMIT 1
        `,
        args: [user.id, `%${tickerUpper}%`],
      });

      if (txRes.rows.length > 0) {
        const tx = txRes.rows[0];
        // Parse share count from recipe_note: e.g. "$DC Dissolution Payout: 39 shares liquidated..."
        const match = String(tx.recipe_note).match(/(\d+)\s+shares/);
        shareholderPayout = {
          shares: match ? parseInt(match[1], 10) : 0,
          amount: Number(tx.amount || 0),
          txId: String(tx.id),
        };
      }
    }

    return NextResponse.json({
      success: true,
      ticker: tickerUpper,
      companyName: company.name,
      status: company.status,
      decree,
      appeal,
      isFounder,
      shareholderPayout,
    });
  } catch (err: any) {
    console.error("GET appeal error:", err);
    return NextResponse.json({ success: false, message: err?.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ ticker: string }> }
) {
  try {
    await initDb();
    const db = getDb();
    const { ticker } = await props.params;
    const tickerUpper = ticker.toUpperCase();

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Please log in to submit an appeal." }, { status: 401 });
    }

    const compRes = await db.execute({
      sql: "SELECT id, ticker, name, creator_id FROM companies WHERE UPPER(ticker) = ?",
      args: [tickerUpper],
    });

    if (compRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Company not found." }, { status: 404 });
    }

    const company = compRes.rows[0];
    const isFounder = String(user.id) === String(company.creator_id);
    const isAdmin = Boolean(user.isAdmin);

    if (!isFounder && !isAdmin) {
      return NextResponse.json({ success: false, message: "Only the company founder may submit a regulatory appeal." }, { status: 403 });
    }

    const body = await request.json();
    const reason = (body.reason || "").trim();
    const restitutionPlan = (body.restitutionPlan || "").trim();

    if (!reason || reason.length < 15) {
      return NextResponse.json({ success: false, message: "Please provide a detailed explanation (at least 15 characters)." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const appealRecord = {
      ticker: tickerUpper,
      companyId: String(company.id),
      founderId: user.id,
      founderUsername: user.username,
      reason,
      restitutionPlan: restitutionPlan || "None provided",
      status: "PENDING_REVIEW",
      submittedAt: now,
    };

    await db.execute({
      sql: "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      args: [`${tickerUpper.toLowerCase()}_founder_appeal`, JSON.stringify(appealRecord)],
    });

    scheduleBlobPersist();

    // Trigger Discord alert if webhook exists
    try {
      const { sendDiscordEmbed } = await import("@/lib/discord");
      await sendDiscordEmbed({
        title: `⚖️ Regulatory Appeal Filed: $${tickerUpper}`,
        description: `Founder **${user.username}** has formally appealed the dissolution decree for **${company.name}** ($${tickerUpper}).\n\n**Reason:**\n> ${reason}\n\n**Restitution Proposal:**\n> ${restitutionPlan || "Standard appeal"}\n\n*Review in Admin Regulatory Portal.*`,
        color: 0xf59e0b,
      });
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      message: "Your appeal has been formally registered with the Exchange Regulatory Board. Status: PENDING REVIEW.",
      appeal: appealRecord,
    });
  } catch (err: any) {
    console.error("POST appeal error:", err);
    return NextResponse.json({ success: false, message: err?.message || "Failed to submit appeal." }, { status: 500 });
  }
}
