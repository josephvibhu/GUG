// ==UserScript==
// @name         Grow UR Gold - Parlamentum Deposit Verifier
// @namespace    https://growurgold.vercel.app/
// @version      1.0.0
// @description  Automatically detects Raw Iron sales on operator JosephArora's Parlamentum account and verifies matching citizen deposits in Grow UR Gold.
// @author       Grow UR Gold Exchange Team
// @match        https://parlamentum.org/*
// @match        http://parlamentum.org/*
// @grant        GM_xmlhttpRequest
// @connect      growurgold.vercel.app
// @connect      grow-ur-gold.vercel.app
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // CONFIGURATION
  const OPERATOR_USERNAME = "JOSEPHARORA"; // Only monitor this character
  const EXCHANGE_API_URL = "https://growurgold.vercel.app/api/admin";
  const SECRET_API_KEY = "pse_secret_parlamentum_key_2026";
  const POLL_INTERVAL_MS = 15000; // Check notifications every 15 seconds

  // STORAGE KEY for processed notifications to prevent duplicate credits
  const STORAGE_KEY = "gug_processed_sales_v1";

  function getProcessedSales() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function markSaleProcessed(signature) {
    const list = getProcessedSales();
    if (!list.includes(signature)) {
      list.push(signature);
      // Keep list within recent 500 items
      if (list.length > 500) list.shift();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
  }

  // 1. ACCOUNT DETECTOR: Check if the current tab belongs to JosephArora
  function detectActiveAccount() {
    const pageText = (document.body ? document.body.innerText : "").toUpperCase();
    if (pageText.includes(OPERATOR_USERNAME)) {
      return OPERATOR_USERNAME;
    }

    // Try finding other common citizen names to show in dormant badge
    const cardMatch = pageText.match(/CARDINALSANJAY/);
    if (cardMatch) return "CARDINALSANJAY";

    return "OTHER_OR_UNKNOWN";
  }

  // 2. CREATE STATUS WIDGET ON SCREEN
  let statusBadge = null;
  function updateWidget(text, bgColor = "#1e293b", textColor = "#38bdf8") {
    if (!statusBadge) {
      statusBadge = document.createElement("div");
      statusBadge.style.position = "fixed";
      statusBadge.style.bottom = "12px";
      statusBadge.style.right = "12px";
      statusBadge.style.zIndex = "999999";
      statusBadge.style.padding = "7px 12px";
      statusBadge.style.borderRadius = "8px";
      statusBadge.style.fontFamily = "system-ui, -apple-system, sans-serif";
      statusBadge.style.fontSize = "12px";
      statusBadge.style.fontWeight = "600";
      statusBadge.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
      statusBadge.style.border = "1px solid rgba(255,255,255,0.15)";
      statusBadge.style.transition = "all 0.3s ease";
      statusBadge.style.pointerEvents = "none";
      document.body.appendChild(statusBadge);
    }
    statusBadge.innerText = text;
    statusBadge.style.backgroundColor = bgColor;
    statusBadge.style.color = textColor;
  }

  // 3. SEND WEBHOOK TO GROW UR GOLD
  function notifyExchange(units, gold, rawText) {
    console.log(`[GUG Verifier] Sending sale event: ${units} Raw Iron for ${gold} gold`);
    updateWidget(`⚡ Verifying sale: ${units} Iron (${gold}g)...`, "#0f766e", "#2dd4bf");

    const payload = JSON.stringify({
      action: "webhook_sale_event",
      apiKey: SECRET_API_KEY,
      ironUnits: units,
      goldAmount: gold,
      rawNotification: rawText,
    });

    const onComplete = (status, responseText) => {
      try {
        const data = JSON.parse(responseText);
        if (data.success) {
          if (data.matched) {
            console.log(`[GUG Verifier] SUCCESS:`, data.message);
            updateWidget(`✅ Auto-Credited: ${data.message}`, "#065f46", "#34d399");
          } else {
            console.log(`[GUG Verifier] Sale recorded:`, data.message);
            updateWidget(`ℹ️ Sale recorded (No deposit queue match)`, "#374151", "#9ca3af");
          }
        } else {
          console.warn(`[GUG Verifier] Exchange returned:`, data.message);
          updateWidget(`⚠️ Exchange: ${data.message}`, "#7f1d1d", "#fca5a5");
        }
      } catch (e) {
        console.error(`[GUG Verifier] Failed to parse response:`, responseText);
      }

      // Reset to idle watching status after 6 seconds
      setTimeout(() => {
        updateWidget(`🟢 GUG Verifier: Watching ${OPERATOR_USERNAME}`, "#064e3b", "#a7f3d0");
      }, 6000);
    };

    // Use GM_xmlhttpRequest if available, otherwise fallback to window.fetch
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

  // 4. SCAN HTML TEXT FOR RAW IRON SALE NOTIFICATIONS
  // Format example: "2× Raw Iron sold — 10.00 gold is in your wallet." or "2x Raw Iron sold - 10 gold is in your wallet."
  function parseAndProcessNotifications(htmlText) {
    const processed = getProcessedSales();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");

    // Scan all text blocks or list elements
    const elements = doc.querySelectorAll("li, tr, div, p, span");
    elements.forEach((el) => {
      const text = el.innerText || el.textContent || "";
      // Regex pattern matching Parlamentum sale notification
      const match = text.match(/(\d+)\s*[×x*]\s*Raw Iron sold\s*[—–-]\s*([\d.]+)\s*gold is in your wallet/i);

      if (match) {
        const units = parseInt(match[1], 10);
        const gold = parseFloat(match[2]);
        const cleanSignature = `sale_raw_iron_${units}u_${gold}g_${text.slice(0, 60).replace(/\s+/g, "_")}`;

        if (!processed.includes(cleanSignature)) {
          console.log(`[GUG Verifier] New unprocessed sale found:`, text.trim());
          markSaleProcessed(cleanSignature);
          notifyExchange(units, gold, text.trim());
        }
      }
    });
  }

  // 5. BACKGROUND CHECKER: Fetch /notifications using active session
  async function checkNotifications() {
    try {
      const res = await fetch("/notifications", { credentials: "include" });
      if (res.ok) {
        const html = await res.text();
        parseAndProcessNotifications(html);
      }
    } catch (e) {
      console.warn("[GUG Verifier] Error fetching /notifications:", e);
    }
  }

  // 6. MAIN CONTROLLER
  function init() {
    const activeAccount = detectActiveAccount();

    if (activeAccount !== OPERATOR_USERNAME) {
      // Different account open in this tab (e.g. CardinalSanjay)!
      // DO NOT run verifier here to prevent any cross-account confusion.
      console.log(`[GUG Verifier] Tab is logged in as '${activeAccount}'. Script inactive on this tab.`);
      updateWidget(`⚪ GUG Verifier: Dormant (${activeAccount})`, "#1e293b", "#64748b");
      return;
    }

    // This tab is logged in as JosephArora!
    console.log(`[GUG Verifier] Active account confirmed as ${OPERATOR_USERNAME}. Starting deposit listener...`);
    updateWidget(`🟢 GUG Verifier: Watching ${OPERATOR_USERNAME}`, "#064e3b", "#a7f3d0");

    // If currently on /notifications, parse immediately from live DOM
    if (window.location.pathname.includes("/notifications")) {
      parseAndProcessNotifications(document.body.innerHTML);
    }

    // Also run initial background check
    checkNotifications();

    // Set recurring interval check
    setInterval(() => {
      // Re-verify that account is still JosephArora
      if (detectActiveAccount() === OPERATOR_USERNAME) {
        checkNotifications();
      }
    }, POLL_INTERVAL_MS);
  }

  // Wait 1.5 seconds for page and navigation to fully render before checking
  setTimeout(init, 1500);
})();
