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

  // Sovereign State account fields
  const [accountType, setAccountType] = useState<"CITIZEN" | "STATE">("CITIZEN");
  const [realmName, setRealmName] = useState("");
  const [delegateName, setDelegateName] = useState("");
  const [stateMotto, setStateMotto] = useState("");
  const [stateCrest, setStateCrest] = useState("🏛️");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.trim();
    if (cleanUser.length < 3) {
      setError(accountType === "STATE" ? "State username handle must be at least 3 characters." : "Your Parlamentum name must be at least 3 characters.");
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

    if (tab === "register" && accountType === "STATE" && !realmName.trim()) {
      setError("Please specify the Official Realm or Republic Name (e.g. Republic of Milan).");
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
            accountType,
            stateInfo: accountType === "STATE" ? {
              realmName: realmName.trim() || cleanUser,
              delegateName: delegateName.trim() || cleanUser,
              motto: stateMotto.trim() || undefined,
              crest: stateCrest,
            } : undefined
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
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Floor
      </Link>

      <div className="max-w-md w-full flex flex-col items-center text-center">
        {/* Emblem */}
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-amber-500/30 flex items-center justify-center text-3xl mb-4 shadow-xl shadow-amber-500/5">
          🏛️
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
          Grow Ur Gold
        </h1>
        <p className="text-xs text-amber-400/90 font-mono tracking-widest uppercase mt-1">
          Parlamentum Stock Exchange
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
          {/* Account Classification: Citizen vs Sovereign State */}
          {tab === "register" && (
            <div className="space-y-3 pb-2 border-b border-zinc-800">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 block">
                Account Classification
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAccountType("CITIZEN")}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
                    accountType === "CITIZEN"
                      ? "bg-amber-500/10 border-amber-500/50 text-white"
                      : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <span className="text-xl">👤</span>
                  <div>
                    <div className="text-xs font-bold">Citizen Wallet</div>
                    <div className="text-[10px] text-zinc-400">Individual Merchant</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAccountType("STATE")}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
                    accountType === "STATE"
                      ? "bg-purple-500/20 border-purple-500/60 text-white"
                      : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <span className="text-xl">🏛️</span>
                  <div>
                    <div className="text-xs font-bold text-purple-300">Sovereign State</div>
                    <div className="text-[10px] text-zinc-400">Republic / Realm</div>
                  </div>
                </button>
              </div>

              {accountType === "STATE" && (
                <div className="p-3 bg-purple-950/20 border border-purple-500/30 rounded-xl space-y-3 mt-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-purple-300 tracking-wider">
                      👑 Realm & State Credentials
                    </span>
                    <span className="text-[10px] text-zinc-400">Institutional Status</span>
                  </div>

                  {/* Preset Buttons for famous realms */}
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] text-zinc-400 mr-1 self-center">Presets:</span>
                    {[
                      { name: "Republic of Milan", crest: "🏛️", motto: "Visconti-Sforza Sovereign Realm" },
                      { name: "Republic of Venice", crest: "🦁", motto: "Serenissima Repubblica" },
                      { name: "Florentine Republic", crest: "⚜️", motto: "Repubblica Fiorentina" },
                      { name: "Kingdom of France", crest: "👑", motto: "Montjoie Saint Denis" },
                    ].map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setRealmName(preset.name);
                          setStateCrest(preset.crest);
                          setStateMotto(preset.motto);
                          if (!username) setUsername(preset.name.replace(/\s+/g, ""));
                        }}
                        className="px-2 py-0.5 rounded bg-zinc-900 border border-purple-500/40 text-[10px] text-purple-200 hover:bg-purple-900/40 transition cursor-pointer"
                      >
                        {preset.crest} {preset.name}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-300 block mb-1">
                      Official State / Realm Title
                    </label>
                    <input
                      type="text"
                      required={accountType === "STATE"}
                      value={realmName}
                      onChange={(e) => setRealmName(e.target.value)}
                      placeholder="e.g. Republic of Milan"
                      className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="text-[10px] uppercase font-bold text-zinc-300 block mb-1">
                        Delegate / Chancellor in Game
                      </label>
                      <input
                        type="text"
                        value={delegateName}
                        onChange={(e) => setDelegateName(e.target.value)}
                        placeholder="In-game character name"
                        className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-zinc-300 block mb-1">
                        State Crest
                      </label>
                      <select
                        value={stateCrest}
                        onChange={(e) => setStateCrest(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                      >
                        <option value="🏛️">🏛️ Republic</option>
                        <option value="👑">👑 Kingdom</option>
                        <option value="🦁">🦁 Venice Lion</option>
                        <option value="🦅">🦅 Imperial Eagle</option>
                        <option value="⚜️">⚜️ Fleur-de-lis</option>
                        <option value="🛡️">🛡️ Duchy</option>
                        <option value="⚔️">⚔️ Knightly Order</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-300 block mb-1">
                      State Motto / Lore (Optional)
                    </label>
                    <input
                      type="text"
                      value={stateMotto}
                      onChange={(e) => setStateMotto(e.target.value)}
                      placeholder="e.g. Visconti-Sforza Sovereign Realm"
                      className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-purple-400"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Parlamentum Character Name */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 block mb-1">
              {accountType === "STATE" && tab === "register" ? "State Treasury Login Handle" : "Your Parlamentum Name"}
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={24}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={accountType === "STATE" && tab === "register" ? "e.g. RepublicOfMilan" : "Exactly as in the game"}
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
