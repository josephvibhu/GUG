"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, Sparkles, KeyRound, AlertCircle, ArrowLeft } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [showAdminField, setShowAdminField] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.trim();
    if (cleanUser.length < 3) {
      setError("Your Parlamentum name must be at least 3 characters.");
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

    setLoading(true);

    try {
      const endpoint = "/api/auth";
      const payload = tab === "login"
        ? { action: "login", username: cleanUser, password }
        : { action: "register", username: cleanUser, password, adminCode: adminCode.trim() };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        router.push("/");
        router.refresh();
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
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Floor
      </Link>

      <div className="max-w-md w-full flex flex-col items-center text-center">
        {/* Emblem */}
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-amber-500/30 flex items-center justify-center text-3xl mb-4 shadow-xl shadow-amber-500/5">
          🏛️
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
          The Parlamentum Bourse
        </h1>
        <p className="text-xs text-amber-400/90 font-mono tracking-widest uppercase mt-1">
          Stock Exchange for Parlamentum Gold
        </p>

        {/* Tab Switcher: Log in / New here */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800 w-full mt-6 mb-4">
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
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 block mb-1">
              Your Parlamentum Name
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={24}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Exactly as in the game"
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-amber-400 transition"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 block mb-1">
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
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 block mb-1">
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
                    <span className="text-[9px] text-zinc-400 mt-1 block">
                      Code: <code className="text-zinc-300 font-mono">parlamentum_admin</code> grants Operator controls.
                    </span>
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
            {loading ? "Verifying Credentials..." : tab === "login" ? "Enter the Exchange" : "Create Citizen Account"}
          </button>

          {/* Security & Authentication Disclaimer */}
          <p className="text-[11px] text-zinc-400 leading-relaxed text-center pt-2">
            Use a new password: never the one you play Parlamentum with. Your name has to match the game, because that is where your gold comes from and goes back to.
          </p>
        </form>

        <p className="text-[10px] text-zinc-400 text-center mt-6 max-w-sm">
          Played with Parlamentum in-game gold only. No real money goes in or comes out. Not run by the official Parlamentum team.
        </p>
      </div>
    </div>
  );
}
