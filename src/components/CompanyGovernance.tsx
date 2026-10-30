"use client";

import { useState, useEffect, useCallback } from "react";
import { Vote, CheckCircle2, XCircle, Clock, AlertCircle, Plus, Users, ShieldCheck } from "lucide-react";
import { CompanyMotion } from "@/lib/governance";
import { fmtQty } from "@/lib/format";

interface Props {
  ticker: string;
  isFounderOrAdmin?: boolean;
}

export default function CompanyGovernance({ ticker, isFounderOrAdmin }: Props) {
  const [loading, setLoading] = useState(true);
  const [motions, setMotions] = useState<CompanyMotion[]>([]);
  const [userShares, setUserShares] = useState(0);
  const [isFounder, setIsFounder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New proposal modal state
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quorumPct, setQuorumPct] = useState(10);
  const [durationDays, setDurationDays] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Voting state
  const [votingMotionId, setVotingMotionId] = useState<string | null>(null);

  const fetchMotions = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/companies/${ticker}/motions`, { cache: "no-store" });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "Failed to load governance motions.");
        return;
      }
      setMotions(data.motions || []);
      setUserShares(data.userShares || 0);
      setIsFounder(data.isFounder || false);
    } catch {
      setError("Could not connect to the governance ledger.");
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    fetchMotions();
  }, [fetchMotions]);

  const handlePropose = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${ticker}/motions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title,
          description,
          quorumPct,
          durationDays,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setActionError(data.message || "Failed to create proposal.");
        return;
      }
      setShowModal(false);
      setTitle("");
      setDescription("");
      fetchMotions();
    } catch {
      setActionError("Network error while submitting proposal.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (motionId: string, choice: "YES" | "NO" | "ABSTAIN") => {
    setVotingMotionId(motionId);
    setActionError(null);
    try {
      const res = await fetch(`/api/companies/${ticker}/motions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "vote",
          motionId,
          choice,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || "Failed to register vote.");
        return;
      }
      fetchMotions();
    } catch {
      alert("Network error casting vote.");
    } finally {
      setVotingMotionId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center text-ash text-sm">
        Loading shareholder resolutions…
      </div>
    );
  }

  const activeMotions = motions.filter((m) => m.status === "ACTIVE");
  const pastMotions = motions.filter((m) => m.status !== "ACTIVE");
  const canPropose = isFounderOrAdmin || isFounder;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl">
      {/* Governance Banner & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-[4px] border border-rule bg-pane">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Vote className="h-4 w-4 text-bullion" />
            <h2 className="text-[15px] font-semibold text-zinc-50 tracking-tight">Shareholder Proxy Governance</h2>
            <span className="text-[11px] px-1.5 py-0.5 rounded border border-bullion/40 bg-bullion/10 text-bullion font-medium">
              1 Share = 1 Vote
            </span>
          </div>
          <p className="text-[13px] text-ash max-w-xl">
            Vote on corporate bylaws, acquisitions, and dividend adjustments. Your voting weight equals your verified equity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {userShares > 0 && (
            <div className="px-3 py-1.5 rounded-[4px] bg-floor border border-rule text-right">
              <span className="block text-[11px] text-ash">Your voting power</span>
              <span className="text-[13px] font-bold text-bullion tabular">{fmtQty(userShares)} shares</span>
            </div>
          )}

          {canPropose && (
            <button
              onClick={() => setShowModal(true)}
              className="h-9 px-3.5 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor text-[13px] font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Propose Motion
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-[4px] border border-bear/40 bg-bear/10 text-[13px] text-bear flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Active Motions Section */}
      <div className="flex flex-col gap-3">
        <h3 className="text-[14px] font-semibold text-zinc-50 flex items-center gap-2">
          <span>Active Resolutions</span>
          <span className="text-ash font-normal tabular">({activeMotions.length})</span>
        </h3>

        {activeMotions.length === 0 ? (
          <div className="p-6 rounded-[4px] border border-dashed border-rule text-center flex flex-col items-center gap-2">
            <Clock className="h-6 w-6 text-ash" />
            <p className="text-[13px] text-paper">No active shareholder motions at this time.</p>
            <p className="text-[12px] text-ash">Company founders post proxy votes for major decisions.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {activeMotions.map((motion) => (
              <MotionCard
                key={motion.id}
                motion={motion}
                userShares={userShares}
                onVote={handleVote}
                voting={votingMotionId === motion.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Past Motions Section */}
      {pastMotions.length > 0 && (
        <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-rule">
          <h3 className="text-[14px] font-semibold text-zinc-50 flex items-center gap-2">
            <span>Resolved Motions</span>
            <span className="text-ash font-normal tabular">({pastMotions.length})</span>
          </h3>
          <div className="flex flex-col gap-4">
            {pastMotions.map((motion) => (
              <MotionCard
                key={motion.id}
                motion={motion}
                userShares={userShares}
                onVote={handleVote}
                voting={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Propose Motion Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-pane border border-rule rounded-[6px] shadow-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-rule pb-3">
              <h3 className="text-[16px] font-bold text-zinc-50">Propose Shareholder Resolution</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-ash hover:text-paper text-sm"
              >
                ✕
              </button>
            </div>

            {actionError && (
              <div className="p-2.5 rounded-[4px] bg-bear/10 border border-bear/30 text-[12px] text-bear">
                {actionError}
              </div>
            )}

            <form onSubmit={handlePropose} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-paper">Motion Title</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Approve acquisition of Iron Mine #3 in Parlamentum"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-9 px-3 rounded-[4px] bg-floor border border-rule text-[13px] text-zinc-50 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-paper">Proposal Description & Justification</span>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide background, financial rationale, and execution timeline for shareholders…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="p-3 rounded-[4px] bg-floor border border-rule text-[13px] text-zinc-50 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-paper">Quorum Required</span>
                  <select
                    value={quorumPct}
                    onChange={(e) => setQuorumPct(Number(e.target.value))}
                    className="h-9 px-3 rounded-[4px] bg-floor border border-rule text-[13px] text-zinc-50 focus:outline-none focus:border-zinc-500"
                  >
                    <option value={5}>5% of float</option>
                    <option value={10}>10% of float (Standard)</option>
                    <option value={20}>20% of float (Major decision)</option>
                    <option value={30}>30% of float (Supermajority)</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-paper">Voting Window</span>
                  <select
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                    className="h-9 px-3 rounded-[4px] bg-floor border border-rule text-[13px] text-zinc-50 focus:outline-none focus:border-zinc-500"
                  >
                    <option value={1}>24 hours</option>
                    <option value={3}>3 days (Recommended)</option>
                    <option value={5}>5 days</option>
                    <option value={7}>7 days (1 week)</option>
                  </select>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="h-9 px-4 rounded-[4px] border border-rule hover:bg-rule text-[13px] text-paper"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-9 px-4 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor font-semibold text-[13px] disabled:opacity-50"
                >
                  {submitting ? "Publishing…" : "Publish Resolution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MotionCard({
  motion,
  userShares,
  onVote,
  voting,
}: {
  motion: CompanyMotion;
  userShares: number;
  onVote: (motionId: string, choice: "YES" | "NO" | "ABSTAIN") => void;
  voting: boolean;
}) {
  const totalShares = motion.totalCompanyShares || 10000;
  const quorumSharesNeeded = Math.round((totalShares * motion.quorumPct) / 100);
  const quorumMet = motion.totalVotedShares >= quorumSharesNeeded;

  const yesPct = motion.totalVotedShares > 0 ? (motion.yesShares / motion.totalVotedShares) * 100 : 0;
  const noPct = motion.totalVotedShares > 0 ? (motion.noShares / motion.totalVotedShares) * 100 : 0;
  const abstainPct = motion.totalVotedShares > 0 ? (motion.abstainShares / motion.totalVotedShares) * 100 : 0;

  const isActive = motion.status === "ACTIVE";
  const endDate = new Date(motion.endsAt);
  const isExpired = endDate.getTime() < Date.now();

  const getStatusBadge = () => {
    switch (motion.status) {
      case "ACTIVE":
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">Voting Open</span>;
      case "PASSED":
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-bullion/10 border border-bullion/30 text-bullion flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Passed</span>;
      case "REJECTED":
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-1"><XCircle className="h-3 w-3" /> Rejected</span>;
      case "EXPIRED":
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-700/40 border border-zinc-600 text-ash">No Quorum</span>;
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-[4px] border border-rule bg-pane flex flex-col gap-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <span className="text-[12px] text-ash">
              Proposed by <strong className="text-paper">@{motion.creatorName}</strong>
            </span>
          </div>
          <h4 className="text-[16px] font-semibold text-zinc-50 leading-snug">{motion.title}</h4>
        </div>

        <div className="text-right text-[12px] text-ash tabular shrink-0">
          {isActive ? (
            <span className="text-bullion font-medium">Closes {endDate.toLocaleDateString()}</span>
          ) : (
            <span>Concluded {endDate.toLocaleDateString()}</span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-[13px] text-paper whitespace-pre-wrap leading-relaxed bg-floor/60 p-3 rounded-[3px] border border-rule/60">
        {motion.description}
      </p>

      {/* Vote Progress Bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-[12px] tabular">
          <span className="font-semibold text-emerald-400">YES: {yesPct.toFixed(1)}% ({fmtQty(motion.yesShares)} sh)</span>
          <span className="font-semibold text-rose-400">NO: {noPct.toFixed(1)}% ({fmtQty(motion.noShares)} sh)</span>
        </div>

        <div className="h-3.5 w-full bg-floor rounded-[3px] overflow-hidden flex border border-rule">
          <div style={{ width: `${yesPct}%` }} className="bg-emerald-500 transition-all duration-300" title={`YES: ${motion.yesShares} shares`} />
          <div style={{ width: `${noPct}%` }} className="bg-rose-500 transition-all duration-300" title={`NO: ${motion.noShares} shares`} />
          <div style={{ width: `${abstainPct}%` }} className="bg-zinc-600 transition-all duration-300" title={`ABSTAIN: ${motion.abstainShares} shares`} />
        </div>

        <div className="flex justify-between items-center text-[11px] text-ash">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {motion.votersCount} shareholder{motion.votersCount === 1 ? "" : "s"} voted ({fmtQty(motion.totalVotedShares)} shares total)
          </span>
          <span className={quorumMet ? "text-emerald-400 font-medium" : "text-ash"}>
            Quorum: {fmtQty(motion.totalVotedShares)} / {fmtQty(quorumSharesNeeded)} sh ({quorumMet ? "Met ✓" : `${motion.quorumPct}% required`})
          </span>
        </div>
      </div>

      {/* Voting Section */}
      {isActive && !isExpired && (
        <div className="pt-3 border-t border-rule/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[12px] text-ash">
            {motion.userVote ? (
              <span className="text-zinc-50">
                You voted: <strong className="text-bullion uppercase">{motion.userVote}</strong> with {fmtQty(userShares)} shares.
              </span>
            ) : userShares > 0 ? (
              <span>Cast your vote ({fmtQty(userShares)} shares voting power):</span>
            ) : (
              <span className="text-ash/80">Only shareholders holding $GUG can cast proxy votes.</span>
            )}
          </div>

          {userShares > 0 && (
            <div className="flex items-center gap-2">
              <button
                disabled={voting}
                onClick={() => onVote(motion.id, "YES")}
                className={`h-8 px-3 rounded-[3px] text-[12px] font-semibold transition-colors ${
                  motion.userVote === "YES"
                    ? "bg-emerald-500 text-floor font-bold ring-2 ring-emerald-400"
                    : "bg-emerald-950/60 text-emerald-400 border border-emerald-800 hover:bg-emerald-900/60"
                }`}
              >
                Vote YES
              </button>
              <button
                disabled={voting}
                onClick={() => onVote(motion.id, "NO")}
                className={`h-8 px-3 rounded-[3px] text-[12px] font-semibold transition-colors ${
                  motion.userVote === "NO"
                    ? "bg-rose-500 text-floor font-bold ring-2 ring-rose-400"
                    : "bg-rose-950/60 text-rose-400 border border-rose-800 hover:bg-rose-900/60"
                }`}
              >
                Vote NO
              </button>
              <button
                disabled={voting}
                onClick={() => onVote(motion.id, "ABSTAIN")}
                className={`h-8 px-2.5 rounded-[3px] text-[12px] transition-colors ${
                  motion.userVote === "ABSTAIN"
                    ? "bg-zinc-600 text-zinc-50 font-bold"
                    : "bg-floor text-ash border border-rule hover:text-paper"
                }`}
              >
                Abstain
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
