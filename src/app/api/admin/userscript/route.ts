import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSetting } from "@/lib/wallet";
import { LEAKED_API_KEY } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const keyParam = searchParams.get("key");
    const user = await getCurrentUser();

    const storedKey = await getSetting("api_key", "");

    // Allow if user is admin OR if provided ?key matches active stored key
    const isAuthorized = 
      (user && user.isAdmin) || 
      (Boolean(keyParam) && keyParam === storedKey && keyParam !== LEAKED_API_KEY);

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, message: "Unauthorized: Admin session or valid key required to download configured userscript." },
        { status: 403 }
      );
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
