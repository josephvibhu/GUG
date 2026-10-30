"use client";

import { useNow } from "@/hooks/useNow";
import { floorAt, type FloorSchedule } from "@/lib/session";
import { fmtDuration } from "@/lib/format";

interface Props {
  schedule: FloorSchedule | null;
  clockOffset: number;
}

function describe(schedule: FloorSchedule, nowMs: number) {
  const f = floorAt(schedule, nowMs);
  if (f.byOperator && !f.isOpen) {
    const detail = schedule.reason || "Closed due to the World War";
    return { f, status: "Floor closed (World War)", detail };
  }
  if (f.is247 || schedule.is247) {
    return { f, status: "Floor open", detail: "24/7 continuous trading" };
  }
  if (f.byOperator) {
    return { f, status: "Floor open", detail: "operator override" };
  }
  return f.isOpen
    ? { f, status: "Floor open", detail: `closes in ${fmtDuration(f.secondsLeft || 0)}` }
    : { f, status: "Floor closed", detail: `opens in ${fmtDuration(f.secondsLeft || 0)}` };
}

/** Compact status for the header: a dot, open/closed, and the countdown */
export function FloorClock({ schedule, clockOffset }: Props) {
  const now = useNow();
  if (!schedule || !now) return <span className="inline-block w-36" aria-hidden />;
  const { f, status, detail } = describe(schedule, now + clockOffset);
  return (
    <span className="inline-flex items-center gap-2 text-xs whitespace-nowrap" title={f.is247 ? "Trading floor open 24/7" : `Trading hours ${schedule.openTimeStr}–${schedule.closeTimeStr} UTC`}>
      <span className={`h-2 w-2 rounded-full ${f.isOpen ? "bg-bullion" : f.byOperator ? "bg-rose-500 animate-pulse" : "bg-zinc-600"}`} />
      <span className={f.isOpen ? "text-bullion font-semibold" : f.byOperator ? "text-rose-400 font-bold" : "text-paper font-semibold"}>{status}</span>
      <span className="text-ash hidden lg:inline">{detail}</span>
    </span>
  );
}

/**
 * The trading day as a 24-hour UTC strip: the session in gold, a marker for now.
 */
export function FloorStrip({ schedule, clockOffset }: Props) {
  const now = useNow();
  if (!schedule) return <div className="h-[104px]" aria-hidden />;
  const nowMs = now ? now + clockOffset : 0;
  const f = nowMs ? floorAt(schedule, nowMs) : null;
  const day = 24 * 60;
  const open = (f?.openMinutes ?? 0) / day;
  const close = (f?.closeMinutes ?? 0) / day;
  const bands = f?.is247 ? [[0, 1]] : close > open ? [[open, close]] : [[open, 1], [0, close]];
  const nowPos = f ? f.nowMinutes / day : null;
  const nowLabel = nowMs ? new Date(nowMs).toISOString().slice(11, 16) : "";

  let headline = "";
  let detail = "";
  if (f) {
    if (f.byOperator && !f.isOpen) {
      headline = "The floor is closed due to the World War.";
      detail = schedule.reason || "Trading floor suspended by the operator due to the outbreak of the World War in Parlamentum.";
    } else if (f.is247) {
      headline = "The trading floor is open 24/7.";
      detail = "Continuous order matching around the clock for all Parlamentum stocks.";
    } else if (f.byOperator) {
      headline = "The floor is open.";
      detail = `The operator opened it; usual hours are ${schedule.openTimeStr}–${schedule.closeTimeStr} UTC.`;
    } else if (f.isOpen) {
      headline = `The floor is open until ${schedule.closeTimeStr} UTC.`;
      detail = `${fmtDuration(f.secondsLeft || 0)} of trading left.`;
    } else {
      headline = `The floor opens at ${schedule.openTimeStr} UTC.`;
      detail = `In ${fmtDuration(f.secondsLeft || 0)}. Orders can only be placed during trading hours.`;
    }
  }

  return (
    <section aria-label="Trading hours" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="condensed text-2xl sm:text-[28px] font-extrabold text-zinc-50 tracking-tight leading-none">
          {headline || " "}
        </h1>
        <p className={`text-sm ${f?.byOperator && !f?.isOpen ? "text-rose-400 font-semibold" : "text-ash"}`}>{detail}</p>
      </div>

      <div className="relative mt-5">
        <div className="relative h-9 rounded-[3px] bg-pane border border-rule overflow-hidden">
          {[...Array(23)].map((_, i) => (
            <span key={i} className="absolute top-0 bottom-0 w-px bg-rule/70" style={{ left: `${((i + 1) / 24) * 100}%` }} />
          ))}
          {bands.map(([a, b], i) => (
            <span
              key={i}
              className={`absolute top-0 bottom-0 ${f?.isOpen ? "bg-bullion" : f?.byOperator ? "bg-rose-950/60" : "bg-bullion/70"}`}
              style={{ left: `${a * 100}%`, width: `${Math.max(0.4, (b - a) * 100)}%` }}
            />
          ))}
          {nowPos !== null && (
            <span className="absolute -top-px -bottom-px w-0.5 bg-zinc-50" style={{ left: `calc(${nowPos * 100}% - 1px)` }} />
          )}
        </div>
        <div className="relative h-5 mt-1 text-[11px] text-ash">
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
            <span
              key={h}
              className={`absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full ${h % 6 ? "hidden sm:inline" : ""}`}
              style={{ left: `${(h / 24) * 100}%` }}
            >
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
        </div>
        {nowPos !== null && (
          <span
            className="absolute -top-6 -translate-x-1/2 text-[11px] text-zinc-50 whitespace-nowrap"
            style={{ left: `clamp(24px, ${nowPos * 100}%, calc(100% - 24px))` }}
          >
            now {nowLabel}
          </span>
        )}
      </div>
    </section>
  );
}
