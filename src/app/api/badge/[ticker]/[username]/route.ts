import { getDb, initDb } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string; username: string }> }
) {
  try {
    await initDb();
    const db = getDb();
    const { ticker, username } = await params;
    const upperTicker = ticker.toUpperCase();

    // 1. Fetch Company
    const compRes = await db.execute({
      sql: "SELECT id, ticker, name, creator_id, total_shares, float_shares, current_price, logo_url FROM companies WHERE ticker = ?",
      args: [upperTicker],
    });

    if (compRes.rows.length === 0) {
      return new Response(generateErrorSvg("Company Not Found"), {
        headers: { "Content-Type": "image/svg+xml" },
        status: 404,
      });
    }

    const comp = compRes.rows[0];
    const companyId = String(comp.id);
    const companyName = escapeXml(String(comp.name));
    const creatorId = String(comp.creator_id);
    const totalShares = Number(comp.total_shares) || 10000;
    const currentPrice = Number(comp.current_price) || 0;
    const logoChar = escapeXml(String(comp.logo_url || "🏛️"));

    // 2. Fetch User
    const userRes = await db.execute({
      sql: "SELECT id, username, display_name FROM users WHERE LOWER(username) = LOWER(?)",
      args: [username],
    });

    if (userRes.rows.length === 0) {
      return new Response(generateErrorSvg(`Citizen @${escapeXml(username)} Not Found`), {
        headers: { "Content-Type": "image/svg+xml" },
        status: 404,
      });
    }

    const user = userRes.rows[0];
    const userId = String(user.id);
    const cleanUsername = escapeXml(String(user.username));
    const displayName = escapeXml(String(user.display_name || user.username));

    // 3. Fetch all shareholders for ranking
    const holdersRes = await db.execute({
      sql: `SELECT user_id, shares FROM portfolios WHERE company_id = ? AND shares > 0 ORDER BY shares DESC`,
      args: [companyId],
    });

    let userShares = 0;
    let rank = 0;
    for (let i = 0; i < holdersRes.rows.length; i++) {
      const row = holdersRes.rows[i];
      if (String(row.user_id) === userId) {
        userShares = Number(row.shares);
        rank = i + 1;
        break;
      }
    }

    const equityPct = totalShares > 0 ? (userShares / totalShares) * 100 : 0;
    const totalGoldValue = userShares * currentPrice;

    // 4. Determine Tier & Title
    let tierTitle = "CITIZEN OBSERVER";
    let tierColor = "#71717a"; // zinc
    let tierBg = "#27272a";

    if (userId === creatorId) {
      tierTitle = "FOUNDER & ARCHITECT";
      tierColor = "#fbbf24"; // gold amber
      tierBg = "#78350f";
    } else if (rank === 1 && userShares > 0) {
      tierTitle = "MAJORITY WHALE • RANK #1";
      tierColor = "#34d399"; // emerald
      tierBg = "#064e3b";
    } else if (rank > 0 && rank <= 5) {
      tierTitle = `TOP 5 SHAREHOLDER • RANK #${rank}`;
      tierColor = "#38bdf8"; // sky blue
      tierBg = "#0c4a6e";
    } else if (rank > 0 && rank <= 10) {
      tierTitle = `TOP 10 CITIZEN • RANK #${rank}`;
      tierColor = "#a78bfa"; // violet
      tierBg = "#3b0764";
    } else if (equityPct >= 5) {
      tierTitle = "ANGEL BACKER (5%+ FLOAT)";
      tierColor = "#f59e0b"; // bullion
      tierBg = "#451a03";
    } else if (userShares > 0) {
      tierTitle = "VERIFIED SHAREHOLDER";
      tierColor = "#e2e8f0"; // slate paper
      tierBg = "#1e293b";
    }

    // 5. Render SVG Badge
    const svg = `
<svg width="540" height="190" viewBox="0 0 540 190" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="540" y2="190" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0c0e14" />
      <stop offset="50%" stop-color="#121622" />
      <stop offset="100%" stop-color="#090a0f" />
    </linearGradient>
    <linearGradient id="goldEdge" x1="0" y1="0" x2="540" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#d97706" />
      <stop offset="30%" stop-color="#f59e0b" />
      <stop offset="70%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>
    <linearGradient id="shieldGlow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.8" />
    </linearGradient>
    <filter id="glow" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Outer Card Frame -->
  <rect x="1" y="1" width="538" height="188" rx="8" fill="url(#bgGrad)" stroke="#27272a" stroke-width="1.5" />
  <rect x="2" y="2" width="536" height="4" rx="2" fill="url(#goldEdge)" />

  <!-- Background Watermark Pattern -->
  <text x="520" y="140" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="70" font-weight="900" fill="#ffffff" fill-opacity="0.02" text-anchor="end">${upperTicker}</text>

  <!-- Left Side: Emblem Badge -->
  <g transform="translate(24, 30)">
    <rect x="0" y="0" width="76" height="76" rx="8" fill="#18181b" stroke="#3f3f46" stroke-width="1.5" />
    <circle cx="38" cy="38" r="28" fill="url(#shieldGlow)" stroke="#f59e0b" stroke-width="1" />
    <text x="38" y="46" font-size="28" text-anchor="middle" dominant-baseline="middle">${logoChar}</text>
    <rect x="8" y="86" width="60" height="20" rx="3" fill="#27272a" stroke="#3f3f46" stroke-width="0.5" />
    <text x="38" y="99" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="bold" fill="#f59e0b" text-anchor="middle" dominant-baseline="middle">$${upperTicker}</text>
  </g>

  <!-- Middle & Right Header: Company & Tier Pill -->
  <g transform="translate(120, 28)">
    <text x="0" y="14" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#f4f4f5">${companyName}</text>
    
    <!-- Tier Badge Pill -->
    <g transform="translate(0, 24)">
      <rect x="0" y="0" width="${Math.max(120, tierTitle.length * 7.5 + 20)}" height="20" rx="4" fill="${tierBg}" stroke="${tierColor}" stroke-opacity="0.5" stroke-width="1" />
      <text x="10" y="13.5" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="800" fill="${tierColor}" letter-spacing="0.5">${tierTitle}</text>
    </g>

    <!-- Citizen Name -->
    <g transform="translate(0, 56)">
      <text x="0" y="14" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="#e4e4e7">@${cleanUsername}</text>
      ${displayName !== cleanUsername ? `<text x="${cleanUsername.length * 8.5 + 20}" y="14" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#71717a">(${displayName})</text>` : ""}
    </g>
  </g>

  <!-- Bottom Stat Row -->
  <g transform="translate(120, 114)">
    <line x1="0" y1="0" x2="395" y2="0" stroke="#27272a" stroke-width="1" />
    
    <!-- Shares -->
    <g transform="translate(0, 10)">
      <text x="0" y="10" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" fill="#a1a1aa" text-transform="uppercase">Shares Held</text>
      <text x="0" y="28" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="14" font-weight="bold" fill="#f59e0b">${userShares.toLocaleString()} sh</text>
    </g>

    <!-- Equity % -->
    <g transform="translate(125, 10)">
      <text x="0" y="10" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" fill="#a1a1aa" text-transform="uppercase">Equity Stake</text>
      <text x="0" y="28" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="14" font-weight="bold" fill="#f4f4f5">${equityPct.toFixed(2)}%</text>
    </g>

    <!-- Position Value -->
    <g transform="translate(235, 10)">
      <text x="0" y="10" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" fill="#a1a1aa" text-transform="uppercase">Holding Value</text>
      <text x="0" y="28" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="14" font-weight="bold" fill="#34d399">${totalGoldValue.toFixed(2)}g</text>
    </g>

    <!-- Rank -->
    <g transform="translate(345, 10)">
      <text x="0" y="10" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" fill="#a1a1aa" text-transform="uppercase">Rank</text>
      <text x="0" y="28" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="14" font-weight="bold" fill="#a78bfa">${rank > 0 ? `#${rank}` : "—"}</text>
    </g>
  </g>

  <!-- Footer Watermark Bar -->
  <g transform="translate(0, 168)">
    <rect x="1" y="0" width="538" height="21" rx="0" fill="#08090d" />
    <text x="24" y="14" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="600" fill="#52525b" letter-spacing="0.5">GROW UR GOLD EXCHANGE • PARLAMENTUM CITIZEN REGISTRY</text>
    <text x="516" y="14" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="bold" fill="#d97706" text-anchor="end">VERIFIED SHAREHOLDER CARD ✓</text>
  </g>
</svg>
`.trim();

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
      status: 200,
    });
  } catch (error: any) {
    console.error("GET /api/badge/[ticker]/[username] error:", error);
    return new Response(generateErrorSvg("Internal Server Error"), {
      headers: { "Content-Type": "image/svg+xml" },
      status: 500,
    });
  }
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

function generateErrorSvg(msg: string): string {
  return `
<svg width="400" height="100" viewBox="0 0 400 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="100" rx="8" fill="#18181b" stroke="#ef4444" stroke-width="1.5" />
  <text x="20" y="45" font-family="sans-serif" font-size="14" font-weight="bold" fill="#ef4444">Grow UR Gold Card Error</text>
  <text x="20" y="70" font-family="sans-serif" font-size="12" fill="#a1a1aa">${escapeXml(msg)}</text>
</svg>
  `.trim();
}
