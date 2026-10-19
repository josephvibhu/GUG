// ==UserScript==
// @name         Grow UR Gold - Parlamentum Trade Ledger & Deposit Verifier
// @namespace    https://growurgold.vercel.app/
// @version      2.1.0
// @description  Automatically detects Raw Iron sales & trade fills on operator JosephArora's Parlamentum account by scraping /trade/ledger and auto-credits citizen purses in Grow UR Gold with zero latency.
// @author       Grow UR Gold Exchange Team
// @match        *://parlamentum.org/*
// @match        *://*.parlamentum.org/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @grant        window.onurlchange
// @connect      growurgold.vercel.app
// @connect      grow-ur-gold.vercel.app
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  console.log("%c[GUG Verifier v2.1] Ledger Edition Loaded on " + window.location.href, "background: #10b981; color: #000; font-size: 13px; font-weight: bold; padding: 4px 8px; border-radius: 4px;");

  // CONFIGURATION
  const OPERATOR_NAMES = ["JOSEPHARORA", "JOSEPH ARORA", "JOSEPH_ARORA"];
  const CITIZEN_NAMES = ["CARDINALSANJAY", "CARDINAL SANJAY", "CARDINAL_SANJAY"];
  const EXCHANGE_API_URL = "https://growurgold.vercel.app/api/admin";
  const SECRET_API_KEY = ""; // Paste here, or click the HUD badge in Parlamentum to enter once!
  const POLL_INTERVAL_MS = 10000; // 10 seconds background sync
  const STORAGE_KEY = "gug_processed_ledger_v2";

  function getActiveApiKey() {
    if (SECRET_API_KEY && SECRET_API_KEY.trim()) return SECRET_API_KEY.trim();
    try {
      if (typeof GM_getValue !== "undefined") {
        const val = GM_getValue("gug_api_key", "");
        if (val && val.trim()) return val.trim();
      }
    } catch {}
    try {
      if (typeof localStorage !== "undefined") {
        const val = localStorage.getItem("gug_api_key") || "";
        if (val && val.trim()) return val.trim();
      }
    } catch {}
    return "";
  }

  function setActiveApiKey(newKey) {
    const trimmed = (newKey || "").trim();
    try {
      if (typeof GM_setValue !== "undefined") {
        GM_setValue("gug_api_key", trimmed);
      }
    } catch {}
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("gug_api_key", trimmed);
      }
    } catch {}
    return trimmed;
  }

  function promptForApiKey() {
    const current = getActiveApiKey();
    const entered = window.prompt(
      "🔑 Grow UR Gold Operator Key\n\nEnter the secret API key shown in your Operator Panel (/admin):",
      current
    );
    if (entered !== null) {
      const saved = setActiveApiKey(entered);
      if (saved) {
        updateWidget("⚡ Key saved! Syncing now...", "#0f766e", "#2dd4bf", "#ffffff");
        syncTradeLedger(true);
      } else {
        updateWidget("⚠️ No API Key set (Click to enter)", "#7f1d1d", "#f87171", "#ffffff");
      }
    }
  }

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
  function updateWidget(htmlContent, bgColor = "#0f172a", borderColor = "#10b981", textColor = "#f8fafc", customAction = null) {
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
      statusBadge.title = "Grow UR Gold Verifier • Click to Sync (or hold Shift to change API key)";

      if (document.body) {
        document.body.appendChild(statusBadge);
      } else {
        document.addEventListener("DOMContentLoaded", () => document.body.appendChild(statusBadge));
      }
    }

    statusBadge.onclick = (e) => {
      if ((e.target).tagName === "A") return;
      if (e.shiftKey || !getActiveApiKey()) {
        promptForApiKey();
        return;
      }
      if (customAction) {
        customAction();
        return;
      }
      updateWidget("⚡ Syncing /trade/ledger now...", "#0f766e", "#2dd4bf", "#ffffff");
      syncTradeLedger(true);
    };

    statusBadge.textContent = htmlContent;
    statusBadge.style.backgroundColor = bgColor;
    statusBadge.style.borderColor = borderColor;
    statusBadge.style.color = textColor;
  }

  updateWidget("🟡 GUG Verifier v2.1: Initializing...", "#1e293b", "#eab308", "#fef08a");

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

  // 3. SEND WEBHOOK PAYLOAD
  function sendWebhook(payloadObj, callback) {
    const payload = JSON.stringify(payloadObj);

    const onComplete = (status, responseText) => {
      try {
        const data = JSON.parse(responseText);
        if (callback) callback(data, status);
      } catch (e) {
        console.error(`[GUG Verifier] JSON parse error:`, responseText);
        if (callback) callback({ success: false, message: `Parse error (${status})` }, status);
      }
    };

    if (typeof GM_xmlhttpRequest !== "undefined") {
      GM_xmlhttpRequest({
        method: "POST",
        url: EXCHANGE_API_URL,
        headers: { "Content-Type": "application/json" },
        data: payload,
        onload: (res) => onComplete(res.status, res.responseText),
        onerror: (err) => {
          console.error("[GUG Verifier] Network error:", err);
          updateWidget("⚠️ Network error contacting GUG", "#7f1d1d", "#f87171", "#ffffff");
        },
      });
    } else {
      fetch(EXCHANGE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      })
        .then((res) => res.text().then((text) => onComplete(res.status, text)))
        .catch((err) => {
          console.error("[GUG Verifier] Fetch error:", err);
          updateWidget("⚠️ Fetch error contacting GUG", "#7f1d1d", "#f87171", "#ffffff");
        });
    }
  }

  // 4. PARLAMENTUM TRADE LEDGER SCRAPER (parlamentum.org/trade/ledger)
  function parseLedgerHtml(htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");

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
    const key = getActiveApiKey();
    if (!key) {
      updateWidget("⚠️ GUG Verifier: Missing API Key (Click to Enter)", "#7f1d1d", "#f87171", "#ffffff", promptForApiKey);
      return;
    }

    try {
      let htmlText = "";

      if (window.location.pathname.includes("/trade/ledger") && document.body) {
        htmlText = document.documentElement.outerHTML;
      } else {
        const res = await fetch("/trade/ledger", { credentials: "include" });
        if (!res.ok) {
          console.warn("[GUG Verifier] Failed to fetch /trade/ledger. Status:", res.status);
          if (isManualClick) updateWidget(`⚠️ Ledger unavailable (${res.status})`, "#7f1d1d", "#f87171", "#ffffff");
          return;
        }
        htmlText = await res.text();
      }

      const { stats, entries } = parseLedgerHtml(htmlText);
      console.log(`[GUG Verifier] Parsed /trade/ledger: ${entries.length} fills, ${stats.itemsBreakdown.length} item summaries.`);

      if (entries.length === 0) {
        if (isManualClick) {
          updateWidget("ℹ️ Ledger synced: 0 fills found", "#1e293b", "#94a3b8", "#cbd5e1");
        }
        return;
      }

      sendWebhook({
        action: "webhook_ledger_sync",
        apiKey: key,
        stats,
        entries,
      }, (data, status) => {
        if (status === 401 || !data.success) {
          if (data.message && data.message.includes("Invalid API Key")) {
            updateWidget("⚠️ Invalid API Key (Click to Change)", "#7f1d1d", "#f87171", "#ffffff", promptForApiKey);
          } else {
            updateWidget(`⚠️ Sync error: ${data.message || "Failed"}`, "#7f1d1d", "#f87171", "#ffffff");
          }
          return;
        }

        if (data.success) {
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          if (data.newCredits && data.newCredits.length > 0) {
            const creditSummary = data.newCredits.map((c) => `@${c.user} (+${c.gold}g)`).join(", ");
            console.log("%c[GUG Verifier] 🚀 NEW AUTO-CREDITS:", "background: #059669; color: #fff; font-weight: bold;", creditSummary);
            updateWidget(`✅ Auto-Credited: ${creditSummary}`, "#065f46", "#34d399", "#ffffff");
            data.newCredits.forEach((c) => markSignatureProcessed(`credit_${c.user}_${c.gold}`));
          } else {
            updateWidget(`🟢 Ledger Synced (${entries.length} fills) • ${timeStr}`, "#064e3b", "#10b981", "#a7f3d0");
          }
        }
      });
    } catch (e) {
      console.warn("[GUG Verifier] Ledger sync error:", e);
      if (isManualClick) updateWidget("⚠️ Sync error (check console)", "#7f1d1d", "#f87171", "#ffffff");
    }
  }

  // 6. INITIALIZATION & RECURRING MONITOR
  let syncIntervalId = null;

  async function checkAndRun() {
    const isOnLedger = window.location.pathname.includes("/trade/ledger");
    const activeAccount = await detectActiveAccount();
    console.log(`[GUG Verifier] Active account detected: ${activeAccount} (onLedger: ${isOnLedger})`);

    // Case A: User is browsing as CardinalSanjay
    if (activeAccount === "CARDINALSANJAY") {
      updateWidget("⚪ GUG: Dormant on @CardinalSanjay (Click to Sync)", "#1e293b", "#64748b", "#cbd5e1");
      if (syncIntervalId) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
      }
      return;
    }

    // Case B: Logged in as JosephArora OR on /trade/ledger page
    if (activeAccount === "JOSEPHARORA" || isOnLedger) {
      updateWidget(
        isOnLedger ? "🟢 GUG Verifier: On Trade Ledger" : "🟢 GUG Verifier: Watching Ledger (JosephArora)",
        "#064e3b", "#10b981", "#a7f3d0"
      );

      // Run sync immediately
      syncTradeLedger();

      // Ensure background sync is running
      if (!syncIntervalId) {
        syncIntervalId = setInterval(syncTradeLedger, POLL_INTERVAL_MS);
      }
      return;
    }

    // Case C: Account not yet detected
    updateWidget("🟡 GUG Verifier: Ready (Click to Sync)", "#1e293b", "#eab308", "#fef08a");
  }

  let initCheckCount = 0;
  function scheduleInit() {
    checkAndRun().then(() => {
      initCheckCount++;
      if (initCheckCount < 5) {
        setTimeout(scheduleInit, 3000);
      }
    });
  }

  if (window.onurlchange === null) {
    window.addEventListener('urlchange', () => {
      setTimeout(checkAndRun, 400);
    });
  }

  setTimeout(scheduleInit, 600);
})();
