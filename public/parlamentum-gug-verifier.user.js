// ==UserScript==
// @name         Grow UR Gold - Parlamentum Trade Ledger & Deposit Verifier
// @namespace    https://growurgold.vercel.app/
// @version      2.0.0
// @description  Automatically detects Raw Iron sales & trade fills on operator JosephArora's Parlamentum account by scraping /trade/ledger and auto-credits citizen purses in Grow UR Gold with zero latency.
// @author       Grow UR Gold Exchange Team
// @match        *://parlamentum.org/*
// @match        *://*.parlamentum.org/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @grant        window.onurlchange
// @connect      growurgold.vercel.app
// @connect      grow-ur-gold.vercel.app
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  console.log("%c[GUG Verifier v2.0] Ledger Edition Loaded on " + window.location.href, "background: #10b981; color: #000; font-size: 13px; font-weight: bold; padding: 4px 8px; border-radius: 4px;");

  // CONFIGURATION
  const OPERATOR_NAMES = ["JOSEPHARORA", "JOSEPH ARORA", "JOSEPH_ARORA"];
  const CITIZEN_NAMES = ["CARDINALSANJAY", "CARDINAL SANJAY", "CARDINAL_SANJAY"];
  const EXCHANGE_API_URL = "https://growurgold.vercel.app/api/admin";
  const SECRET_API_KEY = ""; // paste the key shown in the Operator Panel (this file is public, so it ships empty)
  const POLL_INTERVAL_MS = 10000; // 10 seconds background sync

  const STORAGE_KEY = "gug_processed_ledger_v2";

  function getProcessedSignatures() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function markSignatureProcessed(sig) {
    const list = getProcessedSignatures();
    if (!list.includes(sig)) {
      list.push(sig);
      if (list.length > 500) list.shift();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
  }

  // 1. FLOATING STATUS & HUD WIDGET
  let statusBadge = null;
  function updateWidget(htmlContent, bgColor = "#0f172a", borderColor = "#10b981", textColor = "#f8fafc") {
    if (!statusBadge) {
      statusBadge = document.createElement("div");
      statusBadge.id = "gug-verifier-widget";
      statusBadge.style.position = "fixed";
      statusBadge.style.bottom = "75px"; // Floats cleanly above the in-game chat dock
      statusBadge.style.right = "18px";
      statusBadge.style.zIndex = "2147483647";
      statusBadge.style.padding = "8px 14px";
      statusBadge.style.borderRadius = "10px";
      statusBadge.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      statusBadge.style.fontSize = "12px";
      statusBadge.style.fontWeight = "600";
      statusBadge.style.boxShadow = "0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(16, 185, 129, 0.25)";
      statusBadge.style.border = "1.5px solid " + borderColor;
      statusBadge.style.cursor = "pointer";
      statusBadge.style.userSelect = "none";
      statusBadge.style.display = "flex";
      statusBadge.style.alignItems = "center";
      statusBadge.style.gap = "8px";
      statusBadge.title = "Click to run instant Parlamentum Ledger sync";
      statusBadge.onclick = (e) => {
        // Prevent opening if clicking on an inner link
        if ((e.target).tagName === "A") return;
        updateWidget("⚡ Syncing /trade/ledger now...", "#0f766e", "#2dd4bf", "#ffffff");
        syncTradeLedger(true);
      };

      if (document.body) {
        document.body.appendChild(statusBadge);
      } else {
        document.addEventListener("DOMContentLoaded", () => document.body.appendChild(statusBadge));
      }
    }

    statusBadge.innerHTML = htmlContent;
    statusBadge.style.backgroundColor = bgColor;
    statusBadge.style.borderColor = borderColor;
    statusBadge.style.color = textColor;
  }

  updateWidget("🟡 GUG Verifier v2.0: Initializing...", "#1e293b", "#eab308", "#fef08a");

  // 2. ACTIVE ACCOUNT IDENTIFIER
  async function detectActiveAccount() {
    const pageText = (document.body ? document.body.innerText : "").toUpperCase();

    for (const name of OPERATOR_NAMES) {
      if (pageText.includes(name)) return "JOSEPHARORA";
    }
    for (const name of CITIZEN_NAMES) {
      if (pageText.includes(name)) return "CARDINALSANJAY";
    }

    try {
      const res = await fetch("/", { credentials: "include" });
      if (res.ok) {
        const homeHtml = await res.text();
        const homeUpper = homeHtml.toUpperCase();
        for (const name of OPERATOR_NAMES) {
          if (homeUpper.includes(name)) return "JOSEPHARORA";
        }
        for (const name of CITIZEN_NAMES) {
          if (homeUpper.includes(name)) return "CARDINALSANJAY";
        }
      }
    } catch (e) {
      console.warn("[GUG Verifier] Session probe error:", e);
    }

    return "UNKNOWN";
  }

  // 3. SEND WEBHOOK PAYLOAD (Ledger sync or sale event)
  function sendWebhook(payloadObj, callback) {
    const payload = JSON.stringify(payloadObj);

    const onComplete = (status, responseText) => {
      try {
        const data = JSON.parse(responseText);
        if (callback) callback(data);
      } catch (e) {
        console.error(`[GUG Verifier] JSON parse error:`, responseText);
      }
    };

    if (typeof GM_xmlhttpRequest !== "undefined") {
      GM_xmlhttpRequest({
        method: "POST",
        url: EXCHANGE_API_URL,
        headers: { "Content-Type": "application/json" },
        data: payload,
        onload: (res) => onComplete(res.status, res.responseText),
        onerror: (err) => console.error("[GUG Verifier] Network error:", err),
      });
    } else {
      fetch(EXCHANGE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      })
        .then((res) => res.text().then((text) => onComplete(res.status, text)))
        .catch((err) => console.error("[GUG Verifier] Fetch error:", err));
    }
  }

  // 4. PARLAMENTUM TRADE LEDGER SCRAPER (parlamentum.org/trade/ledger)
  // Extracts:
  // - Top stats (Fills, Bought, Sold, Items, By-Item breakdown)
  // - Table rows: Date, Side, Item, Qty, Price, Total, Tax, With (e.g. CardinalSanjay)
  function parseLedgerHtml(htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");

    // 1. Extract High-Level Stats
    let totalFills = 0;
    let boughtFills = 0;
    let soldFills = 0;
    let itemsCount = 0;
    const itemsBreakdown = [];

    const pageText = doc.body ? doc.body.innerText : "";

    const fillsMatch = pageText.match(/FILLS\s*[\n\r\s]*(\d+)/i);
    if (fillsMatch) totalFills = parseInt(fillsMatch[1], 10);

    const boughtMatch = pageText.match(/BOUGHT\s*[\n\r\s]*(\d+)\s*fills/i) || pageText.match(/BOUGHT\s*[\n\r\s]*(\d+)/i);
    if (boughtMatch) boughtFills = parseInt(boughtMatch[1], 10);

    const soldMatch = pageText.match(/SOLD\s*[\n\r\s]*(\d+)\s*fills/i) || pageText.match(/SOLD\s*[\n\r\s]*(\d+)/i);
    if (soldMatch) soldFills = parseInt(soldMatch[1], 10);

    const itemsMatch = pageText.match(/ITEMS\s*[\n\r\s]*(\d+)/i);
    if (itemsMatch) itemsCount = parseInt(itemsMatch[1], 10);

    // Extract item lines in "BY ITEM": e.g. "Food bought 233 · sold 30 3,828.20 -> 499.50 -3,328.70 USD"
    const byItemRegex = /([A-Za-z0-9\s]+?)\s+bought\s*(\d+)\s*·\s*sold\s*(\d+)\s*([\d,.]+)\s*→\s*([\d,.]+)\s*([+-]?[\d,.]+)\s*(USD|gold)/gi;
    let itemMatch;
    while ((itemMatch = byItemRegex.exec(pageText)) !== null) {
      itemsBreakdown.push({
        item: itemMatch[1].trim(),
        bought: parseInt(itemMatch[2], 10),
        sold: parseInt(itemMatch[3], 10),
        spent: parseFloat(itemMatch[4].replace(/,/g, "")),
        earned: parseFloat(itemMatch[5].replace(/,/g, "")),
        net: parseFloat(itemMatch[6].replace(/,/g, "")),
        currency: itemMatch[7],
      });
    }

    // 2. Extract Table Rows (Ledger)
    const entries = [];
    const rows = doc.querySelectorAll("table tbody tr, tr");

    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length >= 7) {
        const dateStr = (cells[0]?.innerText || cells[0]?.textContent || "").trim();
        const sideStr = (cells[1]?.innerText || cells[1]?.textContent || "").trim();
        const itemStr = (cells[2]?.innerText || cells[2]?.textContent || "").trim();
        const qtyStr = (cells[3]?.innerText || cells[3]?.textContent || "").trim();
        const priceStr = (cells[4]?.innerText || cells[4]?.textContent || "").trim();
        const totalStr = (cells[5]?.innerText || cells[5]?.textContent || "").trim();
        const taxStr = (cells[6]?.innerText || cells[6]?.textContent || "").trim();
        const withStr = (cells[7]?.innerText || cells[7]?.textContent || "").trim();

        // Must look like a transaction row (has date and side)
        const isDate = /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(dateStr);
        const hasSide = /SOLD|BOUGHT/i.test(sideStr);

        if (isDate && hasSide) {
          const qty = parseFloat(qtyStr.replace(/,/g, "")) || 0;
          const total = parseFloat(totalStr.replace(/[^0-9.]/g, "")) || 0;
          const tax = parseFloat(taxStr.replace(/[^0-9.]/g, "")) || 0;
          const currency = totalStr.toLowerCase().includes("usd") ? "USD" : "gold";
          const withUser = withStr.replace(/^[—\-\s]+|[—\-\s]+$/g, "").trim();

          const side = /SOLD/i.test(sideStr) ? "SOLD" : "BOUGHT";
          const sig = `ledger_${dateStr}_${side}_${itemStr.replace(/\s+/g, "_")}_${qty}_${total}_${currency}_${withUser}`;

          entries.push({
            date: dateStr,
            side: side,
            item: itemStr,
            qty: qty,
            price: priceStr,
            total: total,
            tax: tax,
            currency: currency,
            withUser: withUser,
            signature: sig,
          });
        }
      }
    });

    return {
      stats: {
        totalFills: totalFills || entries.length,
        boughtFills,
        soldFills,
        itemsCount: itemsCount || itemsBreakdown.length,
        itemsBreakdown,
      },
      entries,
    };
  }

  // 5. PERIODIC LEDGER SYNCHRONIZER
  async function syncTradeLedger(isManualClick = false) {
    if (!SECRET_API_KEY) {
      updateWidget("⚠️ GUG Verifier: paste the Operator Panel API key into this script", "#7f1d1d", "#f87171", "#ffffff");
      return;
    }
    try {
      let htmlText = "";

      // If user is currently on /trade/ledger, use live document HTML
      if (window.location.pathname.includes("/trade/ledger") && document.body) {
        htmlText = document.documentElement.outerHTML;
      } else {
        // Otherwise fetch /trade/ledger in background using active session cookies
        const res = await fetch("/trade/ledger", { credentials: "include" });
        if (!res.ok) {
          console.warn("[GUG Verifier] Failed to fetch /trade/ledger. Status:", res.status);
          if (isManualClick) updateWidget("⚠️ Sync Failed: Ledger unavailable", "#7f1d1d", "#f87171", "#ffffff");
          return;
        }
        htmlText = await res.text();
      }

      const { stats, entries } = parseLedgerHtml(htmlText);
      console.log(`[GUG Verifier] Parsed /trade/ledger: ${entries.length} fills, ${stats.itemsBreakdown.length} item summaries.`);

      if (entries.length === 0) {
        if (isManualClick) {
          updateWidget("ℹ️ Ledger synced: 0 entries found", "#1e293b", "#94a3b8", "#cbd5e1");
        }
        return;
      }

      // Send to Grow UR Gold
      sendWebhook({
        action: "webhook_ledger_sync",
        apiKey: SECRET_API_KEY,
        stats,
        entries,
      }, (data) => {
        if (data.success) {
          if (data.newCredits && data.newCredits.length > 0) {
            const creditSummary = data.newCredits.map((c) => `@${c.user} (+${c.gold}g)`).join(", ");
            console.log("%c[GUG Verifier] 🚀 NEW AUTO-CREDITS:", "background: #059669; color: #fff; font-weight: bold;", creditSummary);
            updateWidget(`✅ Auto-Credited: ${creditSummary}`, "#065f46", "#34d399", "#ffffff");

            // Mark in localStorage
            data.newCredits.forEach((c) => {
              markSignatureProcessed(`credit_${c.user}_${c.gold}`);
            });
          } else if (isManualClick) {
            updateWidget(`🟢 Ledger Synced (${entries.length} fills). Watching JosephArora`, "#064e3b", "#10b981", "#a7f3d0");
          }
        }
      });
    } catch (e) {
      console.warn("[GUG Verifier] Ledger sync error:", e);
      if (isManualClick) {
        updateWidget("⚠️ Sync error (check console)", "#7f1d1d", "#f87171", "#ffffff");
      }
    }
  }

  // 6. INITIALIZATION
  async function init() {
    const activeAccount = await detectActiveAccount();
    console.log(`[GUG Verifier] Active account identified as: ${activeAccount}`);

    if (activeAccount === "CARDINALSANJAY") {
      updateWidget(`⚪ GUG Verifier: Dormant (CardinalSanjay)`, "#1e293b", "#64748b", "#94a3b8");
      console.log("[GUG Verifier] Tab belongs to CardinalSanjay. Verifier is dormant on this tab.");
      return;
    }

    if (activeAccount === "JOSEPHARORA") {
      const isOnLedger = window.location.pathname.includes("/trade/ledger");
      updateWidget(
        isOnLedger
          ? `🟢 GUG Verifier: On Trade Ledger (JosephArora)`
          : `🟢 GUG Verifier: Watching Ledger (JosephArora)`,
        "#064e3b",
        "#10b981",
        "#a7f3d0"
      );

      // Run initial ledger sync
      syncTradeLedger();

      // Recurring sync every 10 seconds
      setInterval(syncTradeLedger, POLL_INTERVAL_MS);
      return;
    }

    updateWidget(`🟡 GUG Verifier v2.0: Ready (Click to Sync)`, "#1e293b", "#eab308", "#fef08a");
  }

  if (window.onurlchange === null) {
    window.addEventListener('urlchange', () => {
      setTimeout(init, 300);
    });
  }

  setTimeout(init, 600);
})();
