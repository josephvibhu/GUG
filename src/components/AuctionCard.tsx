"use client";

import Link from "next/link";
import { Gavel } from "lucide-react";
import type { NftAuction, Nft } from "@/lib/nft";
import AuctionCountdown from "./AuctionCountdown";
import { fmtPrice } from "@/lib/format";

interface Props {
  auction: NftAuction & { nft: Nft };
}

export default function AuctionCard({ auction }: Props) {
  const { nft } = auction;
  const isScheduled = auction.status === "SCHEDULED";
  const currentDisplay = auction.currentBid !== null ? auction.currentBid : auction.startPrice;
  const hasReserve = auction.reservePrice > 0;

  return (
    <Link
      href={`/auction/${auction.id}`}
      className="group flex flex-col rounded-[6px] border border-rule bg-pane hover:border-zinc-600 transition-colors overflow-hidden"
    >
      {/* Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-floor">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={nft.imageUrl}
          alt={nft.title}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
        />
        {/* Status badge */}
        <span
          className={`absolute top-2 right-2 px-2 py-0.5 rounded-[3px] text-[11px] font-semibold
            ${isScheduled ? "bg-zinc-700 text-zinc-300" : "bg-bull/90 text-floor"}`}
        >
          {isScheduled ? "Upcoming" : "Live"}
        </span>
        {nft.editionNote && (
          <span className="absolute bottom-2 left-2 bg-black/60 text-zinc-300 text-[10px] px-1.5 py-0.5 rounded-[3px]">
            {nft.editionNote}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-1.5 p-3">
        <p className="text-[13px] font-semibold text-zinc-50 leading-snug line-clamp-2">{nft.title}</p>
        <p className="text-[11px] text-ash">by {nft.creatorName}</p>

        <div className="mt-1 flex items-end justify-between gap-2">
          <div>
            <p className="text-[10px] text-ash uppercase tracking-wide">
              {auction.currentBid !== null ? "Current bid" : "Starting at"}
            </p>
            <p className="text-[15px] font-bold text-bullion tabular">{fmtPrice(currentDisplay)}</p>
            {hasReserve && (
              <p className="text-[10px] text-ash italic">Reserve hidden</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] text-ash">{isScheduled ? "Starts" : "Ends"}</p>
            {isScheduled ? (
              <p className="text-[12px] text-zinc-300">
                {new Date(auction.startsAt).toLocaleDateString()}
              </p>
            ) : (
              <AuctionCountdown endsAt={auction.endsAt} extendedAt={auction.extendedAt} className="text-[12px]" />
            )}
          </div>
        </div>

        {auction.bidCount > 0 && (
          <div className="flex items-center gap-1 mt-0.5">
            <Gavel className="h-3 w-3 text-ash" />
            <span className="text-[11px] text-ash">{auction.bidCount} bid{auction.bidCount !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
