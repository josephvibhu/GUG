"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CoinMark } from "@/components/CoinMark";
import { Shield, Sparkles, KeyRound, AlertCircle, ArrowLeft } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [showAdminField, setShowAdminField] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.trim();
    if (cleanUser.length < 3) {
      setError("Your Parlamentum character name must be at least 3 characters.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (tab === "register" && password !== repeatPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (tab === "register" && !agreeTerms) {
      setError("You must accept the Terms & Conditions to register.");
      return;
    }

    setLoading(true);

    try {
      const endpoint = "/api/auth";
      const payload = tab === "login"
        ? { action: "login", username: cleanUser, password }
        : { 
            action: "register", 
            username: cleanUser, 
            password, 
            adminCode: adminCode.trim(),
            acceptedTerms: agreeTerms,
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        window.dispatchEvent(new Event("wallet_updated"));
        window.location.href = "/";
      } else {
        setError(data.message || "Failed to authenticate.");
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 relative font-sans selection:bg-amber-500 selection:text-black">
      {/* Back button */}
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Markets
      </Link>

      <div className="max-w-md w-full flex flex-col items-center text-center">
        <CoinMark className="h-10 w-10 mb-3" />
        <h1 className="condensed text-[32px] leading-none font-extrabold text-zinc-50 tracking-tight">
          Grow Ur Gold
        </h1>
        <p className="text-[13px] text-ash mt-2">
          The player-run stock exchange of Parlamentum
        </p>

        {/* Prominent In-Game Currency Disclaimer Banner */}
        <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-left flex items-start gap-2.5 text-xs text-amber-200/90 mb-4">
          <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-snug">
            <span className="font-semibold text-amber-300">Notice:</span> Played with Parlamentum gold only. No real money goes in or comes out. Not run by the Parlamentum team.
          </div>
        </div>

        {/* Tab Switcher: Log in / New here */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800 w-full mb-4">
          <button
            type="button"
            onClick={() => {
              setTab("login");
              setError(null);
            }}
            className={`py-2 text-center font-bold rounded-lg transition text-xs cursor-pointer ${
              tab === "login"
                ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("register");
              setError(null);
            }}
            className={`py-2 text-center font-bold rounded-lg transition text-xs cursor-pointer ${
              tab === "register"
                ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            New here
          </button>
        </div>

        {/* Authentication Card Form */}
        <form
          onSubmit={handleSubmit}
          className="w-full bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 text-left"
        >
          {/* Parlamentum Character Name */}
          <div>
            <label className="text-[12px] font-medium text-zinc-300 block mb-1">
              Your In-Game Character Name
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={24}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Exact Parlamentum character name"
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-amber-400 transition"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-[12px] font-medium text-zinc-300 block mb-1">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-amber-400 transition"
            />
          </div>

          {/* Registration Extra Fields */}
          {tab === "register" && (
            <>
              <div>
                <label className="text-[12px] font-medium text-zinc-300 block mb-1">
                  Repeat Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-amber-400 transition"
                />
              </div>

              {/* Terms & Conditions Acceptance Checkbox */}
              <label className="flex items-start gap-2.5 cursor-pointer text-[12px] text-zinc-300 select-none pt-1">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-700 text-amber-500 focus:ring-amber-400 bg-zinc-950 w-4 h-4 cursor-pointer shrink-0"
                />
                <span className="leading-snug">
                  I agree to the{" "}
                  <Link href="/terms" target="_blank" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
                    Terms & Conditions
                  </Link>
                  . I acknowledge this is played with <strong className="text-white">Parlamentum gold only</strong>, no real money goes in or comes out, and it is not run by the Parlamentum team.
                </span>
              </label>

              {/* Optional Operator Access Code */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdminField(!showAdminField)}
                  className="text-[10px] text-zinc-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition"
                >
                  <KeyRound className="w-3 h-3" />
                  Have an Operator / Admin Access Code?
                </button>
                {showAdminField && (
                  <div className="mt-2">
                    <input
                      type="password"
                      placeholder="Operator access code (optional)"
                      value={adminCode}
                      onChange={(e) => setAdminCode(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* Error Alert */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-600/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm tracking-wide transition shadow-lg shadow-amber-500/20 cursor-pointer ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {loading ? (tab === "login" ? "Logging in…" : "Creating account…") : tab === "login" ? "Log in" : "Create account"}
          </button>

          {/* Security & Authentication Disclaimer */}
          <p className="text-[11px] text-zinc-400 leading-relaxed text-center pt-2">
            Use a new password: never the one you play Parlamentum with. Your name has to match the game, because that is where your gold comes from and goes back to.
          </p>
        </form>

        <p className="text-[10px] text-zinc-400 text-center mt-6 max-w-sm">
          Played with Parlamentum gold only. No real money goes in or comes out. Not run by the Parlamentum team.
        </p>
      </div>
    </div>
  );
}
