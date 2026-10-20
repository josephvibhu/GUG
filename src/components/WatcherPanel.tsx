"use client";

import { useCallback, useEffect, useState } from "react";

interface Sale {
  id: string;
  kind: "market" | "contract";
  at: string;
  units: number | null;
  gross: number;
  gold: number;
  name: string;
  state: string;
  reason: string | null;
}

interface WatchView {
  on: boolean;
  error: string | null;
  okAt: string | null;
  loginEnds: string | null;
  since: string | null;
  item: string;
  exportTax: number;
  listing: { remaining: number; endsAt: string } | null;
  warnings: string[];
  sales: Sale[];
}

const utc = (iso: string) => iso.slice(0, 16).replace("T", " ") + " UTC";
const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};
const field = "h-9 rounded-[4px] border border-rule bg-floor px-3 text-[13px] text-paper focus:outline-none focus:border-zinc-500";

// The operator's view of the watcher: its game login, its last look, warnings, and the trades it has seen
export default function WatcherPanel() {
  const [view, setView] = useState<WatchView | null>(null);
  const [token, setToken] = useState("");
  const [item, setItem] = useState<string | null>(null);
  const [tax, setTax] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/watcher", { cache: "no-store" });
      const data = await res.json();
      if (data.success) setView(data.watcher);
    } catch {
      // keeps the last view; the next refresh tries again
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/watcher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.watcher) setView(data.watcher);
      if (data.message) setNote({ ok: !!data.success, text: data.message });
      if (data.success && body.action === "start") setToken("");
      if (data.success) await load();
    } catch {
      setNote({ ok: false, text: "Couldn't reach the exchange. Try again." });
    } finally {
      setBusy(false);
    }
  };

  const byHand = (s: Sale) => s.state === "deposit" && s.reason === "credited by hand";
  const stateLabel = (s: Sale) =>
    byHand(s) ? "Already paid by hand" : s.state === "deposit" ? "Credited" : s.state === "open" ? "Waiting" : `Not a deposit: ${s.reason || "unknown"}`;

  return (
    <section aria-labelledby="watcher-title" className="border border-rule rounded-[6px] p-4 sm:p-5 flex flex-col gap-4 text-[13px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="watcher-title" className="text-[15px] font-semibold text-zinc-50">Watcher: automatic Raw Iron deposits</h2>
          <p className="text-[12px] text-ash mt-0.5 max-w-[70ch]">
            Reads the House&apos;s trade ledger in Parlamentum with the House&apos;s game login and credits each Raw Iron purchase to the account
            with the buyer&apos;s in-game name, once. Gold-for-Raw-Iron contracts sent to the House count too.
          </p>
        </div>
        <span className={`px-2 py-0.5 rounded-[3px] border text-[12px] ${view?.on ? (view.error ? "border-bear/60 text-bear" : "border-bull/60 text-bull") : "border-rule text-ash"}`}>
          {view ? (view.on ? (view.error ? "On, failing" : "On") : "Off") : "…"}
        </span>
      </div>

      {view?.on && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2">
          <div>
            <dt className="text-[12px] text-ash">Last good look</dt>
            <dd className="text-paper">{view.okAt ? ago(view.okAt) : "not yet"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-ash">Login runs out</dt>
            <dd className="text-paper">{view.loginEnds ? utc(view.loginEnds) : "unknown"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-ash">Deposit listing</dt>
            <dd className="text-paper">{view.listing ? `${view.listing.remaining.toLocaleString("en-US")} left` : "none seen"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-ash">Crediting since</dt>
            <dd className="text-paper">{view.since ? utc(view.since) : "–"}</dd>
          </div>
        </dl>
      )}

      {view?.error && <p role="alert" className="text-bear">{view.error}</p>}
      {view?.warnings.length ? (
        <ul className="flex flex-col gap-1">
          {view.warnings.map((w) => (
            <li key={w} className="text-bullion">
              {w}
            </li>
          ))}
        </ul>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          post({ action: "start", token });
        }}
        className="flex flex-col gap-2"
      >
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-ash">{view?.on ? "Replace the game login" : "House game login"}</span>
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste the token" autoComplete="off" spellCheck={false} className={field} />
        </label>
        <p className="text-[12px] text-ash leading-relaxed">
          On parlamentum.org, logged in as the House: press F12, open Console, type <code className="text-paper">localStorage.token</code>, press Enter
          and copy the value without the quotes. It lasts about a week; this panel warns two days before it runs out. It is stored encrypted and
          never shown again.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy || !token.trim()} className="h-9 px-4 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor font-semibold disabled:opacity-50">
            {view?.on ? "Save new login" : "Turn the watcher on"}
          </button>
          {view?.on && (
            <>
              <button type="button" disabled={busy} onClick={() => post({ action: "look" })} className="h-9 px-4 rounded-[4px] border border-rule hover:border-zinc-500 text-paper">
                Look now
              </button>
              <button type="button" disabled={busy} onClick={() => post({ action: "stop" })} className="h-9 px-4 rounded-[4px] border border-rule hover:border-bear/60 text-bear">
                Turn off
              </button>
            </>
          )}
        </div>
      </form>

      {note && <p role={note.ok ? "status" : "alert"} className={note.ok ? "text-paper" : "text-bear"}>{note.text}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          post({ action: "settings", item: item ?? view?.item, exportTax: tax ?? view?.exportTax });
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-ash">Game item code</span>
          <input value={item ?? view?.item ?? ""} onChange={(e) => setItem(e.target.value)} className={`${field} w-36 uppercase`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-ash">House export tax (%)</span>
          <input type="number" step="0.5" min="0" max="50" value={tax ?? String(view?.exportTax ?? "")} onChange={(e) => setTax(e.target.value)} className={`${field} w-28 text-right`} />
        </label>
        <button type="submit" disabled={busy} className="h-9 px-4 rounded-[4px] border border-rule hover:border-zinc-500 text-paper">
          Save
        </button>
        <p className="basis-full text-[12px] text-ash">
          Purchases are credited with what the House keeps after this tax (the game&apos;s own figure when its ledger gives one). Only sales at the
          deposit price count.
        </p>
      </form>

      {view && view.sales.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold text-zinc-50">Latest trades seen</h3>
          <ul className="border border-rule rounded-[4px] divide-y divide-rule">
            {view.sales.map((s) => (
              <li key={s.id} className="px-3 py-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="min-w-0">
                  <span className="text-zinc-50">{s.name}</span>{" "}
                  <span className="text-ash">
                    {s.kind === "market" ? `bought ${s.units} Raw Iron for ${s.gross}` : `sent ${s.gross} by contract`}, {utc(s.at)}
                  </span>
                </span>
                <span className={`tabular ${s.state === "deposit" ? "text-bull" : s.state === "open" ? "text-bullion" : "text-ash"}`}>
                  {s.state === "deposit" && !byHand(s) ? `+${s.gold} ` : ""}
                  {stateLabel(s)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
