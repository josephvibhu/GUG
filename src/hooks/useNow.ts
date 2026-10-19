"use client";

import { useSyncExternalStore } from "react";

// One shared 1-second clock for every countdown on the page; only the components that read it re-render.
let now = typeof window === "undefined" ? 0 : Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** Current time in ms (0 during server rendering and hydration) */
export function useNow(): number {
  return useSyncExternalStore(subscribe, () => now, () => 0);
}
