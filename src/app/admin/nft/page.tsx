"use client";

import { useState, useRef, useCallback } from "react";
import { usePoll, stableBody } from "@/hooks/usePoll";
import Navbar from "@/components/Navbar";
import { Gavel, Plus, Image, Upload, X, Check, AlertCircle, Package } from "lucide-react";
import { fmtPrice } from "@/lib/format";
import type { Nft, NftAuction } from "@/lib/nft";
import Link from "next/link";

interface AdminNftData {
  nfts: Nft[];
  auctions: (NftAuction & { nft: Nft })[];
  past: NftAuction[];
  settings: {
    houseCutBps: number;
    creatorRoyaltyBps: number;
    minBidIncrementPct: number;
    snipeExtMinutes: number;
    defaultDurationHours: number;
  };
}

type Tab = "inventory" | "auctions" | "mint" | "settings";

function FeedbackBanner({ msg, onDismiss }: { msg: { ok: boolean; text: string }; onDismiss: () => void }) {
  return (
    <div className={`flex items-start gap-2 px-4 py-3 rounded-[6px] text-[13px] border ${msg.ok ? "bg-bull/10 border-bull/30 text-bull" : "bg-bear/10 border-bear/30 text-bear"}`}>
      {msg.ok ? <Check className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
      <span className="flex-1">{msg.text}</span>
      <button onClick={onDismiss}><X className="h-4 w-4 opacity-60" /></button>
    </div>
  );
}

export default function NftAdminPage() {
  const [data, setData] = useState<AdminNftData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const lastBody = useRef("");

  const refresh = useCallback(async (signal?: AbortSignal) => {
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

  usePoll(refresh, 20000);

  // Merge inventory from /api/nft
  const [inventory, setInventory] = useState<Nft[]>([]);
  const [invLoaded, setInvLoaded] = useState(false);

  const loadInventory = async () => {
    const res = await fetch("/api/nft");
    const j = await res.json();
    if (j.success) setInventory(j.nfts || []);
    setInvLoaded(true);
  };

  const [tab, setTab] = useState<Tab>("auctions");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── Mint form ─────────────────────────────────────────────────────────────
  const [mintTitle, setMintTitle] = useState("");
  const [mintDesc, setMintDesc] = useState("");
  const [mintEdition, setMintEdition] = useState("");
  const [mintCreatorName, setMintCreatorName] = useState("");
  const [mintRoyaltyBps, setMintRoyaltyBps] = useState("500");
  const [mintImageFile, setMintImageFile] = useState<File | null>(null);
  const [mintImagePreview, setMintImagePreview] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setMintImageFile(f);
    setMintImagePreview(URL.createObjectURL(f));
  }

  async function handleMint(e: React.FormEvent) {
    e.preventDefault();
    if (!mintTitle.trim()) return setMsg({ ok: false, text: "Title is required." });
    if (!mintImageFile) return setMsg({ ok: false, text: "Image is required." });
    setMinting(true);
    setMsg(null);
    const fd = new FormData();
    fd.append("title", mintTitle.trim());
    fd.append("description", mintDesc.trim());
    fd.append("edition_note", mintEdition.trim());
    fd.append("creator_name", mintCreatorName.trim());
    fd.append("creator_royalty_bps", mintRoyaltyBps);
    fd.append("image", mintImageFile);
    try {
      const res = await fetch("/api/nft", { method: "POST", body: fd });
      const j = await res.json();
      setMsg({ ok: j.success, text: j.message });
      if (j.success) {
        setMintTitle(""); setMintDesc(""); setMintEdition(""); setMintCreatorName("");
        setMintRoyaltyBps("500"); setMintImageFile(null); setMintImagePreview(null);
        if (fileRef.current) fileRef.current.value = "";
        loadInventory();
      }
    } catch {
      setMsg({ ok: false, text: "Network error." });
    } finally {
      setMinting(false);
    }
  }

  // ── Auction creation ──────────────────────────────────────────────────────
  const [aucNftId, setAucNftId] = useState("");
  const [aucStart, setAucStart] = useState("");
  const [aucReserve, setAucReserve] = useState("");
  const [aucDuration, setAucDuration] = useState(String(data?.settings?.defaultDurationHours ?? 72));
  const [aucStartsAt, setAucStartsAt] = useState("");
  const [aucCutBps, setAucCutBps] = useState(String(data?.settings?.houseCutBps ?? 1500));
  const [creating, setCreating] = useState(false);

  async function handleCreateAuction(e: React.FormEvent) {
    e.preventDefault();
    if (!aucNftId) return setMsg({ ok: false, text: "Select an NFT." });
    setCreating(true); setMsg(null);
    try {
      const res = await fetch("/api/nft/auction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nftId: aucNftId,
          startPrice: parseFloat(aucStart),
          reservePrice: parseFloat(aucReserve) || 0,
          durationHours: parseInt(aucDuration, 10) || 72,
          startsAt: aucStartsAt || undefined,
          houseCutBps: parseInt(aucCutBps, 10) || 1500,
        }),
      });
      const j = await res.json();
      setMsg({ ok: j.success, text: j.message });
      if (j.success) {
        setAucNftId(""); setAucStart(""); setAucReserve(""); setAucStartsAt("");
        refresh();
        setTab("auctions");
      }
    } catch {
      setMsg({ ok: false, text: "Network error." });
    } finally {
      setCreating(false);
    }
  }

  // ── Settle / Cancel ───────────────────────────────────────────────────────
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function auctionAction(auctionId: string, action: "settle" | "cancel") {
    if (!confirm(`${action === "settle" ? "Settle" : "Cancel"} this auction?`)) return;
    setActionLoading(auctionId + action); setMsg(null);
    try {
      const res = await fetch(`/api/nft/auction/${auctionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json();
      setMsg({ ok: j.success, text: j.message });
      refresh();
    } catch {
      setMsg({ ok: false, text: "Network error." });
    } finally {
      setActionLoading(null);
    }
  }

  const ownedNfts = inventory.filter((n) => n.status === "OWNED");
  const liveAuctions = (data?.auctions ?? []).filter((a) => a.status === "LIVE" || a.status === "SCHEDULED");
  const pastAuctions = data?.past ?? [];

  const TAB: { id: Tab; label: string }[] = [
    { id: "auctions", label: "Auctions" },
    { id: "mint", label: "Mint NFT" },
    { id: "inventory", label: "Inventory" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="w-full max-w-[1100px] mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-bullion" />
            <h1 className="text-[20px] font-bold text-zinc-50">NFT Admin</h1>
          </div>
          <Link
            href="/auction"
            className="text-[12px] text-ash hover:text-zinc-200 underline underline-offset-2"
          >
            View public floor →
          </Link>
        </div>

        {/* Feedback */}
        {msg && <FeedbackBanner msg={msg} onDismiss={() => setMsg(null)} />}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-rule">
          {TAB.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                if (t.id === "inventory" && !invLoaded) loadInventory();
              }}
              className={`px-4 py-2 text-[13px] font-medium transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? "border-bullion text-zinc-50"
                  : "border-transparent text-ash hover:text-zinc-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Auctions tab ────────────────────────────────────────────────── */}
        {tab === "auctions" && (
          <div className="flex flex-col gap-6">
            <section>
              <h2 className="text-[13px] font-semibold text-zinc-400 mb-3">Live &amp; Scheduled</h2>
              {!loaded ? (
                <div className="text-ash text-sm">Loading…</div>
              ) : liveAuctions.length === 0 ? (
                <div className="border border-rule rounded-[6px] px-4 py-8 text-center text-ash text-sm">
                  No active auctions. Mint an NFT, then create an auction.
                </div>
              ) : (
                <div className="border border-rule rounded-[6px] overflow-hidden">
                  <table className="w-full text-[12px] tabular">
                    <thead>
                      <tr className="text-[11px] text-ash border-b border-rule">
                        <th className="text-left font-normal py-2 pl-4 pr-2">NFT</th>
                        <th className="text-right font-normal py-2 px-2">Current bid</th>
                        <th className="text-right font-normal py-2 px-2 hidden sm:table-cell">Bids</th>
                        <th className="text-right font-normal py-2 px-2 hidden md:table-cell">Ends</th>
                        <th className="text-right font-normal py-2 px-2">Status</th>
                        <th className="text-right font-normal py-2 pl-2 pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveAuctions.map((a) => (
                        <tr key={a.id} className="border-b border-rule last:border-0">
                          <td className="py-2.5 pl-4 pr-2">
                            <Link href={`/auction/${a.id}`} className="text-zinc-200 hover:underline">
                              {a.nft.title}
                            </Link>
                          </td>
                          <td className="py-2.5 px-2 text-right text-zinc-50">
                            {a.currentBid !== null ? fmtPrice(a.currentBid) : <span className="text-ash">{fmtPrice(a.startPrice)} start</span>}
                          </td>
                          <td className="py-2.5 px-2 text-right text-ash hidden sm:table-cell">{a.bidCount}</td>
                          <td className="py-2.5 px-2 text-right text-ash hidden md:table-cell">
                            {new Date(a.endsAt).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-[3px] ${
                              a.status === "LIVE" ? "bg-bull/20 text-bull" : "bg-zinc-700 text-zinc-400"
                            }`}>{a.status}</span>
                          </td>
                          <td className="py-2.5 pl-2 pr-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => auctionAction(a.id, "settle")}
                                disabled={!!actionLoading}
                                className="text-[11px] px-2 py-1 rounded-[3px] bg-bullion/20 hover:bg-bullion/30 text-bullion disabled:opacity-50"
                              >
                                Settle
                              </button>
                              <button
                                onClick={() => auctionAction(a.id, "cancel")}
                                disabled={!!actionLoading}
                                className="text-[11px] px-2 py-1 rounded-[3px] bg-bear/10 hover:bg-bear/20 text-bear disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {pastAuctions.length > 0 && (
              <section>
                <h2 className="text-[13px] font-semibold text-zinc-400 mb-3">Past auctions</h2>
                <div className="border border-rule rounded-[6px] overflow-hidden">
                  <table className="w-full text-[12px] tabular">
                    <thead>
                      <tr className="text-[11px] text-ash border-b border-rule">
                        <th className="text-left font-normal py-2 pl-4 pr-2">NFT</th>
                        <th className="text-right font-normal py-2 px-2">Hammer</th>
                        <th className="text-right font-normal py-2 px-2">Status</th>
                        <th className="text-right font-normal py-2 pl-2 pr-4">Settled</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pastAuctions.map((a) => (
                        <tr key={a.id} className="border-b border-rule last:border-0">
                          <td className="py-2.5 pl-4 pr-2 text-paper">{a.nftId}</td>
                          <td className="py-2.5 px-2 text-right text-zinc-50">
                            {a.currentBid !== null ? fmtPrice(a.currentBid) : <span className="text-ash">Unsold</span>}
                          </td>
                          <td className="py-2.5 px-2 text-right text-ash">{a.status}</td>
                          <td className="py-2.5 pl-2 pr-4 text-right text-ash">
                            {a.settledAt ? new Date(a.settledAt).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── Mint tab ─────────────────────────────────────────────────────── */}
        {tab === "mint" && (
          <form onSubmit={handleMint} className="max-w-[560px] flex flex-col gap-5">
            <p className="text-[13px] text-ash">
              Mint a new 1-of-1 (or limited edition) NFT. The image is uploaded to Vercel Blob.
            </p>

            {/* Image drop zone */}
            <div>
              <label className="text-[12px] text-ash block mb-1.5">Artwork *</label>
              {mintImagePreview ? (
                <div className="relative w-48 h-48 rounded-[6px] overflow-hidden border border-rule">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mintImagePreview} alt="preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setMintImageFile(null); setMintImagePreview(null); if (fileRef.current) fileRef.current.value = ""; }}
                    className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-48 h-48 border-2 border-dashed border-rule rounded-[6px] flex flex-col items-center justify-center gap-2 text-ash hover:border-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <Upload className="h-6 w-6" />
                  <span className="text-[12px]">Click to upload</span>
                  <span className="text-[10px]">PNG, JPG, GIF, WebP</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            {/* Fields */}
            {[
              { label: "Title *", value: mintTitle, set: setMintTitle, placeholder: "e.g. The Golden Parliament" },
              { label: "Creator name", value: mintCreatorName, set: setMintCreatorName, placeholder: "Leave blank to use your display name" },
              { label: "Edition note", value: mintEdition, set: setMintEdition, placeholder: 'e.g. "1 of 1" or "Edition 2/10"' },
            ].map((f) => (
              <div key={f.label}>
                <label className="text-[12px] text-ash block mb-1">{f.label}</label>
                <input
                  type="text"
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full h-9 rounded-[4px] border border-rule bg-floor px-3 text-[13px] text-zinc-50 placeholder:text-ash focus:outline-none focus:border-zinc-500"
                />
              </div>
            ))}

            <div>
              <label className="text-[12px] text-ash block mb-1">Description</label>
              <textarea
                value={mintDesc}
                onChange={(e) => setMintDesc(e.target.value)}
                rows={3}
                placeholder="Optional description of the piece"
                className="w-full rounded-[4px] border border-rule bg-floor px-3 py-2 text-[13px] text-zinc-50 placeholder:text-ash focus:outline-none focus:border-zinc-500 resize-none"
              />
            </div>

            <div>
              <label className="text-[12px] text-ash block mb-1">
                Creator royalty on resales (basis points — 500 = 5%)
              </label>
              <input
                type="number"
                min="0"
                max="3000"
                value={mintRoyaltyBps}
                onChange={(e) => setMintRoyaltyBps(e.target.value)}
                className="w-32 h-9 rounded-[4px] border border-rule bg-floor px-3 text-[13px] text-zinc-50 tabular focus:outline-none focus:border-zinc-500"
              />
              <p className="text-[11px] text-ash mt-1">
                {Math.round(Number(mintRoyaltyBps) / 100 * 10) / 10}% goes to the creator on every future resale
              </p>
            </div>

            <button
              type="submit"
              disabled={minting}
              className="self-start h-10 px-6 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor font-semibold text-[13px] disabled:opacity-50 flex items-center gap-2"
            >
              <Image className="h-4 w-4" />
              {minting ? "Minting…" : "Mint NFT"}
            </button>
          </form>
        )}

        {/* ── Create Auction tab (embedded under mint success) ─────────────── */}
        {tab === "mint" && ownedNfts.length > 0 && (
          <div className="max-w-[560px] border-t border-rule pt-6 mt-2">
            <h2 className="text-[14px] font-semibold text-zinc-50 mb-4 flex items-center gap-2">
              <Gavel className="h-4 w-4 text-bullion" />
              Create Auction
            </h2>
            <form onSubmit={handleCreateAuction} className="flex flex-col gap-4">
              <div>
                <label className="text-[12px] text-ash block mb-1">Select NFT *</label>
                <select
                  value={aucNftId}
                  onChange={(e) => setAucNftId(e.target.value)}
                  className="w-full h-9 rounded-[4px] border border-rule bg-floor px-3 text-[13px] text-zinc-50 focus:outline-none focus:border-zinc-500"
                >
                  <option value="">— pick one —</option>
                  {ownedNfts.map((n) => (
                    <option key={n.id} value={n.id}>{n.title} ({n.editionNote ?? "1 of 1"})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] text-ash block mb-1">Start price (g) *</label>
                  <input type="number" min="0.01" step="0.01" value={aucStart}
                    onChange={(e) => setAucStart(e.target.value)}
                    placeholder="100"
                    className="w-full h-9 rounded-[4px] border border-rule bg-floor px-3 text-[13px] text-zinc-50 tabular focus:outline-none focus:border-zinc-500" />
                </div>
                <div>
                  <label className="text-[12px] text-ash block mb-1">Reserve price (g)</label>
                  <input type="number" min="0" step="0.01" value={aucReserve}
                    onChange={(e) => setAucReserve(e.target.value)}
                    placeholder="0 = none"
                    className="w-full h-9 rounded-[4px] border border-rule bg-floor px-3 text-[13px] text-zinc-50 tabular focus:outline-none focus:border-zinc-500" />
                </div>
                <div>
                  <label className="text-[12px] text-ash block mb-1">Duration (hours)</label>
                  <input type="number" min="1" value={aucDuration}
                    onChange={(e) => setAucDuration(e.target.value)}
                    className="w-full h-9 rounded-[4px] border border-rule bg-floor px-3 text-[13px] text-zinc-50 tabular focus:outline-none focus:border-zinc-500" />
                </div>
                <div>
                  <label className="text-[12px] text-ash block mb-1">House cut (bps)</label>
                  <input type="number" min="0" max="5000" value={aucCutBps}
                    onChange={(e) => setAucCutBps(e.target.value)}
                    className="w-full h-9 rounded-[4px] border border-rule bg-floor px-3 text-[13px] text-zinc-50 tabular focus:outline-none focus:border-zinc-500" />
                  <p className="text-[10px] text-ash mt-0.5">{(Number(aucCutBps) / 100).toFixed(1)}%</p>
                </div>
              </div>

              <div>
                <label className="text-[12px] text-ash block mb-1">
                  Start time (leave blank = now)
                </label>
                <input
                  type="datetime-local"
                  value={aucStartsAt}
                  onChange={(e) => setAucStartsAt(e.target.value ? new Date(e.target.value).toISOString() : "")}
                  className="h-9 rounded-[4px] border border-rule bg-floor px-3 text-[13px] text-zinc-50 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="self-start h-10 px-6 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor font-semibold text-[13px] disabled:opacity-50 flex items-center gap-2"
              >
                <Gavel className="h-4 w-4" />
                {creating ? "Creating…" : "Create Auction"}
              </button>
            </form>
          </div>
        )}

        {/* ── Inventory tab ────────────────────────────────────────────────── */}
        {tab === "inventory" && (
          <div className="flex flex-col gap-4">
            {!invLoaded ? (
              <div className="text-ash text-sm">Loading inventory…</div>
            ) : inventory.length === 0 ? (
              <div className="border border-rule rounded-[6px] px-4 py-10 text-center text-ash">
                No NFTs minted yet.{" "}
                <button className="underline" onClick={() => setTab("mint")}>Mint one</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {inventory.map((n) => (
                  <div key={n.id} className="border border-rule rounded-[6px] overflow-hidden bg-pane flex flex-col">
                    <div className="aspect-square bg-floor overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={n.imageUrl} alt={n.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-3 flex flex-col gap-1 flex-1">
                      <p className="text-[13px] font-semibold text-zinc-50 line-clamp-2">{n.title}</p>
                      <p className="text-[11px] text-ash">by {n.creatorName}</p>
                      {n.editionNote && <p className="text-[10px] text-zinc-600">{n.editionNote}</p>}
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-[3px] border font-semibold
                          ${n.status === "OWNED" ? "border-bull/30 text-bull" : "border-amber-400/30 text-amber-400"}`}>
                          {n.status === "OWNED" ? "In vault" : "In auction"}
                        </span>
                        {n.status === "OWNED" && (
                          <button
                            onClick={() => {
                              setAucNftId(n.id);
                              setTab("mint");
                            }}
                            className="text-[11px] text-bullion hover:underline"
                          >
                            Auction →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Settings tab ─────────────────────────────────────────────────── */}
        {tab === "settings" && data?.settings && (
          <NftSettingsForm
            initial={data.settings}
            onSaved={(m) => { setMsg(m); refresh(); }}
          />
        )}
      </main>
    </div>
  );
}

// ── Settings sub-form ─────────────────────────────────────────────────────────
function NftSettingsForm({
  initial,
  onSaved,
}: {
  initial: {
    houseCutBps: number;
    creatorRoyaltyBps: number;
    minBidIncrementPct: number;
    snipeExtMinutes: number;
    defaultDurationHours: number;
  };
  onSaved: (m: { ok: boolean; text: string }) => void;
}) {
  const [houseCut, setHouseCut] = useState(String(initial.houseCutBps));
  const [royalty, setRoyalty] = useState(String(initial.creatorRoyaltyBps));
  const [increment, setIncrement] = useState(String(initial.minBidIncrementPct));
  const [snipe, setSnipe] = useState(String(initial.snipeExtMinutes));
  const [duration, setDuration] = useState(String(initial.defaultDurationHours));
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/nft/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nft_house_cut_bps: houseCut,
          nft_creator_royalty_bps: royalty,
          nft_min_bid_increment_pct: increment,
          nft_snipe_extension_min: snipe,
          nft_default_duration_hours: duration,
        }),
      });
      const j = await res.json();
      onSaved({ ok: j.success, text: j.message || (j.success ? "Settings saved." : "Failed.") });
    } catch {
      onSaved({ ok: false, text: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  const fields = [
    { label: "House cut (bps, e.g. 1500 = 15%)", val: houseCut, set: setHouseCut, note: `${(Number(houseCut) / 100).toFixed(1)}%` },
    { label: "Creator royalty on resales (bps)", val: royalty, set: setRoyalty, note: `${(Number(royalty) / 100).toFixed(1)}%` },
    { label: "Min bid increment (%)", val: increment, set: setIncrement, note: "" },
    { label: "Anti-snipe extension (minutes)", val: snipe, set: setSnipe, note: "" },
    { label: "Default auction duration (hours)", val: duration, set: setDuration, note: `${Math.round(Number(duration) / 24 * 10) / 10} days` },
  ];

  return (
    <form onSubmit={save} className="max-w-[480px] flex flex-col gap-4">
      {fields.map((f) => (
        <div key={f.label}>
          <label className="text-[12px] text-ash block mb-1">{f.label}</label>
          <input
            type="number"
            min="0"
            value={f.val}
            onChange={(e) => f.set(e.target.value)}
            className="w-40 h-9 rounded-[4px] border border-rule bg-floor px-3 text-[13px] text-zinc-50 tabular focus:outline-none focus:border-zinc-500"
          />
          {f.note && <p className="text-[11px] text-ash mt-0.5">{f.note}</p>}
        </div>
      ))}
      <button
        type="submit"
        disabled={saving}
        className="self-start h-9 px-5 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor font-semibold text-[13px] disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
