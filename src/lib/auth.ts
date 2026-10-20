import { getDb, initDb, syncDbFromBlob, persistDbToBlob } from "./db";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import crypto from "crypto";
import { RECALIBRATED_CITIZENS, type RecalibratedInfo } from "./depositAdjustments";

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
  termsAccepted: boolean;
  adjustmentNoticeSeen?: boolean;
  // This player's deposit re-credit, sent only to them and only until they dismiss the notice
  adjustment?: RecalibratedInfo;
}

export const COOKIE_NAME = "parlamentum_session_id";
// Operator sign-up code comes from the environment; with ADMIN_SIGNUP_CODE unset nobody can self-register as admin.
const ADMIN_SECRET_CODE = process.env.ADMIN_SIGNUP_CODE || "";

// Session cookies are "<payload>.<hmac>" so a user id alone (shown in public shareholder lists) can't be used as a login.
// The payload is the user id, or "<userId>~<epoch>" once the password has been changed: changing it raises the epoch,
// which ends every older session. Prefer SESSION_SECRET from the environment; otherwise a random secret is generated
// once and kept in settings.
export async function getSessionSecret(): Promise<string> {
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

async function signSession(userId: string, epoch = 0): Promise<string> {
  const payload = epoch > 0 ? `${userId}~${epoch}` : userId;
  const sig = crypto.createHmac("sha256", await getSessionSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

async function verifySession(value: string): Promise<{ userId: string; epoch: number } | null> {
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const [userId, epochText] = value.slice(0, dot).split("~");
  const epoch = epochText === undefined ? 0 : Number(epochText);
  if (!userId || !Number.isInteger(epoch) || epoch < 0) return null;
  const expected = Buffer.from(await signSession(userId, epoch));
  const given = Buffer.from(value);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected) ? { userId, epoch } : null;
}

const SESSION_COOKIE = {
  path: "/",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

// Wrong passwords: at most 5 per name from one connection in 15 minutes, for both logging in and changing a password
const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60_000;
const attemptKey = (username: string, ip: string) => `${username.trim().toLowerCase()}|${ip}`;

async function tooManyFailures(key: string): Promise<boolean> {
  const res = await getDb().execute({ sql: "SELECT failures, window_start FROM login_attempts WHERE key = ?", args: [key] });
  if (res.rows.length === 0) return false;
  const r = res.rows[0];
  return Date.now() - Number(r.window_start) < FAILURE_WINDOW_MS && Number(r.failures) >= MAX_FAILURES;
}

async function recordFailure(key: string): Promise<void> {
  const now = Date.now();
  await getDb().execute({
    sql: `INSERT INTO login_attempts (key, failures, window_start) VALUES (?, 1, ?)
          ON CONFLICT(key) DO UPDATE SET
            failures = CASE WHEN ? - window_start >= ? THEN 1 ELSE failures + 1 END,
            window_start = CASE WHEN ? - window_start >= ? THEN ? ELSE window_start END`,
    args: [key, now, now, FAILURE_WINDOW_MS, now, FAILURE_WINDOW_MS, now],
  });
}

async function clearFailures(key: string): Promise<void> {
  await getDb().execute({ sql: "DELETE FROM login_attempts WHERE key = ?", args: [key] });
}

const TOO_MANY = "Too many wrong passwords. Wait 15 minutes and try again.";

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

  const session = await verifySession(userId);
  if (!session) {
    return null;
  }

  const res = await db.execute({
    sql: "SELECT * FROM users WHERE id = ?",
    args: [session.userId],
  });

  if (res.rows.length === 0) {
    return null;
  }

  const u = res.rows[0];
  // A password change since this cookie was issued ends the session
  if (Number(u.session_epoch || 0) !== session.epoch) {
    return null;
  }
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
    termsAccepted: Boolean(u.terms_accepted_at),
    adjustmentNoticeSeen: Boolean(u.deposit_adjustment_notice_seen_at),
    adjustment: u.deposit_adjustment_notice_seen_at ? undefined : RECALIBRATED_CITIZENS[String(u.id)],
  };
}

export async function registerUser(
  username: string, 
  password: string, 
  adminCode?: string,
  acceptedTerms?: boolean
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
  if (!acceptedTerms) {
    return { success: false, message: "You must accept the Terms & Conditions to register." };
  }

  const existing = await db.execute({
    sql: "SELECT id FROM users WHERE LOWER(username) = ?",
    args: [cleanUser.toLowerCase()],
  });

  if (existing.rows.length > 0) {
    return { success: false, message: "A citizen with this name is already registered." };
  }

  const id = `usr_${crypto.randomUUID().slice(0, 8)}`;
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  
  // Admin role granted if secret admin code matches
  const isAdmin = ADMIN_SECRET_CODE && adminCode && adminCode.trim() === ADMIN_SECRET_CODE ? 1 : 0;
  const avatar = isAdmin ? "🏛️" : "🎩";
  const displayName = cleanUser;

  // Balance starts at strictly 0.0 gold
  await db.execute({
    sql: `INSERT INTO users (
            id, username, password_hash, display_name, parlamentum_name, cash_balance, locked_cash, 
            avatar, is_admin, account_type, terms_accepted_at, created_at
          ) VALUES (?, ?, ?, ?, ?, 0.0, 0.0, ?, ?, 'CITIZEN', ?, ?)`,
    args: [
      id, 
      cleanUser, 
      passwordHash, 
      displayName, 
      cleanUser, 
      avatar, 
      isAdmin,
      now,
      now
    ],
  });

  await persistDbToBlob();

  try {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, await signSession(id), SESSION_COOKIE);
  } catch {}

  return {
    success: true,
    user: {
      id,
      username: cleanUser,
      displayName,
      parlamentumName: cleanUser,
      cashBalance: 0.0,
      lockedCash: 0.0,
      avatar,
      isAdmin: isAdmin === 1,
      isFrozen: false,
      termsAccepted: true,
    },
  };
}

export async function loginUser(
  username: string, 
  password: string,
  ip = "unknown"
): Promise<{ success: boolean; message?: string; user?: UserSession }> {
  await initDb();
  const cleanUser = username.trim();
  const attempts = attemptKey(cleanUser, ip);
  if (await tooManyFailures(attempts)) {
    return { success: false, message: TOO_MANY };
  }

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
    await recordFailure(attempts);
    return { success: false, message: "Invalid citizen name or password." };
  }

  const u = res.rows[0];
  const valid = await bcrypt.compare(password, String(u.password_hash));
  if (!valid) {
    await recordFailure(attempts);
    return { success: false, message: "Invalid citizen name or password." };
  }
  await clearFailures(attempts);

  try {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, await signSession(String(u.id), Number(u.session_epoch || 0)), SESSION_COOKIE);
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
      termsAccepted: Boolean(u.terms_accepted_at),
      adjustmentNoticeSeen: Boolean(u.deposit_adjustment_notice_seen_at),
    adjustment: u.deposit_adjustment_notice_seen_at ? undefined : RECALIBRATED_CITIZENS[String(u.id)],
    },
  };
}

export async function acceptTerms(userId: string): Promise<boolean> {
  await initDb();
  const db = getDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: "UPDATE users SET terms_accepted_at = ? WHERE id = ?",
    args: [now, userId],
  });
  await persistDbToBlob();
  return true;
}

export async function dismissAdjustmentNotice(userId: string): Promise<boolean> {
  await initDb();
  const db = getDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: "UPDATE users SET deposit_adjustment_notice_seen_at = ? WHERE id = ?",
    args: [now, userId],
  });
  await persistDbToBlob();
  return true;
}

export async function logoutUser(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
  } catch {}
  return true;
}


// Changes a password from the login screen (no session needed: the current password proves it) or from the account.
// Every other session of the account ends; this browser is logged in with the new one.
export async function changePassword(
  username: string,
  currentPassword: string,
  newPassword: string,
  ip = "unknown"
): Promise<{ success: boolean; message: string }> {
  await initDb();
  const db = getDb();
  const attempts = attemptKey(String(username || ""), ip);
  if (await tooManyFailures(attempts)) {
    return { success: false, message: TOO_MANY };
  }

  if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 200) {
    return { success: false, message: "The new password needs at least 8 characters." };
  }

  const res = await db.execute({
    sql: "SELECT id, password_hash, session_epoch FROM users WHERE LOWER(username) = ?",
    args: [String(username || "").trim().toLowerCase()],
  });
  const wrong = { success: false, message: "That name and current password don't match." };
  if (res.rows.length === 0) {
    await recordFailure(attempts);
    return wrong;
  }

  const u = res.rows[0];
  const oldHash = String(u.password_hash);
  if (!(await bcrypt.compare(String(currentPassword || ""), oldHash))) {
    await recordFailure(attempts);
    return wrong;
  }
  await clearFailures(attempts);
  if (await bcrypt.compare(newPassword, oldHash)) {
    return { success: false, message: "Pick a password different from the current one." };
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  // Only if the password is still the one just checked, so two changes at once can't both apply
  const upd = await db.execute({
    sql: "UPDATE users SET password_hash = ?, session_epoch = COALESCE(session_epoch, 0) + 1 WHERE id = ? AND password_hash = ?",
    args: [newHash, String(u.id), oldHash],
  });
  if (upd.rowsAffected === 0) {
    return { success: false, message: "The password was just changed. Log in with the new one." };
  }

  await persistDbToBlob();

  try {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, await signSession(String(u.id), Number(u.session_epoch || 0) + 1), SESSION_COOKIE);
  } catch {}

  return { success: true, message: "Password changed. Any other device that was logged in has been logged out." };
}

// ---------- reset codes ----------

// The operator makes a one-time code for a player who can't use their password (or whose password was set for them),
// sends it privately, and the player sets their own password with it from the login screen. Codes last 24 hours, work
// once, and only their hash is stored. Making a new code cancels the player's older unused ones.
const RESET_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I: easy to read out
const RESET_TTL_MS = 24 * 3_600_000;
const hashCode = (code: string) => crypto.createHash("sha256").update(code.replace(/[^A-Z0-9]/gi, "").toUpperCase()).digest("hex");

export async function createResetCode(userId: string, operatorId: string): Promise<{ success: boolean; message: string; code?: string; username?: string; expiresAt?: string }> {
  await initDb();
  const db = getDb();
  const u = await db.execute({ sql: "SELECT id, username FROM users WHERE id = ?", args: [userId] });
  if (u.rows.length === 0 || String(u.rows[0].id) === "usr_treasury") return { success: false, message: "Player not found." };

  // 12 characters from a 32-letter alphabet: 60 random bits, written as XXXX-XXXX-XXXX
  const bytes = crypto.randomBytes(12);
  const raw = Array.from(bytes, (b) => RESET_ALPHABET[b % 32]).join("");
  const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
  const now = Date.now();

  await db.batch(
    [
      { sql: "UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL", args: [now, userId] },
      {
        sql: "INSERT INTO password_resets (code_hash, user_id, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
        args: [hashCode(code), userId, operatorId, now, now + RESET_TTL_MS],
      },
    ],
    "write"
  );
  await persistDbToBlob();
  return {
    success: true,
    message: "Reset code made. Send it privately; it works once.",
    code,
    username: String(u.rows[0].username),
    expiresAt: new Date(now + RESET_TTL_MS).toISOString(),
  };
}

export async function resetPasswordWithCode(
  username: string,
  code: string,
  newPassword: string,
  ip = "unknown"
): Promise<{ success: boolean; message: string }> {
  await initDb();
  const db = getDb();
  const attempts = attemptKey(String(username || ""), ip);
  if (await tooManyFailures(attempts)) {
    return { success: false, message: TOO_MANY };
  }
  if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 200) {
    return { success: false, message: "The new password needs at least 8 characters." };
  }

  const u = await db.execute({
    sql: "SELECT id, password_hash, session_epoch FROM users WHERE LOWER(username) = ?",
    args: [String(username || "").trim().toLowerCase()],
  });
  const wrong = { success: false, message: "That name and reset code don't match, or the code has run out or was used." };
  if (u.rows.length === 0) {
    await recordFailure(attempts);
    return wrong;
  }
  const user = u.rows[0];
  const now = Date.now();

  // Use the code up first (only one request can), then set the password and end every other session
  const claim = await db.execute({
    sql: "UPDATE password_resets SET used_at = ? WHERE code_hash = ? AND user_id = ? AND used_at IS NULL AND expires_at > ?",
    args: [now, hashCode(String(code || "")), String(user.id), now],
  });
  if (claim.rowsAffected === 0) {
    await recordFailure(attempts);
    return wrong;
  }
  await clearFailures(attempts);

  const newHash = await bcrypt.hash(newPassword, 10);
  await db.execute({
    sql: "UPDATE users SET password_hash = ?, session_epoch = COALESCE(session_epoch, 0) + 1 WHERE id = ?",
    args: [newHash, String(user.id)],
  });
  await persistDbToBlob();

  const epoch = await db.execute({ sql: "SELECT session_epoch FROM users WHERE id = ?", args: [String(user.id)] });
  try {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, await signSession(String(user.id), Number(epoch.rows[0]?.session_epoch || 0)), SESSION_COOKIE);
  } catch {}

  return { success: true, message: "Password set. Any other device that was logged in has been logged out." };
}
