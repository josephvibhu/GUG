import { NextResponse, after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { setSetting } from "@/lib/wallet";
import { loginEnds, setLogin, watch, watchView } from "@/lib/watcher";

// The operator gives the watcher its game login, takes it away, asks for a look now, or changes what counts as a
// deposit. The login is stored sealed and never sent back out: the panel only ever learns when it runs out.

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ success: false, message: "Operator only." }, { status: 403 });
  return NextResponse.json({ success: true, watcher: await watchView() });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.isAdmin) return NextResponse.json({ success: false, message: "Operator only." }, { status: 403 });
    const body = await request.json().catch(() => ({}));

    if (body.action === "stop") {
      await setLogin(null);
      return NextResponse.json({ success: true, message: "The watcher is off. Deposits are credited by hand again." });
    }

    if (body.action === "look") {
      await watch(true);
      return NextResponse.json({ success: true, watcher: await watchView() });
    }

    if (body.action === "settings") {
      if (body.item !== undefined) {
        const item = String(body.item).trim().toUpperCase();
        if (!/^[A-Z0-9_]{2,40}$/.test(item)) return NextResponse.json({ success: false, message: "Use the game's item code, e.g. IRON_RAW." }, { status: 400 });
        await setSetting("watcher_item", item);
      }
      if (body.exportTax !== undefined) {
        const tax = Number(body.exportTax);
        if (!Number.isFinite(tax) || tax < 0 || tax > 50) return NextResponse.json({ success: false, message: "The export tax is between 0 and 50%." }, { status: 400 });
        await setSetting("house_export_tax", String(tax));
      }
      return NextResponse.json({ success: true, watcher: await watchView() });
    }

    if (body.action === "start") {
      // Accept the token as copied from the browser console, with or without quotes
      const token = typeof body.token === "string" ? body.token.trim().replace(/^"|"$/g, "") : "";
      const ends = loginEnds(token);
      if (!ends) return NextResponse.json({ success: false, message: "That isn't a game login. Copy the value of localStorage.token on parlamentum.org." }, { status: 400 });
      if (ends.getTime() <= Date.now()) return NextResponse.json({ success: false, message: "That login has already run out. Log in to the game again and copy a fresh one." }, { status: 400 });
      await setLogin(token);
      after(() => watch(true).catch((err) => console.error("watcher", err)));
      return NextResponse.json({ success: true, message: `The watcher is on until ${ends.toISOString().slice(0, 16).replace("T", " ")} UTC.` });
    }

    return NextResponse.json({ success: false, message: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("POST /api/admin/watcher error:", error);
    return NextResponse.json({ success: false, message: "Something went wrong. See the server log." }, { status: 500 });
  }
}
