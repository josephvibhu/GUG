import { getDb, initDb } from "./db";
import { getSetting } from "./wallet";
import crypto from "crypto";

export interface PlaceOrderParams {
  userId: string;
  companyId: string;
  type: "BUY" | "SELL";
  orderType: "LIMIT" | "MARKET";
  price: number;
  quantity: number;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  message?: string;
  filledQuantity: number;
  remainingQuantity: number;
  averageFillPrice: number;
  tradesExecuted: Array<{
    tradeId: string;
    price: number;
    quantity: number;
    total: number;
  }>;
}

export async function placeOrder(params: PlaceOrderParams): Promise<OrderResult> {
  await initDb();
  const db = getDb();

  const feePercentStr = await getSetting("trade_fee_percent", "0.5");
  const feePercent = parseFloat(feePercentStr) || 0.5;
  const feeRate = feePercent / 100;

  const { userId, companyId, type, orderType } = params;
  const quantity = Math.floor(params.quantity);
  const price = Math.round(params.price * 100) / 100;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { success: false, message: "Quantity must be greater than 0", filledQuantity: 0, remainingQuantity: 0, averageFillPrice: 0, tradesExecuted: [] };
  }

  if (orderType === "LIMIT" && (!Number.isFinite(price) || price <= 0)) {
    return { success: false, message: "Price must be greater than 0 for limit orders", filledQuantity: 0, remainingQuantity: 0, averageFillPrice: 0, tradesExecuted: [] };
  }

  // 1. Fetch User and Company
  const userRes = await db.execute({
    sql: "SELECT * FROM users WHERE id = ?",
    args: [userId],
  });
  if (userRes.rows.length === 0) {
    return { success: false, message: "User not found", filledQuantity: 0, remainingQuantity: 0, averageFillPrice: 0, tradesExecuted: [] };
  }
  const user = userRes.rows[0];

  if (Number(user.is_frozen || 0) === 1) {
    return {
      success: false,
      message: "Your account has been FROZEN by the Exchange Operator pending compliance review. Order placement is suspended.",
      filledQuantity: 0,
      remainingQuantity: 0,
      averageFillPrice: 0,
      tradesExecuted: [],
    };
  }

  const companyRes = await db.execute({
    sql: "SELECT * FROM companies WHERE id = ? OR ticker = ?",
    args: [companyId, companyId.toUpperCase()],
  });
  if (companyRes.rows.length === 0) {
    return { success: false, message: "Company not found", filledQuantity: 0, remainingQuantity: 0, averageFillPrice: 0, tradesExecuted: [] };
  }
  const company = companyRes.rows[0];
  const actualCompanyId = String(company.id);

  if (company.status === "HALTED") {
    return {
      success: false,
      message: `Trading for $${company.ticker} is currently HALTED by the Exchange Operator.`,
      filledQuantity: 0,
      remainingQuantity: 0,
      averageFillPrice: 0,
      tradesExecuted: [],
    };
  }

  if (company.status === "DEFAULTED") {
    return {
      success: false,
      message: `Company $${company.ticker} has been flagged as DEFAULTED. All trading is permanently suspended.`,
      filledQuantity: 0,
      remainingQuantity: 0,
      averageFillPrice: 0,
      tradesExecuted: [],
    };
  }

  // 2. Validate Available Balance / Shares & Lock Escrow
  let effectiveMarketBuyPrice = Number(company.current_price);
  if (type === "BUY" && orderType === "MARKET") {
    // Find the best available ask on the book
    const bestAskRes = await db.execute({
      sql: "SELECT price FROM orders WHERE company_id = ? AND type = 'SELL' AND status IN ('OPEN', 'PARTIAL') AND user_id != ? ORDER BY price ASC LIMIT 1",
      args: [actualCompanyId, userId],
    });
    if (bestAskRes.rows.length === 0) {
      return {
        success: false,
        message: "No shares currently available for sale on the order book. Please use a Limit order to post your bid.",
        filledQuantity: 0,
        remainingQuantity: 0,
        averageFillPrice: 0,
        tradesExecuted: [],
      };
    }
    const lowestAsk = Number(bestAskRes.rows[0].price);
    effectiveMarketBuyPrice = price > 0 ? Math.max(price, lowestAsk) : lowestAsk;
  }

  if (type === "SELL" && orderType === "MARKET") {
    const bestBidRes = await db.execute({
      sql: "SELECT price FROM orders WHERE company_id = ? AND type = 'BUY' AND status IN ('OPEN', 'PARTIAL') AND user_id != ? ORDER BY price DESC LIMIT 1",
      args: [actualCompanyId, userId],
    });
    if (bestBidRes.rows.length === 0) {
      return {
        success: false,
        message: "No active buy orders on the order book. Please switch to Advanced to place a Limit Sell order at your desired price.",
        filledQuantity: 0,
        remainingQuantity: 0,
        averageFillPrice: 0,
        tradesExecuted: [],
      };
    }
  }

  if (type === "BUY") {
    const requiredCash = orderType === "LIMIT"
      ? Math.round(price * quantity * 100) / 100
      : Math.round(effectiveMarketBuyPrice * quantity * 1.05 * 100) / 100; // 5% slippage buffer for market
    const availableCash = Number(user.cash_balance);

    if (availableCash < requiredCash) {
      return {
        success: false,
        message: `Insufficient funds. Available: Ᵽ${availableCash.toFixed(2)}, Required: Ᵽ${requiredCash.toFixed(2)}`,
        filledQuantity: 0,
        remainingQuantity: 0,
        averageFillPrice: 0,
        tradesExecuted: [],
      };
    }

    // Lock cash, only if it is still there (parallel orders must not spend the same gold twice)
    const lock = await db.execute({
      sql: "UPDATE users SET cash_balance = cash_balance - ?, locked_cash = locked_cash + ? WHERE id = ? AND cash_balance >= ?",
      args: [requiredCash, requiredCash, userId, requiredCash],
    });
    if (lock.rowsAffected === 0) {
      return {
        success: false,
        message: `Insufficient funds. Available: Ᵽ${availableCash.toFixed(2)}, Required: Ᵽ${requiredCash.toFixed(2)}`,
        filledQuantity: 0,
        remainingQuantity: 0,
        averageFillPrice: 0,
        tradesExecuted: [],
      };
    }
  } else {
    // SELL
    const portRes = await db.execute({
      sql: "SELECT * FROM portfolios WHERE user_id = ? AND company_id = ?",
      args: [userId, actualCompanyId],
    });
    const sharesOwned = portRes.rows.length > 0 ? Number(portRes.rows[0].shares) : 0;
    const lockedShares = portRes.rows.length > 0 ? Number(portRes.rows[0].locked_shares) : 0;
    const availableShares = sharesOwned - lockedShares;

    if (availableShares < quantity) {
      return {
        success: false,
        message: `Insufficient shares. Available: ${availableShares}, Required: ${quantity}`,
        filledQuantity: 0,
        remainingQuantity: 0,
        averageFillPrice: 0,
        tradesExecuted: [],
      };
    }

    // Lock shares, only if they are still free
    const lock = await db.execute({
      sql: "UPDATE portfolios SET locked_shares = locked_shares + ? WHERE user_id = ? AND company_id = ? AND shares - locked_shares >= ?",
      args: [quantity, userId, actualCompanyId, quantity],
    });
    if (lock.rowsAffected === 0) {
      return {
        success: false,
        message: `Insufficient shares. Available: ${availableShares}, Required: ${quantity}`,
        filledQuantity: 0,
        remainingQuantity: 0,
        averageFillPrice: 0,
        tradesExecuted: [],
      };
    }
  }

  // 3. Match against opposing order book
  let remainingQuantity = quantity;
  let filledQuantity = 0;
  let totalCost = 0;
  const tradesExecuted: Array<{ tradeId: string; price: number; quantity: number; total: number }> = [];

  const newOrderId = `ord_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  if (type === "BUY") {
    // Fetch Asks (SELL orders) with price <= order.price, ordered by price ASC, created_at ASC.
    // MARKET buys only escrowed current price + 5%, so they can't take asks above that band
    // (the buyer would be charged the escrow while the seller is paid the full ask).
    const matchQuery = "SELECT * FROM orders WHERE company_id = ? AND type = 'SELL' AND status IN ('OPEN', 'PARTIAL') AND price <= ? AND user_id != ? ORDER BY price ASC, created_at ASC";
    const priceCap = orderType === "LIMIT" ? price : Math.round(effectiveMarketBuyPrice * 1.05 * 100) / 100;

    const matchArgs = [actualCompanyId, priceCap, userId];
    const opposingOrders = await db.execute({ sql: matchQuery, args: matchArgs });

    for (const ask of opposingOrders.rows) {
      if (remainingQuantity <= 0) break;

      const askRemaining = Number(ask.remaining_quantity);
      const matchQty = Math.min(remainingQuantity, askRemaining);
      const execPrice = Number(ask.price); // Taker gets maker's posted price!
      const matchCost = Math.round(matchQty * execPrice * 100) / 100;

      // Update Maker Ask Order first, only if those shares are still on it (a parallel order may have taken them)
      const claim = await db.execute({
        sql: `UPDATE orders SET remaining_quantity = remaining_quantity - ?,
                status = CASE WHEN remaining_quantity - ? = 0 THEN 'FILLED' ELSE 'PARTIAL' END
              WHERE id = ? AND status IN ('OPEN', 'PARTIAL') AND remaining_quantity >= ?`,
        args: [matchQty, matchQty, ask.id, matchQty],
      });
      if (claim.rowsAffected === 0) continue;

      // Execute Trade
      const tradeId = `trd_${crypto.randomUUID()}`;
      await db.execute({
        sql: `INSERT INTO trades (id, company_id, buyer_id, seller_id, buy_order_id, sell_order_id, price, quantity, total, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [tradeId, actualCompanyId, userId, ask.user_id, newOrderId, ask.id, execPrice, matchQty, matchCost, now],
      });

      const tradeFee = Math.round(matchCost * feeRate * 100) / 100;
      const sellerProceeds = Math.max(0, Math.round((matchCost - tradeFee) * 100) / 100);

      // Underwrite / Listing Fee check: If this is the company's primary float offering,
      // recover the IPO charter fee directly from the capital raised.
      const isIpoOrder = String(ask.id).startsWith("ord_ipo_");
      let ipoFeeDeducted = 0;

      if (isIpoOrder) {
        try {
          const compRow = await db.execute({
            sql: "SELECT ipo_fee_collected FROM companies WHERE id = ? LIMIT 1",
            args: [actualCompanyId],
          });
          const collected = compRow.rows.length > 0 ? Number(compRow.rows[0].ipo_fee_collected || 0) : 0;
          const listingSetting = await db.execute({
            sql: "SELECT value FROM settings WHERE key = 'ipo_listing_fee' LIMIT 1",
          });
          const targetListingFee = listingSetting.rows.length > 0 ? Number(listingSetting.rows[0].value) : 200;
          const remainingListingFee = Math.max(0, Math.round((targetListingFee - collected) * 100) / 100);

          if (remainingListingFee > 0 && sellerProceeds > 0) {
            ipoFeeDeducted = Math.min(sellerProceeds, remainingListingFee);
            await db.execute({
              sql: "UPDATE companies SET ipo_fee_collected = ipo_fee_collected + ? WHERE id = ?",
              args: [ipoFeeDeducted, actualCompanyId],
            });
          }
        } catch (e) {
          console.warn("Error calculating IPO fee deduction in engine:", e);
        }
      }

      const netSellerProceeds = Math.max(0, Math.round((sellerProceeds - ipoFeeDeducted) * 100) / 100);

      // Update Seller: unlock shares and give seller net cash
      await db.execute({
        sql: `UPDATE portfolios SET shares = shares - ?, locked_shares = locked_shares - ? 
              WHERE user_id = ? AND company_id = ?`,
        args: [matchQty, matchQty, ask.user_id, actualCompanyId],
      });
      if (netSellerProceeds > 0) {
        await db.execute({
          sql: `UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?`,
          args: [netSellerProceeds, ask.user_id],
        });
      }

      // Credit fee to Treasury (Brokerage Fee + IPO Underwriting Fee)
      const totalTreasuryInflow = Math.round((tradeFee + ipoFeeDeducted) * 100) / 100;
      if (totalTreasuryInflow > 0) {
        await db.execute({
          sql: `UPDATE users SET cash_balance = cash_balance + ? WHERE id = 'usr_treasury'`,
          args: [totalTreasuryInflow],
        });
      }

      // Update Buyer: deduct locked cash and add shares to buyer portfolio
      const lockedCashDeduct = orderType === "LIMIT" ? Math.round(matchQty * price * 100) / 100 : Math.round(matchQty * effectiveMarketBuyPrice * 1.05 * 100) / 100;
      const cashDifference = lockedCashDeduct - matchCost; // Refund difference if filled below limit price!

      await db.execute({
        sql: `UPDATE users SET locked_cash = locked_cash - ?, cash_balance = cash_balance + ? WHERE id = ?`,
        args: [lockedCashDeduct, Math.max(0, cashDifference), userId],
      });

      // Add shares to buyer portfolio
      await addSharesToPortfolio(db, userId, actualCompanyId, matchQty, execPrice);

      remainingQuantity -= matchQty;
      filledQuantity += matchQty;
      totalCost += matchCost;

      tradesExecuted.push({
        tradeId,
        price: execPrice,
        quantity: matchQty,
        total: matchCost,
      });

      // Update company current price to latest executed trade
      await updateCompanyPrice(db, actualCompanyId, execPrice, matchCost);
    }

    // After matching loop: handle leftover
    if (remainingQuantity > 0) {
      if (orderType === "LIMIT") {
        // Place remainder as open limit buy order
        await db.execute({
          sql: `INSERT INTO orders (id, user_id, company_id, type, order_type, price, initial_quantity, remaining_quantity, status, created_at)
                VALUES (?, ?, ?, 'BUY', 'LIMIT', ?, ?, ?, ?, ?)`,
          args: [newOrderId, userId, actualCompanyId, price, quantity, remainingQuantity, filledQuantity > 0 ? "PARTIAL" : "OPEN", now],
        });
      } else {
        // Market order: unlock remaining unspent locked cash
        const unspentCash = Math.round(remainingQuantity * effectiveMarketBuyPrice * 1.05 * 100) / 100;
        await db.execute({
          sql: "UPDATE users SET locked_cash = locked_cash - ?, cash_balance = cash_balance + ? WHERE id = ?",
          args: [unspentCash, unspentCash, userId],
        });
      }
    }
  } else {
    // SELL
    // Fetch Bids (BUY orders) with price >= order.price (or any if MARKET), ordered by price DESC, created_at ASC
    const matchQuery = orderType === "LIMIT"
      ? "SELECT * FROM orders WHERE company_id = ? AND type = 'BUY' AND status IN ('OPEN', 'PARTIAL') AND price >= ? AND user_id != ? ORDER BY price DESC, created_at ASC"
      : "SELECT * FROM orders WHERE company_id = ? AND type = 'BUY' AND status IN ('OPEN', 'PARTIAL') AND user_id != ? ORDER BY price DESC, created_at ASC";

    const matchArgs = orderType === "LIMIT" ? [actualCompanyId, price, userId] : [actualCompanyId, userId];
    const opposingOrders = await db.execute({ sql: matchQuery, args: matchArgs });

    for (const bid of opposingOrders.rows) {
      if (remainingQuantity <= 0) break;

      const bidRemaining = Number(bid.remaining_quantity);
      const matchQty = Math.min(remainingQuantity, bidRemaining);
      const execPrice = Number(bid.price); // Execution is at resting bid price!
      const matchCost = Math.round(matchQty * execPrice * 100) / 100;

      // Update Maker Bid Order first, only if those shares are still wanted (a parallel order may have filled it)
      const claim = await db.execute({
        sql: `UPDATE orders SET remaining_quantity = remaining_quantity - ?,
                status = CASE WHEN remaining_quantity - ? = 0 THEN 'FILLED' ELSE 'PARTIAL' END
              WHERE id = ? AND status IN ('OPEN', 'PARTIAL') AND remaining_quantity >= ?`,
        args: [matchQty, matchQty, bid.id, matchQty],
      });
      if (claim.rowsAffected === 0) continue;

      // Execute Trade
      const tradeId = `trd_${crypto.randomUUID()}`;
      await db.execute({
        sql: `INSERT INTO trades (id, company_id, buyer_id, seller_id, buy_order_id, sell_order_id, price, quantity, total, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [tradeId, actualCompanyId, bid.user_id, userId, bid.id, newOrderId, execPrice, matchQty, matchCost, now],
      });

      // Update Buyer: deduct locked cash and add shares to buyer
      const buyerLockedToDeduct = Math.round(matchQty * execPrice * 100) / 100;
      await db.execute({
        sql: "UPDATE users SET locked_cash = locked_cash - ? WHERE id = ?",
        args: [buyerLockedToDeduct, bid.user_id],
      });
      await addSharesToPortfolio(db, String(bid.user_id), actualCompanyId, matchQty, execPrice);

      const tradeFee = Math.round(matchCost * feeRate * 100) / 100;
      const sellerProceeds = Math.max(0, Math.round((matchCost - tradeFee) * 100) / 100);

      // Update Seller (Taker): unlock and deduct shares, add net cash to seller
      await db.execute({
        sql: `UPDATE portfolios SET shares = shares - ?, locked_shares = locked_shares - ? 
              WHERE user_id = ? AND company_id = ?`,
        args: [matchQty, matchQty, userId, actualCompanyId],
      });
      await db.execute({
        sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?",
        args: [sellerProceeds, userId],
      });

      // Credit fee to Treasury
      if (tradeFee > 0) {
        await db.execute({
          sql: `UPDATE users SET cash_balance = cash_balance + ? WHERE id = 'usr_treasury'`,
          args: [tradeFee],
        });
      }

      remainingQuantity -= matchQty;
      filledQuantity += matchQty;
      totalCost += matchCost;

      tradesExecuted.push({
        tradeId,
        price: execPrice,
        quantity: matchQty,
        total: matchCost,
      });

      // Update company current price to latest executed trade
      await updateCompanyPrice(db, actualCompanyId, execPrice, matchCost);
    }

    // Leftover for sell order
    if (remainingQuantity > 0) {
      if (orderType === "LIMIT") {
        await db.execute({
          sql: `INSERT INTO orders (id, user_id, company_id, type, order_type, price, initial_quantity, remaining_quantity, status, created_at)
                VALUES (?, ?, ?, 'SELL', 'LIMIT', ?, ?, ?, ?, ?)`,
          args: [newOrderId, userId, actualCompanyId, price, quantity, remainingQuantity, filledQuantity > 0 ? "PARTIAL" : "OPEN", now],
        });
      } else {
        // Market sell: unlock remaining shares
        await db.execute({
          sql: "UPDATE portfolios SET locked_shares = locked_shares - ? WHERE user_id = ? AND company_id = ?",
          args: [remainingQuantity, userId, actualCompanyId],
        });
      }
    }
  }

  const avgFillPrice = filledQuantity > 0 ? Math.round((totalCost / filledQuantity) * 100) / 100 : 0;

  return {
    success: true,
    orderId: newOrderId,
    message: filledQuantity === quantity
      ? `Order fully executed (${filledQuantity} shares @ avg Ᵽ${avgFillPrice})`
      : orderType === "MARKET"
      ? `Market order filled ${filledQuantity}/${quantity} shares${filledQuantity > 0 ? ` @ avg Ᵽ${avgFillPrice}` : ""}; no more matching orders${type === "BUY" ? " within 5% of the last price" : ""}, the rest was cancelled.`
      : filledQuantity > 0
      ? `Order partially filled (${filledQuantity}/${quantity} shares @ avg Ᵽ${avgFillPrice}, remaining open)`
      : `Limit order placed successfully on the order book.`,
    filledQuantity,
    remainingQuantity,
    averageFillPrice: avgFillPrice,
    tradesExecuted,
  };
}

// Cancel an open limit order and refund locked funds/shares
export async function cancelOrder(userId: string, orderId: string): Promise<{ success: boolean; message: string }> {
  await initDb();
  const db = getDb();

  const orderRes = await db.execute({
    sql: "SELECT * FROM orders WHERE id = ? AND user_id = ? AND status IN ('OPEN', 'PARTIAL')",
    args: [orderId, userId],
  });

  if (orderRes.rows.length === 0) {
    return { success: false, message: "Active order not found or already completed/cancelled" };
  }

  const order = orderRes.rows[0];
  const remainingQty = Number(order.remaining_quantity);
  const orderPrice = Number(order.price);

  // Mark it cancelled before refunding, and only if nothing filled it meanwhile, so the escrow comes back once
  const claim = await db.execute({
    sql: "UPDATE orders SET status = 'CANCELLED' WHERE id = ? AND user_id = ? AND status IN ('OPEN', 'PARTIAL') AND remaining_quantity = ?",
    args: [orderId, userId, remainingQty],
  });
  if (claim.rowsAffected === 0) {
    return { success: false, message: "This order was just filled or cancelled. Refresh and try again." };
  }

  if (order.type === "BUY") {
    const refundAmount = Math.round(remainingQty * orderPrice * 100) / 100;
    await db.execute({
      sql: "UPDATE users SET locked_cash = locked_cash - ?, cash_balance = cash_balance + ? WHERE id = ?",
      args: [refundAmount, refundAmount, userId],
    });
  } else {
    // SELL
    await db.execute({
      sql: "UPDATE portfolios SET locked_shares = locked_shares - ? WHERE user_id = ? AND company_id = ?",
      args: [remainingQty, userId, order.company_id],
    });
  }

  return { success: true, message: "Order cancelled and escrow returned to your balance." };
}

// Helper: update or insert portfolio holdings
async function addSharesToPortfolio(db: any, userId: string, companyId: string, addedShares: number, buyPrice: number) {
  const existing = await db.execute({
    sql: "SELECT * FROM portfolios WHERE user_id = ? AND company_id = ?",
    args: [userId, companyId],
  });

  if (existing.rows.length === 0) {
    const portId = `port_${crypto.randomUUID()}`;
    await db.execute({
      sql: `INSERT INTO portfolios (id, user_id, company_id, shares, locked_shares, avg_buy_price)
            VALUES (?, ?, ?, ?, 0, ?)`,
      args: [portId, userId, companyId, addedShares, buyPrice],
    });
  } else {
    const currentShares = Number(existing.rows[0].shares);
    const currentAvg = Number(existing.rows[0].avg_buy_price);
    const newTotalShares = currentShares + addedShares;
    const newAvg = newTotalShares > 0 
      ? Math.round((((currentShares * currentAvg) + (addedShares * buyPrice)) / newTotalShares) * 100) / 100
      : buyPrice;

    await db.execute({
      sql: "UPDATE portfolios SET shares = shares + ?, avg_buy_price = ? WHERE user_id = ? AND company_id = ?",
      args: [addedShares, newAvg, userId, companyId],
    });
  }
}

// Helper: update company price, 24h stats, and candlestick
async function updateCompanyPrice(db: any, companyId: string, newPrice: number, tradeVolume: number) {
  // Update company current price, volume
  await db.execute({
    sql: `UPDATE companies 
          SET current_price = ?, 
              volume_24h = volume_24h + ?,
              high_24h = MAX(high_24h, ?),
              low_24h = MIN(low_24h, ?)
          WHERE id = ?`,
    args: [newPrice, tradeVolume, newPrice, newPrice, companyId],
  });

  // Calculate 24h change
  const compRes = await db.execute({
    sql: "SELECT ipo_price, current_price FROM companies WHERE id = ?",
    args: [companyId],
  });
  if (compRes.rows.length > 0) {
    const ipo = Number(compRes.rows[0].ipo_price);
    const cur = Number(compRes.rows[0].current_price);
    const change = Math.round(((cur - ipo) / ipo) * 10000) / 100;
    await db.execute({
      sql: "UPDATE companies SET change_24h = ? WHERE id = ?",
      args: [change, companyId],
    });
  }

  // Update current hour candle
  const currentHourBucket = new Date().toISOString().slice(0, 13) + ":00:00Z";
  const existingCandle = await db.execute({
    sql: "SELECT * FROM candles WHERE company_id = ? AND time_bucket = ?",
    args: [companyId, currentHourBucket],
  });

  if (existingCandle.rows.length === 0) {
    await db.execute({
      sql: `INSERT INTO candles (id, company_id, time_bucket, open, high, low, close, volume)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      args: [`cnd_${crypto.randomUUID()}`, companyId, currentHourBucket, newPrice, newPrice, newPrice, newPrice],
    });
  } else {
    await db.execute({
      sql: `UPDATE candles 
            SET high = MAX(high, ?),
                low = MIN(low, ?),
                close = ?,
                volume = volume + 1
            WHERE company_id = ? AND time_bucket = ?`,
      args: [newPrice, newPrice, newPrice, companyId, currentHourBucket],
    });
  }
}

// Bot Simulation Pulse: generates realistic organic trades to keep the market active
export async function pulseMarketBots(): Promise<{ success: boolean; actions: string[] }> {
  await initDb();
  const db = getDb();

  const companies = await db.execute("SELECT * FROM companies");
  const actions: string[] = [];

  for (const comp of companies.rows) {
    const curPrice = Number(comp.current_price);
    const cid = String(comp.id);

    // Random choice: 50% chance of a bot action
    if (Math.random() > 0.4) {
      const isBuy = Math.random() > 0.48;
      const deltaPercent = (Math.random() - 0.5) * 0.02; // -1% to +1%
      const targetPrice = Math.round((curPrice * (1 + deltaPercent)) * 100) / 100;
      const qty = Math.floor(5 + Math.random() * 25);

      if (isBuy) {
        // Bot places limit buy near current price
        await placeOrder({
          userId: "usr_bot",
          companyId: cid,
          type: "BUY",
          orderType: "LIMIT",
          price: targetPrice,
          quantity: qty,
        });
        actions.push(`[${comp.ticker}] Bot placed BUY limit for ${qty} shares @ Ᵽ${targetPrice}`);
      } else {
        // Bot places limit sell near current price
        await placeOrder({
          userId: "usr_bot",
          companyId: cid,
          type: "SELL",
          orderType: "LIMIT",
          price: targetPrice,
          quantity: qty,
        });
        actions.push(`[${comp.ticker}] Bot placed SELL limit for ${qty} shares @ Ᵽ${targetPrice}`);
      }
    }
  }

  return { success: true, actions };
}
