import { getDb, initDb, syncDbFromBlob, persistDbToBlob } from "./db";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import crypto from "crypto";

export interface UserSession {
  id: string;
  username: string;
  displayName: string;
  parlamentumName: string;
  cashBalance: number;
  lockedCash: number;
  avatar: string;
  isAdmin: boolean;
  isFrozen: boolean;
  accountType?: "CITIZEN" | "STATE";
  stateRealmName?: string;
  stateMotto?: string;
  stateDelegateName?: string;
  stateCrest?: string;
}

export const COOKIE_NAME = "parlamentum_session_id";
export const ADMIN_SECRET_CODE = "parlamentum_admin";

// Session cookies are "<userId>.<hmac>" so a user id alone (shown in public shareholder lists) can't be used as a login.
// Prefer SESSION_SECRET from the environment; otherwise a random secret is generated once and kept in settings.
async function getSessionSecret(): Promise<string> {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const db = getDb();
  const res = await db.execute("SELECT value FROM settings WHERE key = 'session_secret'");
  if (res.rows.length > 0) return String(res.rows[0].value);
  await db.execute({
    sql: "INSERT OR IGNORE INTO settings (key, value) VALUES ('session_secret', ?)",
    args: [crypto.randomBytes(32).toString("hex")],
  });
  const created = await db.execute("SELECT value FROM settings WHERE key = 'session_secret'");
  return String(created.rows[0].value);
}

async function signSession(userId: string): Promise<string> {
  const sig = crypto.createHmac("sha256", await getSessionSecret()).update(userId).digest("hex");
  return `${userId}.${sig}`;
}

async function verifySession(value: string): Promise<string | null> {
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = value.slice(0, dot);
  const expected = Buffer.from(await signSession(userId));
  const given = Buffer.from(value);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected) ? userId : null;
}

export async function getCurrentUser(): Promise<UserSession | null> {
  await initDb();
  await syncDbFromBlob(false);
  const db = getDb();
  let userId: string | null | undefined;

  try {
    const cookieStore = await cookies();
    userId = cookieStore.get(COOKIE_NAME)?.value;
  } catch {
    userId = undefined;
  }

  // Proper login: if no cookie, user is NOT logged in!
  if (!userId) {
    return null;
  }

  userId = await verifySession(userId);
  if (!userId) {
    return null;
  }

  const res = await db.execute({
    sql: "SELECT * FROM users WHERE id = ?",
    args: [userId],
  });

  if (res.rows.length === 0) {
    return null;
  }

  const u = res.rows[0];
  return {
    id: String(u.id),
    username: String(u.username),
    displayName: String(u.display_name),
    parlamentumName: String(u.parlamentum_name || u.username),
    cashBalance: Number(u.cash_balance),
    lockedCash: Number(u.locked_cash),
    avatar: String(u.avatar || "👤"),
    isAdmin: Number(u.is_admin) === 1,
    isFrozen: Number(u.is_frozen || 0) === 1,
    accountType: (u.account_type as "CITIZEN" | "STATE") || "CITIZEN",
    stateRealmName: u.state_realm_name ? String(u.state_realm_name) : undefined,
    stateMotto: u.state_motto ? String(u.state_motto) : undefined,
    stateDelegateName: u.state_delegate_name ? String(u.state_delegate_name) : undefined,
    stateCrest: u.state_crest ? String(u.state_crest) : "🏛️",
  };
}

export async function registerUser(
  username: string, 
  password: string, 
  adminCode?: string,
  accountType: "CITIZEN" | "STATE" = "CITIZEN",
  stateInfo?: {
    realmName?: string;
    motto?: string;
    delegateName?: string;
    crest?: string;
  }
): Promise<{ success: boolean; message?: string; user?: UserSession }> {
  await initDb();
  const db = getDb();

  const cleanUser = username.trim();
  if (cleanUser.length < 3) {
    return { success: false, message: "Username must be at least 3 characters" };
  }
  if (password.length < 6) {
    return { success: false, message: "Password must be at least 6 characters" };
  }

  const existing = await db.execute({
    sql: "SELECT id FROM users WHERE LOWER(username) = ?",
    args: [cleanUser.toLowerCase()],
  });

  if (existing.rows.length > 0) {
    return { success: false, message: "A citizen or sovereign state with this name is already registered." };
  }

  const id = `usr_${crypto.randomUUID().slice(0, 8)}`;
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  
  // Admin role granted if secret admin code matches
  const isAdmin = adminCode && adminCode.trim() === ADMIN_SECRET_CODE ? 1 : 0;
  let avatar = isAdmin ? "🏛️" : "🎩";
  let displayName = cleanUser;

  if (accountType === "STATE") {
    avatar = stateInfo?.crest || "🏛️";
    displayName = stateInfo?.realmName?.trim() || cleanUser;
  }

  // Balance starts at strictly 0.0 gold
  await db.execute({
    sql: `INSERT INTO users (
            id, username, password_hash, display_name, parlamentum_name, cash_balance, locked_cash, 
            avatar, is_admin, account_type, state_realm_name, state_motto, state_delegate_name, state_crest, created_at
          ) VALUES (?, ?, ?, ?, ?, 0.0, 0.0, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, 
      cleanUser, 
      passwordHash, 
      displayName, 
      stateInfo?.delegateName?.trim() || cleanUser, 
      avatar, 
      isAdmin,
      accountType,
      stateInfo?.realmName?.trim() || (accountType === "STATE" ? cleanUser : null),
      stateInfo?.motto?.trim() || null,
      stateInfo?.delegateName?.trim() || cleanUser,
      stateInfo?.crest || (accountType === "STATE" ? "🏛️" : null),
      now
    ],
  });

  await persistDbToBlob();

  try {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, await signSession(id), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  } catch {}

  return {
    success: true,
    user: {
      id,
      username: cleanUser,
      displayName,
      parlamentumName: stateInfo?.delegateName?.trim() || cleanUser,
      cashBalance: 0.0,
      lockedCash: 0.0,
      avatar,
      isAdmin: isAdmin === 1,
      isFrozen: false,
      accountType,
      stateRealmName: stateInfo?.realmName?.trim() || (accountType === "STATE" ? cleanUser : undefined),
      stateMotto: stateInfo?.motto?.trim() || undefined,
      stateDelegateName: stateInfo?.delegateName?.trim() || cleanUser,
      stateCrest: stateInfo?.crest || (accountType === "STATE" ? "🏛️" : undefined),
    },
  };
}

export async function loginUser(
  username: string, 
  password: string
): Promise<{ success: boolean; message?: string; user?: UserSession }> {
  await initDb();
  const cleanUser = username.trim();

  let db = getDb();
  let res = await db.execute({
    sql: "SELECT * FROM users WHERE LOWER(username) = ?",
    args: [cleanUser.toLowerCase()],
  });

  // If citizen not found in current container instance, sync from Blob and retry
  if (res.rows.length === 0) {
    await syncDbFromBlob(true);
    db = getDb();
    res = await db.execute({
      sql: "SELECT * FROM users WHERE LOWER(username) = ?",
      args: [cleanUser.toLowerCase()],
    });
  }

  if (res.rows.length === 0) {
    return { success: false, message: "Invalid citizen or state name, or password." };
  }

  const u = res.rows[0];
  const valid = await bcrypt.compare(password, String(u.password_hash));
  if (!valid) {
    return { success: false, message: "Invalid citizen or state name, or password." };
  }

  try {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, await signSession(String(u.id)), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
  } catch {}

  return {
    success: true,
    user: {
      id: String(u.id),
      username: String(u.username),
      displayName: String(u.display_name),
      parlamentumName: String(u.parlamentum_name || u.username),
      cashBalance: Number(u.cash_balance),
      lockedCash: Number(u.locked_cash),
      avatar: String(u.avatar || "👤"),
      isAdmin: Number(u.is_admin) === 1,
      isFrozen: Number(u.is_frozen || 0) === 1,
      accountType: (u.account_type as "CITIZEN" | "STATE") || "CITIZEN",
      stateRealmName: u.state_realm_name ? String(u.state_realm_name) : undefined,
      stateMotto: u.state_motto ? String(u.state_motto) : undefined,
      stateDelegateName: u.state_delegate_name ? String(u.state_delegate_name) : undefined,
      stateCrest: u.state_crest ? String(u.state_crest) : "🏛️",
    },
  };
}

export async function logoutUser(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
  } catch {}
  return true;
}

