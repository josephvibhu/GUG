/**
 * NFT Auction System & P2P Marketplace — core library.
 * All amounts in gold (REAL). Percentages as basis points (integer, 100bps = 1%).
 * House treasury is usr_treasury (ExchangeTreasury).
 */
import { getDb, initDb, scheduleBlobPersist } from "./db";
import { getSetting } from "./wallet";
import crypto from "crypto";

// ─── Types ──────────────────────────────────────────────────────────────────

export type NftStatus = "OWNED" | "IN_AUCTION" | "LISTED_FOR_SALE";
export type AuctionStatus = "SCHEDULED" | "LIVE" | "ENDED" | "SETTLED" | "CANCELLED";
export type BidStatus = "ACTIVE" | "OUTBID" | "WON" | "REFUNDED";
export type NftEvent = "MINTED" | "SOLD" | "TRANSFERRED" | "GIFTED" | "P2P_SALE" | "DIRECT_OFFER";
export type ListingStatus = "ACTIVE" | "SOLD" | "CANCELLED";
export type OfferStatus = "ACTIVE" | "ACCEPTED" | "REJECTED" | "CANCELLED";

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
  activeListing?: NftListing | null;
  activeOffersCount?: number;
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
  maxBid?: number | null;
  placedAt: string;
  status: BidStatus;
}

export interface NftListing {
  id: string;
  nftId: string;
  nftTitle?: string;
  nftImageUrl?: string;
  sellerId: string;
  sellerName?: string;
  price: number;
  status: ListingStatus;
  createdAt: string;
  completedAt?: string | null;
}

export interface NftOffer {
  id: string;
  nftId: string;
  nftTitle?: string;
  nftImageUrl?: string;
  buyerId: string;
  buyerName?: string;
  sellerId?: string;
  sellerName?: string;
  amount: number;
  status: OfferStatus;
  createdAt: string;
  completedAt?: string | null;
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

/** Default house cut on every auction/trade: 1500 bps = 15 % */
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
  creatorRoyaltyBps?: number;
  editionNote?: string;
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
  startsAt?: string;
  durationHours?: number;
  houseCutBps?: number;
}

export async function createNftAuction(params: CreateAuctionParams): Promise<{ success: boolean; message: string; auction?: NftAuction }> {
  await initDb();
  const db = getDb();

  const sellerRes = await db.execute({ sql: "SELECT id, is_admin, is_frozen FROM users WHERE id = ?", args: [params.sellerId] });
  if (sellerRes.rows.length === 0 || Number(sellerRes.rows[0].is_admin) !== 1) {
    return { success: false, message: "Only admins can create auctions." };
  }
  if (Number(sellerRes.rows[0].is_frozen) === 1) {
    return { success: false, message: "Your account is frozen." };
  }

  const nftRes = await db.execute({ sql: "SELECT * FROM nfts WHERE id = ?", args: [params.nftId] });
  if (nftRes.rows.length === 0) return { success: false, message: "NFT not found." };
  const nft = nftRes.rows[0];
  if (String(nft.current_owner_id) !== params.sellerId) return { success: false, message: "You do not own this NFT." };
  if (String(nft.status) !== "OWNED") return { success: false, message: "NFT is not available (in auction or listed for sale)." };

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

// ─── Place Bid with Proxy (Max Bid) Support ──────────────────────────────────

export interface PlaceBidParams {
  bidderId: string;
  auctionId: string;
  amount: number;
  maxBid?: number;
}

export async function placeBid(params: PlaceBidParams): Promise<{ success: boolean; message: string; bid?: NftBid }> {
  await initDb();
  const db = getDb();

  const userRes = await db.execute({ sql: "SELECT id, cash_balance, locked_cash, is_frozen FROM users WHERE id = ?", args: [params.bidderId] });
  if (userRes.rows.length === 0) return { success: false, message: "User not found." };
  const user = userRes.rows[0];
  if (Number(user.is_frozen) === 1) return { success: false, message: "Your account is frozen." };

  const aucRes = await db.execute({ sql: "SELECT * FROM nft_auctions WHERE id = ?", args: [params.auctionId] });
  if (aucRes.rows.length === 0) return { success: false, message: "Auction not found." };
  const auc = aucRes.rows[0];

  if (String(auc.status) === "SCHEDULED" && new Date(String(auc.starts_at)) <= new Date()) {
    await db.execute({ sql: "UPDATE nft_auctions SET status = 'LIVE' WHERE id = ?", args: [params.auctionId] });
    auc.status = "LIVE";
  }

  if (String(auc.status) !== "LIVE") return { success: false, message: "This auction is not currently live." };
  if (new Date(String(auc.ends_at)) <= new Date()) return { success: false, message: "This auction has already ended." };
  if (String(auc.seller_id) === params.bidderId) return { success: false, message: "You cannot bid on your own auction." };

  const currentBid = auc.current_bid !== null ? Number(auc.current_bid) : null;
  const startPrice = Number(auc.start_price);
  const minIncrementPct = await getNftMinIncrementPct();

  const minNextBid = currentBid === null
    ? startPrice
    : Math.round((currentBid * (1 + minIncrementPct / 100)) * 100) / 100;

  const rawAmount = Math.round(Number(params.amount) * 100) / 100;
  const maxBid = params.maxBid ? Math.round(Number(params.maxBid) * 100) / 100 : rawAmount;

  if (maxBid < minNextBid) {
    return {
      success: false,
      message: `Minimum required bid is ${minNextBid.toLocaleString()} g.`,
    };
  }

  // Find incumbent top active bid (if any)
  const incumbentRes = await db.execute({
    sql: "SELECT * FROM nft_bids WHERE auction_id = ? AND status = 'ACTIVE' LIMIT 1",
    args: [params.auctionId],
  });
  const incumbent = incumbentRes.rows.length > 0 ? incumbentRes.rows[0] : null;

  // Check if caller already has the active bid
  if (incumbent && String(incumbent.bidder_id) === params.bidderId) {
    // Updating their proxy max_bid
    if (maxBid <= Number(incumbent.amount)) {
      return { success: false, message: `Your current winning bid is already ${Number(incumbent.amount).toLocaleString()} g.` };
    }
    // Adjust locked cash to the new maxBid
    const oldLocked = Number(incumbent.max_bid || incumbent.amount);
    const diff = maxBid - oldLocked;
    const available = Number(user.cash_balance);
    if (diff > 0 && available < diff) {
      return { success: false, message: `Insufficient gold to raise max proxy bid to ${maxBid.toLocaleString()} g (available: ${available.toLocaleString()} g).` };
    }

    if (diff !== 0) {
      await db.execute({
        sql: "UPDATE users SET cash_balance = cash_balance - ?, locked_cash = locked_cash + ? WHERE id = ? AND cash_balance >= ?",
        args: [diff, diff, params.bidderId, diff > 0 ? diff : 0],
      });
    }

    await db.execute({
      sql: "UPDATE nft_bids SET max_bid = ? WHERE id = ?",
      args: [maxBid, String(incumbent.id)],
    });

    scheduleBlobPersist();
    return {
      success: true,
      message: `Your maximum proxy bid has been updated to ${maxBid.toLocaleString()} g!`,
      bid: {
        id: String(incumbent.id),
        auctionId: params.auctionId,
        bidderId: params.bidderId,
        amount: Number(incumbent.amount),
        maxBid,
        placedAt: String(incumbent.placed_at),
        status: "ACTIVE",
      },
    };
  }

  // New challenger placing a bid
  // Challenger must lock their full maxBid
  const available = Number(user.cash_balance);
  if (available < maxBid) {
    return { success: false, message: `Insufficient gold. You need ${maxBid.toLocaleString()} g available to back your bid (you have ${available.toLocaleString()} g).` };
  }

  const now = new Date().toISOString();

  // Deduct challenger's maxBid from available cash into locked_cash
  await db.execute({
    sql: "UPDATE users SET cash_balance = cash_balance - ?, locked_cash = locked_cash + ? WHERE id = ? AND cash_balance >= ?",
    args: [maxBid, maxBid, params.bidderId, maxBid],
  });

  let winningBidderId = params.bidderId;
  let newCurrentBid = minNextBid;
  let challengerStatus: BidStatus = "ACTIVE";
  let message = "";

  if (!incumbent) {
    // First bid of auction
    newCurrentBid = Math.max(startPrice, rawAmount);
    if (newCurrentBid > maxBid) newCurrentBid = maxBid;

    const bidId = `bid_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    await db.execute({
      sql: `INSERT INTO nft_bids (id, auction_id, bidder_id, amount, max_bid, placed_at, status) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      args: [bidId, params.auctionId, params.bidderId, newCurrentBid, maxBid, now],
    });

    await db.execute({
      sql: `UPDATE nft_auctions SET current_bid = ?, current_bidder_id = ?, bid_count = bid_count + 1 WHERE id = ?`,
      args: [newCurrentBid, params.bidderId, params.auctionId],
    });

    winningBidderId = params.bidderId;
    message = `Bid of ${newCurrentBid.toLocaleString()} g placed! (Proxy max: ${maxBid.toLocaleString()} g)`;
  } else {
    // There is an incumbent
    const incumbentId = String(incumbent.bidder_id);
    const incumbentMax = Number(incumbent.max_bid || incumbent.amount);

    if (maxBid > incumbentMax) {
      // Challenger beats incumbent
      const incBump = Math.round((incumbentMax * (1 + minIncrementPct / 100)) * 100) / 100;
      newCurrentBid = Math.min(maxBid, incBump);

      // Refund old incumbent
      const refundAmt = Number(incumbent.max_bid || incumbent.amount);
      await db.execute({ sql: "UPDATE nft_bids SET status = 'OUTBID' WHERE id = ?", args: [String(incumbent.id)] });
      await db.execute({
        sql: "UPDATE users SET cash_balance = cash_balance + ?, locked_cash = locked_cash - ? WHERE id = ?",
        args: [refundAmt, refundAmt, incumbentId],
      });

      // Insert challenger winning bid
      const bidId = `bid_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      await db.execute({
        sql: `INSERT INTO nft_bids (id, auction_id, bidder_id, amount, max_bid, placed_at, status) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
        args: [bidId, params.auctionId, params.bidderId, newCurrentBid, maxBid, now],
      });

      await db.execute({
        sql: `UPDATE nft_auctions SET current_bid = ?, current_bidder_id = ?, bid_count = bid_count + 1 WHERE id = ?`,
        args: [newCurrentBid, params.bidderId, params.auctionId],
      });

      winningBidderId = params.bidderId;
      message = `You are now the highest bidder at ${newCurrentBid.toLocaleString()} g! (Proxy max: ${maxBid.toLocaleString()} g)`;
    } else {
      // Incumbent's proxy defends! Incumbent stays on top
      const defBump = Math.round((maxBid * (1 + minIncrementPct / 100)) * 100) / 100;
      newCurrentBid = Math.min(incumbentMax, defBump);

      // Record challenger bid as OUTBID and refund challenger
      const chalBidId = `bid_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      await db.execute({
        sql: `INSERT INTO nft_bids (id, auction_id, bidder_id, amount, max_bid, placed_at, status) VALUES (?, ?, ?, ?, ?, ?, 'OUTBID')`,
        args: [chalBidId, params.auctionId, params.bidderId, maxBid, maxBid, now],
      });

      // Refund challenger locked cash immediately
      await db.execute({
        sql: "UPDATE users SET cash_balance = cash_balance + ?, locked_cash = locked_cash - ? WHERE id = ?",
        args: [maxBid, maxBid, params.bidderId],
      });

      // Update incumbent's active visible bid
      await db.execute({
        sql: "UPDATE nft_bids SET amount = ? WHERE id = ?",
        args: [newCurrentBid, String(incumbent.id)],
      });

      await db.execute({
        sql: `UPDATE nft_auctions SET current_bid = ?, bid_count = bid_count + 1 WHERE id = ?`,
        args: [newCurrentBid, params.auctionId],
      });

      winningBidderId = incumbentId;
      challengerStatus = "OUTBID";
      message = `Outbid! The current leader had an automatic proxy bid that defended at ${newCurrentBid.toLocaleString()} g. Your gold was refunded.`;
    }
  }

  // Anti-snipe check
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
    message,
    bid: {
      id: `bid_${crypto.randomUUID().slice(0, 8)}`,
      auctionId: params.auctionId,
      bidderId: params.bidderId,
      amount: newCurrentBid,
      maxBid,
      placedAt: now,
      status: challengerStatus,
    },
  };
}

// ─── Settle Auction ──────────────────────────────────────────────────────────

export async function settleAuction(auctionId: string, byAdminId: string): Promise<{ success: boolean; message: string; sold?: boolean }> {
  await initDb();
  const db = getDb();

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

  const currentBid = auc.current_bid !== null ? Number(auc.current_bid) : null;
  const reservePrice = Number(auc.reserve_price);

  if (currentBid === null || currentBid < reservePrice) {
    const activeBids = await db.execute({
      sql: "SELECT id, bidder_id, amount, max_bid FROM nft_bids WHERE auction_id = ? AND status = 'ACTIVE'",
      args: [auctionId],
    });
    for (const row of activeBids.rows) {
      const lockedAmt = Number(row.max_bid || row.amount);
      await db.execute({
        sql: "UPDATE users SET cash_balance = cash_balance + ?, locked_cash = locked_cash - ? WHERE id = ?",
        args: [lockedAmt, lockedAmt, String(row.bidder_id)],
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

  const winnerId = String(auc.current_bidder_id);
  const hammerPrice = currentBid;
  const houseCutBps = Number(auc.house_cut_bps);

  const winningBidRes = await db.execute({
    sql: "SELECT id, max_bid, amount FROM nft_bids WHERE auction_id = ? AND bidder_id = ? AND status = 'ACTIVE' LIMIT 1",
    args: [auctionId, winnerId],
  });
  const winRow = winningBidRes.rows[0];
  const maxLocked = winRow ? Number(winRow.max_bid || winRow.amount) : hammerPrice;
  const excessRefund = Math.max(0, maxLocked - hammerPrice);

  const nftRes = await db.execute({ sql: "SELECT creator_id, creator_royalty_bps FROM nfts WHERE id = ?", args: [nftId] });
  const nft = nftRes.rows[0];
  const creatorId = String(nft.creator_id);
  const creatorRoyaltyBps = Number(nft.creator_royalty_bps);
  const isPrimary = creatorId === sellerId;

  const houseCut = Math.round(hammerPrice * houseCutBps / 10000 * 100) / 100;
  const creatorRoyalty = isPrimary ? 0 : Math.round(hammerPrice * creatorRoyaltyBps / 10000 * 100) / 100;
  const sellerNet = Math.round((hammerPrice - houseCut - creatorRoyalty) * 100) / 100;

  // 1. Settle winner's lock: deduct full locked amount, refund excess (if maxBid was higher than hammer)
  await db.execute({
    sql: "UPDATE users SET locked_cash = locked_cash - ? WHERE id = ?",
    args: [maxLocked, winnerId],
  });
  if (excessRefund > 0) {
    await db.execute({
      sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?",
      args: [excessRefund, winnerId],
    });
  }

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
      nftId, sellerId, winnerId, hammerPrice, auctionId,
      `House: ${houseCut}g | ${isPrimary ? "Primary" : `Creator royalty: ${creatorRoyalty}g`}`, now,
    ],
  });

  scheduleBlobPersist();

  return {
    success: true,
    message: `Settled! ${winnerName} won for ${hammerPrice.toLocaleString()} g. Seller received ${sellerNet.toLocaleString()} g. House: ${houseCut.toLocaleString()} g.${creatorRoyalty > 0 ? ` Creator royalty: ${creatorRoyalty.toLocaleString()} g.` : ""}`,
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

  const activeBids = await db.execute({
    sql: "SELECT id, bidder_id, amount, max_bid FROM nft_bids WHERE auction_id = ? AND status = 'ACTIVE'",
    args: [auctionId],
  });
  for (const row of activeBids.rows) {
    const lockedAmt = Number(row.max_bid || row.amount);
    await db.execute({
      sql: "UPDATE users SET cash_balance = cash_balance + ?, locked_cash = locked_cash - ? WHERE id = ?",
      args: [lockedAmt, lockedAmt, String(row.bidder_id)],
    });
    await db.execute({ sql: "UPDATE nft_bids SET status = 'REFUNDED' WHERE id = ?", args: [String(row.id)] });
  }

  await db.execute({ sql: "UPDATE nft_auctions SET status = 'CANCELLED' WHERE id = ?", args: [auctionId] });
  await db.execute({ sql: "UPDATE nfts SET status = 'OWNED' WHERE id = ?", args: [String(auc.nft_id)] });
  scheduleBlobPersist();

  return { success: true, message: "Auction cancelled. All bids refunded." };
}

// ─── P2P Direct Trade: Fixed Price Listings ──────────────────────────────────

export async function listNftForSale(
  userId: string,
  nftId: string,
  price: number
): Promise<{ success: boolean; message: string; listing?: NftListing }> {
  await initDb();
  const db = getDb();

  const safePrice = Math.round(Number(price) * 100) / 100;
  if (!Number.isFinite(safePrice) || safePrice <= 0) {
    return { success: false, message: "Price must be greater than 0 gold." };
  }

  const userRes = await db.execute({ sql: "SELECT id, is_frozen FROM users WHERE id = ?", args: [userId] });
  if (userRes.rows.length === 0 || Number(userRes.rows[0].is_frozen) === 1) {
    return { success: false, message: "Account is frozen or invalid." };
  }

  const nftRes = await db.execute({ sql: "SELECT * FROM nfts WHERE id = ?", args: [nftId] });
  if (nftRes.rows.length === 0) return { success: false, message: "NFT not found." };
  const nft = nftRes.rows[0];

  if (String(nft.current_owner_id) !== userId) {
    return { success: false, message: "You do not own this NFT." };
  }
  if (String(nft.status) !== "OWNED") {
    return { success: false, message: "NFT is not available to list (currently in auction or already listed)." };
  }

  const listingId = `list_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const now = new Date().toISOString();

  await db.execute({
    sql: "UPDATE nfts SET status = 'LISTED_FOR_SALE' WHERE id = ? AND status = 'OWNED'",
    args: [nftId],
  });

  await db.execute({
    sql: `INSERT INTO nft_listings (id, nft_id, seller_id, price, status, created_at) VALUES (?, ?, ?, ?, 'ACTIVE', ?)`,
    args: [listingId, nftId, userId, safePrice, now],
  });

  scheduleBlobPersist();

  return {
    success: true,
    message: `NFT listed for sale at ${safePrice.toLocaleString()} g!`,
    listing: {
      id: listingId,
      nftId,
      sellerId: userId,
      price: safePrice,
      status: "ACTIVE",
      createdAt: now,
    },
  };
}

export async function cancelNftListing(
  userId: string,
  listingId: string
): Promise<{ success: boolean; message: string }> {
  await initDb();
  const db = getDb();

  const listRes = await db.execute({ sql: "SELECT * FROM nft_listings WHERE id = ? AND seller_id = ?", args: [listingId, userId] });
  if (listRes.rows.length === 0) return { success: false, message: "Listing not found or you are not the seller." };
  const l = listRes.rows[0];
  if (String(l.status) !== "ACTIVE") return { success: false, message: "Listing is no longer active." };

  await db.execute({ sql: "UPDATE nft_listings SET status = 'CANCELLED' WHERE id = ?", args: [listingId] });
  await db.execute({ sql: "UPDATE nfts SET status = 'OWNED' WHERE id = ?", args: [String(l.nft_id)] });

  scheduleBlobPersist();
  return { success: true, message: "Listing cancelled. NFT returned to your vault." };
}

export async function buyNftListing(
  buyerId: string,
  listingId: string
): Promise<{ success: boolean; message: string }> {
  await initDb();
  const db = getDb();

  const buyerRes = await db.execute({ sql: "SELECT id, cash_balance, locked_cash, is_frozen, display_name, username FROM users WHERE id = ?", args: [buyerId] });
  if (buyerRes.rows.length === 0 || Number(buyerRes.rows[0].is_frozen) === 1) {
    return { success: false, message: "Account is frozen or invalid." };
  }
  const buyer = buyerRes.rows[0];

  const listRes = await db.execute({ sql: "SELECT * FROM nft_listings WHERE id = ? AND status = 'ACTIVE'", args: [listingId] });
  if (listRes.rows.length === 0) return { success: false, message: "Listing is not active." };
  const listing = listRes.rows[0];
  const sellerId = String(listing.seller_id);
  const nftId = String(listing.nft_id);
  const price = Number(listing.price);

  if (sellerId === buyerId) return { success: false, message: "You cannot buy your own listing." };

  const available = Number(buyer.cash_balance);
  if (available < price) {
    return { success: false, message: `Insufficient gold. Price is ${price.toLocaleString()} g, you have ${available.toLocaleString()} g available.` };
  }

  // Deduct from buyer
  const debitRes = await db.execute({
    sql: "UPDATE users SET cash_balance = cash_balance - ? WHERE id = ? AND cash_balance >= ?",
    args: [price, buyerId, price],
  });
  if (debitRes.rowsAffected === 0) {
    return { success: false, message: "Insufficient available gold." };
  }

  const now = new Date().toISOString();

  // Splits: 15% house cut, creator royalty (if secondary)
  const nftRes = await db.execute({ sql: "SELECT creator_id, creator_royalty_bps FROM nfts WHERE id = ?", args: [nftId] });
  const nft = nftRes.rows[0];
  const creatorId = String(nft.creator_id);
  const creatorRoyaltyBps = Number(nft.creator_royalty_bps);
  const houseCutBps = await getNftHouseCutBps();

  const isPrimary = creatorId === sellerId;
  const houseCut = Math.round(price * houseCutBps / 10000 * 100) / 100;
  const creatorRoyalty = isPrimary ? 0 : Math.round(price * creatorRoyaltyBps / 10000 * 100) / 100;
  const sellerNet = Math.round((price - houseCut - creatorRoyalty) * 100) / 100;

  // Credit house
  await db.execute({ sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = 'usr_treasury'", args: [houseCut] });
  // Credit creator (secondary)
  if (creatorRoyalty > 0) {
    await db.execute({ sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?", args: [creatorRoyalty, creatorId] });
  }
  // Credit seller
  await db.execute({ sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?", args: [sellerNet, sellerId] });

  // Update listing & NFT
  await db.execute({ sql: "UPDATE nft_listings SET status = 'SOLD', completed_at = ? WHERE id = ?", args: [now, listingId] });
  await db.execute({ sql: "UPDATE nfts SET current_owner_id = ?, status = 'OWNED' WHERE id = ?", args: [buyerId, nftId] });

  // Provenance
  await db.execute({
    sql: `INSERT INTO nft_history (id, nft_id, event, from_user_id, to_user_id, price, note, created_at)
          VALUES (?, ?, 'P2P_SALE', ?, ?, ?, ?, ?)`,
    args: [
      `nfth_${crypto.randomUUID().slice(0, 8)}`,
      nftId, sellerId, buyerId, price,
      `Direct P2P listing sale · House: ${houseCut}g | Royalty: ${creatorRoyalty}g`,
      now,
    ],
  });

  scheduleBlobPersist();

  return {
    success: true,
    message: `Purchase complete! You now own this NFT.`,
  };
}

// ─── P2P Private Offers ──────────────────────────────────────────────────────

export async function makePrivateOffer(
  buyerId: string,
  nftId: string,
  amount: number
): Promise<{ success: boolean; message: string; offer?: NftOffer }> {
  await initDb();
  const db = getDb();

  const safeAmount = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
    return { success: false, message: "Offer amount must be greater than 0 gold." };
  }

  const buyerRes = await db.execute({ sql: "SELECT id, cash_balance, locked_cash, is_frozen, display_name, username FROM users WHERE id = ?", args: [buyerId] });
  if (buyerRes.rows.length === 0 || Number(buyerRes.rows[0].is_frozen) === 1) {
    return { success: false, message: "Account is frozen or invalid." };
  }
  const buyer = buyerRes.rows[0];

  const nftRes = await db.execute({ sql: "SELECT * FROM nfts WHERE id = ?", args: [nftId] });
  if (nftRes.rows.length === 0) return { success: false, message: "NFT not found." };
  const nft = nftRes.rows[0];

  if (String(nft.current_owner_id) === buyerId) {
    return { success: false, message: "You already own this NFT." };
  }

  const available = Number(buyer.cash_balance);
  if (available < safeAmount) {
    return { success: false, message: `Insufficient gold. Offer requires ${safeAmount.toLocaleString()} g available, you have ${available.toLocaleString()} g.` };
  }

  // Lock offer funds from buyer
  const lockRes = await db.execute({
    sql: "UPDATE users SET cash_balance = cash_balance - ?, locked_cash = locked_cash + ? WHERE id = ? AND cash_balance >= ?",
    args: [safeAmount, safeAmount, buyerId, safeAmount],
  });
  if (lockRes.rowsAffected === 0) {
    return { success: false, message: "Failed to lock gold for offer." };
  }

  const offerId = `off_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO nft_offers (id, nft_id, buyer_id, amount, status, created_at) VALUES (?, ?, ?, ?, 'ACTIVE', ?)`,
    args: [offerId, nftId, buyerId, safeAmount, now],
  });

  scheduleBlobPersist();

  return {
    success: true,
    message: `Offer of ${safeAmount.toLocaleString()} g placed! Funds are reserved.`,
    offer: {
      id: offerId,
      nftId,
      buyerId,
      buyerName: String(buyer.display_name || buyer.username),
      amount: safeAmount,
      status: "ACTIVE",
      createdAt: now,
    },
  };
}

export async function cancelPrivateOffer(
  buyerId: string,
  offerId: string
): Promise<{ success: boolean; message: string }> {
  await initDb();
  const db = getDb();

  const offRes = await db.execute({ sql: "SELECT * FROM nft_offers WHERE id = ? AND buyer_id = ? AND status = 'ACTIVE'", args: [offerId, buyerId] });
  if (offRes.rows.length === 0) return { success: false, message: "Active offer not found or you are not the buyer." };
  const offer = offRes.rows[0];
  const amount = Number(offer.amount);

  // Refund locked cash
  await db.execute({
    sql: "UPDATE users SET cash_balance = cash_balance + ?, locked_cash = locked_cash - ? WHERE id = ?",
    args: [amount, amount, buyerId],
  });

  await db.execute({ sql: "UPDATE nft_offers SET status = 'CANCELLED' WHERE id = ?", args: [offerId] });
  scheduleBlobPersist();

  return { success: true, message: `Offer cancelled. ${amount.toLocaleString()} g returned to your purse.` };
}

export async function acceptPrivateOffer(
  sellerId: string,
  offerId: string
): Promise<{ success: boolean; message: string }> {
  await initDb();
  const db = getDb();

  const offRes = await db.execute({
    sql: `SELECT o.*, n.current_owner_id, n.creator_id, n.creator_royalty_bps, n.status as nft_status
          FROM nft_offers o
          JOIN nfts n ON o.nft_id = n.id
          WHERE o.id = ? AND o.status = 'ACTIVE'`,
    args: [offerId],
  });
  if (offRes.rows.length === 0) return { success: false, message: "Active offer not found." };
  const row = offRes.rows[0];

  if (String(row.current_owner_id) !== sellerId) {
    return { success: false, message: "You are not the current owner of this NFT." };
  }
  if (String(row.nft_status) === "IN_AUCTION") {
    return { success: false, message: "Cannot accept offers while NFT is in an active auction." };
  }

  const buyerId = String(row.buyer_id);
  const nftId = String(row.nft_id);
  const amount = Number(row.amount);
  const creatorId = String(row.creator_id);
  const creatorRoyaltyBps = Number(row.creator_royalty_bps);
  const houseCutBps = await getNftHouseCutBps();

  const isPrimary = creatorId === sellerId;
  const houseCut = Math.round(amount * houseCutBps / 10000 * 100) / 100;
  const creatorRoyalty = isPrimary ? 0 : Math.round(amount * creatorRoyaltyBps / 10000 * 100) / 100;
  const sellerNet = Math.round((amount - houseCut - creatorRoyalty) * 100) / 100;

  const now = new Date().toISOString();

  // Deduct buyer's locked cash
  await db.execute({
    sql: "UPDATE users SET locked_cash = locked_cash - ? WHERE id = ?",
    args: [amount, buyerId],
  });

  // Pay seller
  await db.execute({
    sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?",
    args: [sellerNet, sellerId],
  });

  // Pay house
  await db.execute({
    sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = 'usr_treasury'",
    args: [houseCut],
  });

  // Pay royalty
  if (creatorRoyalty > 0) {
    await db.execute({
      sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?",
      args: [creatorRoyalty, creatorId],
    });
  }

  // Cancel any active listing for this NFT
  await db.execute({
    sql: "UPDATE nft_listings SET status = 'CANCELLED' WHERE nft_id = ? AND status = 'ACTIVE'",
    args: [nftId],
  });

  // Mark this offer ACCEPTED
  await db.execute({
    sql: "UPDATE nft_offers SET status = 'ACCEPTED', completed_at = ? WHERE id = ?",
    args: [now, offerId],
  });

  // Reject and refund other active offers for this NFT
  const otherOffers = await db.execute({
    sql: "SELECT id, buyer_id, amount FROM nft_offers WHERE nft_id = ? AND id != ? AND status = 'ACTIVE'",
    args: [nftId, offerId],
  });
  for (const o of otherOffers.rows) {
    const oAmt = Number(o.amount);
    await db.execute({
      sql: "UPDATE users SET cash_balance = cash_balance + ?, locked_cash = locked_cash - ? WHERE id = ?",
      args: [oAmt, oAmt, String(o.buyer_id)],
    });
    await db.execute({ sql: "UPDATE nft_offers SET status = 'REJECTED' WHERE id = ?", args: [String(o.id)] });
  }

  // Transfer NFT
  await db.execute({
    sql: "UPDATE nfts SET current_owner_id = ?, status = 'OWNED' WHERE id = ?",
    args: [buyerId, nftId],
  });

  // Provenance
  await db.execute({
    sql: `INSERT INTO nft_history (id, nft_id, event, from_user_id, to_user_id, price, note, created_at)
          VALUES (?, ?, 'DIRECT_OFFER', ?, ?, ?, ?, ?)`,
    args: [
      `nfth_${crypto.randomUUID().slice(0, 8)}`,
      nftId, sellerId, buyerId, amount,
      `Accepted private offer · House: ${houseCut}g | Royalty: ${creatorRoyalty}g`,
      now,
    ],
  });

  scheduleBlobPersist();

  return {
    success: true,
    message: `Offer accepted! You received ${sellerNet.toLocaleString()} g. NFT transferred.`,
  };
}

export async function rejectPrivateOffer(
  sellerId: string,
  offerId: string
): Promise<{ success: boolean; message: string }> {
  await initDb();
  const db = getDb();

  const offRes = await db.execute({
    sql: `SELECT o.*, n.current_owner_id FROM nft_offers o JOIN nfts n ON o.nft_id = n.id WHERE o.id = ? AND o.status = 'ACTIVE'`,
    args: [offerId],
  });
  if (offRes.rows.length === 0) return { success: false, message: "Active offer not found." };
  const offer = offRes.rows[0];

  if (String(offer.current_owner_id) !== sellerId) {
    return { success: false, message: "You are not the owner of this NFT." };
  }

  const amount = Number(offer.amount);
  const buyerId = String(offer.buyer_id);

  // Refund buyer locked cash
  await db.execute({
    sql: "UPDATE users SET cash_balance = cash_balance + ?, locked_cash = locked_cash - ? WHERE id = ?",
    args: [amount, amount, buyerId],
  });

  await db.execute({ sql: "UPDATE nft_offers SET status = 'REJECTED' WHERE id = ?", args: [offerId] });
  scheduleBlobPersist();

  return { success: true, message: "Offer rejected and buyer's funds refunded." };
}

// ─── Citizen Vault / Trophy Case ─────────────────────────────────────────────

export async function getUserVaultNfts(userId: string): Promise<{
  vault: (Nft & { activeListing?: NftListing | null; activeOffersCount?: number })[];
  totalVaultValue: number;
  offersReceived: NftOffer[];
  offersSent: NftOffer[];
}> {
  await initDb();
  const db = getDb();

  const nftsRes = await db.execute({
    sql: `SELECT n.*, ow.display_name as owner_name FROM nfts n
          LEFT JOIN users ow ON n.current_owner_id = ow.id
          WHERE n.current_owner_id = ?
          ORDER BY n.minted_at DESC`,
    args: [userId],
  });

  const vault = await Promise.all(
    nftsRes.rows.map(async (r) => {
      const nft = mapNft(r);
      const [listRes, offersRes] = await Promise.all([
        db.execute({ sql: "SELECT * FROM nft_listings WHERE nft_id = ? AND status = 'ACTIVE' LIMIT 1", args: [nft.id] }),
        db.execute({ sql: "SELECT COUNT(*) as cnt FROM nft_offers WHERE nft_id = ? AND status = 'ACTIVE'", args: [nft.id] }),
      ]);
      const activeListing = listRes.rows.length > 0 ? (listRes.rows[0] as any) : null;
      const activeOffersCount = offersRes.rows.length > 0 ? Number(offersRes.rows[0].cnt) : 0;
      return {
        ...nft,
        activeListing: activeListing
          ? {
              id: String(activeListing.id),
              nftId: String(activeListing.nft_id),
              sellerId: String(activeListing.seller_id),
              price: Number(activeListing.price),
              status: activeListing.status,
              createdAt: String(activeListing.created_at),
            }
          : null,
        activeOffersCount,
      };
    })
  );

  // Offers received for user's owned NFTs
  const receivedRes = await db.execute({
    sql: `SELECT o.*, n.title as nft_title, n.image_url as nft_image_url, u.display_name as buyer_name
          FROM nft_offers o
          JOIN nfts n ON o.nft_id = n.id
          JOIN users u ON o.buyer_id = u.id
          WHERE n.current_owner_id = ? AND o.status = 'ACTIVE'
          ORDER BY o.created_at DESC`,
    args: [userId],
  });

  // Offers sent by user
  const sentRes = await db.execute({
    sql: `SELECT o.*, n.title as nft_title, n.image_url as nft_image_url, ow.display_name as seller_name
          FROM nft_offers o
          JOIN nfts n ON o.nft_id = n.id
          JOIN users ow ON n.current_owner_id = ow.id
          WHERE o.buyer_id = ? AND o.status = 'ACTIVE'
          ORDER BY o.created_at DESC`,
    args: [userId],
  });

  const totalVaultValue = vault.reduce((sum, n) => {
    return sum + (n.activeListing ? n.activeListing.price : 0);
  }, 0);

  return {
    vault,
    totalVaultValue,
    offersReceived: receivedRes.rows.map((r) => ({
      id: String(r.id),
      nftId: String(r.nft_id),
      nftTitle: String(r.nft_title),
      nftImageUrl: String(r.nft_image_url),
      buyerId: String(r.buyer_id),
      buyerName: String(r.buyer_name),
      amount: Number(r.amount),
      status: r.status as OfferStatus,
      createdAt: String(r.created_at),
    })),
    offersSent: sentRes.rows.map((r) => ({
      id: String(r.id),
      nftId: String(r.nft_id),
      nftTitle: String(r.nft_title),
      nftImageUrl: String(r.nft_image_url),
      buyerId: String(r.buyer_id),
      sellerName: String(r.seller_name),
      amount: Number(r.amount),
      status: r.status as OfferStatus,
      createdAt: String(r.created_at),
    })),
  };
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
      amount: Number(b.amount),
      maxBid: b.max_bid !== null && b.max_bid !== undefined ? Number(b.max_bid) : undefined,
      placedAt: String(b.placed_at),
      status: String(b.status) as BidStatus,
    })),
  };
}

export async function getNftById(nftId: string): Promise<(Nft & { history: NftHistoryEntry[]; activeListing?: NftListing | null; activeOffers?: NftOffer[] }) | null> {
  await initDb();
  const db = getDb();

  const res = await db.execute({
    sql: `SELECT n.*, ow.display_name as owner_name FROM nfts n
          LEFT JOIN users ow ON n.current_owner_id = ow.id
          WHERE n.id = ?`,
    args: [nftId],
  });
  if (res.rows.length === 0) return null;

  const [histRes, listRes, offRes] = await Promise.all([
    db.execute({
      sql: `SELECT h.*, fu.display_name as from_name, tu.display_name as to_name
            FROM nft_history h
            LEFT JOIN users fu ON h.from_user_id = fu.id
            LEFT JOIN users tu ON h.to_user_id = tu.id
            WHERE h.nft_id = ? ORDER BY h.created_at ASC`,
      args: [nftId],
    }),
    db.execute({
      sql: "SELECT * FROM nft_listings WHERE nft_id = ? AND status = 'ACTIVE' LIMIT 1",
      args: [nftId],
    }),
    db.execute({
      sql: `SELECT o.*, u.display_name as buyer_name FROM nft_offers o
            JOIN users u ON o.buyer_id = u.id
            WHERE o.nft_id = ? AND o.status = 'ACTIVE' ORDER BY o.amount DESC`,
      args: [nftId],
    }),
  ]);

  const activeListing = listRes.rows.length > 0 ? (listRes.rows[0] as any) : null;

  return {
    ...mapNft(res.rows[0]),
    activeListing: activeListing
      ? {
          id: String(activeListing.id),
          nftId: String(activeListing.nft_id),
          sellerId: String(activeListing.seller_id),
          price: Number(activeListing.price),
          status: activeListing.status,
          createdAt: String(activeListing.created_at),
        }
      : null,
    activeOffers: offRes.rows.map((o) => ({
      id: String(o.id),
      nftId: String(o.nft_id),
      buyerId: String(o.buyer_id),
      buyerName: String(o.buyer_name),
      amount: Number(o.amount),
      status: o.status as OfferStatus,
      createdAt: String(o.created_at),
    })),
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

export async function getActiveListings(): Promise<NftListing[]> {
  await initDb();
  const db = getDb();
  const res = await db.execute(`
    SELECT l.*, n.title as nft_title, n.image_url as nft_image_url, u.display_name as seller_name
    FROM nft_listings l
    JOIN nfts n ON l.nft_id = n.id
    JOIN users u ON l.seller_id = u.id
    WHERE l.status = 'ACTIVE'
    ORDER BY l.created_at DESC
  `);
  return res.rows.map((r) => ({
    id: String(r.id),
    nftId: String(r.nft_id),
    nftTitle: String(r.nft_title),
    nftImageUrl: String(r.nft_image_url),
    sellerId: String(r.seller_id),
    sellerName: String(r.seller_name),
    price: Number(r.price),
    status: r.status as ListingStatus,
    createdAt: String(r.created_at),
  }));
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
