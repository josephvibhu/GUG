import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSetting } from "@/lib/wallet";
import { LEAKED_API_KEY } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    // Only a logged-in operator can download the script with the key filled in
    const user = await getCurrentUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ success: false, message: "Log in as the operator to download the userscript." }, { status: 403 });
    }

    const storedKey = await getSetting("api_key", "");
    if (!storedKey || storedKey === LEAKED_API_KEY) {
      return NextResponse.json({ success: false, message: "Set an API key in the operator settings first." }, { status: 409 });
    }

    const scriptPath = path.join(process.cwd(), "public", "parlamentum-gug-verifier.user.js");
    let scriptContent = fs.readFileSync(scriptPath, "utf8");

    // Inject active API key
    scriptContent = scriptContent.replace(
      /const SECRET_API_KEY\s*=\s*".*?";/,
      `const SECRET_API_KEY = "${storedKey}";`
    );

    return new NextResponse(scriptContent, {
      status: 200,
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
        "Content-Disposition": 'inline; filename="parlamentum-gug-verifier.user.js"',
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
