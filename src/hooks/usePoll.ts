"use client";

import { useEffect, useRef } from "react";

/**
 * Polls without piling up requests: runs `task` now, then `intervalMs` after each run finishes
 * (setInterval fired regardless, so slow connections stacked requests). Pauses while the tab is
 * hidden, runs at once when the tab comes back, on window focus and on `wallet_updated`, and
 * backs off (up to 8x) while requests fail. Changing `key` (e.g. the ticker) restarts it.
 */
export function usePoll(task: (signal: AbortSignal) => Promise<void>, intervalMs: number, key = "") {
  const taskRef = useRef(task);
  useEffect(() => {
    taskRef.current = task;
  });

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    let running = false;
    let rerun = false;
    let failures = 0;

    const schedule = () => {
      clearTimeout(timer);
      if (stopped || document.hidden) return;
      timer = setTimeout(run, intervalMs * Math.min(8, 2 ** failures));
    };

    const run = async () => {
      if (stopped || document.hidden) return;
      if (running) {
        rerun = true;
        return;
      }
      running = true;
      controller = new AbortController();
      try {
        await taskRef.current(controller.signal);
        failures = 0;
      } catch {
        if (!controller.signal.aborted) failures++;
      }
      running = false;
      if (rerun) {
        rerun = false;
        run();
      } else {
        schedule();
      }
    };

    const wake = () => {
      if (document.hidden) return;
      clearTimeout(timer);
      run();
    };

    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("wallet_updated", wake);
    run();

    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("wallet_updated", wake);
    };
  }, [intervalMs, key]);
}

/** JSON body without fields that change on every response, for "did anything change?" checks */
export function stableBody(data: Record<string, unknown>, volatile: string[] = ["serverNow"]): string {
  return JSON.stringify(data, (k, v) => (volatile.includes(k) ? undefined : v));
}
