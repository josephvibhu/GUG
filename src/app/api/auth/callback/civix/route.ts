import { NextResponse, connection } from "next/server";
import { loginOrRegisterCivixUser } from "@/lib/auth";

export async function GET(req: Request) {
  await connection();
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error || !code) {
      return NextResponse.redirect(new URL("/login?error=civix_canceled", req.url));
    }

    // Exchange auth code with Civix Hub
    const civixHost = process.env.NEXT_PUBLIC_CIVIX_URL || "https://civix-plum.vercel.app";
    const res = await fetch(`${civixHost}/api/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: "civ_client_gug_live",
        client_secret: "secret_gug_preview",
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Civix token exchange failed:", err);
      return NextResponse.redirect(new URL("/login?error=civix_failed", req.url));
    }

    const data = await res.json();
    if (!data.citizen) {
      return NextResponse.redirect(new URL("/login?error=civix_invalid_citizen", req.url));
    }

    // Auto-login or register citizen in GUG
    const loginResult = await loginOrRegisterCivixUser(data.citizen);
    if (!loginResult.success) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(loginResult.message || "civix_error")}`, req.url));
    }

    const redirectPath = loginResult.user?.isManager ? "/admin" : "/";
    return NextResponse.redirect(new URL(redirectPath, req.url));
  } catch (err: any) {
    console.error("Civix callback error:", err);
    return NextResponse.redirect(new URL("/login?error=civix_server_error", req.url));
  }
}
