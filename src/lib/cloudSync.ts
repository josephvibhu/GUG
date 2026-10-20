import { getDb, initDb, scheduleBlobPersist } from "./db";
import { getSetting, setSetting } from "./wallet";
import { syncLedgerData, LedgerEntryInput } from "./ledger";

/**
 * Extracts trade ledger fills from the raw HTML of https://parlamentum.org/trade/ledger
 */
export function parseParlamentumLedgerHtml(html: string): LedgerEntryInput[] {
  const entries: LedgerEntryInput[] = [];

  // Match all <tr>...</tr> rows
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowContent = trMatch[1];
    
    // Extract each <td>...</td> cell
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let tdMatch;

    while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
      // Strip HTML tags and normalize whitespace
      const cleanText = tdMatch[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      cells.push(cleanText);
    }

    if (cells.length >= 6) {
      const dateStr = cells[0] || "";
      const sideStr = cells[1] || "";
      const itemStr = cells[2] || "";
      const qtyStr = cells[3] || "";
      const priceStr = cells[4] || "";
      const totalStr = cells[5] || "";
      const taxStr = cells[6] || "0";
      const withStr = cells[7] || "";

      const isDate = /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(dateStr);
      const isSide = /SOLD|BOUGHT/i.test(sideStr);

      if (isDate && isSide) {
        const qty = parseFloat(qtyStr.replace(/,/g, "")) || 0;
        const total = parseFloat(totalStr.replace(/[^0-9.]/g, "")) || 0;
        const tax = parseFloat(taxStr.replace(/[^0-9.]/g, "")) || 0;
        const currency = totalStr.toLowerCase().includes("usd") ? "USD" : "gold";
        const withUser = withStr.replace(/^[—\-\s]+|[—\-\s]+$/g, "").trim();
        const side = /SOLD/i.test(sideStr) ? "SOLD" : "BOUGHT";
        const sig = `ledger_${dateStr}_${side}_${itemStr.replace(/\s+/g, "_")}_${qty}_${total}_${currency}_${withUser}`;

        entries.push({
          date: dateStr,
          side,
          item: itemStr,
          qty,
          price: priceStr,
          total,
          tax,
          currency,
          withUser,
          signature: sig,
        });
      }
    }
  }

  return entries;
}

/**
 * Connects to parlamentum.org in the cloud using the operator's saved session cookie,
 * parses recent market trade fills, and automatically credits citizen purses in Grow UR Gold.
 */
export async function triggerCloudLedgerSync(force = false): Promise<{
  success: boolean;
  message: string;
  fillsFound: number;
  newCredits: Array<{ user: string; gold: number; item: string; reason: string }>;
  expired?: boolean;
}> {
  await initDb();
  const cookie = (await getSetting("parlamentum_cookie", process.env.PARLAMENTUM_COOKIE || "")).trim();

  if (!cookie) {
    const msg = "Parlamentum Session Cookie not configured. Please paste your session cookie in Admin Settings.";
    await setSetting("last_cloud_sync_status", "NOT_CONFIGURED");
    await setSetting("last_cloud_sync_message", msg);
    return {
      success: false,
      message: msg,
      fillsFound: 0,
      newCredits: [],
    };
  }

  // At most one scrape a minute, whatever triggers it (cron, deposit announcements); the operator's
  // "sync now" button passes force. The slot is claimed in one statement, so parallel triggers can't all run.
  if (!force) {
    const db = getDb();
    const nowMs = Date.now();
    await db.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('cloud_sync_slot', '0')");
    const slot = await db.execute({
      sql: "UPDATE settings SET value = ? WHERE key = 'cloud_sync_slot' AND CAST(value AS INTEGER) <= ?",
      args: [String(nowMs), nowMs - 60_000],
    });
    if (slot.rowsAffected === 0) {
      return { success: true, message: "A sync ran less than a minute ago.", fillsFound: 0, newCredits: [] };
    }
  }

  const now = new Date().toISOString();
  await setSetting("last_cloud_sync_at", now);

  try {
    const res = await fetch("https://parlamentum.org/trade/ledger", {
      method: "GET",
      headers: {
        "Cookie": cookie,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
      // Short timeout to keep serverless functions snappy
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      const msg = `Parlamentum server responded with status HTTP ${res.status}`;
      await setSetting("last_cloud_sync_status", "ERROR");
      await setSetting("last_cloud_sync_message", msg);
      return {
        success: false,
        message: msg,
        fillsFound: 0,
        newCredits: [],
      };
    }

    const html = await res.text();

    // Check if session has expired (e.g. Next.js returned unauthenticated 404/login page)
    if (html.includes("404: This page could not be found") || html.includes('name="login"') || html.includes("Sign In")) {
      const msg = "Parlamentum session cookie has expired or is invalid. Please copy a fresh cookie from your browser into Admin Settings.";
      await setSetting("last_cloud_sync_status", "EXPIRED");
      await setSetting("last_cloud_sync_message", msg);
      return {
        success: false,
        expired: true,
        message: msg,
        fillsFound: 0,
        newCredits: [],
      };
    }

    // Parse fills
    const entries = parseParlamentumLedgerHtml(html);

    if (entries.length === 0) {
      const msg = "Synced successfully with parlamentum.org (0 active trade fills in ledger).";
      await setSetting("last_cloud_sync_status", "SUCCESS");
      await setSetting("last_cloud_sync_message", msg);
      scheduleBlobPersist();
      return {
        success: true,
        message: msg,
        fillsFound: 0,
        newCredits: [],
      };
    }

    // Ingest into Grow UR Gold ledger and auto-credit citizens
    const syncRes = await syncLedgerData(entries);

    const msg = `Cloud sync successful! Found ${entries.length} in-game fills. Credited ${syncRes.newCredits.length} new deposit(s).`;
    await setSetting("last_cloud_sync_status", "SUCCESS");
    await setSetting("last_cloud_sync_message", msg);
    await setSetting("last_cloud_sync_fills", String(entries.length));
    scheduleBlobPersist();

    return {
      success: true,
      message: msg,
      fillsFound: entries.length,
      newCredits: syncRes.newCredits,
    };
  } catch (err: any) {
    const errMsg = `Cloud sync network error: ${err.message || String(err)}`;
    console.error("[CloudSync Error]", errMsg);
    await setSetting("last_cloud_sync_status", "ERROR");
    await setSetting("last_cloud_sync_message", errMsg);
    return {
      success: false,
      message: errMsg,
      fillsFound: 0,
      newCredits: [],
    };
  }
}
