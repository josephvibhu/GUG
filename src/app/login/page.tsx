"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CoinMark } from "@/components/CoinMark";
import { KeyRound, ArrowLeft } from "lucide-react";

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
    } catch {
      setError("Couldn't reach the exchange. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const field = "h-10 w-full rounded-[4px] border border-rule bg-floor px-3 text-[14px] text-zinc-50 placeholder:text-ash focus:outline-none focus:border-zinc-500";

  return (
    <div className="min-h-screen flex flex-col items-center px-4 pt-6 pb-10">
      <Link href="/" className="self-start text-[13px] text-ash hover:text-paper flex items-center gap-1">
        <ArrowLeft className="h-3.5 w-3.5" />
        Markets
      </Link>

      <div className="w-full max-w-sm mt-8 sm:mt-16 flex flex-col gap-6">
        <header className="flex flex-col items-center text-center gap-2">
          <CoinMark className="h-10 w-10" />
          <h1 className="condensed text-[32px] leading-none font-extrabold text-zinc-50 tracking-tight">Grow Ur Gold</h1>
          <p className="text-[13px] text-ash">The player-run stock exchange of Parlamentum</p>
        </header>

        <div role="tablist" aria-label="Account" className="grid grid-cols-2 gap-0.5 p-0.5 rounded-[4px] border border-rule">
          {([
            ["login", "Log in"],
            ["register", "New here"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                setTab(id);
                setError(null);
              }}
              className={`h-8 rounded-[3px] text-[13px] ${tab === id ? "bg-rule text-zinc-50 font-semibold" : "text-ash hover:text-paper"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-ash">Your Parlamentum character name</span>
            <input type="text" required minLength={3} maxLength={24} autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className={field} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-ash">Password</span>
            <input type="password" required minLength={6} autoComplete={tab === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
          </label>

          {tab === "register" && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] text-ash">Repeat the password</span>
                <input type="password" required minLength={6} autoComplete="new-password" value={repeatPassword} onChange={(e) => setRepeatPassword(e.target.value)} className={field} />
              </label>
              <label className="flex items-start gap-2.5 text-[13px] text-paper">
                <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-bullion)]" />
                <span className="leading-snug">
                  I agree to the{" "}
                  <Link href="/terms" target="_blank" className="underline underline-offset-4">
                    terms
                  </Link>
                  : Parlamentum gold only, no real money, not run by the Parlamentum team.
                </span>
              </label>
              <div>
                <button type="button" onClick={() => setShowAdminField(!showAdminField)} className="text-[12px] text-ash hover:text-paper flex items-center gap-1">
                  <KeyRound className="h-3 w-3" />
                  Operator sign-up code
                </button>
                {showAdminField && (
                  <input type="password" aria-label="Operator sign-up code" value={adminCode} onChange={(e) => setAdminCode(e.target.value)} className={`${field} mt-2`} />
                )}
              </div>
            </>
          )}

          {error && (
            <p role="alert" className="text-[13px] text-bear">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="h-10 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor text-[14px] font-semibold disabled:opacity-50">
            {loading ? (tab === "login" ? "Logging in…" : "Creating your account…") : tab === "login" ? "Log in" : "Create account"}
          </button>

          <p className="text-[12px] text-ash leading-relaxed">
            Use a new password, never your Parlamentum one. Your name must match the game: that is where your gold comes from and goes back to.
          </p>
        </form>
      </div>
    </div>
  );
}
