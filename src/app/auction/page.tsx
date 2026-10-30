"use client";

import { useState, useCallback, useRef } from "react";
import { usePoll, stableBody } from "@/hooks/usePoll";
import Navbar from "@/components/Navbar";
import AuctionCard from "@/components/AuctionCard";
import { Gavel, Clock } from "lucide-react";
import type { NftAuction, Nft } from "@/lib/nft";
import { fmtPrice } from "@/lib/format";

interface AuctionData {
  auctions: (NftAuction & { nft: Nft })[];
  past: NftAuction[];
  settings: {
    houseCutBps: number;
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
  const [loaded, setLoaded] = useState(false);
  const lastBody = useRef("");

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/nft/auction", { cache: "no-store", signal });
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
  }, []);

  usePoll(load, 15000);

  const live = (data?.auctions ?? []).filter((a) => a.status === "LIVE");
  const scheduled = (data?.auctions ?? []).filter((a) => a.status === "SCHEDULED");
  const past = data?.past ?? [];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-10">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] font-bold text-zinc-50 flex items-center gap-2">
            <Gavel className="h-5 w-5 text-bullion" />
            Auction House
          </h1>
          <p className="text-sm text-ash">
            Unique digital collectibles. Bid in gold. All bids locked instantly — outbid bids refunded immediately.
          </p>
          {data?.settings && (
            <p className="text-[11px] text-zinc-600 mt-1">
              House fee {data.settings.houseCutBps / 100}% · Min increment {data.settings.minBidIncrementPct}%
            </p>
          )}
        </div>

        {/* Live auctions */}
        <section aria-labelledby="live-heading">
          <h2 id="live-heading" className="text-[14px] font-semibold text-zinc-50 mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-bull animate-pulse" />
            Live{live.length > 0 && <span className="text-ash font-normal">{live.length}</span>}
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

        {/* Scheduled / upcoming */}
        {scheduled.length > 0 && (
          <section aria-labelledby="upcoming-heading">
            <h2 id="upcoming-heading" className="text-[14px] font-semibold text-zinc-50 mb-4 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-ash" />
              Upcoming
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {scheduled.map((a) => (
                <AuctionCard key={a.id} auction={a} />
              ))}
            </div>
          </section>
        )}

        {/* Past auctions */}
        {past.length > 0 && (
          <section aria-labelledby="past-heading">
            <h2 id="past-heading" className="text-[14px] font-semibold text-zinc-50 mb-3">Past sales</h2>
            <div className="border border-rule rounded-[6px] overflow-hidden">
              <table className="w-full text-[13px] tabular">
                <thead>
                  <tr className="text-[11px] text-ash border-b border-rule">
                    <th className="text-left font-normal py-2 pl-4 pr-2">Lot</th>
                    <th className="text-right font-normal py-2 px-2">Hammer price</th>
                    <th className="text-right font-normal py-2 px-2 hidden sm:table-cell">Bids</th>
                    <th className="text-right font-normal py-2 pl-2 pr-4 hidden md:table-cell">Settled</th>
                  </tr>
                </thead>
                <tbody>
                  {past.map((a) => (
                    <tr key={a.id} className="border-b border-rule last:border-0">
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
