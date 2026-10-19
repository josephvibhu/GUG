"use client";

import { useSyncExternalStore } from "react";
import type { Company } from "@/lib/market";
import type { FloorSchedule } from "@/lib/session";
import { stableBody } from "./usePoll";

export interface FeedUser {
  id: string;
  username: string;
  displayName: string;
  parlamentumName?: string;
  cashBalance: number;
  lockedCash: number;
  avatar: string;
  isAdmin?: boolean;
  termsAccepted?: boolean;
  adjustmentNoticeSeen?: boolean;
}

export interface MarketFeed {
  loaded: boolean;
  companies: Company[];
  user: FeedUser | null;
  schedule: FloorSchedule | null;
  sparklines: Record<string, number[]>;
  clockOffset: number; // server time minus local time, ms
}

/*
  One /api/market poll shared by everything on the page (header, market list, trade index).
  Before, the header polled /api/market and /api/auth every 2.5 s and the market page polled
  /api/market again on its own. Unchanged responses don't re-render anything.
*/
const EMPTY: MarketFeed = { loaded: false, companies: [], user: null, schedule: null, sparklines: {}, clockOffset: 0 };
const VOLATILE = ["serverNow", "currentUTC", "timeRemainingSeconds", "timeRemainingFormatted"];

let state: MarketFeed = EMPTY;
let lastBody = "";
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let rerun = false;
let failures = 0;

function schedule() {
  clearTimeout(timer);
  if (listeners.size === 0 || document.hidden) return;
  const base = state.schedule?.isOpen ? 5000 : 20000;
  timer = setTimeout(refreshMarketFeed, base * Math.min(8, 2 ** failures));
}

export async function refreshMarketFeed(): Promise<void> {
  if (typeof window === "undefined") return;
  if (running) {
    rerun = true;
    return;
  }
  running = true;
  try {
    const res = await fetch("/api/market", { cache: "no-store" });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "market feed failed");
    const body = stableBody(data, VOLATILE);
    const clockOffset = typeof data.serverNow === "number" ? data.serverNow - Date.now() : 0;
    if (body !== lastBody) {
      lastBody = body;
      state = {
        loaded: true,
        companies: data.companies || [],
        user: data.user || null,
        schedule: data.marketSchedule || null,
        sparklines: data.sparklines || {},
        clockOffset,
      };
      listeners.forEach((l) => l());
    }
    failures = 0;
  } catch {
    failures++;
  }
  running = false;
  if (rerun) {
    rerun = false;
    return refreshMarketFeed();
  }
  schedule();
}

function wake() {
  if (!document.hidden) {
    clearTimeout(timer);
    refreshMarketFeed();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("wallet_updated", wake);
    refreshMarketFeed();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("wallet_updated", wake);
    }
  };
}

export function useMarketFeed(): MarketFeed {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}
