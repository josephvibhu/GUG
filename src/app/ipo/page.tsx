"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { 
  Building2, 
  Coins, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  FileText,
  User,
  Percent
} from "lucide-react";

interface UserApplication {
  id: string;
  ticker: string;
  name: string;
  sector: string;
  proposedTotalShares: number;
  proposedIpoPrice: number;
  proposedFounderRetainPercent: number;
  logoUrl: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  operatorNotes?: string;
  finalPrice?: number;
  createdAt: string;
}

export default function IpoPage() {
  const [parlamentumName, setParlamentumName] = useState("");
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sector, setSector] = useState("Industry & Metallurgy");
  const [totalShares, setTotalShares] = useState("10000");
  const [ipoPrice, setIpoPrice] = useState("10.00");
  const [floatPercent, setFloatPercent] = useState<number>(20);
  const [logoEmoji, setLogoEmoji] = useState("🏛️");

  const [applications, setApplications] = useState<UserApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const numTotalShares = parseInt(totalShares, 10) || 0;
  const numIpoPrice = parseFloat(ipoPrice) || 0;
  const initialMarketCap = numTotalShares * numIpoPrice;
  const founderPercent = parseFloat((100 - floatPercent).toFixed(2));
  const rawFounderShares = Math.floor(numTotalShares * (founderPercent / 100));
  const publicFloat = Math.max(1, numTotalShares - rawFounderShares);
  const founderShares = numTotalShares - publicFloat;
  const publicFloatVal = publicFloat * numIpoPrice;

  const emojiList = ["🏛️", "⚙️", "⚒️", "🗡️", "💎", "🌾", "🚢", "🚂", "🛡️", "⚗️", "👑"];

  const sectors = [
    "Mining & Raw Iron Extraction",
    "Industry & Metallurgy",
    "Agriculture & Grain Trade",
    "Banking & Corporate Credit",
    "Logistics & Courier Guild",
    "Military & Defense Outfitting",
    "Parliamentary Faction Syndicate",
  ];

  const fetchApplications = async () => {
    try {
      const res = await fetch("/api/ipo", { cache: "no-store" });
      const data = await res.json();
      if (data.success && data.applications) {
        setApplications(data.applications);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchApplications();
    // Pre-fill user's character name
    fetch("/api/auth", { cache: "no-store" }).then(r => r.json()).then(data => {
      if (data.user?.parlamentumName || data.user?.username) {
        setParlamentumName(data.user.parlamentumName || data.user.username);
      }
    }).catch(() => {});
  }, []);

  const handleLaunchIpo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanTicker = ticker.trim().toUpperCase();
    if (cleanTicker.length < 2 || cleanTicker.length > 5) {
      setError("Ticker symbol must be between 2 and 5 letters.");
      return;
    }
    if (!name.trim()) {
      setError("Please provide a legitimate company name.");
      return;
    }
    if (!parlamentumName.trim()) {
      setError("Please provide your exact in-game Parlamentum character name.");
      return;
    }
    if (!description.trim()) {
      setError("Please describe your business lore and in-game backing assets.");
      return;
    }
    if (numTotalShares < 1000) {
      setError("Total authorized shares must be at least 1,000 shares.");
      return;
    }
    if (numIpoPrice <= 0) {
      setError("IPO offering price must be greater than 0 gold.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/ipo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parlamentumName: parlamentumName.trim(),
          ticker: cleanTicker,
          name: name.trim(),
          description: description.trim(),
          sector,
          proposedTotalShares: numTotalShares,
          proposedIpoPrice: numIpoPrice,
          proposedFounderRetainPercent: founderPercent,
          proposedFloatPercent: floatPercent,
          logoUrl: logoEmoji,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(data.message || `Charter request for $${cleanTicker} submitted to High Registrar!`);
        setTicker("");
        setName("");
        setDescription("");
        fetchApplications();
      } else {
        setError(data.message || "Failed to submit IPO charter application.");
      }
    } catch (err: any) {
      setError(err.message || "Network error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="max-w-6xl w-full mx-auto p-4 sm:p-6 md:p-8 flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2 border-b border-zinc-800 pb-6">
          <h1 className="condensed text-[28px] leading-none font-extrabold text-zinc-50 tracking-tight">
            List your company
          </h1>
          <p className="text-ash text-sm max-w-2xl leading-relaxed">
            Tell the operator what backs your company in the game and propose the shares, price and public float.
            They review it, may negotiate the price, and open the first shares for sale when it&apos;s approved.
          </p>
        </div>

        {/* Existing Applications Section */}
        {applications.length > 0 && (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
            <h2 className="font-bold text-white text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              Your IPO Charter Applications ({applications.length})
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {applications.map((app) => (
                <div 
                  key={app.id} 
                  className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{app.logoUrl}</span>
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>{app.name}</span>
                            <span className="font-mono text-amber-400">(${app.ticker})</span>
                          </div>
                          <span className="text-[10px] text-zinc-400">{app.sector}</span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        app.status === "PENDING"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          : app.status === "APPROVED"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                      }`}>
                        {app.status === "PENDING" ? "🟡 Under Review" : app.status === "APPROVED" ? "🟢 Listed on Bourse" : "🔴 Rejected"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-zinc-800/80 font-mono text-[11px]">
                      <div>
                        <span className="text-zinc-500 block text-[10px] font-sans">Public Float</span>
                        <span className="text-amber-400 font-bold">{(100 - Number(app.proposedFounderRetainPercent)).toFixed(2)}%</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] font-sans">Proposed Price</span>
                        <span className="text-zinc-300">{app.proposedIpoPrice.toFixed(2)} gold</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] font-sans">Final Price</span>
                        <span className="text-emerald-400 font-bold">
                          {app.finalPrice ? `${app.finalPrice.toFixed(2)} gold` : "Pending"}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] font-sans">Total Shares</span>
                        <span className="text-zinc-300">{app.proposedTotalShares.toLocaleString()}</span>
                      </div>
                    </div>

                    {app.operatorNotes && (
                      <div className="mt-2.5 p-2 bg-zinc-900 rounded border border-zinc-800 text-[11px] text-zinc-300 font-sans">
                        <strong className="text-amber-400">Operator Note:</strong> {app.operatorNotes}
                      </div>
                    )}
                  </div>

                  {app.status === "APPROVED" && (
                    <Link
                      href={`/trade/${app.ticker}`}
                      className="w-full py-1.5 text-center bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5"
                    >
                      Open Live Trading Terminal <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Application Form & Real-Time Pro-Forma Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <form onSubmit={handleLaunchIpo} className="lg:col-span-7 flex flex-col gap-5 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xl">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-600/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Applicant In-Game Name */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-400" />
                Founder In-Game Parlamentum Character Name
              </label>
              <input
                type="text"
                value={parlamentumName}
                onChange={(e) => setParlamentumName(e.target.value)}
                placeholder="Exact character name in Parlamentum"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-amber-400 transition"
              />
              <span className="text-[11px] text-zinc-400 mt-1 block">
                The operator will verify your character and negotiate listing terms in-game or via Discord.
              </span>
            </div>

            {/* Ticker & Logo */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                  Requested Ticker Symbol
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-zinc-500 font-mono text-sm font-bold">$</span>
                  <input
                    type="text"
                    maxLength={5}
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    placeholder="FE"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-white font-mono uppercase tracking-wider font-bold focus:outline-none focus:border-amber-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                  Charter Crest
                </label>
                <select
                  value={logoEmoji}
                  onChange={(e) => setLogoEmoji(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-lg text-white focus:outline-none focus:border-amber-400 transition cursor-pointer"
                >
                  {emojiList.map((em) => (
                    <option key={em} value={em}>
                      {em}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Company Name */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                Official Charter / Enterprise Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ironworks Conglomerate of Parlamentum"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 transition"
              />
            </div>

            {/* Sector */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                Economic Sector
              </label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-400 transition cursor-pointer"
              >
                {sectors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Business Lore & Asset Backing */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                Business Plan & In-Game Backing Assets
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain what in-game assets back your company (e.g. 5 Raw Iron mines, 12 couriers, territory ownership, dividend commitments to shareholders)."
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-amber-400 transition"
              />
            </div>

            {/* Capital Structure */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                  Proposed Total Shares
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  value={totalShares}
                  onChange={(e) => setTotalShares(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-amber-400 transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                  Proposed Initial Price (Gold)
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.5"
                  value={ipoPrice}
                  onChange={(e) => setIpoPrice(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-amber-400 transition"
                />
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  Negotiable with operator during review.
                </span>
              </div>
            </div>

            {/* Public Float (% Putting Out) & Founder Equity Controls */}
            <div className="p-4 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <label className="text-xs font-bold text-amber-400 block">
                    Public Float % (Percentage Putting Out to Bourse)
                  </label>
                  <span className="text-[10px] text-zinc-400">
                    Supports micro-floats down to 0.10% (Founder keeps 99.90%)
                  </span>
                </div>
                <div className="text-right font-mono">
                  <span className="text-xs font-bold text-amber-400">
                    {floatPercent.toFixed(2)}% Float
                  </span>
                  <span className="text-[10px] text-zinc-400 block">
                    ({publicFloat.toLocaleString()} shares)
                  </span>
                </div>
              </div>

              {/* Number input and slider for exact decimal float control */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0.10"
                      max="99.90"
                      value={floatPercent}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          setFloatPercent(Math.min(99.9, Math.max(0.1, Math.round(val * 100) / 100)));
                        }
                      }}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-3 pr-8 py-2 font-mono text-amber-400 font-bold text-sm focus:outline-none focus:border-amber-400"
                    />
                    <Percent className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-3" />
                  </div>
                </div>

                <div className="p-2 bg-zinc-900/60 rounded-lg border border-zinc-800 text-[11px] font-mono flex items-center justify-between">
                  <span className="text-zinc-400 font-sans">Founder Retains:</span>
                  <strong className="text-paper font-bold">{founderPercent.toFixed(2)}% ({founderShares.toLocaleString()} sh.)</strong>
                </div>
              </div>

              {/* Slider for smooth dragging */}
              <input
                type="range"
                min="0.10"
                max="99.90"
                step="0.10"
                value={floatPercent}
                onChange={(e) => setFloatPercent(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />

              {/* Micro-Float Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-zinc-500 mr-1">Presets:</span>
                {[
                  { label: "0.10% (Micro)", val: 0.10 },
                  { label: "1.00%", val: 1.00 },
                  { label: "5.00%", val: 5.00 },
                  { label: "10.00%", val: 10.00 },
                  { label: "25.00%", val: 25.00 },
                  { label: "50.00%", val: 50.00 },
                ].map((pill) => (
                  <button
                    key={pill.val}
                    type="button"
                    onClick={() => setFloatPercent(pill.val)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer border ${
                      floatPercent === pill.val
                        ? "bg-amber-500 text-black font-bold border-amber-400"
                        : "bg-zinc-800 text-zinc-300 hover:text-white border-zinc-700"
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor font-semibold text-sm transition cursor-pointer flex items-center justify-center gap-2 ${
                loading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <Building2 className="w-4 h-4" />
              {loading ? "Sending application…" : "Send application to the operator"}
            </button>
          </form>

          {/* Pro-Forma Prospectus Preview (5 cols) */}
          <div className="lg:col-span-5 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col gap-4">
            <h3 className="font-bold text-white text-sm flex items-center gap-2 border-b border-zinc-800 pb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Listing preview
            </h3>

            <div className="flex items-center gap-3 p-3 bg-zinc-950 rounded-xl border border-zinc-800">
              <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-2xl">
                {logoEmoji}
              </div>
              <div>
                <div className="font-bold text-white text-base">
                  {name || "Untitled Enterprise"}
                </div>
                <div className="font-mono text-xs text-amber-400 font-bold">
                  ${ticker || "TICKER"} · <span className="text-zinc-400 font-sans font-normal">{sector}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 font-mono text-xs">
              <div className="flex justify-between p-2 rounded bg-zinc-950/60 border border-zinc-800/60">
                <span className="text-zinc-400 font-sans">Initial Valuation (Market Cap):</span>
                <span className="font-bold text-emerald-400">{initialMarketCap.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gold</span>
              </div>

              <div className="flex justify-between p-2 rounded bg-zinc-950/60 border border-zinc-800/60">
                <span className="text-zinc-400 font-sans">Public Float (% Putting Out):</span>
                <span className="font-bold text-amber-400">{floatPercent.toFixed(2)}% ({publicFloat.toLocaleString()} shares)</span>
              </div>

              <div className="flex justify-between p-2 rounded bg-zinc-950/60 border border-zinc-800/60">
                <span className="text-zinc-400 font-sans">Founder Retained Stake:</span>
                <span className="font-bold text-paper">{founderPercent.toFixed(2)}% ({founderShares.toLocaleString()} shares)</span>
              </div>

              <div className="flex justify-between p-2 rounded bg-zinc-950/60 border border-zinc-800/60">
                <span className="text-zinc-400 font-sans">Capital To Be Raised:</span>
                <span className="font-bold text-amber-300">{publicFloatVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gold</span>
              </div>

              <div className="flex justify-between p-2 rounded bg-zinc-950/60 border border-zinc-800/60">
                <span className="text-zinc-400 font-sans">Standard Bourse Trading Fee:</span>
                <span className="text-zinc-300">0.5% on matches</span>
              </div>
            </div>

            <div className="text-[11px] text-zinc-400 leading-relaxed border-t border-zinc-800 pt-3">
              Once submitted, the operator can adjust or renegotiate the initial price with you before the public book is opened.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
