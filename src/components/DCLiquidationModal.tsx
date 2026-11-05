"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert, Scale, X, Send } from "lucide-react";

interface DCLiquidationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DecreeData {
  ticker: string;
  companyName: string;
  status: string;
  decree: {
    ticker: string;
    companyName: string;
    founder: string;
    dissolvedAt: string;
    fineAmount: number;
    gugSupportAmount: number;
    totalRefunded: number;
    sharesDissolved: number;
    reason: string;
  } | null;
  appeal: {
    reason: string;
    restitutionPlan: string;
    status: string;
    submittedAt: string;
  } | null;
  isFounder: boolean;
  shareholderPayout: {
    shares: number;
    amount: number;
    txId: string;
  } | null;
}

export default function DCLiquidationModal({ isOpen, onClose }: DCLiquidationModalProps) {
  const [data, setData] = useState<DecreeData | null>(null);
  const [loading, setLoading] = useState(false);

  // Appeal form states for founder
  const [appealReason, setAppealReason] = useState("");
  const [restitutionPlan, setRestitutionPlan] = useState("");
  const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false);
  const [appealMessage, setAppealMessage] = useState<string | null>(null);
  const [appealError, setAppealError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch("/api/companies/DC/appeal")
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success) {
          setData(resData);
        }
      })
      .catch((err) => console.error("Error fetching DC decree:", err))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const handleAppealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealReason || appealReason.trim().length < 15) {
      setAppealError("Please provide a detailed justification (minimum 15 characters).");
      return;
    }

    setIsSubmittingAppeal(true);
    setAppealError(null);
    setAppealMessage(null);

    try {
      const res = await fetch("/api/companies/DC/appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: appealReason.trim(),
          restitutionPlan: restitutionPlan.trim() || undefined,
        }),
      });

      const resJson = await res.json();
      if (resJson.success) {
        setAppealMessage(resJson.message);
        setData((prev) => (prev ? { ...prev, appeal: resJson.appeal } : null));
      } else {
        setAppealError(resJson.message || "Failed to submit appeal.");
      }
    } catch (err: any) {
      setAppealError(err?.message || "Network error. Try again.");
    } finally {
      setIsSubmittingAppeal(false);
    }
  };

  if (!isOpen) return null;

  const isShareholder = Boolean(data?.shareholderPayout);
  const isFounder = Boolean(data?.isFounder);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full sm:max-w-xl bg-pane border border-rule rounded-[8px] shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-rule flex items-center justify-between bg-floor/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-bear/20 text-bear border border-bear/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-wider uppercase text-bear font-sans">
                Regulatory Enforcement Decree
              </span>
              <h2 className="text-[15px] sm:text-[16px] font-bold text-white flex items-center gap-1.5 font-sans">
                Dissolution of Dynamax Corporation ($DC)
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-ash hover:text-white hover:bg-rule/50 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-[13px] leading-relaxed">
          {loading ? (
            <div className="py-12 text-center text-ash text-xs">Loading decree records...</div>
          ) : (
            <>
              {/* Executive Summary */}
              <div className="bg-floor/60 border border-rule rounded-[6px] p-3.5 space-y-2">
                <div className="flex items-start gap-2 text-paper">
                  <AlertTriangle className="w-4 h-4 text-bullion shrink-0 mt-0.5" />
                  <p>
                    By order of the Exchange Regulatory Board, **Dynamax Corporation ($DC)** has been{" "}
                    <span className="text-bear font-bold">dissolved and liquidated</span> due to failure to submit mandatory
                    weekly financial filings and disburse shareholder dividends following statutory 24-hour and 12-hour notices.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-rule/60 text-center font-sans">
                  <div className="p-2 rounded bg-pane border border-rule/50">
                    <div className="text-[10px] uppercase text-ash">Regulatory Fine</div>
                    <div className="text-[13px] font-bold text-bear">60.00 gold</div>
                  </div>
                  <div className="p-2 rounded bg-pane border border-rule/50">
                    <div className="text-[10px] uppercase text-ash">GUG 80% Match</div>
                    <div className="text-[13px] font-bold text-bullion">+48.00 gold</div>
                  </div>
                  <div className="p-2 rounded bg-pane border border-rule/50">
                    <div className="text-[10px] uppercase text-ash">Refunded Pool</div>
                    <div className="text-[13px] font-bold text-white">92.48 gold</div>
                  </div>
                  <div className="p-2 rounded bg-pane border border-rule/50">
                    <div className="text-[10px] uppercase text-ash">Shares Dissolved</div>
                    <div className="text-[13px] font-bold text-ash">50 Public</div>
                  </div>
                </div>
              </div>

              {/* Context 1: Personalized Section for Affected Shareholders */}
              {isShareholder && data?.shareholderPayout && (
                <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-[6px] p-4 space-y-2 text-emerald-200">
                  <div className="flex items-center gap-2 font-bold font-sans text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Investor Restitution Credited
                  </div>
                  <p className="text-emerald-100/90 text-[12px]">
                    You held <strong className="text-white">{data.shareholderPayout.shares} shares</strong> of $DC. Your shares
                    have been dissolved, and your full restitution share of{" "}
                    <strong className="text-bullion font-sans text-[13px]">
                      +{data.shareholderPayout.amount.toFixed(2)} gold
                    </strong>{" "}
                    has been automatically credited directly into your citizen purse.
                  </p>
                  <div className="text-[11px] text-emerald-400/80 font-mono">
                    Receipt Reference: {data.shareholderPayout.txId}
                  </div>
                </div>
              )}

              {/* Context 2: Personalized Section for the Founder (Kedah / dinomite) */}
              {isFounder && (
                <div className="bg-amber-950/30 border border-amber-500/40 rounded-[6px] p-4 space-y-3 text-amber-200">
                  <div className="flex items-center gap-2 font-bold font-sans text-amber-400">
                    <Scale className="w-4 h-4" />
                    Founder Rights & Formal Appeal Portal
                  </div>
                  <p className="text-[12px] text-amber-100/90">
                    As the founder of $DC, your company status has been moved to <strong>LIQUIDATED</strong> and all public
                    obligations settled. Under Exchange Bylaw VII, you retain the statutory right to appeal this enforcement
                    decree to the Regulatory Board.
                  </p>

                  {data?.appeal ? (
                    <div className="p-3 bg-floor border border-amber-500/30 rounded text-[12px] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-bullion font-sans uppercase text-[10px]">
                          Appeal Status: {data.appeal.status}
                        </span>
                        <span className="text-[10px] text-ash">
                          {new Date(data.appeal.submittedAt).toUTCString().slice(0, 16)}
                        </span>
                      </div>
                      <p className="text-paper italic">&quot;{data.appeal.reason}&quot;</p>
                      {data.appeal.restitutionPlan && (
                        <div className="text-[11px] text-ash">
                          <strong>Plan:</strong> {data.appeal.restitutionPlan}
                        </div>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleAppealSubmit} className="space-y-2.5 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-amber-300 uppercase mb-1">
                          Reason for Non-Compliance / Defense
                        </label>
                        <textarea
                          value={appealReason}
                          onChange={(e) => setAppealReason(e.target.value)}
                          placeholder="Explain circumstances (e.g. game downtime, deployment confusion, absence)..."
                          rows={3}
                          className="w-full p-2.5 rounded bg-floor border border-rule text-white text-[12px] focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-amber-300 uppercase mb-1">
                          Proposed Remedy / Re-listing Plan (Optional)
                        </label>
                        <input
                          type="text"
                          value={restitutionPlan}
                          onChange={(e) => setRestitutionPlan(e.target.value)}
                          placeholder="e.g. Guarantee 100g dividend reserve deposit upon reactivation"
                          className="w-full px-2.5 h-8 rounded bg-floor border border-rule text-white text-[12px] focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {appealError && <div className="text-bear text-[11px] font-bold">{appealError}</div>}
                      {appealMessage && <div className="text-emerald-400 text-[11px] font-bold">{appealMessage}</div>}

                      <button
                        type="submit"
                        disabled={isSubmittingAppeal}
                        className="w-full py-2 px-3 rounded bg-amber-500 hover:bg-amber-400 text-floor font-bold text-[12px] flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {isSubmittingAppeal ? "Registering Appeal..." : "Submit Formal Appeal to Regulatory Board"}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* General Public Notice Note */}
              {!isShareholder && !isFounder && (
                <p className="text-ash text-[12px] bg-floor/40 p-3 rounded border border-rule/40 leading-relaxed">
                  <strong>Public Market Transparency:</strong> As part of Grow UR Gold’s investor safety mandate, company
                  treasuries from unclaimed IPO sales are reserved to protect public float. In cases of corporate delinquency,
                  funds plus 80% fine match are disbursed directly to public holders.
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-rule bg-floor flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded bg-bullion hover:bg-amber-300 text-floor font-bold font-sans text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
