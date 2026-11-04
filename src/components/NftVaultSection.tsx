"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Trophy, 
  Tag, 
  Send, 
  Check, 
  X, 
  AlertCircle, 
  Clock, 
  Lock, 
  ArrowRight,
  ExternalLink 
} from "lucide-react";
import { fmtPrice } from "@/lib/format";
import type { Nft, NftListing, NftOffer } from "@/lib/nft";

interface Props {
  vault: (Nft & { activeListing?: NftListing | null; activeOffersCount?: number })[];
  offersReceived: NftOffer[];
  offersSent: NftOffer[];
  onRefresh: () => void;
}

export default function NftVaultSection({
  vault,
  offersReceived,
  offersSent,
  onRefresh,
}: Props) {
  const [subTab, setSubTab] = useState<"items" | "received" | "sent">("items");

  // Listing modal / input state
  const [listingNftId, setListingNftId] = useState<string | null>(null);
  const [listPrice, setListPrice] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Direct offer modal state
  const [offerNftId, setOfferNftId] = useState<string | null>(null);
  const [offerAmount, setOfferAmount] = useState("");

  const activeReceivedCount = offersReceived.length;
  const activeSentCount = offersSent.length;

  async function handleList(nftId: string) {
    const price = parseFloat(listPrice);
    if (!price || price <= 0) {
      setMsg({ ok: false, text: "Enter a valid sale price in gold." });
      return;
    }
    setActionLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/nft/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", nftId, price }),
      });
      const data = await res.json();
      setMsg({ ok: data.success, text: data.message });
      if (data.success) {
        setListingNftId(null);
        setListPrice("");
        onRefresh();
      }
    } catch {
      setMsg({ ok: false, text: "Network error listing NFT." });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancelListing(listingId: string) {
    if (!confirm("Remove this NFT from direct sale?")) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/nft/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_listing", listingId }),
      });
      const data = await res.json();
      setMsg({ ok: data.success, text: data.message });
      onRefresh();
    } catch {
      setMsg({ ok: false, text: "Network error cancelling listing." });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleOfferAction(offerId: string, action: "accept_offer" | "reject_offer" | "cancel_offer") {
    const confirmPrompt =
      action === "accept_offer"
        ? "Accept this offer? You will receive gold and transfer the NFT immediately."
        : action === "reject_offer"
        ? "Reject this offer? Buyer's gold will be returned to them."
        : "Cancel your offer and retrieve your reserved gold?";
    if (!confirm(confirmPrompt)) return;

    setActionLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/nft/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, offerId }),
      });
      const data = await res.json();
      setMsg({ ok: data.success, text: data.message });
      onRefresh();
    } catch {
      setMsg({ ok: false, text: "Network error processing offer." });
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <section aria-labelledby="nft-vault-heading" className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-bullion" />
          <h2 id="nft-vault-heading" className="text-[16px] font-bold text-zinc-50">
            Citizen Trophy Vault &amp; Art Gallery
          </h2>
          <span className="text-ash text-xs">({vault.length} items owned)</span>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1 bg-pane p-0.5 rounded-[4px] border border-rule text-[12px]">
          <button
            type="button"
            onClick={() => { setSubTab("items"); setMsg(null); }}
            className={`px-3 py-1 rounded-[3px] transition ${
              subTab === "items" ? "bg-floor text-zinc-50 font-semibold" : "text-ash hover:text-paper"
            }`}
          >
            Vault Items ({vault.length})
          </button>
          <button
            type="button"
            onClick={() => { setSubTab("received"); setMsg(null); }}
            className={`px-3 py-1 rounded-[3px] transition flex items-center gap-1.5 ${
              subTab === "received" ? "bg-floor text-zinc-50 font-semibold" : "text-ash hover:text-paper"
            }`}
          >
            Offers Received
            {activeReceivedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-bullion text-floor text-[10px] font-bold">
                {activeReceivedCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => { setSubTab("sent"); setMsg(null); }}
            className={`px-3 py-1 rounded-[3px] transition flex items-center gap-1.5 ${
              subTab === "sent" ? "bg-floor text-zinc-50 font-semibold" : "text-ash hover:text-paper"
            }`}
          >
            Offers Made
            {activeSentCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rule text-paper text-[10px]">
                {activeSentCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {msg && (
        <div
          className={`flex items-start justify-between gap-2 px-3 py-2 rounded-[4px] text-xs border ${
            msg.ok ? "bg-bull/10 border-bull/30 text-bull" : "bg-bear/10 border-bear/30 text-bear"
          }`}
        >
          <div className="flex items-center gap-1.5">
            {msg.ok ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="opacity-60 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Sub-tab: Vault items ────────────────────────────────────────── */}
      {subTab === "items" && (
        <>
          {vault.length === 0 ? (
            <div className="border border-rule rounded-[4px] p-8 text-center flex flex-col items-center gap-2">
              <Trophy className="h-8 w-8 text-ash opacity-40" />
              <p className="text-[14px] font-semibold text-zinc-200">Your Trophy Vault is empty</p>
              <p className="text-xs text-ash max-w-sm">
                Win rare artworks, emblems, and relics on the Auction House floor to display them here or trade with fellow citizens.
              </p>
              <Link
                href="/auction"
                className="mt-2 h-8 px-4 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor font-semibold text-xs flex items-center gap-1.5"
              >
                Browse Live Auctions →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {vault.map((nft) => {
                const isListed = nft.status === "LISTED_FOR_SALE" && !!nft.activeListing;
                const inAuction = nft.status === "IN_AUCTION";

                return (
                  <article
                    key={nft.id}
                    className="border border-rule rounded-[6px] overflow-hidden bg-pane flex flex-col group hover:border-zinc-500 transition"
                  >
                    {/* Visual */}
                    <div className="relative aspect-square w-full bg-floor overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={nft.imageUrl}
                        alt={nft.title}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                      <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                        {isListed && (
                          <span className="px-2 py-0.5 rounded-[3px] text-[10px] font-bold bg-bullion text-floor shadow">
                            FOR SALE: {fmtPrice(nft.activeListing!.price)}
                          </span>
                        )}
                        {inAuction && (
                          <span className="px-2 py-0.5 rounded-[3px] text-[10px] font-bold bg-amber-400 text-floor shadow">
                            IN AUCTION
                          </span>
                        )}
                        {!isListed && !inAuction && (
                          <span className="px-2 py-0.5 rounded-[3px] text-[10px] font-semibold bg-black/60 text-zinc-300 backdrop-blur-xs">
                            VAULTED
                          </span>
                        )}
                      </div>

                      {nft.editionNote && (
                        <span className="absolute bottom-2 left-2 text-[10px] px-1.5 py-0.5 rounded-[2px] bg-black/70 text-zinc-300">
                          {nft.editionNote}
                        </span>
                      )}
                    </div>

                    {/* Metadata & Controls */}
                    <div className="p-3 flex flex-col flex-1 gap-2">
                      <div>
                        <h3 className="text-[13px] font-bold text-zinc-50 truncate leading-tight">
                          {nft.title}
                        </h3>
                        <p className="text-[11px] text-ash mt-0.5">
                          by <span className="text-zinc-300">{nft.creatorName}</span>
                        </p>
                      </div>

                      {nft.description && (
                        <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                          {nft.description}
                        </p>
                      )}

                      {/* Listing / Trade Actions */}
                      <div className="mt-auto pt-2 border-t border-rule flex flex-col gap-2">
                        {isListed ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-bullion font-bold tabular">
                              {fmtPrice(nft.activeListing!.price)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCancelListing(nft.activeListing!.id)}
                              disabled={actionLoading}
                              className="text-[11px] px-2.5 py-1 rounded-[3px] bg-rule hover:bg-zinc-700 text-paper transition cursor-pointer"
                            >
                              Cancel Listing
                            </button>
                          </div>
                        ) : inAuction ? (
                          <div className="text-[11px] text-amber-300/80 italic">
                            Locked in live bidding floor
                          </div>
                        ) : listingNftId === nft.id ? (
                          <div className="flex flex-col gap-1.5 bg-floor p-2 rounded-[4px] border border-rule">
                            <label className="text-[10px] text-ash">Set fixed sale price (gold):</label>
                            <div className="flex gap-1.5">
                              <input
                                type="number"
                                min="1"
                                step="0.01"
                                value={listPrice}
                                onChange={(e) => setListPrice(e.target.value)}
                                placeholder="e.g. 1500"
                                className="w-full h-7 rounded-[3px] bg-pane border border-rule px-2 text-xs text-white focus:outline-none focus:border-zinc-400 tabular"
                              />
                              <button
                                type="button"
                                onClick={() => handleList(nft.id)}
                                disabled={actionLoading || !listPrice}
                                className="h-7 px-2.5 rounded-[3px] bg-bullion hover:bg-amber-300 text-floor font-bold text-xs shrink-0 cursor-pointer"
                              >
                                List
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => setListingNftId(null)}
                              className="text-[10px] text-ash hover:text-paper self-end"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setListingNftId(nft.id);
                                setListPrice("");
                              }}
                              className="h-7 px-3 rounded-[3px] border border-rule hover:border-zinc-500 text-paper text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                            >
                              <Tag className="h-3 w-3 text-bullion" /> List for Sale
                            </button>
                            {nft.activeOffersCount && nft.activeOffersCount > 0 ? (
                              <button
                                type="button"
                                onClick={() => setSubTab("received")}
                                className="text-[11px] text-bullion hover:underline font-semibold"
                              >
                                {nft.activeOffersCount} Offer{nft.activeOffersCount > 1 ? "s" : ""}
                              </button>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Sub-tab: Direct Offers Received ─────────────────────────────── */}
      {subTab === "received" && (
        <div className="flex flex-col gap-3">
          {offersReceived.length === 0 ? (
            <div className="border border-rule rounded-[4px] p-6 text-center text-ash text-xs">
              No pending private offers received for your vault items.
            </div>
          ) : (
            <div className="border border-rule rounded-[4px] overflow-hidden">
              <table className="w-full text-[13px] tabular">
                <thead>
                  <tr className="text-[11px] text-ash border-b border-rule bg-pane">
                    <th className="text-left font-normal py-2.5 pl-4 pr-2">Item</th>
                    <th className="text-left font-normal py-2.5 px-2">From Buyer</th>
                    <th className="text-right font-normal py-2.5 px-2">Offer Amount</th>
                    <th className="text-right font-normal py-2.5 px-2">Offered At</th>
                    <th className="text-right font-normal py-2.5 pl-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {offersReceived.map((off) => (
                    <tr key={off.id} className="border-b border-rule last:border-0 hover:bg-pane/50">
                      <td className="py-2.5 pl-4 pr-2 text-zinc-50 font-medium">
                        {off.nftTitle || off.nftId}
                      </td>
                      <td className="py-2.5 px-2 text-paper">{off.buyerName || off.buyerId}</td>
                      <td className="py-2.5 px-2 text-right text-bullion font-bold">
                        {fmtPrice(off.amount)}
                      </td>
                      <td className="py-2.5 px-2 text-right text-ash text-xs">
                        {new Date(off.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 pl-2 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOfferAction(off.id, "accept_offer")}
                            disabled={actionLoading}
                            className="px-2.5 py-1 rounded-[3px] bg-bullion hover:bg-amber-300 text-floor font-bold text-xs cursor-pointer"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOfferAction(off.id, "reject_offer")}
                            disabled={actionLoading}
                            className="px-2 py-1 rounded-[3px] border border-rule hover:bg-rule text-bear text-xs cursor-pointer"
                          >
                            Decline
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Sub-tab: Direct Offers Sent ─────────────────────────────────── */}
      {subTab === "sent" && (
        <div className="flex flex-col gap-3">
          {offersSent.length === 0 ? (
            <div className="border border-rule rounded-[4px] p-6 text-center text-ash text-xs">
              You have no active private offers out on other citizens&apos; NFTs.
            </div>
          ) : (
            <div className="border border-rule rounded-[4px] overflow-hidden">
              <table className="w-full text-[13px] tabular">
                <thead>
                  <tr className="text-[11px] text-ash border-b border-rule bg-pane">
                    <th className="text-left font-normal py-2.5 pl-4 pr-2">Item</th>
                    <th className="text-left font-normal py-2.5 px-2">Owner</th>
                    <th className="text-right font-normal py-2.5 px-2">Your Offer</th>
                    <th className="text-right font-normal py-2.5 px-2">Status</th>
                    <th className="text-right font-normal py-2.5 pl-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {offersSent.map((off) => (
                    <tr key={off.id} className="border-b border-rule last:border-0 hover:bg-pane/50">
                      <td className="py-2.5 pl-4 pr-2 text-zinc-50 font-medium">
                        {off.nftTitle || off.nftId}
                      </td>
                      <td className="py-2.5 px-2 text-paper">{off.sellerName || "Citizen"}</td>
                      <td className="py-2.5 px-2 text-right text-bullion font-bold">
                        {fmtPrice(off.amount)}
                      </td>
                      <td className="py-2.5 px-2 text-right text-ash text-xs">
                        <span className="px-1.5 py-0.5 rounded-[2px] bg-rule text-paper font-medium">
                          FUNDS LOCKED
                        </span>
                      </td>
                      <td className="py-2.5 pl-2 pr-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOfferAction(off.id, "cancel_offer")}
                          disabled={actionLoading}
                          className="px-2.5 py-1 rounded-[3px] border border-rule hover:bg-rule text-ash hover:text-paper text-xs cursor-pointer"
                        >
                          Revoke Offer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
