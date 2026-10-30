import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface AuditLedgerData {
  period: {
    from: string;
    to: string;
    isFirstRun: boolean;
  };
  houseUser: {
    username: string;
    parlamentum_name: string;
    cash_balance: number;
    locked_cash: number;
  };
  treasuryUser: {
    cash_balance: number;
    locked_cash: number;
  };
  requiredInGameReserves: {
    pendingWithdrawalsOwed: number;
    totalCitizenLiabilities: number;
    totalCompanyTreasuries: number;
    totalCustomerBackingRequired: number;
    houseSpendablePurse: number;
    platformFeeProfit: number;
    totalHouseEquity: number;
  };
  companies: Array<{
    id: string;
    ticker: string;
    name: string;
    status: string;
    total_shares: number;
    float_shares: number;
    current_price: number;
    dividend_rate: number;
    total_dividends_paid: number;
    treasury_balance: number;
    creator_name: string;
    creator_parlamentum: string;
  }>;
  transactions: Array<{
    id: string;
    user_id: string;
    type: "DEPOSIT" | "WITHDRAWAL";
    method: string;
    amount: number;
    iron_units: number;
    parlamentum_name: string;
    status: string;
    created_at: string;
  }>;
  allTimeTxSummary: Array<{
    type: string;
    status: string;
    count: number;
    total_amount: number;
  }>;
  trades: Array<{
    id: string;
    company_id: string;
    ticker: string;
    price: number;
    quantity: number;
    total: number;
    created_at: string;
    buyer_name: string;
    seller_name: string;
  }>;
  tradesAllTime: Array<{
    company_id: string;
    ticker: string;
    trade_count: number;
    total_shares_traded: number;
    total_volume_gold: number;
  }>;
  earningsReports: Array<{
    id: string;
    ticker: string;
    period_title: string;
    net_profit: number;
    dividend_percent: number;
    dividend_pool: number;
    status: string;
    distributed_at?: string;
    created_at: string;
    reporter_name: string;
  }>;
  shareholders: Array<{
    ticker: string;
    company_name: string;
    username: string;
    parlamentum_name: string;
    shares: number;
    locked_shares: number;
    is_founder: number;
    is_house: number;
  }>;
  pendingWithdrawals: Array<{
    id: string;
    amount: number;
    parlamentum_name: string;
    created_at: string;
    recipe_note?: string;
  }>;
}

export function generateAuditLedgerPdf(data: AuditLedgerData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  const goldPrimary: [number, number, number] = [197, 160, 89]; // #c5a059
  const darkBg: [number, number, number] = [24, 24, 27]; // #18181b
  const accentRed: [number, number, number] = [225, 29, 72];
  const accentGreen: [number, number, number] = [16, 185, 129];

  const fmt = (n: number | null | undefined, dec = 2) => (Number(n || 0)).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const fmtDate = (dStr: string) => {
    try {
      const d = new Date(dStr);
      return d.toUTCString().replace("GMT", "UTC");
    } catch {
      return dStr;
    }
  };

  const periodLabel = data.period.isFirstRun
    ? "GENESIS AUDIT (All-Time Platform Inception to Present)"
    : `PERIOD: ${fmtDate(data.period.from)} -> ${fmtDate(data.period.to)}`;

  // ==========================================
  // PAGE 1: EXECUTIVE LEDGER & IN-GAME VAULT
  // ==========================================
  doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 80, "F");

  doc.setTextColor(goldPrimary[0], goldPrimary[1], goldPrimary[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("GROW UR GOLD ($GUG) — BOURSE AUDIT LEDGER", 40, 38);

  doc.setFontSize(10);
  doc.setTextColor(240, 240, 240);
  doc.text("Official House & Corporate Financial Statement", 40, 56);
  doc.setTextColor(180, 180, 180);
  doc.text(`Generated: ${fmtDate(data.period.to)} | ${periodLabel}`, 40, 70);

  let currentY = 105;

  // Key Callout Box: What is ours to spend vs in-game obligations
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(darkBg[0], darkBg[1], darkBg[2]);
  doc.text("1. HOUSE CAPITAL & IN-GAME VAULT REQUIREMENTS", 40, currentY);

  currentY += 15;

  const summaryHeaders = [["Category", "Amount (Gold)", "Owner / Classification", "Action / Status"]];
  const summaryBody = [
    [
      "Spendable House Purse (JosephArora)",
      `${fmt(data.requiredInGameReserves.houseSpendablePurse)} g`,
      "House Founder (Ours to Spend)",
      "Unrestricted liquid balance in personal purse"
    ],
    [
      "Platform Fee Profits (ExchangeTreasury)",
      `${fmt(data.requiredInGameReserves.platformFeeProfit)} g`,
      "House Platform Profit (Ours to Spend)",
      "Accumulated 1.0% trade & IPO charter fees"
    ],
    [
      "TOTAL FREELY SPENDABLE HOUSE GOLD",
      `${fmt(data.requiredInGameReserves.totalHouseEquity)} g`,
      "HOUSE TOTAL EQUITY",
      "SAFE TO WITHDRAW OR REINVEST"
    ],
    [
      "Pending In-Game Withdrawals Owed",
      `${fmt(data.requiredInGameReserves.pendingWithdrawalsOwed)} g`,
      "Player Withdrawals (Debt)",
      `${data.pendingWithdrawals.length} tickets waiting in-game delivery`
    ],
    [
      "Citizen Web Purses (Liquid + Locked)",
      `${fmt(data.requiredInGameReserves.totalCitizenLiabilities)} g`,
      "Citizen Custody (Customer Liabilities)",
      "Must be backed 1:1 inside Parlamentum"
    ],
    [
      "Corporate Company Treasuries",
      `${fmt(data.requiredInGameReserves.totalCompanyTreasuries)} g`,
      "Chartered Corporate Capital",
      "Held in trust for corporate expenditures"
    ],
    [
      "TOTAL REQUIRED IN-GAME VAULT BACKING",
      `${fmt(data.requiredInGameReserves.totalCustomerBackingRequired)} g`,
      "MANDATORY PARLAMENTUM RESERVE",
      "Exact in-game gold JosephArora must hold"
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    head: summaryHeaders,
    body: summaryBody,
    theme: "grid",
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 180 },
      1: { halign: "right", fontStyle: "bold", cellWidth: 100 },
      2: { cellWidth: 130 },
      3: { cellWidth: 110 },
    },
    didParseCell: (data) => {
      if (data.row.index === 2) {
        data.cell.styles.fillColor = [220, 252, 231]; // light green highlight
        data.cell.styles.textColor = [22, 101, 52];
      }
      if (data.row.index === 6) {
        data.cell.styles.fillColor = [254, 243, 199]; // gold highlight
        data.cell.styles.textColor = [146, 64, 14];
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 25;

  // Pending withdrawals detail if any
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Pending In-Game Payouts Queue (Immediate Action Required In-Game)", 40, currentY);
  currentY += 10;

  if (data.pendingWithdrawals.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("No pending withdrawal tickets. All citizen cashouts are currently fulfilled in-game.", 40, currentY + 10);
    currentY += 25;
  } else {
    const pwHeaders = [["Ticket ID", "Player Name", "Amount (Gold)", "Requested UTC", "Fulfillment Note"]];
    const pwBody = data.pendingWithdrawals.map((pw) => [
      pw.id,
      pw.parlamentum_name,
      `${fmt(pw.amount)} g`,
      fmtDate(pw.created_at).slice(0, 22),
      pw.recipe_note ? pw.recipe_note.slice(0, 60) + "..." : "Standard market buy"
    ]);

    autoTable(doc, {
      startY: currentY,
      head: pwHeaders,
      body: pwBody,
      theme: "striped",
      headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255] },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        2: { halign: "right", fontStyle: "bold" },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 20;
  }

  // ==========================================
  // PAGE 2: WALLET INFLOWS & OUTFLOWS (DEPOSITS & WITHDRAWALS)
  // ==========================================
  doc.addPage();
  currentY = 40;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(darkBg[0], darkBg[1], darkBg[2]);
  doc.text("2. PURSE LEDGER — INFLOWS & OUTFLOWS", 40, currentY);

  currentY += 15;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Transactions recorded during audit window: ${data.transactions.length} entries.`, 40, currentY);
  currentY += 10;

  const txHeaders = [["Tx ID", "Type", "Player Name", "Amount", "Commodity", "Status", "Timestamp UTC"]];
  const txBody = data.transactions.map((tx) => [
    tx.id,
    tx.type,
    tx.parlamentum_name,
    `${fmt(tx.amount)} g`,
    tx.iron_units > 0 ? `${tx.iron_units} units` : tx.method,
    tx.status,
    fmtDate(tx.created_at).slice(0, 22),
  ]);

  autoTable(doc, {
    startY: currentY,
    head: txHeaders,
    body: txBody.length > 0 ? txBody : [["No wallet transactions recorded in this period.", "", "", "", "", "", ""]],
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      3: { halign: "right", fontStyle: "bold" },
    },
    didParseCell: (cellData) => {
      if (cellData.column.index === 1) {
        if (cellData.cell.raw === "DEPOSIT") cellData.cell.styles.textColor = accentGreen;
        if (cellData.cell.raw === "WITHDRAWAL") cellData.cell.styles.textColor = accentRed;
      }
    },
  });

  // ==========================================
  // PAGE 3: SECONDARY MARKET TRADES & VOLUME
  // ==========================================
  doc.addPage();
  currentY = 40;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(darkBg[0], darkBg[1], darkBg[2]);
  doc.text("3. EXCHANGE TRADING FLOOR — EXECUTED TRADES", 40, currentY);

  currentY += 15;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Matched secondary trades during audit window: ${data.trades.length} trades.`, 40, currentY);
  currentY += 10;

  const tradeHeaders = [["Trade ID", "Stock", "Price", "Qty", "Total (Gold)", "Buyer", "Seller", "Timestamp UTC"]];
  const tradeBody = data.trades.map((t) => [
    t.id.slice(0, 12),
    t.ticker,
    `${fmt(t.price)} g`,
    t.quantity.toLocaleString(),
    `${fmt(t.total)} g`,
    t.buyer_name,
    t.seller_name,
    fmtDate(t.created_at).slice(0, 22),
  ]);

  autoTable(doc, {
    startY: currentY,
    head: tradeHeaders,
    body: tradeBody.length > 0 ? tradeBody : [["No secondary trades executed in this period.", "", "", "", "", "", "", ""]],
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right", fontStyle: "bold" },
    },
  });

  // ==========================================
  // PAGE 4: CORPORATE PERFORMANCE, TREASURY & DIVIDENDS
  // ==========================================
  doc.addPage();
  currentY = 40;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(darkBg[0], darkBg[1], darkBg[2]);
  doc.text("4. CHARTERED COMPANIES & TREASURY STATUS", 40, currentY);

  currentY += 15;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Status of corporate balance sheets, treasury balances, and cumulative dividends paid.", 40, currentY);
  currentY += 10;

  const companyHeaders = [["Ticker", "Company Name", "CEO / Founder", "Price", "Float", "Treasury", "Total Divs", "Status"]];
  const companyBody = data.companies.map((c) => [
    `$${c.ticker}`,
    c.name,
    c.creator_name || "N/A",
    `${fmt(c.current_price)} g`,
    `${c.float_shares} / ${c.total_shares}`,
    `${fmt(c.treasury_balance)} g`,
    `${fmt(c.total_dividends_paid)} g`,
    c.status,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: companyHeaders,
    body: companyBody,
    theme: "grid",
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      3: { halign: "right" },
      5: { halign: "right", fontStyle: "bold" },
      6: { halign: "right" },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 25;

  // Earnings filings in period
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Earnings Reports & Dividend Sweeps (In Period)", 40, currentY);
  currentY += 10;

  const divHeaders = [["Ticker", "Cycle Title", "Audited Profit", "Div %", "Pool (Gold)", "Reporter", "Status"]];
  const divBody = data.earningsReports.map((r) => [
    r.ticker,
    r.period_title,
    `${fmt(r.net_profit)} g`,
    `${r.dividend_percent}%`,
    `${fmt(r.dividend_pool)} g`,
    r.reporter_name,
    r.status,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: divHeaders,
    body: divBody.length > 0 ? divBody : [["No dividend filings in this period.", "", "", "", "", "", ""]],
    theme: "striped",
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255] },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      2: { halign: "right" },
      4: { halign: "right", fontStyle: "bold" },
    },
  });

  // ==========================================
  // PAGE 5: COMPLETE SHAREHOLDER REGISTRY (CAP TABLE)
  // ==========================================
  doc.addPage();
  currentY = 40;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(darkBg[0], darkBg[1], darkBg[2]);
  doc.text("5. OFFICIAL SHAREHOLDER CAP TABLE (BY STOCK)", 40, currentY);

  currentY += 15;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Verified registry of citizen and founder shareholdings across all exchange stocks.", 40, currentY);
  currentY += 10;

  const shHeaders = [["Stock", "Shareholder", "In-Game Name", "Shares Held", "Locked", "Ownership Type"]];
  const shBody = data.shareholders.map((s) => [
    `$${s.ticker}`,
    s.username,
    s.parlamentum_name || s.username,
    s.shares.toLocaleString(),
    s.locked_shares > 0 ? s.locked_shares.toLocaleString() : "0",
    s.is_house ? "House Reserve" : s.is_founder ? "Founder Holding" : "Public Citizen",
  ]);

  autoTable(doc, {
    startY: currentY,
    head: shHeaders,
    body: shBody,
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      3: { halign: "right", fontStyle: "bold" },
      4: { halign: "right" },
    },
    didParseCell: (cellData) => {
      if (cellData.column.index === 5) {
        if (cellData.cell.raw === "House Reserve") cellData.cell.styles.textColor = [197, 160, 89];
        if (cellData.cell.raw === "Founder Holding") cellData.cell.styles.textColor = [59, 130, 246];
      }
    },
  });

  // Footer for all pages
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Grow UR Gold Exchange Audit — Confidential Operator Report | Page ${i} of ${pageCount}`,
      40,
      doc.internal.pageSize.getHeight() - 20
    );
  }

  // Trigger browser download
  const cleanDateStr = new Date(data.period.to).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `GUG-Audit-Ledger-${cleanDateStr}.pdf`;
  doc.save(filename);
}
