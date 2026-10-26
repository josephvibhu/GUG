"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CoinMark } from "@/components/CoinMark";
import { KeyRound, ArrowLeft } from "lucide-react";

type Mode = "login" | "register" | "change";

// /login?mode=change opens the password form (the account menu links there); false while rendering on the server
const noSubscribe = () => () => {};
const useAskedForChange = () =>
  useSyncExternalStore(noSubscribe, () => new URLSearchParams(window.location.search).get("mode") === "change", () => false);

export default function LoginPage() {
  const askedForChange = useAskedForChange();
  const [chosen, setChosen] = useState<Mode | null>(null);
  const mode: Mode = chosen ?? (askedForChange ? "change" : "login");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [showAdminField, setShowAdminField] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  // Changing the password with a one-time code from the operator instead of the current password
  const [useCode, setUseCode] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const switchTo = (m: Mode) => {
    setChosen(m);
    setError(null);
    setNotice(null);
    setPassword("");
    setNewPassword("");
    setRepeatPassword("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const cleanUser = username.trim();
    if (cleanUser.length < 3) {
      setError("Your Parlamentum character name must be at least 3 characters.");
      return;
    }
    if (mode === "change") {
      if (newPassword.length < 8) {
        setError("The new password needs at least 8 characters.");
        return;
      }
      if (newPassword !== repeatPassword) {
        setError("The new passwords don't match.");
        return;
      }
    } else {
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (mode === "register" && password !== repeatPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (mode === "register" && !agreeTerms) {
        setError("You must accept the Terms & Conditions to register.");
        return;
      }
    }

    setLoading(true);
    try {
      const payload =
        mode === "login"
          ? { action: "login", username: cleanUser, password }
          : mode === "register"
          ? { action: "register", username: cleanUser, password, adminCode: adminCode.trim(), acceptedTerms: agreeTerms }
          : useCode
          ? { action: "reset_password", username: cleanUser, code: password, newPassword }
          : { action: "change_password", username: cleanUser, currentPassword: password, newPassword };

      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        window.dispatchEvent(new Event("wallet_updated"));
        if (mode === "change") {
          setNotice(data.message || "Password changed.");
          setPassword("");
          setNewPassword("");
          setRepeatPassword("");
          setTimeout(() => (window.location.href = data.user?.isManager ? "/admin" : "/"), 1800);
        } else {
          window.location.href = data.user?.isManager ? "/admin" : "/";
        }
      } else {
        setError(data.message || "That didn't work. Check the details and try again.");
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
          <h1 className="condensed text-[32px] leading-none font-extrabold text-zinc-50 tracking-tight">
            {mode === "change" ? "Change your password" : "Grow Ur Gold"}
          </h1>
          <p className="text-[13px] text-ash">
            {mode === "change"
              ? useCode
                ? "Enter the one-time code the operator sent you, then pick your own password."
                : "Every other device logged in to your account will be logged out."
              : "The player-run stock exchange of Parlamentum"}
          </p>
        </header>

        {mode !== "change" && (
          <div role="tablist" aria-label="Account" className="grid grid-cols-2 gap-0.5 p-0.5 rounded-[4px] border border-rule">
            {([
              ["login", "Log in"],
              ["register", "New here"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                onClick={() => switchTo(id)}
                className={`h-8 rounded-[3px] text-[13px] ${mode === id ? "bg-rule text-zinc-50 font-semibold" : "text-ash hover:text-paper"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-ash">Your Parlamentum character name</span>
            <input type="text" required minLength={3} maxLength={24} autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className={field} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-ash">{mode === "change" ? (useCode ? "Reset code from the operator" : "Current password") : "Password"}</span>
            <input
              type={mode === "change" && useCode ? "text" : "password"}
              required
              minLength={mode === "change" ? 1 : 6}
              autoComplete={mode === "change" && useCode ? "one-time-code" : mode === "register" ? "new-password" : "current-password"}
              autoCapitalize={mode === "change" && useCode ? "characters" : undefined}
              spellCheck={false}
              placeholder={mode === "change" && useCode ? "XXXX-XXXX-XXXX" : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${field} ${mode === "change" && useCode ? "uppercase placeholder:normal-case tracking-wide" : ""}`}
            />
          </label>
          {mode === "change" && (
            <button
              type="button"
              onClick={() => {
                setUseCode((v) => !v);
                setPassword("");
                setError(null);
              }}
              className="self-start -mt-2 text-[12px] text-ash hover:text-paper underline underline-offset-4"
            >
              {useCode ? "I know my current password" : "I have a reset code from the operator"}
            </button>
          )}

          {mode === "change" && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] text-ash">New password (8 characters or more)</span>
                <input type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={field} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] text-ash">Repeat the new password</span>
                <input type="password" required minLength={8} autoComplete="new-password" value={repeatPassword} onChange={(e) => setRepeatPassword(e.target.value)} className={field} />
              </label>
            </>
          )}

          {mode === "register" && (
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
          {notice && (
            <p role="status" className="text-[13px] text-bull">
              {notice}
            </p>
          )}

          <button type="submit" disabled={loading} className="h-10 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor text-[14px] font-semibold disabled:opacity-50">
            {loading
              ? mode === "login"
                ? "Logging in…"
                : mode === "register"
                ? "Creating your account…"
                : "Changing your password…"
              : mode === "login"
              ? "Log in"
              : mode === "register"
              ? "Create account"
              : "Change password"}
          </button>

          {mode === "change" ? (
            <button type="button" onClick={() => switchTo("login")} className="self-start text-[13px] text-paper underline underline-offset-4">
              Back to log in
            </button>
          ) : (
            <>
              {mode === "login" && (
                <button type="button" onClick={() => switchTo("change")} className="self-start text-[13px] text-paper underline underline-offset-4">
                  Change your password
                </button>
              )}
              <p className="text-[12px] text-ash leading-relaxed">
                Use a new password, never your Parlamentum one. Your name must match the game: that is where your gold comes from and goes back to.
              </p>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
