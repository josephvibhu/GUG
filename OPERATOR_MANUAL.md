# 🏛️ GROW UR GOLD ($GUG) — OFFICIAL EXCHANGE OPERATOR & MANAGER MANUAL

**Confidential — For Authorized Exchange Operators & Managers Only**  
*Platform URL: https://growurgold.vercel.app*  
*Operator Panel: https://growurgold.vercel.app/admin*  
*In-Game House Entity: `JosephArora` (Parlamentum)*

---

## 1. Welcome & Manager Account Overview

Welcome to the **Grow UR Gold ($GUG)** operator team. As the Exchange Manager, you oversee day-to-day liquidity, market hours, deposit/withdrawal settlements, IPO approvals, and weekly dividend distributions for the Parlamentum citizen economy.

### 🔑 Manager Login Credentials
* **Username:** `manager`
* **Default Password:** `ManagerPass2026!` *(Change immediately via Account > Change Password)*
* **Login URL:** https://growurgold.vercel.app/login

### 🛡️ Manager Account Role & Constraints
To maintain strict regulatory integrity and prevent insider trading:
1. **Operator Desk Only:** Your account is permanently locked to the Operator Panel (`/admin`). Attempting to visit trading or public pages will automatically redirect you back to `/admin`.
2. **No Personal Wallet:** Manager accounts have no personal deposit, withdrawal, or cash balance purse. You cannot hold or transfer personal gold on the site.
3. **No Stock Trading:** Manager accounts cannot place buy or sell orders on the exchange floor.
4. **No Personal IPOs:** Manager accounts cannot apply for or launch personal IPO charters.

---

## 2. Platform Architecture & Core Concept

Grow UR Gold operates as the high-speed financial bridge between the browser text MMORPG **Parlamentum** and a modern, high-frequency stock exchange.

```
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│     PARLAMENTUM (IN-GAME)       │           │      GROW UR GOLD (WEBSITE)     │
│                                 │           │                                 │
│  • Citizen sells Raw Iron to    │  Webhook  │  • Automated Watcher credits    │
│    House entity (`JosephArora`) │ ────────> │    Citizen's Web Wallet Purse   │
│  • House buys withdrawal items  │ <──────── │  • Citizen trades $GUG, $BCKRM  │
│    from Citizens in Parlamentum │  Manual   │  • Corporate Dividends settled  │
└─────────────────────────────────┘           └─────────────────────────────────┘
```

* **Game Currency:** Gold pieces (`g`).
* **Deposit Commodity Rail:** Players deposit gold by listing **Raw Iron** (or Cotton/Copper) in Parlamentum and selling it to the House (`JosephArora`) at the agreed conversion formula (`0.10g` per unit).
* **The House Entity:** In-game character name is `JosephArora`. This account holds the physical gold reserves inside Parlamentum.

---

## 3. Daily Duty 1: Managing In-Game Deposits

### A. The Automatic Watcher System
The website runs an automated watcher bot (`src/lib/watcher.ts`).
1. Every 60 seconds (or on user activity), the Watcher queries the Parlamentum API using the House session cookie.
2. When it sees an in-game purchase made by `JosephArora` from a citizen, it **automatically** deposits the net gold into that citizen's website balance.
3. Once automatically credited, the transaction is logged with a green verified tag.

### B. The Deposit Announcement Queue (`/admin` Section 2)
Before selling Raw Iron in-game, citizens submit a "Deposit Announcement" on the website declaring how much gold they are transferring.

**How to handle tickets in this queue:**
* **Scenario 1 — Watcher Already Credited It:**
  If the player's web balance already updated or the Watcher picked up the trade, do **NOT** click "Credit Gold" manually (this would double-credit the user!). Click **Reject** or let the ticket auto-clear.
* **Scenario 2 — Legitimate Manual Deposit:**
  If a player genuinely sold Raw Iron to `JosephArora` in-game but the Watcher was temporarily offline or delayed:
  1. Open Parlamentum and check `JosephArora`'s trade history.
  2. Confirm the player's name and exact gold amount received.
  3. On `/admin`, locate the ticket and click **Accept / Credit Gold**.
* **Scenario 3 — Ghost / Duplicate Tickets:**
  If a citizen submitted duplicate tickets or clicked "Announce" without ever selling items in-game, click **Reject / Dismiss**.

---

## 4. Daily Duty 2: Managing Player Withdrawals

When citizens want to convert their website gold back into in-game Parlamentum gold, they request a **Withdrawal**.

### ⚠️ Official Withdrawal Policy & Rules:
* **Window:** Withdrawal requests can **ONLY be submitted on Fridays (00:00 – 23:59 UTC)**. The website automatically closes submission on all other days.
* **Minimum Amount:** Strictly **100 gold minimum**.
* **Fulfillment SLA:** All Friday requests must be fulfilled in-game within **48 hours** (by Sunday 23:59 UTC).
* **Support Ticket Handling:** If a player has not received their in-game trade within 48 hours, they open a ticket on the Discord support server: `https://discord.gg/q3QA6WzHQZ`.

### Fulfilling a Withdrawal Step-by-Step:
1. Go to the **Withdrawals Queue** on `/admin`.
2. Note the citizen's **Parlamentum character name** and the **Net Gold Amount**.
3. Log into the Parlamentum game with the House character (`JosephArora`).
4. Find the player's trade offer / Raw Iron contract in-game (players list an agreed item for the gross gold amount).
5. Buy the item in Parlamentum so the gold transfers to them.
6. Return to `/admin` and click **Approve / Complete Withdrawal**.
   * *Note: The player's web balance is deducted upon request creation and permanently cleared once completed.*

---

## 5. Daily Duty 3: Exchange Trading Floor Operations

Grow UR Gold hosts listed stocks including **$GUG (Grow UR Gold)**, **$BCKRM (The Back Room)**, and **$EI (Europeon Inc)**.

### A. Market Trading Hours (Section 2.5)
* Stock trading runs during set UTC market sessions (e.g. `15:30` to `16:30` UTC).
* **Schedule Mode Options:**
  * **Auto:** Follows the scheduled open and close times automatically.
  * **Force Open:** Keeps the trading floor continuously active (useful during special events).
  * **Force Closed:** Pauses all trading for maintenance or audits.
* *To change hours:* Enter new Open/Close times and click **Save Schedule**.

### B. Secondary Trading & Exchange Fees
* Every matched trade on the exchange pays a **1.0% fee** to the platform house.
* Limit buy and sell orders match automatically via the in-memory order book engine.

---

## 6. Weekly Duty: Auditing Profits & Distributing Friday Dividends

Dividends are the cornerstone of shareholder trust. Grow UR Gold distributes profit dividends every **Friday at 00:00 UTC**.

### A. Understanding the Math (Float vs Founder Shares)
* Total Shares of $GUG = `10,000`
* **Founder Shares:** `8,995` shares (held by the platform treasury/founder).
* **Public Citizen Float:** `1,005` shares (~10% of total company).

> [!IMPORTANT]
> **Why Dividends Don't Drain the House:**
> If you declare a **20%** or **50%** dividend:
> * 90% of the dividend pool is paid on founder shares and **returns immediately to the company treasury**.
> * Only ~10% leaves the platform into public citizens' purses!
> * *Example:* On a 1,000g net profit, a 50% dividend pool is 500g. **450g returns straight to the founder**, while only **50g** is paid out to all public citizens combined!

### B. Step-by-Step: Declaring Weekly Dividends (`/admin` Section 5)
1. At the end of each weekly cycle (Thursdays / Fridays):
   * Calculate **Gross Platform Inflow** (Secondary trading fees + IPO listing fees + deposit rail spread).
   * Deduct **Operating Expenses** (Raw material procurement costs @ 0.10g avg + in-game postage tickets).
   * Result = **Net Operating Profit**.
2. Scroll to **Section 5: Corporate Earnings & Friday Dividend Desk**.
3. Select the Enterprise: **Grow UR Gold ($GUG)** (or any other chartered company reporting earnings).
4. Enter:
   * **Audited Net Profit** (e.g. `1006.91`)
   * **Dividend Payout Ratio (%)**: Select `20%`, `25%`, `30%`, or enter a custom amount.
   * **Period Title**: e.g., `Week 2 Official Audit Cycle`.
   * **Audit Notes**: Brief memo explaining trading performance.
5. Payout Execution:
   * If you check **"Distribute immediately"**: Shareholder purses are credited instantly on the spot, and an official announcement is posted to the bourse floor.
   * If left unchecked: The system schedules it for automatic sweeping at **Friday 00:00 UTC**.
   * Use the **"Force Friday Sweeper"** button if you ever need to manually trigger any pending scheduled distribution.

---

## 7. Corporate IPO Charter Applications (`/admin` Section 2.8)

Entrepreneurs in Parlamentum submit applications to list their companies on `/ipo`.

### How to Review and Approve an IPO:
1. Locate pending applications in **Section 2.8: IPO Applications & Price Negotiation Queue**.
2. Review the business description, production volume, Discord ID, and proposed valuation.
3. Adjust the parameters:
   * **Agreed IPO Price (Gold / Share)**
   * **Total Share Float**
   * **Founder Retained Ratio** (e.g. 50% founder / 50% public float)
4. Standard charter listing fee collected by the house is **200 gold**.
5. Click **Approve IPO** to charter the company onto the live bourse floor, or **Reject IPO** with feedback notes.

---

## 8. Compliance, Support & Security Tools

### A. One-Time Password Reset Codes
If a player forgets their password:
1. Search for the player under **Section 4: Citizen Wealth & Accounts Inspector**.
2. Click **Generate Reset Code**.
3. Copy the secure 12-character code (e.g. `ABCD-EFGH-JKLM`) and DM it to the player privately on Discord.
4. The code expires in 24 hours and allows the player to set a new password on `/login?mode=change`.

### B. Account Freezing
If an account is flagged for exploit attempts or duplicate abuse:
1. Find the citizen in the inspector table.
2. Click **Freeze Account**.
3. All cash withdrawals, stock transfers, and order submissions are suspended for that account until unfrozen.

### C. Discord Webhook Alerts (Section 3)
* Connect your Discord channel webhook URL.
* Set whale order alerts (default: `25 gold`).
* The system broadcasts real-time trades, IPO listings, and dividend distribution notices.

---

## 9. Quick Reference Cheat Sheet

| Situation | Recommended Action |
| :--- | :--- |
| Player deposits Raw Iron in-game | Verify trade on `JosephArora` in Parlamentum -> If not auto-credited by Watcher, approve manual deposit ticket on `/admin`. |
| Player requests Gold Withdrawal (Fridays only, min 100g) | Verify Friday request -> Buy item in Parlamentum with `JosephArora` within 48h -> Mark withdrawal Approved on `/admin`. |
| Citizen submits duplicate/ghost ticket | Click **Reject** on `/admin`. Never credit without verifying in-game trade history. |
| Thursday/Friday Dividend Day | Audit weekly net profit -> Go to Section 5 on `/admin` -> Enter profit & % -> Click Distribute Immediately. |
| Player forgot password | Generate one-time reset code in Section 4 -> Send privately via Discord. |
| Market needs to stay open for an event | Set Market Schedule to **Force Open** and click Save Schedule. |

---
*Grow UR Gold Operations Manual — Revision 2.4 — October 2026*
