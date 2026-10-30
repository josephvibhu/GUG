"use client";

import type { NftHistoryEntry } from "@/lib/nft";
import { fmtPrice } from "@/lib/format";

interface Props {
  history: NftHistoryEntry[];
}

const EVENT_LABEL: Record<string, { label: string; dot: string }> = {
  MINTED:      { label: "Minted",      dot: "bg-zinc-500" },
  SOLD:        { label: "Sold",        dot: "bg-bull" },
  TRANSFERRED: { label: "Transferred", dot: "bg-amber-400" },
  GIFTED:      { label: "Gifted",      dot: "bg-purple-400" },
};

export default function NFTProvenance({ history }: Props) {
  if (history.length === 0) return null;

  return (
    <div className="flex flex-col gap-0">
      <h3 className="text-[12px] text-ash uppercase tracking-wide mb-3">Provenance</h3>
      <ol className="relative border-l border-rule ml-2 flex flex-col gap-0">
        {history.map((entry, i) => {
          const meta = EVENT_LABEL[entry.event] ?? { label: entry.event, dot: "bg-zinc-500" };
          return (
            <li key={entry.id} className="ml-4 pb-5 last:pb-0 relative">
              {/* dot */}
              <span
                className={`absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full border border-floor ${meta.dot}`}
              />
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[13px] font-semibold text-zinc-50">{meta.label}</span>
                {entry.price !== undefined && (
                  <span className="text-[12px] text-bullion tabular">{fmtPrice(entry.price)}</span>
                )}
                {entry.note && (
                  <span className="text-[11px] text-ash">{entry.note}</span>
                )}
              </div>
              <p className="text-[11px] text-ash mt-0.5">
                {entry.fromUserName ? `${entry.fromUserName} → ` : ""}
                {entry.toUserName ?? entry.toUserId}
              </p>
              <p className="text-[10px] text-zinc-600 mt-0.5 tabular">
                {new Date(entry.createdAt).toLocaleString()}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
