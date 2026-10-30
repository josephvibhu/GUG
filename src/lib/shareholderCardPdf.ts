import jsPDF from "jspdf";

export interface ShareholderCardData {
  ticker: string;
  companyName: string;
  weekNumber: number;
  periodStart: string;
  periodEnd: string;
  generatedDate: string;
  payoutDate: string;
  netProfit: number;
  payoutPercent: number;
  totalPayout: number;
  perShare: number;
  publicShares: number;
  publicPayout: number;
  totalShares: number;
  operations: {
    tradesCount: number;
    tradesVolume: number;
    tradeCommissions: number;
    charterFees: number;
    charterCompaniesCount: number;
    depositGross: number;
    depositUnits: number;
    depositNetMargin: number;
    cogsExpenses: number;
  };
  sinceLaunch: {
    totalVolume: number;
    allTimeNetProfit: number;
    allTimePaidOut: number;
    allTimePublicFloatPaid: number;
  };
}

export function generateShareholderCardPdf(data: ShareholderCardData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth(); // 595.28
  const pageHeight = doc.internal.pageSize.getHeight(); // 841.89

  // Colors
  const bg = [10, 10, 13]; // deep dark canvas
  const cardBg = [17, 17, 23]; // slightly lighter dark card
  const cardBorder = [40, 40, 52]; // subtle border
  const gold = [245, 175, 25]; // #f5af19 primary vibrant gold
  const goldLight = [252, 211, 77]; // amber-300
  const textWhite = [255, 255, 255];
  const textAsh = [156, 163, 175]; // zinc-400
  const textMuted = [113, 113, 122]; // zinc-500
  const green = [52, 211, 153]; // emerald-400
  const red = [248, 113, 113]; // rose-400

  // 1. Fill entire page with deep background
  doc.setFillColor(bg[0], bg[1], bg[2]);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Helper formatting functions
  const fmt = (n: number | null | undefined, dec = 2) =>
    Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });

  let y = 42;
  const leftX = 38;
  const contentWidth = pageWidth - leftX * 2; // 519.28

  // =========================================================================
  // HEADER
  // =========================================================================
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(26);
  doc.setTextColor(gold[0], gold[1], gold[2]);
  doc.text(data.companyName.toUpperCase(), leftX, y);

  // Ticker pill badge on top right
  const pillWidth = 84;
  const pillHeight = 24;
  const pillX = leftX + contentWidth - pillWidth;
  const pillY = y - 20;

  doc.setFillColor(gold[0], gold[1], gold[2]);
  doc.roundedRect(pillX, pillY, pillWidth, pillHeight, 12, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(10, 10, 13);
  doc.text(`$${data.ticker}`, pillX + pillWidth / 2, pillY + 16, { align: "center" });

  // Week number below pill
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.text(`WEEK ${data.weekNumber}`, pillX + pillWidth - 2, pillY + 40, { align: "right" });

  // Subtitle under company name
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(textAsh[0], textAsh[1], textAsh[2]);
  doc.text("SHAREHOLDER REPORT", leftX, y);

  // Metadata timestamps
  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("PERIOD", leftX, y);
  doc.setTextColor(textAsh[0], textAsh[1], textAsh[2]);
  doc.text(`${data.periodStart}  –  ${data.periodEnd}`, leftX + 85, y);

  y += 13;
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("GENERATED", leftX, y);
  doc.setTextColor(textAsh[0], textAsh[1], textAsh[2]);
  doc.text(data.generatedDate, leftX + 85, y);

  y += 13;
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("PAYOUT DATE", leftX, y);
  doc.setTextColor(textAsh[0], textAsh[1], textAsh[2]);
  doc.text(data.payoutDate, leftX + 85, y);

  // =========================================================================
  // 4 HIGHLIGHT PILLARS (STAT CARDS)
  // =========================================================================
  y += 22;
  const cardGap = 9;
  const cardW = (contentWidth - cardGap * 3) / 4;
  const cardH = 72;

  const cards = [
    {
      label: "NET PROFIT",
      val: `+${fmt(data.netProfit)}`,
      sub: "gold",
      color: gold,
      subColor: textMuted,
    },
    {
      label: "TOTAL PAYOUT",
      val: fmt(data.totalPayout),
      sub: `${data.payoutPercent}% of ${fmt(data.netProfit)}`,
      color: goldLight,
      subColor: textMuted,
    },
    {
      label: "PER SHARE",
      val: fmt(data.perShare, 4),
      sub: `gold on each of ${data.totalShares.toLocaleString()}`,
      color: goldLight,
      subColor: textMuted,
    },
    {
      label: "PUBLIC FLOAT",
      val: fmt(data.publicPayout),
      sub: `gold to its ${data.publicShares.toLocaleString()} shares`,
      color: textWhite,
      subColor: textMuted,
    },
  ];

  cards.forEach((c, i) => {
    const cx = leftX + i * (cardW + cardGap);
    // Card background & border
    doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
    doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
    doc.roundedRect(cx, y, cardW, cardH, 4, 4, "FD");

    // Label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(c.label, cx + 10, y + 15);

    // Value
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(c.color[0], c.color[1], c.color[2]);
    doc.text(c.val, cx + 10, y + 42);

    // Subtext
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(c.subColor[0], c.subColor[1], c.subColor[2]);
    doc.text(c.sub, cx + 10, y + 60);
  });

  y += cardH + 28;

  // =========================================================================
  // SECTION: THE OPERATIONS (EXCHANGE ACTIVITY TABLE)
  // =========================================================================
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(14);
  doc.setTextColor(gold[0], gold[1], gold[2]);
  doc.text("THE OPERATIONS", leftX, y);

  y += 14;
  // Table header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);

  doc.text("ACTIVITY", leftX, y);
  doc.text("UNITS / TRADES", leftX + 150, y, { align: "right" });
  doc.text("THROUGHPUT", leftX + 245, y, { align: "right" });
  doc.text("EXPENSES (COGS)", leftX + 345, y, { align: "right" });
  doc.text("NET REVENUE", leftX + contentWidth, y, { align: "right" });

  y += 5;
  doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
  doc.setLineWidth(0.5);
  doc.line(leftX, y, leftX + contentWidth, y);

  const opRows = [
    {
      name: "Secondary Market Trades",
      count: `${data.operations.tradesCount} trades`,
      volume: `${fmt(data.operations.tradesVolume)}`,
      cogs: "0.00",
      net: `+${fmt(data.operations.tradeCommissions)}`,
    },
    {
      name: "IPO Charter & Listing Fees",
      count: `${data.operations.charterCompaniesCount} charters`,
      volume: `${fmt(data.operations.charterFees)}`,
      cogs: "0.00",
      net: `+${fmt(data.operations.charterFees)}`,
    },
    {
      name: "Deposit Rail Processing",
      count: `${data.operations.depositUnits} units`,
      volume: `${fmt(data.operations.depositGross)}`,
      cogs: `-${fmt(data.operations.cogsExpenses)}`,
      net: `+${fmt(data.operations.depositNetMargin)}`,
    },
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  opRows.forEach((r) => {
    y += 17;
    doc.setTextColor(textAsh[0], textAsh[1], textAsh[2]);
    doc.text(r.name, leftX, y);
    doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
    doc.text(r.count, leftX + 150, y, { align: "right" });
    doc.text(r.volume, leftX + 245, y, { align: "right" });
    doc.setTextColor(red[0], red[1], red[2]);
    doc.text(r.cogs, leftX + 345, y, { align: "right" });
    doc.setTextColor(green[0], green[1], green[2]);
    doc.text(r.net, leftX + contentWidth, y, { align: "right" });
  });

  // ALL THREE / TOTAL ROW
  y += 18;
  doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
  doc.line(leftX, y - 10, leftX + contentWidth, y - 10);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(gold[0], gold[1], gold[2]);
  doc.text("ALL OPERATIONS", leftX, y);
  const totalThroughput = data.operations.tradesVolume + data.operations.charterFees + data.operations.depositGross;
  const totalNet = data.operations.tradeCommissions + data.operations.charterFees + data.operations.depositNetMargin;
  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.text(fmt(totalThroughput), leftX + 245, y, { align: "right" });
  doc.setTextColor(red[0], red[1], red[2]);
  doc.text(`-${fmt(data.operations.cogsExpenses)}`, leftX + 345, y, { align: "right" });
  doc.setTextColor(gold[0], gold[1], gold[2]);
  doc.text(`+${fmt(totalNet)}`, leftX + contentWidth, y, { align: "right" });

  y += 32;

  // =========================================================================
  // SIDE-BY-SIDE: THE WEEK'S PROFIT & PAYOUT
  // =========================================================================
  const colW = (contentWidth - 28) / 2;
  const col2X = leftX + colW + 28;
  const colStartY = y;

  // --- COLUMN 1: THE WEEK'S PROFIT ---
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(13);
  doc.setTextColor(gold[0], gold[1], gold[2]);
  doc.text("THE WEEK'S PROFIT", leftX, y);

  let col1Y = y + 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  const profitItems = [
    { label: "Trading fees kept (1.0%)", val: `+${fmt(data.operations.tradeCommissions)}` },
    { label: "New IPO charter fees", val: `+${fmt(data.operations.charterFees)}` },
    { label: "Deposit rail facility kept", val: `+${fmt(data.operations.depositNetMargin)}` },
    { label: "COGS: Raw materials procurement", val: `-${fmt(data.operations.cogsExpenses)}`, isRed: true },
    { label: "Courier & transport buffers", val: "-0.00" },
  ];

  profitItems.forEach((item) => {
    doc.setTextColor(textAsh[0], textAsh[1], textAsh[2]);
    doc.text(item.label, leftX, col1Y);
    if (item.isRed) doc.setTextColor(red[0], red[1], red[2]);
    else doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
    doc.text(item.val, leftX + colW, col1Y, { align: "right" });
    col1Y += 14;
  });

  // Net Profit row in Col 1
  col1Y += 4;
  doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
  doc.line(leftX, col1Y - 6, leftX + colW, col1Y - 6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.text("Net profit", leftX, col1Y);
  doc.setTextColor(gold[0], gold[1], gold[2]);
  doc.text(`+${fmt(data.netProfit)}`, leftX + colW, col1Y, { align: "right" });

  // --- COLUMN 2: PAYOUT ---
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(13);
  doc.setTextColor(gold[0], gold[1], gold[2]);
  doc.text("PAYOUT", col2X, colStartY);

  let col2Y = colStartY + 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  const founderPayout = Math.max(0, data.totalPayout - data.publicPayout);

  const payoutItems = [
    { label: "Net profit", val: `+${fmt(data.netProfit)}` },
    { label: "Loss carried in", val: "0.00" },
    { label: "Distributable", val: fmt(data.netProfit) },
    { label: "Payout ratio", val: `${data.payoutPercent}%` },
    { label: "Total payout", val: fmt(data.totalPayout), isBold: true },
    { label: `Per share (${data.totalShares.toLocaleString()} shares)`, val: fmt(data.perShare, 4) },
    { label: `Public float (${data.publicShares.toLocaleString()} shares)`, val: fmt(data.publicPayout), isGold: true },
    { label: "Retained by House / Founder", val: fmt(founderPayout) },
    { label: "Loss carried forward", val: "0.00" },
  ];

  payoutItems.forEach((item) => {
    doc.setTextColor(textAsh[0], textAsh[1], textAsh[2]);
    if (item.isBold) doc.setFont("helvetica", "bold");
    else doc.setFont("helvetica", "normal");
    doc.text(item.label, col2X, col2Y);

    if (item.isGold) {
      doc.setTextColor(gold[0], gold[1], gold[2]);
      doc.setFont("helvetica", "bold");
    } else {
      doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
    }
    doc.text(item.val, col2X + colW, col2Y, { align: "right" });
    col2Y += 13.5;
  });

  y = Math.max(col1Y, col2Y) + 26;

  // =========================================================================
  // SECTION: SINCE LAUNCH (CUMULATIVE PERFORMANCE)
  // =========================================================================
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(13);
  doc.setTextColor(gold[0], gold[1], gold[2]);
  doc.text("SINCE LAUNCH", leftX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("Inception to Present · Cumulative Performance", leftX + 115, y);

  y += 12;
  const bottomCardH = 62;
  const launchCards = [
    {
      label: "TOTAL VOLUME",
      val: fmt(data.sinceLaunch.totalVolume, 0),
      sub: "secondary floor volume",
      color: textWhite,
    },
    {
      label: "NET PROFIT",
      val: `+${fmt(data.sinceLaunch.allTimeNetProfit)}`,
      sub: "gold earned",
      color: gold,
    },
    {
      label: "PAID OUT",
      val: fmt(data.sinceLaunch.allTimePaidOut),
      sub: "gold, all shares",
      color: textWhite,
    },
    {
      label: "PUBLIC FLOAT",
      val: fmt(data.sinceLaunch.allTimePublicFloatPaid),
      sub: "gold to public shares",
      color: goldLight,
    },
  ];

  launchCards.forEach((c, i) => {
    const cx = leftX + i * (cardW + cardGap);
    doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
    doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
    doc.roundedRect(cx, y, cardW, bottomCardH, 4, 4, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(c.label, cx + 10, y + 14);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(c.color[0], c.color[1], c.color[2]);
    doc.text(c.val, cx + 10, y + 36);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(c.sub, cx + 10, y + 50);
  });

  // =========================================================================
  // FOOTER
  // =========================================================================
  const footerY = pageHeight - 34;
  doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
  doc.line(leftX, footerY - 8, leftX + contentWidth, footerY - 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(
    "Figures in Parlamentum gold, from the exchange's sovereign ledger: aggregates only, with no citizen account balances or House bankroll.",
    leftX,
    footerY
  );
  doc.text("GUG Primary share sales are reserved in corporate treasury and excluded from operational P&L.", leftX, footerY + 10);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(gold[0], gold[1], gold[2]);
  doc.text(`$${data.ticker} · ${data.companyName}`, leftX + contentWidth, footerY + 5, { align: "right" });

  doc.save(`GUG-Shareholder-Report-Week-${data.weekNumber}.pdf`);
}
