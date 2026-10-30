"use client";

import { use, useState, useCallback, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { usePoll, stableBody } from "@/hooks/usePoll";
import Navbar from "@/components/Navbar";
import AuctionCountdown from "@/components/AuctionCountdown";
import NFTProvenance from "@/components/NFTProvenance";
import { fmtPrice } from "@/lib/format";
import { Gavel, ChevronLeft, Lock, Users } from "lucide-react";
import type { NftAuction, Nft, NftBid, NftHistoryEntry } from "@/lib/nft";

type AuctionDetail = NftAuction & { nft: Nft & { history?: NftHistoryEntry[] }; bids: NftBid[] };

function StatusBadge({ status }: { status: string }) {
  if (status === "LIVE") return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-bull bg-bull/10 border border-bull/30 px-2 py-0.5 rounded-[3px]">
      <span className="h-1.5 w-1.5 rounded-full bg-bull animate-pulse" />Live
    </span>
  );
  if (status === "SCHEDULED") return (
    <span className="text-[11px] font-semibold text-zinc-400 bg-zinc-800 border border-rule px-2 py-0.5 rounded-[3px]">Upcoming</span>
  );
  if (status === "ENDED") return (
    <span className="text-[11px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-[3px]">Ended – pending settlement</span>
  );
  if (status === "SETTLED") return (
    <span className="text-[11px] font-semibold text-ash bg-pane border border-rule px-2 py-0.5 rounded-[3px]">Settled</span>
  );
  if (status === "CANCELLED") return (
    <span className="text-[11px] font-semibold text-bear bg-bear/10 border border-bear/30 px-2 py-0.5 rounded-[3px]">Cancelled</span>
  );
  return null;
}

function AuctionLotInner({ auctionId }: { auctionId: string }) {
  const router = useRouter();

  const [data, setData] = useState<{ auction: AuctionDetail } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const lastBody = useRef("");

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/nft/auction/${auctionId}`, { cache: "no-store", signal });
      const json = await res.json();
      if (json.success) {
        const body = stableBody(json);
        if (body !== lastBody.current) {
          lastBody.current = body;
          setData(json);
        }
      }
    } finally {
      setLoaded(true);
    }
  }, [auctionId]);

  usePoll(refresh, 8000, auctionId);

  const auction = data?.auction ?? null;
  const nft = auction?.nft ?? null;

  const [bidAmount, setBidAmount] = useState("");
  const [bidding, setBidding] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const minBid = auction
    ? auction.currentBid !== null
      ? Math.ceil(auction.currentBid * 1.05 * 100) / 100
      : auction.startPrice
    : 0;

  async function handleBid() {
    const amount = parseFloat(bidAmount);
    if (!amount || amount < minBid) {
      setMsg({ ok: false, text: `Minimum bid is ${minBid.toLocaleString()} g.` });
      return;
    }
    setBidding(true);
    setMsg(null);
    try {
      const res = await fetch("/api/nft/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionId, amount }),
      });
      const json = await res.json();
      setMsg({ ok: json.success, text: json.message });
      if (json.success) {
        setBidAmount("");
        refresh();
      }
    } catch {
      setMsg({ ok: false, text: "Network error. Please try again." });
    } finally {
      setBidding(false);
    }
  }

  const canBid = auction?.status === "LIVE";

  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-rule border-t-bullion animate-spin" />
      </div>
    );
  }

  if (!auction || !nft) {
    return (
      <main className="w-full max-w-[800px] mx-auto px-4 py-10">
        <p className="text-ash">Auction not found.</p>
      </main>
    );
  }

  const currentDisplay = auction.currentBid !== null ? auction.currentBid : auction.startPrice;
  const isPrimary = nft.creatorId === auction.sellerId;

  return (
    <main className="w-full max-w-[1100px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Back */}
      <button
        onClick={() => router.push("/auction")}
        className="flex items-center gap-1.5 text-[13px] text-ash hover:text-zinc-200 mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        Auction House
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Left — image */}
        <div className="flex flex-col gap-4">
          <div className="rounded-[8px] overflow-hidden border border-rule bg-floor aspect-square w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={nft.imageUrl} alt={nft.title} className="w-full h-full object-contain" />
          </div>
          {nft.editionNote && (
            <p className="text-[12px] text-ash text-center">{nft.editionNote}</p>
          )}
        </div>

        {/* Right — details + bid */}
        <div className="flex flex-col gap-5">
          {/* Title + status */}
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-[22px] font-bold text-zinc-50 leading-tight">{nft.title}</h1>
              <StatusBadge status={auction.status} />
            </div>
            <p className="text-[13px] text-ash">
              by <span className="text-zinc-300">{nft.creatorName}</span>
              {!isPrimary && (
                <span className="ml-2 text-[11px]">
                  · Creator royalty: {nft.creatorRoyaltyBps / 100}%
                </span>
              )}
            </p>
            {nft.description && (
              <p className="text-[13px] text-paper leading-relaxed">{nft.description}</p>
            )}
          </div>

          {/* Current bid box */}
          <div className="border border-rule rounded-[6px] p-4 bg-floor flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] text-ash uppercase tracking-wide">
                  {auction.currentBid !== null ? "Current bid" : "Starting price"}
                </p>
                <p className="text-[28px] font-bold text-bullion tabular">{fmtPrice(currentDisplay)}</p>
                {auction.reservePrice > 0 && (
                  <p className="text-[11px] text-ash italic mt-0.5">Reserve not disclosed</p>
                )}
              </div>
              {(auction.status === "LIVE" || auction.status === "SCHEDULED") && (
                <div className="text-right">
                  <p className="text-[10px] text-ash">{auction.status === "SCHEDULED" ? "Starts" : "Ends in"}</p>
                  {auction.status === "LIVE" ? (
                    <AuctionCountdown
                      endsAt={auction.endsAt}
                      extendedAt={auction.extendedAt}
                      className="text-[16px] font-bold"
                      onExpire={refresh}
                    />
                  ) : (
                    <p className="text-[13px] text-zinc-300">{new Date(auction.startsAt).toLocaleString()}</p>
                  )}
                </div>
              )}
            </div>

            {auction.bidCount > 0 && (
              <div className="flex items-center gap-1.5 text-[12px] text-ash">
                <Users className="h-3.5 w-3.5" />
                {auction.bidCount} bid{auction.bidCount !== 1 ? "s" : ""}
                {auction.currentBidderName && (
                  <span> · Leading: <span className="text-zinc-300">{auction.currentBidderName}</span></span>
                )}
              </div>
            )}

            {/* House info */}
            <p className="text-[11px] text-zinc-600">
              House fee: {auction.houseCutBps / 100}%
              {!isPrimary && ` · Creator royalty: ${nft.creatorRoyaltyBps / 100}%`}
            </p>
          </div>

          {/* Bid form */}
          {canBid && (
            <div className="flex flex-col gap-2">
              <label className="text-[12px] text-ash">
                Your bid (gold) — minimum {fmtPrice(minBid)}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={minBid}
                  step="0.01"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleBid()}
                  placeholder={`${minBid}`}
                  className="flex-1 h-10 rounded-[4px] border border-rule bg-floor px-3 text-[14px] text-zinc-50 placeholder:text-ash focus:outline-none focus:border-zinc-500 tabular"
                />
                <button
                  onClick={handleBid}
                  disabled={bidding || !bidAmount}
                  className="h-10 px-5 rounded-[4px] bg-bullion hover:bg-amber-300 disabled:opacity-50 text-floor font-semibold text-[13px] flex items-center gap-1.5 transition-colors"
                >
                  <Gavel className="h-4 w-4" />
                  {bidding ? "Bidding…" : "Bid"}
                </button>
              </div>
              <div className="flex items-start gap-1 text-[11px] text-ash">
                <Lock className="h-3 w-3 mt-0.5 shrink-0" />
                Gold is locked immediately. Refunded if you are outbid.
              </div>
              {msg && (
                <p className={`text-[12px] font-medium ${msg.ok ? "text-bull" : "text-bear"}`}>{msg.text}</p>
              )}
            </div>
          )}

          {auction.status === "ENDED" && (
            <div className="rounded-[6px] border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-[13px] text-amber-200">
              Auction ended — awaiting settlement by the operator.
            </div>
          )}

          {auction.status === "SETTLED" && auction.currentBid !== null && (
            <div className="rounded-[6px] border border-rule bg-pane px-4 py-3 text-[13px] text-ash">
              Hammer price: <span className="text-zinc-50 font-semibold">{fmtPrice(auction.currentBid)}</span>
              {auction.settledAt && (
                <span className="ml-2">· {new Date(auction.settledAt).toLocaleDateString()}</span>
              )}
            </div>
          )}

          {/* Bid history */}
          {auction.bids.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-[12px] text-ash uppercase tracking-wide">Bid history</h3>
              <div className="border border-rule rounded-[6px] overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-[12px] tabular">
                  <tbody>
                    {auction.bids.map((bid) => (
                      <tr key={bid.id} className="border-b border-rule last:border-0">
                        <td className="py-2 pl-3 pr-2 text-ash">
                          {bid.bidderName ?? bid.bidderId.slice(0, 8)}
                        </td>
                        <td className="py-2 px-2 text-right text-zinc-50 font-medium">
                          {fmtPrice(bid.amount)}
                        </td>
                        <td className="py-2 pl-2 pr-3 text-right text-zinc-600">
                          {new Date(bid.placedAt).toLocaleTimeString()}
                        </td>
                        <td className="py-2 pl-2 pr-3 text-right">
                          {bid.status === "ACTIVE" && <span className="text-bull">●</span>}
                          {bid.status === "WON" && <span className="text-bullion">★</span>}
                          {bid.status === "OUTBID" && <span className="text-ash">○</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Provenance */}
          {nft.id && <NFTProvenance history={nft.history ?? []} />}
        </div>
      </div>
    </main>
  );
}

function AuctionLotContent({ params }: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = use(params);
  return <AuctionLotInner auctionId={auctionId} />;
}

export default function AuctionLotPage(props: { params: Promise<{ auctionId: string }> }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-rule border-t-bullion animate-spin" />
        </div>
      }>
        <AuctionLotContent params={props.params} />
      </Suspense>
    </div>
  );
}
