import { NextResponse, after } from "next/server";
import { maybeWatch } from "@/lib/watcher";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { 
  IRON_UNIT_PRICE, 
  getSetting, 
  calculateDepositRecipe, 
  calculateWithdrawalRecipe 
} from "@/lib/wallet";
import crypto from "crypto";

export async function GET() {
  try {
    await initDb();
    const db = getDb();
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const [taxRateStr, houseName] = await Promise.all([
      getSetting("tax_rate", "10"),
      getSetting("house_name", "JosephArora"),
    ]);

    const taxRate = parseFloat(taxRateStr) || 10;

    // Fetch user's wallet transactions
    const ledgerRes = await db.execute({
      sql: `SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`,
      args: [user.id],
    });

    const ledger = ledgerRes.rows.map((r: any) => ({
      id: String(r.id),
      type: String(r.type),
      method: String(r.method),
      amount: Number(r.amount),
      ironUnits: Number(r.iron_units || 0),
      parlamentumName: String(r.parlamentum_name),
      status: String(r.status),
      recipeNote: String(r.recipe_note || ""),
      taxRate: Number(r.tax_rate ?? taxRate),
      createdAt: String(r.created_at),
    }));

    return NextResponse.json({
      success: true,
      balance: user.cashBalance,
      lockedCash: user.lockedCash,
      houseOperator: houseName,
      parlamentumName: user.parlamentumName || user.username,
      ironPrice: IRON_UNIT_PRICE,
      taxRate,
      ledger,
    });
  } catch (error: any) {
    console.error("GET /api/wallet error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDb();
    const db = getDb();
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "Please log in with your Parlamentum name." }, { status: 401 });
    }

    if (user.isFrozen) {
      return NextResponse.json({ 
        success: false, 
        message: "Your citizen wallet has been FROZEN by the Exchange Operator pending compliance review. Cash operations are suspended." 
      }, { status: 403 });
    }

    const body = await request.json();
    const { action, amount, method, parlamentumName } = body;
    const numAmount = Math.floor(Number(amount));
    const targetName = (parlamentumName || user.parlamentumName || user.username).trim();

    if (!Number.isFinite(numAmount) || numAmount < IRON_UNIT_PRICE) {
      return NextResponse.json({ success: false, message: `Minimum transaction is ${IRON_UNIT_PRICE} gold.` }, { status: 400 });
    }

    const [taxRateStr, houseName] = await Promise.all([
      getSetting("tax_rate", "10"),
      getSetting("house_name", "JosephArora"),
    ]);

    const taxRate = parseFloat(taxRateStr) || 10;

    const now = new Date().toISOString();
    const txId = `tx_${crypto.randomUUID().slice(0, 8)}`;

    if (action === "deposit") {
      // 1. DEPOSIT (Buy Raw Iron at 10 gold each)
      const depositCalc = calculateDepositRecipe(numAmount, taxRate);
      const ironUnits = depositCalc.ironUnits;
      const actualGold = depositCalc.grossTotal;

      const recipe = method === "CONTRACT"
        ? `In-game contract to ${houseName} giving ${actualGold} gold + 1 courier ticket for 1 Raw Iron.`
        : `Bought ${ironUnits} Raw Iron listed by ${houseName} at ${IRON_UNIT_PRICE} gold each (${actualGold} gold total).`;

      const reqTaxRate = body.taxRate !== undefined && !isNaN(Number(body.taxRate))
        ? Math.max(0, Math.min(50, Number(body.taxRate)))
        : taxRate;

      // All deposits are strictly PENDING until operator confirms receipt in Parlamentum
      const status = "PENDING";

      await db.execute({
        sql: `INSERT INTO wallet_transactions (id, user_id, type, method, amount, iron_units, parlamentum_name, status, recipe_note, tax_rate, created_at)
              VALUES (?, ?, 'DEPOSIT', ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [txId, user.id, method || "MARKET_IRON", actualGold, ironUnits, targetName, status, recipe, reqTaxRate, now],
      });

      // Update player's character name if not set
      await db.execute({
        sql: "UPDATE users SET parlamentum_name = ? WHERE id = ? AND (parlamentum_name IS NULL OR parlamentum_name = '')",
        args: [targetName, user.id],
      });

      // Dispatch Discord webhook ping to operator (non-blocking)
      import("@/lib/discord").then(({ notifyDiscordDepositAnnouncement }) => {
        notifyDiscordDepositAnnouncement({
          citizenName: targetName,
          amount: actualGold,
          ironUnits,
          txId,
        });
      }).catch(() => {});

      // Look for the purchase right away when the watcher is on
      after(() => maybeWatch());

      const updatedUser = await db.execute({
        sql: "SELECT cash_balance FROM users WHERE id = ?",
        args: [user.id],
      });

      const message = `Deposit announced! ${houseName} will credit ${actualGold.toLocaleString()} gold once the in-game Raw Iron purchase (${ironUnits} units) is verified in Parlamentum.`;

      return NextResponse.json({
        success: true,
        message,
        newBalance: Number(updatedUser.rows[0].cash_balance),
        txId,
        pending: true,
      });
    }

    if (action === "withdraw") {
      // 2. WITHDRAWAL (Send back money by negating tax)
      if (numAmount < 20) {
        return NextResponse.json({
          success: false,
          message: "Minimum cash out is 20 gold. You need at least 20 gold to withdraw.",
        }, { status: 400 });
      }

      const userRes = await db.execute({
        sql: "SELECT cash_balance FROM users WHERE id = ?",
        args: [user.id],
      });
      const currentCash = Number(userRes.rows[0].cash_balance);

      if (currentCash < numAmount) {
        return NextResponse.json({
          success: false,
          message: `Insufficient purse balance. Available: ${currentCash.toLocaleString()} gold, Requested: ${numAmount.toLocaleString()} gold.`,
        }, { status: 400 });
      }

      // The player may pick a lower regional rate, never one above the operator's: the rate sets how much the
      // House pays for the listing, so an inflated rate would pay out more gold than the purse gave up
      const reqTaxRate = body.taxRate !== undefined && Number.isFinite(Number(body.taxRate))
        ? Math.max(0, Math.min(taxRate, Number(body.taxRate)))
        : taxRate;

      const withdrawCalc = calculateWithdrawalRecipe(numAmount, reqTaxRate);
      const ironUnits = withdrawCalc.ironUnits;
      const grossListing = withdrawCalc.grossTotal;
      const unitPrice = withdrawCalc.unitPrice;
      const taxAbsorbed = withdrawCalc.taxAmount;

      // Deduct net requested gold from user purse, only if it is still there (parallel requests can't overdraw)
      const debit = await db.execute({
        sql: "UPDATE users SET cash_balance = cash_balance - ? WHERE id = ? AND cash_balance >= ?",
        args: [numAmount, user.id, numAmount],
      });
      if (debit.rowsAffected === 0) {
        return NextResponse.json({
          success: false,
          message: `Insufficient purse balance. Requested: ${numAmount.toLocaleString()} gold.`,
        }, { status: 400 });
      }

      const recipe = `List ${ironUnits} Raw Iron on Parlamentum market at ${unitPrice.toFixed(2)} gold each (Total: ${grossListing.toFixed(2)} gold). ${houseName} pays the ${taxAbsorbed.toFixed(2)} gold game tax (${reqTaxRate}% regional rate) so you get exactly ${numAmount.toLocaleString()} gold net.`;

      await db.execute({
        sql: `INSERT INTO wallet_transactions (id, user_id, type, method, amount, iron_units, parlamentum_name, status, recipe_note, tax_rate, created_at)
              VALUES (?, ?, 'WITHDRAWAL', 'MARKET_IRON', ?, ?, ?, 'PENDING', ?, ?, ?)`,
        args: [txId, user.id, numAmount, ironUnits, targetName, recipe, reqTaxRate, now],
      });

      const updatedUser = await db.execute({
        sql: "SELECT cash_balance FROM users WHERE id = ?",
        args: [user.id],
      });

      return NextResponse.json({
        success: true,
        message: `${numAmount.toLocaleString()} gold withdrawal initiated! Follow the listing recipe to receive your gold.`,
        recipe: withdrawCalc,
        newBalance: Number(updatedUser.rows[0].cash_balance),
      });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/wallet error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
