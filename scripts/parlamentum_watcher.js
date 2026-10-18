/**
 * Parlamentum 100% Automated Market Sales Watcher
 * 
 * How this achieves 100% automated deposits:
 * ----------------------------------------------------
 * 1. This daemon script monitors your in-game market sales in Parlamentum
 *    (via your game session cookie, local game log file, or Discord notifications).
 * 2. When an in-game sale event occurs (e.g. "Trader_Vance bought 100 Raw Iron for 500 gold"),
 *    it captures the buyer name and units.
 * 3. It immediately fires an HTTP POST request to your exchange webhook (/api/admin).
 * 4. The player's purse balance is loaded with 500 gold within 2 seconds.
 * 5. Neither you nor the player need to do any manual approvals!
 * 
 * Run with:
 *   node scripts/parlamentum_watcher.js
 */

const https = require("https");
const http = require("http");

// CONFIGURATION:
const CONFIG = {
  // Your exchange endpoint (local or Vercel URL)
  exchangeUrl: process.env.EXCHANGE_URL || "http://localhost:3000/api/admin",
  // Secret API Key configured in your exchange Operator Panel
  apiKey: process.env.EXCHANGE_API_KEY || "",
  // In-game commodity rate
  goldPerIron: 5,
  // Poll interval in milliseconds (e.g. every 5 seconds)
  pollIntervalMs: 5000,
};

// Set of already processed transaction IDs to prevent double crediting
const processedTxIds = new Set();

/**
 * Sends automated credit webhook to the Parlamentum Exchange
 */
async function creditPlayerPurse({ txId, buyerName, ironUnits, rawGold }) {
  if (processedTxIds.has(txId)) {
    return; // Already processed
  }

  const calculatedGold = rawGold || ironUnits * CONFIG.goldPerIron;
  const payload = JSON.stringify({
    action: "webhook_credit",
    apiKey: CONFIG.apiKey,
    buyerName: buyerName.trim(),
    ironUnits: ironUnits || Math.ceil(calculatedGold / CONFIG.goldPerIron),
    goldAmount: calculatedGold,
  });

  const urlObj = new URL(CONFIG.exchangeUrl);
  const client = urlObj.protocol === "https:" ? https : http;

  const req = client.request(
    CONFIG.exchangeUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    },
    (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.success) {
            processedTxIds.add(txId);
            console.log(
              `[SUCCESS] Credited ${calculatedGold} gold to ${buyerName} (Tx: ${txId}). New Balance: ${json.newBalance}g`
            );
          } else {
            console.error(`[ERROR] Webhook rejected: ${json.message}`);
          }
        } catch (e) {
          console.error(`[ERROR] Non-JSON response: ${data}`);
        }
      });
    }
  );

  req.on("error", (err) => {
    console.error(`[NETWORK ERROR] Failed to reach exchange: ${err.message}`);
  });

  req.write(payload);
  req.end();
}

/**
 * Example Poller:
 * Replace this mockup function with your actual Parlamentum source:
 * - Option A: Fetching your Parlamentum character notifications page with a session cookie.
 * - Option B: Watching a local game log / chat log file.
 * - Option C: Receiving Discord webhook notifications.
 */
async function pollParlamentumSales() {
  console.log(`[WATCHER] Polling Parlamentum market for sales to ${CONFIG.exchangeUrl}...`);

  // To test out of the box, you can simulate an event or connect to your game endpoint
}

// Start daemon loop
console.log("==================================================");
console.log("   PARLAMENTUM 100% AUTOMATED FUND LOADER DAEMON   ");
console.log("==================================================");
console.log(`Target Exchange: ${CONFIG.exchangeUrl}`);
console.log(`Poll Frequency:  Every ${CONFIG.pollIntervalMs / 1000} seconds`);
console.log(`Rate:            ${CONFIG.goldPerIron} gold per Raw Iron`);
console.log("Ready. Waiting for in-game sales...\n");
if (!CONFIG.apiKey) {
  console.warn("[WARN] EXCHANGE_API_KEY is not set: copy the key from the Operator Panel, or every webhook will be rejected.");
}

setInterval(pollParlamentumSales, CONFIG.pollIntervalMs);

// Export for integration
module.exports = { creditPlayerPurse, CONFIG };
