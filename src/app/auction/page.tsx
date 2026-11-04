"use client";

import { useState, useCallback, useRef } from "react";
import { usePoll, stableBody } from "@/hooks/usePoll";
import Navbar from "@/components/Navbar";
import AuctionCard from "@/components/AuctionCard";
import { Gavel, Clock, Tag, ShoppingCart, Check, AlertCircle, X } from "lucide-react";
import type { NftAuction, Nft, NftListing } from "@/lib/nft";
import { fmtPrice } from "@/lib/format";
import Link from "next/link";

interface AuctionData {
  auctions: (NftAuction & { nft: Nft })[];
  past: NftAuction[];
  settings: {
    houseCutBps: number;
    creatorRoyaltyBps: number;
    minBidIncrementPct: number;
    defaultDurationHours: number;
  };
}

function EmptyFloor() {
  return (
    <div className="border border-rule rounded-[6px] px-6 py-14 flex flex-col items-center gap-3 text-center">
      <Gavel className="h-8 w-8 text-ash" />
      <p className="text-[15px] text-zinc-50 font-semibold">No auctions are live right now.</p>
      <p className="text-sm text-ash max-w-sm">
        The operator mints and lists NFTs here. Check back soon — upcoming lots will appear below.
      </p>
    </div>
  );
}

export default function AuctionFloor() {
  const [data, setData] = useState<AuctionData | null>(null);
  const [p2pListings, setP2pListings] = useState<NftListing[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const lastBody = useRef("");

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const [resAuc, resList] = await Promise.all([
        fetch("/api/nft/auction", { cache: "no-store", signal }),
        fetch("/api/nft/trade?mode=listings", { cache: "no-store", signal }),
      ]);
      const jsonAuc = await resAuc.json();
      const jsonList = await resList.json();

      if (jsonAuc.success) {
        const body = stableBody(jsonAuc);
        if (body !== lastBody.current) {
          lastBody.current = body;
          setData(jsonAuc);
        }
      }
      if (jsonList.success) {
        setP2pListings(jsonList.listings || []);
      }
    } finally {
      setLoaded(true);
    }
  }, []);

  usePoll(load, 15000);

  async function handleBuyListing(listingId: string, price: number) {
    if (!confirm(`Instant buy this NFT for ${price.toLocaleString()} g?`)) return;
    setBuyingId(listingId);
    setMsg(null);
    try {
      const res = await fetch("/api/nft/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "buy_listing", listingId }),
      });
      const data = await res.json();
      setMsg({ ok: data.success, text: data.message });
      if (data.success) {
        load();
      }
    } catch {
      setMsg({ ok: false, text: "Network error purchasing listing." });
    } finally {
      setBuyingId(null);
    }
  }

  const live = (data?.auctions ?? []).filter((a) => a.status === "LIVE");
  const scheduled = (data?.auctions ?? []).filter((a) => a.status === "SCHEDULED");
  const past = data?.past ?? [];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-10">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h1 className="text-[22px] font-bold text-zinc-50 flex items-center gap-2">
              <Gavel className="h-5 w-5 text-bullion" />
              Auction House &amp; P2P Trade Floor
            </h1>
            <Link
              href="/portfolio"
              className="text-[12px] text-bullion hover:underline font-semibold"
            >
              My Trophy Vault →
            </Link>
          </div>
          <p className="text-sm text-ash">
            Unique digital collectibles and sovereign artifacts. Support automatic proxy bidding, instant P2P trades, and verified provenance.
          </p>
          {data?.settings && (
            <p className="text-[11px] text-zinc-600 mt-0.5">
              House fee {data.settings.houseCutBps / 100}% · Artist resale royalty {data.settings.creatorRoyaltyBps / 100}% · Min raise {data.settings.minBidIncrementPct}%
            </p>
          )}
        </div>

        {/* Global alert banner */}
        {msg && (
          <div
            className={`flex items-start justify-between gap-2 px-3 py-2.5 rounded-[4px] text-xs border ${
              msg.ok ? "bg-bull/10 border-bull/30 text-bull" : "bg-bear/10 border-bear/30 text-bear"
            }`}
          >
            <div className="flex items-center gap-1.5">
              {msg.ok ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              <span>{msg.text}</span>
            </div>
            <button onClick={() => setMsg(null)} className="opacity-60 hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ── Live auctions ──────────────────────────────────────────────── */}
        <section aria-labelledby="live-heading">
          <h2 id="live-heading" className="text-[14px] font-semibold text-zinc-50 mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-bull animate-pulse" />
            Live Auctions{live.length > 0 && <span className="text-ash font-normal">({live.length})</span>}
          </h2>
          {!loaded ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="aspect-square rounded-[6px] bg-pane border border-rule animate-pulse" />
              ))}
            </div>
          ) : live.length === 0 ? (
            <EmptyFloor />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {live.map((a) => (
                <AuctionCard key={a.id} auction={a} />
              ))}
            </div>
          )}
        </section>

        {/* ── P2P Marketplace: Fixed Price Direct Listings ─────────────────── */}
        {p2pListings.length > 0 && (
          <section aria-labelledby="p2p-heading">
            <h2 id="p2p-heading" className="text-[14px] font-semibold text-zinc-50 mb-4 flex items-center gap-2">
              <Tag className="h-4 w-4 text-bullion" />
              Citizen P2P Marketplace (Instant Buy)
              <span className="text-ash font-normal">({p2pListings.length})</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {p2pListings.map((listing) => (
                <div
                  key={listing.id}
                  className="border border-rule rounded-[6px] overflow-hidden bg-pane flex flex-col hover:border-zinc-500 transition"
                >
                  <div className="aspect-square bg-floor overflow-hidden relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={listing.nftImageUrl}
                      alt={listing.nftTitle || "NFT"}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-[3px] text-[10px] font-bold bg-bullion text-floor shadow">
                      INSTANT BUY
                    </span>
                  </div>

                  <div className="p-3 flex flex-col flex-1 gap-2">
                    <div>
                      <h3 className="text-[13px] font-bold text-zinc-50 truncate">
                        {listing.nftTitle}
                      </h3>
                      <p className="text-[11px] text-ash">
                        Seller: <span className="text-zinc-300">{listing.sellerName}</span>
                      </p>
                    </div>

                    <div className="mt-auto pt-2 border-t border-rule flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-ash uppercase">Fixed Price</div>
                        <div className="text-[14px] font-bold text-bullion tabular">
                          {fmtPrice(listing.price)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleBuyListing(listing.id, listing.price)}
                        disabled={buyingId === listing.id}
                        className="h-8 px-3 rounded-[3px] bg-bullion hover:bg-amber-300 text-floor font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        {buyingId === listing.id ? "Buying…" : "Buy Now"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Scheduled / upcoming ─────────────────────────────────────────── */}
        {scheduled.length > 0 && (
          <section aria-labelledby="upcoming-heading">
            <h2 id="upcoming-heading" className="text-[14px] font-semibold text-zinc-50 mb-4 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-ash" />
              Upcoming Scheduled Auctions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {scheduled.map((a) => (
                <AuctionCard key={a.id} auction={a} />
              ))}
            </div>
          </section>
        )}

        {/* ── Past auctions ────────────────────────────────────────────────── */}
        {past.length > 0 && (
          <section aria-labelledby="past-heading">
            <h2 id="past-heading" className="text-[14px] font-semibold text-zinc-50 mb-3">Past Sales</h2>
            <div className="border border-rule rounded-[6px] overflow-hidden">
              <table className="w-full text-[13px] tabular">
                <thead>
                  <tr className="text-[11px] text-ash border-b border-rule bg-pane">
                    <th className="text-left font-normal py-2 pl-4 pr-2">Lot</th>
                    <th className="text-right font-normal py-2 px-2">Hammer price</th>
                    <th className="text-right font-normal py-2 px-2 hidden sm:table-cell">Bids</th>
                    <th className="text-right font-normal py-2 pl-2 pr-4 hidden md:table-cell">Settled</th>
                  </tr>
                </thead>
                <tbody>
                  {past.map((a) => (
                    <tr key={a.id} className="border-b border-rule last:border-0 hover:bg-pane/50">
                      <td className="py-2.5 pl-4 pr-2 text-paper">{a.nftId}</td>
                      <td className="py-2.5 px-2 text-right text-zinc-50 font-medium">
                        {a.currentBid !== null ? fmtPrice(a.currentBid) : <span className="text-ash">Unsold</span>}
                      </td>
                      <td className="py-2.5 px-2 text-right text-ash hidden sm:table-cell">{a.bidCount}</td>
                      <td className="py-2.5 pl-2 pr-4 text-right text-ash hidden md:table-cell">
                        {a.settledAt ? new Date(a.settledAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
