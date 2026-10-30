/**
 * NFT Auction System — core library.
 * All amounts in gold (REAL).  Percentages as basis points (integer, 100bps = 1%).
 * House treasury is usr_treasury (ExchangeTreasury).
 */
import { getDb, initDb, scheduleBlobPersist } from "./db";
import { getSetting } from "./wallet";
import crypto from "crypto";

// ─── Types ──────────────────────────────────────────────────────────────────

export type NftStatus = "OWNED" | "IN_AUCTION";
export type AuctionStatus = "SCHEDULED" | "LIVE" | "ENDED" | "SETTLED" | "CANCELLED";
export type BidStatus = "ACTIVE" | "OUTBID" | "WON" | "REFUNDED";
export type NftEvent = "MINTED" | "SOLD" | "TRANSFERRED" | "GIFTED";

export interface Nft {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  creatorId: string;
  creatorName: string;
  currentOwnerId: string;
  currentOwnerName?: string;
  editionNote?: string;
  /** Basis points, e.g. 500 = 5 % */
  creatorRoyaltyBps: number;
  status: NftStatus;
  mintedAt: string;
}

export interface NftAuction {
  id: string;
  nftId: string;
  nft?: Nft;
  sellerId: string;
  sellerName?: string;
  reservePrice: number;
  startPrice: number;
  currentBid: number | null;
  currentBidderId: string | null;
  currentBidderName?: string | null;
  bidCount: number;
  startsAt: string;
  endsAt: string;
  extendedAt: string | null;
  status: AuctionStatus;
  /** Basis points, e.g. 1500 = 15 % */
  houseCutBps: number;
  settledAt: string | null;
  createdAt: string;
}

export interface NftBid {
  id: string;
  auctionId: string;
  bidderId: string;
  bidderName?: string;
  amount: number;
  placedAt: string;
  status: BidStatus;
}

export interface NftHistoryEntry {
  id: string;
  nftId: string;
  event: NftEvent;
  fromUserId?: string;
  fromUserName?: string;
  toUserId: string;
  toUserName?: string;
  price?: number;
  auctionId?: string;
  note?: string;
  createdAt: string;
}

// ─── Settings helpers ────────────────────────────────────────────────────────

/** Default house cut on every auction (primary sale): 1500 bps = 15 % */
export async function getNftHouseCutBps(): Promise<number> {
  const v = await getSetting("nft_house_cut_bps", "1500");
  return Math.max(0, Math.min(5000, parseInt(v, 10) || 1500));
}

/** Secondary-sale creator royalty: 500 bps = 5 % */
export async function getNftCreatorRoyaltyBps(): Promise<number> {
  const v = await getSetting("nft_creator_royalty_bps", "500");
  return Math.max(0, Math.min(3000, parseInt(v, 10) || 500));
}

/** Minimum bid increment as percent of current bid, e.g. 5 */
export async function getNftMinIncrementPct(): Promise<number> {
  const v = await getSetting("nft_min_bid_increment_pct", "5");
  return Math.max(1, parseInt(v, 10) || 5);
}

/** Anti-snipe extension in minutes, e.g. 5 */
export async function getNftSnipeExtMinutes(): Promise<number> {
  const v = await getSetting("nft_snipe_extension_min", "5");
  return Math.max(1, parseInt(v, 10) || 5);
}

/** Default auction duration in hours, e.g. 72 */
export async function getNftDefaultDurationHours(): Promise<number> {
  const v = await getSetting("nft_default_duration_hours", "72");
  return Math.max(1, parseInt(v, 10) || 72);
}

// ─── Mint ────────────────────────────────────────────────────────────────────

export interface MintParams {
  adminId: string;
  title: string;
  description?: string;
  imageUrl: string;
  /** Optional override; defaults to global nft_creator_royalty_bps setting */
  creatorRoyaltyBps?: number;
  editionNote?: string;
  /** Who the NFT is attributed to as creator. Defaults to minting admin. */
  creatorId?: string;
  creatorName?: string;
}

export async function mintNft(params: MintParams): Promise<{ success: boolean; message: string; nft?: Nft }> {
  await initDb();
  const db = getDb();

  const adminRes = await db.execute({ sql: "SELECT id, username, display_name, is_admin FROM users WHERE id = ?", args: [params.adminId] });
  if (adminRes.rows.length === 0 || Number(adminRes.rows[0].is_admin) !== 1) {
    return { success: false, message: "Only admins can mint NFTs." };
  }

  if (!params.title?.trim()) return { success: false, message: "Title is required." };
  if (!params.imageUrl?.trim()) return { success: false, message: "Image URL is required." };

  const defaultRoyaltyBps = await getNftCreatorRoyaltyBps();
  const royaltyBps = params.creatorRoyaltyBps !== undefined
    ? Math.max(0, Math.min(3000, params.creatorRoyaltyBps))
    : defaultRoyaltyBps;

  const creatorId = params.creatorId || params.adminId;
  const creatorName = params.creatorName || String(adminRes.rows[0].display_name || adminRes.rows[0].username);

  const id = `nft_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO nfts (id, title, description, image_url, creator_id, creator_name, current_owner_id, edition_note, creator_royalty_bps, status, minted_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OWNED', ?)`,
    args: [id, params.title.trim(), params.description?.trim() || null, params.imageUrl.trim(),
      creatorId, creatorName, creatorId, params.editionNote?.trim() || null, royaltyBps, now],
  });

  // Provenance: MINTED
  await db.execute({
    sql: `INSERT INTO nft_history (id, nft_id, event, from_user_id, to_user_id, price, auction_id, note, created_at)
          VALUES (?, ?, 'MINTED', NULL, ?, NULL, NULL, ?, ?)`,
    args: [`nfth_${crypto.randomUUID().slice(0, 8)}`, id, creatorId, params.editionNote?.trim() || null, now],
  });

  scheduleBlobPersist();

  return {
    success: true,
    message: `NFT "${params.title.trim()}" minted successfully.`,
    nft: {
      id, title: params.title.trim(), description: params.description?.trim(),
      imageUrl: params.imageUrl.trim(), creatorId, creatorName,
      currentOwnerId: creatorId, editionNote: params.editionNote?.trim(),
      creatorRoyaltyBps: royaltyBps, status: "OWNED", mintedAt: now,
    },
  };
}

// ─── Create Auction ──────────────────────────────────────────────────────────

export interface CreateAuctionParams {
  sellerId: string;
  nftId: string;
  reservePrice: number;
  startPrice: number;
  /** ISO-8601 string; defaults to now */
  startsAt?: string;
  /** Hours from startsAt; defaults to nft_default_duration_hours setting */
  durationHours?: number;
  /** Bps override; defaults to nft_house_cut_bps setting */
  houseCutBps?: number;
}

export async function createNftAuction(params: CreateAuctionParams): Promise<{ success: boolean; message: string; auction?: NftAuction }> {
  await initDb();
  const db = getDb();

  // Seller must be admin (only admins can start auctions in this config)
  const sellerRes = await db.execute({ sql: "SELECT id, is_admin, is_frozen FROM users WHERE id = ?", args: [params.sellerId] });
  if (sellerRes.rows.length === 0 || Number(sellerRes.rows[0].is_admin) !== 1) {
    return { success: false, message: "Only admins can create auctions." };
  }
  if (Number(sellerRes.rows[0].is_frozen) === 1) {
    return { success: false, message: "Your account is frozen." };
  }

  // NFT must be OWNED by the seller
  const nftRes = await db.execute({ sql: "SELECT * FROM nfts WHERE id = ?", args: [params.nftId] });
  if (nftRes.rows.length === 0) return { success: false, message: "NFT not found." };
  const nft = nftRes.rows[0];
  if (String(nft.current_owner_id) !== params.sellerId) return { success: false, message: "You do not own this NFT." };
  if (String(nft.status) !== "OWNED") return { success: false, message: "NFT is already in an auction." };

  const reservePrice = Math.max(0, Number(params.reservePrice) || 0);
  const startPrice = Math.max(0, Number(params.startPrice) || 0);
  if (!Number.isFinite(startPrice) || startPrice <= 0) return { success: false, message: "Start price must be greater than 0." };

  const defaultHours = await getNftDefaultDurationHours();
  const durationHours = params.durationHours && params.durationHours > 0 ? params.durationHours : defaultHours;

  const startsAt = params.startsAt ? new Date(params.startsAt) : new Date();
  const endsAt = new Date(startsAt.getTime() + durationHours * 3_600_000);

  const defaultCutBps = await getNftHouseCutBps();
  const houseCutBps = params.houseCutBps !== undefined
    ? Math.max(0, Math.min(5000, params.houseCutBps))
    : defaultCutBps;

  const id = `auc_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const now = new Date().toISOString();
  const startsAtIso = startsAt.toISOString();
  const endsAtIso = endsAt.toISOString();

  // Lock the NFT
  await db.execute({ sql: "UPDATE nfts SET status = 'IN_AUCTION' WHERE id = ? AND status = 'OWNED'", args: [params.nftId] });

  await db.execute({
    sql: `INSERT INTO nft_auctions (id, nft_id, seller_id, reserve_price, start_price, current_bid, current_bidder_id,
          bid_count, starts_at, ends_at, extended_at, status, house_cut_bps, settled_at, created_at)
          VALUES (?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?, NULL, ?, ?, NULL, ?)`,
    args: [id, params.nftId, params.sellerId, reservePrice, startPrice,
      startsAtIso, endsAtIso,
      startsAt <= new Date() ? "LIVE" : "SCHEDULED",
      houseCutBps, now],
  });

  scheduleBlobPersist();

  return {
    success: true,
    message: `Auction created. Ends ${endsAt.toLocaleString()}.`,
    auction: {
      id, nftId: params.nftId, sellerId: params.sellerId,
      reservePrice, startPrice, currentBid: null, currentBidderId: null,
      bidCount: 0, startsAt: startsAtIso, endsAt: endsAtIso, extendedAt: null,
      status: startsAt <= new Date() ? "LIVE" : "SCHEDULED",
      houseCutBps, settledAt: null, createdAt: now,
    },
  };
}

// ─── Tick / auto-promote scheduled auctions ──────────────────────────────────

/** Called by the cron route. Promotes SCHEDULED→LIVE and LIVE→ENDED based on clock. */
export async function tickAuctions(): Promise<void> {
  await initDb();
  const db = getDb();
  const now = new Date().toISOString();

  await db.execute({
    sql: "UPDATE nft_auctions SET status = 'LIVE' WHERE status = 'SCHEDULED' AND starts_at <= ?",
    args: [now],
  });
  await db.execute({
    sql: "UPDATE nft_auctions SET status = 'ENDED' WHERE status = 'LIVE' AND ends_at <= ?",
    args: [now],
  });
  scheduleBlobPersist();
}

// ─── Place Bid ───────────────────────────────────────────────────────────────

export interface PlaceBidParams {
  bidderId: string;
  auctionId: string;
  amount: number;
}

export async function placeBid(params: PlaceBidParams): Promise<{ success: boolean; message: string; bid?: NftBid }> {
  await initDb();
  const db = getDb();

  const amount = Math.round(params.amount * 100) / 100;

  const userRes = await db.execute({ sql: "SELECT id, cash_balance, locked_cash, is_frozen FROM users WHERE id = ?", args: [params.bidderId] });
  if (userRes.rows.length === 0) return { success: false, message: "User not found." };
  const user = userRes.rows[0];
  if (Number(user.is_frozen) === 1) return { success: false, message: "Your account is frozen." };

  const aucRes = await db.execute({ sql: "SELECT * FROM nft_auctions WHERE id = ?", args: [params.auctionId] });
  if (aucRes.rows.length === 0) return { success: false, message: "Auction not found." };
  const auc = aucRes.rows[0];

  // Tick it first in case it just opened
  if (String(auc.status) === "SCHEDULED" && new Date(String(auc.starts_at)) <= new Date()) {
    await db.execute({ sql: "UPDATE nft_auctions SET status = 'LIVE' WHERE id = ?", args: [params.auctionId] });
    auc.status = "LIVE";
  }

  if (String(auc.status) !== "LIVE") return { success: false, message: "This auction is not currently live." };
  if (new Date(String(auc.ends_at)) <= new Date()) return { success: false, message: "This auction has already ended." };
  if (String(auc.seller_id) === params.bidderId) return { success: false, message: "You cannot bid on your own auction." };

  // Minimum amount
  const currentBid = auc.current_bid !== null ? Number(auc.current_bid) : null;
  const startPrice = Number(auc.start_price);
  const minIncrementPct = await getNftMinIncrementPct();

  let minAmount: number;
  if (currentBid === null) {
    minAmount = startPrice;
  } else {
    minAmount = Math.round((currentBid * (1 + minIncrementPct / 100)) * 100) / 100;
  }

  if (!Number.isFinite(amount) || amount < minAmount) {
    return {
      success: false,
      message: `Minimum bid is ${minAmount.toLocaleString()} g (${currentBid === null ? "start price" : `+${minIncrementPct}% increment`}).`,
    };
  }

  // Check if bidder has an existing ACTIVE bid — refund it first
  const prevBidRes = await db.execute({
    sql: "SELECT id, amount FROM nft_bids WHERE auction_id = ? AND bidder_id = ? AND status = 'ACTIVE'",
    args: [params.auctionId, params.bidderId],
  });

  const cashBalance = Number(user.cash_balance);
  const lockedCash = Number(user.locked_cash);

  let additionalLock = amount;
  if (prevBidRes.rows.length > 0) {
    const prevAmount = Number(prevBidRes.rows[0].amount);
    // Refund old bid lock; only need to lock the difference
    additionalLock = amount - prevAmount;
    await db.execute({
      sql: "UPDATE nft_bids SET status = 'OUTBID' WHERE id = ? AND status = 'ACTIVE'",
      args: [String(prevBidRes.rows[0].id)],
    });
    await db.execute({
      sql: "UPDATE users SET locked_cash = locked_cash - ? WHERE id = ?",
      args: [prevAmount, params.bidderId],
    });
    await db.execute({
      sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?",
      args: [prevAmount, params.bidderId],
    });
  }

  // Now lock the new full amount
  const available = cashBalance - lockedCash + (prevBidRes.rows.length > 0 ? Number(prevBidRes.rows[0].amount) : 0);
  if (available < amount) {
    return { success: false, message: `Insufficient gold. You need ${amount.toLocaleString()} g but have ${available.toLocaleString()} g available.` };
  }

  // Atomic lock: debit available cash, add to locked
  const lockUpdate = await db.execute({
    sql: "UPDATE users SET cash_balance = cash_balance - ?, locked_cash = locked_cash + ? WHERE id = ? AND (cash_balance - locked_cash) >= ?",
    args: [additionalLock, additionalLock, params.bidderId, additionalLock],
  });
  if (lockUpdate.rowsAffected === 0) {
    return { success: false, message: "Insufficient available gold to place this bid." };
  }

  // Mark any OTHER user's previous top bid as OUTBID (refund theirs)
  if (auc.current_bidder_id && String(auc.current_bidder_id) !== params.bidderId) {
    const prevTopRes = await db.execute({
      sql: "SELECT id, amount, bidder_id FROM nft_bids WHERE auction_id = ? AND bidder_id = ? AND status = 'ACTIVE'",
      args: [params.auctionId, String(auc.current_bidder_id)],
    });
    for (const row of prevTopRes.rows) {
      await db.execute({ sql: "UPDATE nft_bids SET status = 'OUTBID' WHERE id = ?", args: [String(row.id)] });
      await db.execute({
        sql: "UPDATE users SET cash_balance = cash_balance + ?, locked_cash = locked_cash - ? WHERE id = ?",
        args: [Number(row.amount), Number(row.amount), String(row.bidder_id)],
      });
    }
  }

  const bidId = `bid_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO nft_bids (id, auction_id, bidder_id, amount, placed_at, status) VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
    args: [bidId, params.auctionId, params.bidderId, amount, now],
  });

  await db.execute({
    sql: `UPDATE nft_auctions SET current_bid = ?, current_bidder_id = ?, bid_count = bid_count + 1 WHERE id = ?`,
    args: [amount, params.bidderId, params.auctionId],
  });

  // Anti-snipe: if ends in < snipe_extension_min minutes, extend
  const snipeExt = await getNftSnipeExtMinutes();
  const endsAt = new Date(String(auc.ends_at));
  const msLeft = endsAt.getTime() - Date.now();
  if (msLeft > 0 && msLeft < snipeExt * 60_000) {
    const newEndsAt = new Date(Date.now() + snipeExt * 60_000).toISOString();
    await db.execute({
      sql: "UPDATE nft_auctions SET ends_at = ?, extended_at = ? WHERE id = ?",
      args: [newEndsAt, now, params.auctionId],
    });
  }

  scheduleBlobPersist();

  return {
    success: true,
    message: `Bid of ${amount.toLocaleString()} g placed!`,
    bid: { id: bidId, auctionId: params.auctionId, bidderId: params.bidderId, amount, placedAt: now, status: "ACTIVE" },
  };
}

// ─── Settle Auction ──────────────────────────────────────────────────────────

export async function settleAuction(auctionId: string, byAdminId: string): Promise<{ success: boolean; message: string; sold?: boolean }> {
  await initDb();
  const db = getDb();

  // Admin-only
  const adminRes = await db.execute({ sql: "SELECT is_admin FROM users WHERE id = ?", args: [byAdminId] });
  if (adminRes.rows.length === 0 || Number(adminRes.rows[0].is_admin) !== 1) {
    return { success: false, message: "Only admins can manually settle auctions." };
  }

  const aucRes = await db.execute({ sql: "SELECT * FROM nft_auctions WHERE id = ?", args: [auctionId] });
  if (aucRes.rows.length === 0) return { success: false, message: "Auction not found." };
  const auc = aucRes.rows[0];

  if (String(auc.status) !== "ENDED" && String(auc.status) !== "LIVE") {
    return { success: false, message: `Auction is ${auc.status}, not settleable.` };
  }

  const now = new Date().toISOString();
  const nftId = String(auc.nft_id);
  const sellerId = String(auc.seller_id);

  // No bids or reserve not met → no sale
  const currentBid = auc.current_bid !== null ? Number(auc.current_bid) : null;
  const reservePrice = Number(auc.reserve_price);

  if (currentBid === null || currentBid < reservePrice) {
    // Refund all active bids
    const activeBids = await db.execute({
      sql: "SELECT id, bidder_id, amount FROM nft_bids WHERE auction_id = ? AND status = 'ACTIVE'",
      args: [auctionId],
    });
    for (const row of activeBids.rows) {
      await db.execute({
        sql: "UPDATE users SET cash_balance = cash_balance + ?, locked_cash = locked_cash - ? WHERE id = ?",
        args: [Number(row.amount), Number(row.amount), String(row.bidder_id)],
      });
      await db.execute({ sql: "UPDATE nft_bids SET status = 'REFUNDED' WHERE id = ?", args: [String(row.id)] });
    }
    await db.execute({
      sql: "UPDATE nft_auctions SET status = 'SETTLED', settled_at = ? WHERE id = ?",
      args: [now, auctionId],
    });
    await db.execute({ sql: "UPDATE nfts SET status = 'OWNED' WHERE id = ?", args: [nftId] });
    scheduleBlobPersist();
    return { success: true, message: "Auction settled — reserve not met. NFT returned to seller.", sold: false };
  }

  // We have a winner
  const winnerId = String(auc.current_bidder_id);
  const bidAmount = currentBid;
  const houseCutBps = Number(auc.house_cut_bps);

  // Check if this is a primary sale (seller == creator)
  const nftRes = await db.execute({ sql: "SELECT creator_id, creator_royalty_bps FROM nfts WHERE id = ?", args: [nftId] });
  const nft = nftRes.rows[0];
  const creatorId = String(nft.creator_id);
  const creatorRoyaltyBps = Number(nft.creator_royalty_bps);
  const isPrimary = creatorId === sellerId;

  const houseCut = Math.round(bidAmount * houseCutBps / 10000 * 100) / 100;
  const creatorRoyalty = isPrimary ? 0 : Math.round(bidAmount * creatorRoyaltyBps / 10000 * 100) / 100;
  const sellerNet = Math.round((bidAmount - houseCut - creatorRoyalty) * 100) / 100;

  // 1. Unlock winner's bid (was already locked in cash) → deduct locked_cash
  await db.execute({
    sql: "UPDATE users SET locked_cash = locked_cash - ? WHERE id = ?",
    args: [bidAmount, winnerId],
  });

  // 2. Pay seller
  await db.execute({
    sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?",
    args: [sellerNet, sellerId],
  });

  // 3. Pay house
  await db.execute({
    sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = 'usr_treasury'",
    args: [houseCut],
  });

  // 4. Pay creator royalty (secondary only)
  if (creatorRoyalty > 0) {
    await db.execute({
      sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?",
      args: [creatorRoyalty, creatorId],
    });
  }

  // 5. Transfer NFT
  const winnerNameRes = await db.execute({ sql: "SELECT display_name, username FROM users WHERE id = ?", args: [winnerId] });
  const winnerName = winnerNameRes.rows.length > 0
    ? String(winnerNameRes.rows[0].display_name || winnerNameRes.rows[0].username)
    : winnerId;

  await db.execute({
    sql: "UPDATE nfts SET current_owner_id = ?, status = 'OWNED' WHERE id = ?",
    args: [winnerId, nftId],
  });

  // 6. Mark auction settled + winning bid won
  await db.execute({
    sql: "UPDATE nft_auctions SET status = 'SETTLED', settled_at = ? WHERE id = ?",
    args: [now, auctionId],
  });
  await db.execute({
    sql: "UPDATE nft_bids SET status = 'WON' WHERE auction_id = ? AND bidder_id = ? AND status = 'ACTIVE'",
    args: [auctionId, winnerId],
  });

  // 7. Provenance
  const sellerNameRes = await db.execute({ sql: "SELECT display_name, username FROM users WHERE id = ?", args: [sellerId] });
  const sellerName = sellerNameRes.rows.length > 0
    ? String(sellerNameRes.rows[0].display_name || sellerNameRes.rows[0].username)
    : sellerId;

  await db.execute({
    sql: `INSERT INTO nft_history (id, nft_id, event, from_user_id, to_user_id, price, auction_id, note, created_at)
          VALUES (?, ?, 'SOLD', ?, ?, ?, ?, ?, ?)`,
    args: [
      `nfth_${crypto.randomUUID().slice(0, 8)}`,
      nftId, sellerId, winnerId, bidAmount, auctionId,
      `House: ${houseCut}g | ${isPrimary ? "Primary" : `Creator royalty: ${creatorRoyalty}g`}`, now,
    ],
  });

  scheduleBlobPersist();

  return {
    success: true,
    message: `Settled! ${winnerName} won for ${bidAmount.toLocaleString()} g. Seller received ${sellerNet.toLocaleString()} g. House: ${houseCut.toLocaleString()} g.${creatorRoyalty > 0 ? ` Creator royalty: ${creatorRoyalty.toLocaleString()} g.` : ""}`,
    sold: true,
  };
}

// ─── Cancel Auction ──────────────────────────────────────────────────────────

export async function cancelAuction(auctionId: string, byAdminId: string): Promise<{ success: boolean; message: string }> {
  await initDb();
  const db = getDb();

  const adminRes = await db.execute({ sql: "SELECT is_admin FROM users WHERE id = ?", args: [byAdminId] });
  if (adminRes.rows.length === 0 || Number(adminRes.rows[0].is_admin) !== 1) {
    return { success: false, message: "Only admins can cancel auctions." };
  }

  const aucRes = await db.execute({ sql: "SELECT * FROM nft_auctions WHERE id = ?", args: [auctionId] });
  if (aucRes.rows.length === 0) return { success: false, message: "Auction not found." };
  const auc = aucRes.rows[0];
  if (!["SCHEDULED", "LIVE"].includes(String(auc.status))) {
    return { success: false, message: `Cannot cancel a ${auc.status} auction.` };
  }

  // Refund all active bids
  const activeBids = await db.execute({
    sql: "SELECT id, bidder_id, amount FROM nft_bids WHERE auction_id = ? AND status = 'ACTIVE'",
    args: [auctionId],
  });
  for (const row of activeBids.rows) {
    await db.execute({
      sql: "UPDATE users SET cash_balance = cash_balance + ?, locked_cash = locked_cash - ? WHERE id = ?",
      args: [Number(row.amount), Number(row.amount), String(row.bidder_id)],
    });
    await db.execute({ sql: "UPDATE nft_bids SET status = 'REFUNDED' WHERE id = ?", args: [String(row.id)] });
  }

  await db.execute({ sql: "UPDATE nft_auctions SET status = 'CANCELLED' WHERE id = ?", args: [auctionId] });
  await db.execute({ sql: "UPDATE nfts SET status = 'OWNED' WHERE id = ?", args: [String(auc.nft_id)] });
  scheduleBlobPersist();

  return { success: true, message: "Auction cancelled. All bids refunded." };
}

// ─── Read helpers ────────────────────────────────────────────────────────────

function mapNft(r: any): Nft {
  return {
    id: String(r.id), title: String(r.title),
    description: r.description ? String(r.description) : undefined,
    imageUrl: String(r.image_url),
    creatorId: String(r.creator_id), creatorName: String(r.creator_name),
    currentOwnerId: String(r.current_owner_id),
    currentOwnerName: r.owner_name ? String(r.owner_name) : undefined,
    editionNote: r.edition_note ? String(r.edition_note) : undefined,
    creatorRoyaltyBps: Number(r.creator_royalty_bps),
    status: String(r.status) as NftStatus,
    mintedAt: String(r.minted_at),
  };
}

function mapAuction(r: any): NftAuction {
  return {
    id: String(r.id), nftId: String(r.nft_id),
    sellerId: String(r.seller_id),
    sellerName: r.seller_name ? String(r.seller_name) : undefined,
    reservePrice: Number(r.reserve_price),
    startPrice: Number(r.start_price),
    currentBid: r.current_bid !== null && r.current_bid !== undefined ? Number(r.current_bid) : null,
    currentBidderId: r.current_bidder_id ? String(r.current_bidder_id) : null,
    currentBidderName: r.bidder_name ? String(r.bidder_name) : null,
    bidCount: Number(r.bid_count),
    startsAt: String(r.starts_at), endsAt: String(r.ends_at),
    extendedAt: r.extended_at ? String(r.extended_at) : null,
    status: String(r.status) as AuctionStatus,
    houseCutBps: Number(r.house_cut_bps),
    settledAt: r.settled_at ? String(r.settled_at) : null,
    createdAt: String(r.created_at),
  };
}

export async function getLiveAuctions(): Promise<(NftAuction & { nft: Nft })[]> {
  await initDb();
  const db = getDb();
  // Auto-tick first
  await tickAuctions();

  const res = await db.execute(`
    SELECT a.*, n.title, n.description, n.image_url, n.creator_id, n.creator_name,
           n.current_owner_id, n.edition_note, n.creator_royalty_bps, n.status as nft_status, n.minted_at,
           s.display_name as seller_name, b.display_name as bidder_name,
           ow.display_name as owner_name
    FROM nft_auctions a
    JOIN nfts n ON a.nft_id = n.id
    JOIN users s ON a.seller_id = s.id
    LEFT JOIN users b ON a.current_bidder_id = b.id
    LEFT JOIN users ow ON n.current_owner_id = ow.id
    WHERE a.status IN ('LIVE', 'SCHEDULED')
    ORDER BY a.status DESC, a.ends_at ASC
  `);

  return res.rows.map((r) => ({
    ...mapAuction(r),
    nft: mapNft({ ...r, status: r.nft_status, id: r.nft_id }),
  }));
}

export async function getAuctionById(auctionId: string): Promise<(NftAuction & { nft: Nft & { history: NftHistoryEntry[] }; bids: NftBid[] }) | null> {
  await initDb();
  const db = getDb();
  await tickAuctions();

  const res = await db.execute({
    sql: `SELECT a.*, n.id as nft_row_id, n.title, n.description, n.image_url, n.creator_id, n.creator_name,
           n.current_owner_id, n.edition_note, n.creator_royalty_bps, n.status as nft_status, n.minted_at,
           s.display_name as seller_name, b.display_name as bidder_name,
           ow.display_name as owner_name
    FROM nft_auctions a
    JOIN nfts n ON a.nft_id = n.id
    JOIN users s ON a.seller_id = s.id
    LEFT JOIN users b ON a.current_bidder_id = b.id
    LEFT JOIN users ow ON n.current_owner_id = ow.id
    WHERE a.id = ?`,
    args: [auctionId],
  });
  if (res.rows.length === 0) return null;

  const r = res.rows[0];
  const [bidsRes, histRes] = await Promise.all([
    db.execute({
      sql: `SELECT bd.*, u.display_name as bidder_name FROM nft_bids bd
            JOIN users u ON bd.bidder_id = u.id
            WHERE bd.auction_id = ? ORDER BY bd.placed_at DESC LIMIT 50`,
      args: [auctionId],
    }),
    db.execute({
      sql: `SELECT h.*, fu.display_name as from_name, tu.display_name as to_name
            FROM nft_history h
            LEFT JOIN users fu ON h.from_user_id = fu.id
            LEFT JOIN users tu ON h.to_user_id = tu.id
            WHERE h.nft_id = ? ORDER BY h.created_at ASC`,
      args: [String(r.nft_row_id)],
    }),
  ]);

  return {
    ...mapAuction(r),
    nft: {
      ...mapNft({ ...r, status: r.nft_status, id: r.nft_row_id }),
      history: histRes.rows.map((h) => ({
        id: String(h.id),
        nftId: String(h.nft_id),
        event: String(h.event) as NftEvent,
        fromUserId: h.from_user_id ? String(h.from_user_id) : undefined,
        fromUserName: h.from_name ? String(h.from_name) : undefined,
        toUserId: String(h.to_user_id),
        toUserName: h.to_name ? String(h.to_name) : undefined,
        price: h.price !== null && h.price !== undefined ? Number(h.price) : undefined,
        auctionId: h.auction_id ? String(h.auction_id) : undefined,
        note: h.note ? String(h.note) : undefined,
        createdAt: String(h.created_at),
      })),
    },
    bids: bidsRes.rows.map((b) => ({
      id: String(b.id), auctionId: String(b.auction_id),
      bidderId: String(b.bidder_id), bidderName: b.bidder_name ? String(b.bidder_name) : undefined,
      amount: Number(b.amount), placedAt: String(b.placed_at),
      status: String(b.status) as BidStatus,
    })),
  };
}

export async function getNftById(nftId: string): Promise<(Nft & { history: NftHistoryEntry[] }) | null> {
  await initDb();
  const db = getDb();

  const res = await db.execute({
    sql: `SELECT n.*, ow.display_name as owner_name FROM nfts n
          LEFT JOIN users ow ON n.current_owner_id = ow.id
          WHERE n.id = ?`,
    args: [nftId],
  });
  if (res.rows.length === 0) return null;

  const histRes = await db.execute({
    sql: `SELECT h.*, fu.display_name as from_name, tu.display_name as to_name
          FROM nft_history h
          LEFT JOIN users fu ON h.from_user_id = fu.id
          LEFT JOIN users tu ON h.to_user_id = tu.id
          WHERE h.nft_id = ? ORDER BY h.created_at ASC`,
    args: [nftId],
  });

  return {
    ...mapNft(res.rows[0]),
    history: histRes.rows.map((h) => ({
      id: String(h.id), nftId: String(h.nft_id),
      event: String(h.event) as NftEvent,
      fromUserId: h.from_user_id ? String(h.from_user_id) : undefined,
      fromUserName: h.from_name ? String(h.from_name) : undefined,
      toUserId: String(h.to_user_id),
      toUserName: h.to_name ? String(h.to_name) : undefined,
      price: h.price !== null && h.price !== undefined ? Number(h.price) : undefined,
      auctionId: h.auction_id ? String(h.auction_id) : undefined,
      note: h.note ? String(h.note) : undefined,
      createdAt: String(h.created_at),
    })),
  };
}

export async function getAllNfts(): Promise<Nft[]> {
  await initDb();
  const db = getDb();
  const res = await db.execute(`
    SELECT n.*, ow.display_name as owner_name FROM nfts n
    LEFT JOIN users ow ON n.current_owner_id = ow.id
    ORDER BY n.minted_at DESC
  `);
  return res.rows.map(mapNft);
}

export async function getPastAuctions(limit = 20): Promise<NftAuction[]> {
  await initDb();
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT a.*, s.display_name as seller_name, b.display_name as bidder_name
          FROM nft_auctions a
          JOIN users s ON a.seller_id = s.id
          LEFT JOIN users b ON a.current_bidder_id = b.id
          WHERE a.status IN ('SETTLED', 'CANCELLED', 'ENDED')
          ORDER BY a.settled_at DESC, a.ends_at DESC LIMIT ?`,
    args: [limit],
  });
  return res.rows.map(mapAuction);
}

export async function getNftSettings(): Promise<{
  houseCutBps: number;
  creatorRoyaltyBps: number;
  minBidIncrementPct: number;
  snipeExtMinutes: number;
  defaultDurationHours: number;
}> {
  const [houseCutBps, creatorRoyaltyBps, minBidIncrementPct, snipeExtMinutes, defaultDurationHours] = await Promise.all([
    getNftHouseCutBps(), getNftCreatorRoyaltyBps(), getNftMinIncrementPct(),
    getNftSnipeExtMinutes(), getNftDefaultDurationHours(),
  ]);
  return { houseCutBps, creatorRoyaltyBps, minBidIncrementPct, snipeExtMinutes, defaultDurationHours };
}
