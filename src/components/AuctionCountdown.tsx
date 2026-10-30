"use client";

import { useEffect, useState } from "react";
import { useNow } from "@/hooks/useNow";
// useNow() takes no arguments — the clock runs at 1 s automatically

interface Props {
  endsAt: string;
  extendedAt?: string | null;
  className?: string;
  onExpire?: () => void;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function AuctionCountdown({ endsAt, extendedAt, className, onExpire }: Props) {
  const now = useNow();
  const [fired, setFired] = useState(false);

  const ms = new Date(endsAt).getTime() - now;
  const totalSec = Math.max(0, Math.floor(ms / 1000));

  useEffect(() => {
    if (totalSec === 0 && !fired) {
      setFired(true);
      onExpire?.();
    }
  }, [totalSec, fired, onExpire]);

  if (totalSec === 0) {
    return <span className={`text-bear font-semibold ${className ?? ""}`}>Ended</span>;
  }

  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  const urgent = totalSec < 300; // < 5 min

  return (
    <span className={`font-mono tabular ${urgent ? "text-amber-400" : "text-zinc-300"} ${className ?? ""}`}>
      {d > 0 && <>{d}d </>}
      {pad(h)}:{pad(m)}:{pad(s)}
      {extendedAt && (
        <span className="ml-1.5 text-[10px] text-amber-400/70 font-sans">extended</span>
      )}
    </span>
  );
}
