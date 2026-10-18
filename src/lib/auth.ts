import { getDb, initDb } from "./db";
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
}

export const COOKIE_NAME = "parlamentum_session_id";
export const ADMIN_SECRET_CODE = "parlamentum_admin";

export async function getCurrentUser(): Promise<UserSession | null> {
  await initDb();
  const db = getDb();
  let userId: string | undefined;

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
  };
}

export async function registerUser(
  username: string, 
  password: string, 
  adminCode?: string
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
    return { success: false, message: "A citizen with this Parlamentum name is already registered." };
  }

  const id = `usr_${crypto.randomUUID().slice(0, 8)}`;
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  
  // Admin role granted if secret admin code matches
  const isAdmin = adminCode && adminCode.trim() === ADMIN_SECRET_CODE ? 1 : 0;
  const avatar = isAdmin ? "🏛️" : "🎩";

  // Balance starts at strictly 0.0 gold
  await db.execute({
    sql: `INSERT INTO users (id, username, password_hash, display_name, parlamentum_name, cash_balance, locked_cash, avatar, is_admin, created_at)
          VALUES (?, ?, ?, ?, ?, 0.0, 0.0, ?, ?, ?)`,
    args: [id, cleanUser, passwordHash, cleanUser, cleanUser, avatar, isAdmin, now],
  });

  try {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, id, {
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
      displayName: cleanUser,
      parlamentumName: cleanUser,
      cashBalance: 0.0,
      lockedCash: 0.0,
      avatar,
      isAdmin: isAdmin === 1,
      isFrozen: false,
    },
  };
}

export async function loginUser(
  username: string, 
  password: string
): Promise<{ success: boolean; message?: string; user?: UserSession }> {
  await initDb();
  const db = getDb();

  const cleanUser = username.trim();

  const res = await db.execute({
    sql: "SELECT * FROM users WHERE LOWER(username) = ?",
    args: [cleanUser.toLowerCase()],
  });

  if (res.rows.length === 0) {
    return { success: false, message: "Invalid citizen name or password." };
  }

  const u = res.rows[0];
  const valid = await bcrypt.compare(password, String(u.password_hash));
  if (!valid) {
    return { success: false, message: "Invalid citizen name or password." };
  }

  try {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, String(u.id), {
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

export async function switchDemoUser(userId: string): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, userId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
  } catch {}
  return true;
}

export async function depositCash(userId: string, amount: number): Promise<void> {
  await initDb();
  const db = getDb();
  await db.execute({
    sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?",
    args: [amount, userId],
  });
}

