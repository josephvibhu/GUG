// ==UserScript==
// @name         Grow UR Gold - Parlamentum Deposit Verifier
// @namespace    https://growurgold.vercel.app/
// @version      1.1.0
// @description  Automatically detects Raw Iron sales on operator JosephArora's Parlamentum account and verifies matching citizen deposits in Grow UR Gold.
// @author       Grow UR Gold Exchange Team
// @match        *://parlamentum.org/*
// @match        *://*.parlamentum.org/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      growurgold.vercel.app
// @connect      grow-ur-gold.vercel.app
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  console.log("%c[GUG Verifier] Script Loaded on " + window.location.href, "background: #10b981; color: #000; font-size: 13px; font-weight: bold; padding: 4px 8px; border-radius: 4px;");

  // CONFIGURATION
  const OPERATOR_NAMES = ["JOSEPHARORA", "JOSEPH ARORA", "JOSEPH_ARORA"];
  const CITIZEN_NAMES = ["CARDINALSANJAY", "CARDINAL SANJAY", "CARDINAL_SANJAY"];
  const EXCHANGE_API_URL = "https://growurgold.vercel.app/api/admin";
  const SECRET_API_KEY = "pse_secret_parlamentum_key_2026";
  const POLL_INTERVAL_MS = 15000;

  const STORAGE_KEY = "gug_processed_sales_v2";

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
      if (list.length > 500) list.shift();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
  }

  // 1. FLOATING STATUS WIDGET (Positioned cleanly above the in-game bottom dock)
  let statusBadge = null;
  function updateWidget(htmlContent, bgColor = "#0f172a", borderColor = "#10b981", textColor = "#f8fafc") {
    if (!statusBadge) {
      statusBadge = document.createElement("div");
      statusBadge.id = "gug-verifier-widget";
      statusBadge.style.position = "fixed";
      statusBadge.style.bottom = "75px"; // Floats above the in-game +99 chat / energy dock
      statusBadge.style.right = "18px";
      statusBadge.style.zIndex = "2147483647"; // Above all in-game layers
      statusBadge.style.padding = "8px 14px";
      statusBadge.style.borderRadius = "10px";
      statusBadge.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      statusBadge.style.fontSize = "12px";
      statusBadge.style.fontWeight = "600";
      statusBadge.style.boxShadow = "0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(16, 185, 129, 0.2)";
      statusBadge.style.border = "1.5px solid " + borderColor;
      statusBadge.style.cursor = "pointer";
      statusBadge.style.userSelect = "none";
      statusBadge.style.display = "flex";
      statusBadge.style.alignItems = "center";
      statusBadge.style.gap = "8px";
      statusBadge.title = "Click to run instant deposit check";
      statusBadge.onclick = () => {
        updateWidget("⚡ Checking now...", "#0f766e", "#2dd4bf", "#ffffff");
        checkNotifications(true);
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

  // Show immediate initialization state
  updateWidget("🟡 GUG Verifier: Initializing...", "#1e293b", "#eab308", "#fef08a");

  // 2. ACCURATE ACCOUNT DETECTOR (Handles both Home dashboard and subpages like /notifications)
  async function detectActiveAccount() {
    const pageText = (document.body ? document.body.innerText : "").toUpperCase();

    for (const name of OPERATOR_NAMES) {
      if (pageText.includes(name)) return "JOSEPHARORA";
    }
    for (const name of CITIZEN_NAMES) {
      if (pageText.includes(name)) return "CARDINALSANJAY";
    }

    // On /notifications or other subpages, the left character card is hidden.
    // Fetch the home page dashboard to inspect the logged-in session!
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

  // 3. SEND WEBHOOK TO GROW UR GOLD
  function notifyExchange(units, gold, rawText) {
    console.log(`[GUG Verifier] 🚀 Sending sale event: ${units} Raw Iron for ${gold} gold`);
    updateWidget(`⚡ Verifying: ${units} Iron (${gold}g)...`, "#0f766e", "#2dd4bf", "#ffffff");

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
            console.log(`[GUG Verifier] ✅ SUCCESS:`, data.message);
            updateWidget(`✅ Auto-Credited: ${data.message}`, "#065f46", "#34d399", "#ffffff");
          } else {
            console.log(`[GUG Verifier] ℹ️ Sale recorded:`, data.message);
            updateWidget(`ℹ️ Sale recorded (${gold}g) · No pending queue match`, "#1e293b", "#94a3b8", "#cbd5e1");
          }
        } else {
          console.warn(`[GUG Verifier] ⚠️ Exchange error:`, data.message);
          updateWidget(`⚠️ Exchange: ${data.message}`, "#7f1d1d", "#f87171", "#ffffff");
        }
      } catch (e) {
        console.error(`[GUG Verifier] Failed to parse response:`, responseText);
      }

      setTimeout(() => {
        updateWidget(`🟢 GUG Verifier: Watching JosephArora`, "#064e3b", "#10b981", "#a7f3d0");
      }, 7000);
    };

    if (typeof GM_xmlhttpRequest !== "undefined") {
      GM_xmlhttpRequest({
        method: "POST",
        url: EXCHANGE_API_URL,
        headers: { "Content-Type": "application/json" },
        data: payload,
        onload: (res) => onComplete(res.status, res.responseText),
        onerror: (err) => console.error("[GUG Verifier] GM network error:", err),
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
  // Supports: "2× Raw Iron sold — 10.00 gold is in your wallet." / "2x Raw Iron sold - 10 gold is in your wallet."
  function parseAndProcessNotifications(htmlText) {
    const processed = getProcessedSales();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");

    let countFound = 0;
    const elements = doc.querySelectorAll("li, tr, div, p, span");
    elements.forEach((el) => {
      const text = el.innerText || el.textContent || "";
      // Broad regex matching quantity, Raw Iron sold, and gold amount
      const match = text.match(/(\d+)\s*[×x*]?\s*Raw\s*Iron\s*sold\s*[—–-]?\s*([\d.]+)\s*gold/i);

      if (match) {
        const units = parseInt(match[1], 10);
        const gold = parseFloat(match[2]);
        const cleanSignature = `sale_raw_iron_${units}u_${gold}g_${text.slice(0, 50).replace(/\s+/g, "_")}`;

        if (!processed.includes(cleanSignature)) {
          countFound++;
          console.log(`[GUG Verifier] New unprocessed Raw Iron sale:`, text.trim());
          markSaleProcessed(cleanSignature);
          notifyExchange(units, gold, text.trim());
        }
      }
    });

    return countFound;
  }

  // 5. BACKGROUND CHECKER: Fetch /notifications using active session
  async function checkNotifications(isManualClick = false) {
    try {
      // Also scan current DOM if we are already on /notifications
      if (window.location.pathname.includes("/notifications") && document.body) {
        parseAndProcessNotifications(document.body.innerHTML);
      }

      const res = await fetch("/notifications", { credentials: "include" });
      if (res.ok) {
        const html = await res.text();
        const found = parseAndProcessNotifications(html);
        if (isManualClick && found === 0) {
          updateWidget(`🟢 Checked: 0 new sales. Watching JosephArora`, "#064e3b", "#10b981", "#a7f3d0");
        }
      }
    } catch (e) {
      console.warn("[GUG Verifier] Error checking /notifications:", e);
      if (isManualClick) {
        updateWidget(`⚠️ Check failed: Network error`, "#7f1d1d", "#f87171", "#ffffff");
      }
    }
  }

  // 6. INITIALIZATION FLOW
  async function init() {
    const activeAccount = await detectActiveAccount();
    console.log(`[GUG Verifier] Active account identified as: ${activeAccount}`);

    if (activeAccount === "CARDINALSANJAY") {
      updateWidget(`⚪ GUG Verifier: Dormant (CardinalSanjay)`, "#1e293b", "#64748b", "#94a3b8");
      console.log("[GUG Verifier] Tab belongs to CardinalSanjay. Verifier is dormant on this tab.");
      return;
    }

    if (activeAccount === "JOSEPHARORA") {
      updateWidget(`🟢 GUG Verifier: Watching JosephArora`, "#064e3b", "#10b981", "#a7f3d0");
      console.log("[GUG Verifier] Tab confirmed as JosephArora! Starting deposit listener...");

      // Initial check
      checkNotifications();

      // Recurring check
      setInterval(checkNotifications, POLL_INTERVAL_MS);
      return;
    }

    // If still UNKNOWN after probe, allow manual click to watch
    updateWidget(`🟡 GUG Verifier: Ready (Click to Sync)`, "#1e293b", "#eab308", "#fef08a");
  }

  // Run initialization after 500ms
  setTimeout(init, 500);
})();
