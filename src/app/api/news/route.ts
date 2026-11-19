import { NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";

export async function GET() {
  try {
    await initDb();
    const db = getDb();

    // 1. Announcements
    const announcementsRes = await db.execute(`
      SELECT a.id, a.title, a.content, a.created_at,
             c.ticker, c.name as company_name, c.logo_url,
             u.display_name, u.username
      FROM announcements a
      JOIN companies c ON a.company_id = c.id
      JOIN users u ON a.author_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 30
    `);

    // 2. Recent earnings / dividend reports
    const earningsRes = await db.execute(`
      SELECT e.id, e.period_title, e.net_profit, e.dividend_pool, e.dividend_per_share,
             e.status, e.scheduled_for, e.distributed_at, e.created_at,
             c.ticker, c.name as company_name, c.logo_url
      FROM earnings_reports e
      JOIN companies c ON e.company_id = c.id
      ORDER BY e.created_at DESC
      LIMIT 20
    `);

    // 3. Recent regulatory decrees / settings announcements
    const decreeRes = await db.execute("SELECT value FROM settings WHERE key = 'dc_liquidation_decree'");
    let decree = null;
    if (decreeRes.rows[0]?.value) {
      try {
        decree = JSON.parse(String(decreeRes.rows[0].value));
      } catch {}
    }

    const announcements = announcementsRes.rows.map((r: any) => ({
      id: String(r.id),
      type: "ANNOUNCEMENT" as const,
      title: String(r.title),
      content: String(r.content),
      ticker: String(r.ticker),
      companyName: String(r.company_name),
      logoUrl: String(r.logo_url || "🏛️"),
      author: String(r.display_name || r.username),
      createdAt: String(r.created_at),
    }));

    const earnings = earningsRes.rows.map((r: any) => ({
      id: String(r.id),
      type: "DIVIDEND_REPORT" as const,
      title: `${r.ticker} Dividend Declaration: ${r.period_title}`,
      content: `Net profit: ${Number(r.net_profit).toFixed(2)} gold | Dividend pool: ${Number(r.dividend_pool).toFixed(2)} gold (${Number(r.dividend_per_share).toFixed(4)} gold / share). Status: ${r.status}`,
      ticker: String(r.ticker),
      companyName: String(r.company_name),
      logoUrl: String(r.logo_url || "🏛️"),
      author: "Corporate Secretary",
      createdAt: String(r.created_at || r.scheduled_for),
    }));

    const feed = [...announcements, ...earnings].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      success: true,
      feed,
      decree,
    });
  } catch (error: any) {
    console.error("GET /api/news error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
