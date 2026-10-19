// Number and time formatting shared by the client pages (prices in gold, quantities in shares, times in UTC)

const twoDp = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export const fmtPrice = (n: number) => twoDp.format(n || 0);
export const fmtGold = (n: number) => whole.format(Math.round(n || 0));
export const fmtQty = (n: number) => whole.format(n || 0);
export const fmtCompact = (n: number) => compactFmt.format(n || 0);

export function fmtPct(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}%`;
}

export function fmtSigned(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${twoDp.format(Math.abs(v))}`;
}

/** "16:54:55" from an ISO timestamp (the exchange runs on UTC) */
export const fmtUtcTime = (iso: string) => (iso.includes("T") ? iso.slice(11, 19) : iso.slice(-8));

/** "Oct 23" style date in UTC */
export const fmtUtcDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Countdown text: "3h 12m", "42m 05s", "45s" */
export function fmtDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

/** Text colour for a price move */
export const moveColor = (n: number) => (n > 0 ? "text-bull" : n < 0 ? "text-bear" : "text-ash");
