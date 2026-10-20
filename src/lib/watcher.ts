// The watcher: reads the House's own side of Parlamentum with the House's game login and credits Raw Iron deposits by
// itself. The game's trade ledger names the buyer of every unit of the House's deposit iron, and an accepted deposit
// contract names its sender; each is credited to the exchange account of the same in-game name, once (a deposit keeps
// the id of the game trade it came from, and the database lets one trade pay one deposit). It never writes to the game.
// Server-only. Ported from The Back Room casino's watcher.
import crypto from "crypto";
import { getDb, initDb, scheduleBlobPersist } from "./db";
import { getSetting, setSetting, IRON_UNIT_PRICE } from "./wallet";
import { getSessionSecret } from "./auth";

const GAME = (process.env.GAME_URL || "https://parlamentum.org").replace(/\/+$/, "");
/** At most one look at the game this often, across every server instance. */
export const WATCH_EVERY_MS = 60_000;
/** Warnings: the deposit listing runs this low or ends this soon, or the game login ends this soon. */
const LOW_STOCK = 200;
const ENDS_SOON_MS = 12 * 3_600_000;
const LOGIN_SOON_MS = 2 * 86_400_000;

// ---------- the login, sealed ----------

const sealKey = async () => crypto.createHash("sha256").update(`${await getSessionSecret()}:watcher`).digest();

async function seal(text: string): Promise<string> {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", await sealKey(), iv);
  const body = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

async function unseal(sealed: string): Promise<string | null> {
  try {
    const [iv, tag, body] = sealed.split(".").map((x) => Buffer.from(x, "base64url"));
    const d = crypto.createDecipheriv("aes-256-gcm", await sealKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(body), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** When a game login (a JSON web token) runs out, read from the token itself; null if it is not one. */
export function loginEnds(token: string): Date | null {
  const parts = token.split(".");
  if (parts.length !== 3 || token.length > 4_000) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof claims?.exp === "number" ? new Date(claims.exp * 1000) : null;
  } catch {
    return null;
  }
}

/** The operator sets the login the watcher reads with, or (null) stops it. Trades from before the first login stay the
 *  operator's to credit by hand, as they always were. */
export async function setLogin(token: string | null): Promise<void> {
  await initDb();
  if (token === null) {
    await setSetting("watcher_token", "");
    await setSetting("watcher_token_exp", "");
    await setSetting("watcher_error", "");
    return;
  }
  const ends = loginEnds(token);
  await setSetting("watcher_token", await seal(token));
  await setSetting("watcher_token_exp", ends ? ends.toISOString() : "");
  if (!(await getSetting("watcher_since", ""))) await setSetting("watcher_since", new Date().toISOString());
  await setSetting("watcher_house_id", "");
  await setSetting("watcher_checked_at", "0");
  await setSetting("watcher_error", "");
}

export async function watcherOn(): Promise<boolean> {
  await initDb();
  return (await getSetting("watcher_token", "")) !== "";
}

// ---------- reading the game ----------

/** Why the watcher can't look right now, in words for the operator panel. */
class Off extends Error {}
function changed(what: string): never {
  throw new Off(`The game's ${what} came back in a shape the watcher doesn't know. The game may have changed; the watcher stopped crediting until it is updated.`);
}

async function game(path: string, token: string): Promise<unknown> {
  let r: Response;
  try {
    r = await fetch(GAME + path, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Off("The game didn't answer.");
  }
  if (r.status === 401) throw new Off("The game login has run out or was revoked. Paste a fresh one.");
  if (r.status === 403 || r.status === 429) throw new Off(`The game refused the request (${r.status}). It will try again in a minute.`);
  if (!r.ok) throw new Off(`The game answered with an error (${r.status}).`);
  if (!(r.headers.get("content-type") ?? "").includes("json")) throw new Off("The game answered with a web page instead of data.");
  try {
    return await r.json();
  } catch {
    throw new Off("The game's answer couldn't be read.");
  }
}

type Row = Record<string, unknown>;
const str = (v: unknown): v is string => typeof v === "string";
const digits = (v: unknown): v is string => str(v) && /^\d{1,15}$/.test(v);
const when = (v: unknown): v is string => str(v) && !Number.isNaN(Date.parse(v));
const rec = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** A deposit seen in the game. Gold figures are in gold (the game counts hundredths); `gold` is what it credits. */
interface Seen {
  id: string;
  kind: "market" | "contract";
  at: string;
  units: number | null;
  gross: number;
  tax: number;
  gold: number;
  name: string;
}

/** Buys of the deposit iron from the trade ledger: sold on the global market, at the deposit price, to a named buyer.
 *  The purse gets what the House kept after the game's export tax (the "net gold received" rule). */
function ironBuys(v: unknown, priceCents: number, item: string, exportTaxPct: number): Seen[] {
  const rows = rec(v) ? v.rows : null;
  if (!Array.isArray(rows)) changed("trade ledger");
  const out: Seen[] = [];
  for (const t of rows as unknown[]) {
    if (!rec(t) || !str(t.id) || !when(t.at) || !str(t.book) || !str(t.side) || !str(t.itemType) || !str(t.currency)
      || !(t.counterparty === null || str(t.counterparty)) || !digits(t.quantity) || !digits(t.pricePerUnit)) changed("trade ledger");
    const r = t as Row & { id: string; at: string; quantity: string; pricePerUnit: string; counterparty: string | null };
    if (r.book !== "GLOBAL" || r.side !== "SOLD" || r.itemType !== item || r.currency !== "GOLD" || Number(r.pricePerUnit) !== priceCents || !r.counterparty) continue;
    const units = Number(r.quantity);
    // The ledger gives the game's own figures in hundredths: `total` and `taxPaid` (the export tax the House paid).
    // Without them, the game's rules: total = units × price, tax rounded down and at least a hundredth.
    const grossCents = digits(r.total) ? Number(r.total) : units * priceCents;
    const taxCents = digits(r.taxPaid)
      ? Number(r.taxPaid)
      : exportTaxPct > 0
      ? Math.max(1, Math.floor((grossCents * exportTaxPct) / 100))
      : 0;
    out.push({
      id: `trade:${r.id}`,
      kind: "market",
      at: new Date(r.at).toISOString(),
      units,
      gross: grossCents / 100,
      tax: taxCents / 100,
      gold: Math.max(0, grossCents - taxCents) / 100,
      name: r.counterparty.trim(),
    });
  }
  return out;
}

/** Accepted deposit contracts: sent to the House, gold from the sender and nothing else, Raw Iron back from the House.
 *  Contracts pay no tax, so the purse gets all of the gold. */
function depositContracts(v: unknown, houseId: string, item: string): Seen[] {
  if (!Array.isArray(v)) changed("contract list");
  const out: Seen[] = [];
  for (const c of v as unknown[]) {
    if (!rec(c) || !str(c.id) || !str(c.status) || !(c.respondedAt === null || when(c.respondedAt)) || !rec(c.proposer) || !rec(c.receiver)
      || !str(c.proposer.id) || !str(c.proposer.name) || !str(c.receiver.id) || !Array.isArray(c.lines)) changed("contract list");
    const lines = c.lines as unknown[];
    if (lines.some((l) => !rec(l) || !str(l.side) || !str(l.asset) || !digits(l.amount))) changed("contract list");
    const ls = lines as { side: string; asset: string; amount: string; itemType?: unknown }[];
    if (c.status !== "ACCEPTED" || !c.respondedAt || (c.receiver as Row).id !== houseId) continue;
    const given = ls.filter((l) => l.side === "PROPOSER");
    const back = ls.filter((l) => l.side === "RECEIVER");
    if (!given.length || given.some((l) => l.asset !== "GOLD") || !back.length || back.some((l) => l.asset !== "ITEM" || l.itemType !== item)) continue;
    const cents = given.reduce((t, l) => t + Number(l.amount), 0);
    out.push({
      id: `contract:${c.id}`,
      kind: "contract",
      at: new Date(c.respondedAt as string).toISOString(),
      units: null,
      gross: cents / 100,
      tax: 0,
      gold: cents / 100,
      name: String((c.proposer as Row).name).trim(),
    });
  }
  return out;
}

/** The deposit listing: the House's live Raw Iron on the global market at the deposit price. */
function depositListing(v: unknown, priceCents: number, item: string): { remaining: number; endsAt: string } | null {
  if (!Array.isArray(v)) changed("listing list");
  let best: { remaining: number; endsAt: string } | null = null;
  for (const l of v as unknown[]) {
    if (!rec(l) || !str(l.itemType) || !digits(l.pricePerUnit) || !digits(l.remaining) || !when(l.expiresAt)) changed("listing list");
    const x = l as Row & { itemType: string; pricePerUnit: string; remaining: string; expiresAt: string };
    if (x.itemType !== item || Number(x.pricePerUnit) !== priceCents || x.expired === true || x.cancelledAt || Date.parse(x.expiresAt) <= Date.now()) continue;
    if (!best || Number(x.remaining) > best.remaining) best = { remaining: Number(x.remaining), endsAt: new Date(x.expiresAt).toISOString() };
  }
  return best;
}

// ---------- crediting ----------

/** Credits one game trade to an account, all of it or none: one batch (a single write transaction) takes the trade,
 *  settles the player's oldest announced deposit with what was really paid (or writes a new deposit line), and pays the
 *  purse. Every statement after the first only acts if this run's claim on the trade is the one stored, so a second
 *  look at the same trade changes nothing. */
async function creditSale(s: Seen & { user: string }): Promise<boolean> {
  const db = getDb();
  const claim = crypto.randomUUID();
  const now = new Date().toISOString();
  const note =
    s.kind === "market"
      ? `Bought ${s.units} Raw Iron for ${s.gross} gold (${s.gold} after the game's tax); credited by the watcher`
      : `Sent ${s.gold} gold by contract; credited by the watcher`;
  const mine = "EXISTS (SELECT 1 FROM game_sales WHERE id = ? AND claim = ?)";
  const res = await db.batch(
    [
      { sql: "UPDATE game_sales SET state = 'deposit', user_id = ?, claim = ?, reason = NULL WHERE id = ? AND state = 'open'", args: [s.user, claim, s.id] },
      {
        sql: `UPDATE wallet_transactions SET amount = ?, status = 'CREDITED', game_sale = ?, recipe_note = COALESCE(recipe_note, '') || ?
              WHERE id = (SELECT id FROM wallet_transactions WHERE user_id = ? AND type = 'DEPOSIT' AND status = 'PENDING' ORDER BY created_at LIMIT 1)
                AND ${mine}`,
        args: [s.gold, s.id, ` | ${note}`, s.user, s.id, claim],
      },
      {
        sql: `INSERT INTO wallet_transactions (id, user_id, type, method, amount, iron_units, parlamentum_name, status, recipe_note, created_at, game_sale)
              SELECT ?, ?, 'DEPOSIT', 'WATCHER', ?, ?, ?, 'CREDITED', ?, ?, ?
              WHERE ${mine} AND NOT EXISTS (SELECT 1 FROM wallet_transactions WHERE game_sale = ?)`,
        args: [`tx_${crypto.randomUUID().slice(0, 8)}`, s.user, s.gold, s.units || 0, s.name, note, now, s.id, s.id, claim, s.id],
      },
      { sql: `UPDATE users SET cash_balance = ROUND(cash_balance + ?, 2) WHERE id = ? AND ${mine}`, args: [s.gold, s.user, s.id, claim] },
    ],
    "write"
  );
  return res[0].rowsAffected === 1;
}

/** Credits every open trade to the account with the buyer's (or sender's) in-game name. A trade nobody here can claim
 *  stays on the operator's list as not a deposit. A deposit the operator already credited by hand for this trade (the
 *  same player and Raw Iron, or the same gold by contract) is taken as its payment, so it is never paid twice. So is a
 *  raise in the balance editor made after the trade for exactly its gold, before or after the tax. */
async function settleOpen(): Promise<void> {
  const db = getDb();
  const open = await db.execute("SELECT * FROM game_sales WHERE state = 'open' ORDER BY at, id");
  for (const row of open.rows) {
    const s: Seen = {
      id: String(row.id),
      kind: String(row.kind) as Seen["kind"],
      at: String(row.at),
      units: row.units === null ? null : Number(row.units),
      gross: Number(row.gross),
      tax: Number(row.tax),
      gold: Number(row.gold),
      name: String(row.name),
    };
    try {
      const key = s.name.toLowerCase();
      const u = await db.execute({
        sql: `SELECT id, is_admin FROM users WHERE LOWER(parlamentum_name) = ? OR LOWER(username) = ?
              ORDER BY CASE WHEN LOWER(parlamentum_name) = ? THEN 0 ELSE 1 END, created_at LIMIT 1`,
        args: [key, key, key],
      });
      if (u.rows.length === 0 || Number(u.rows[0].is_admin) === 1) {
        await db.execute({
          sql: "UPDATE game_sales SET state = 'other', reason = ? WHERE id = ? AND state = 'open'",
          args: [u.rows.length ? "operator account" : "no exchange account with this name", s.id],
        });
        continue;
      }
      const user = String(u.rows[0].id);

      // Paid by hand already? Link that deposit to this trade instead of paying again (one batch, claim first)
      const claim = crypto.randomUUID();
      const sameDeposit = `user_id = ? AND type = 'DEPOSIT' AND game_sale IS NULL AND (
          (status = 'CREDITED' AND ${s.kind === "market" ? "iron_units = ?" : "ABS(amount - ?) < 0.005"} AND created_at >= ?)
          OR (status = 'COMPLETED' AND method = 'OPERATOR_ADJUSTMENT' AND (ABS(amount - ?) < 0.005 OR ABS(amount - ?) < 0.005) AND created_at >= ?))`;
      const matchArgs = [
        user,
        s.kind === "market" ? s.units : s.gold,
        new Date(Date.parse(s.at) - 2 * 86_400_000).toISOString(),
        s.gross,
        s.gold,
        new Date(Date.parse(s.at)).toISOString(),
      ];
      const byHand = await db.batch(
        [
          {
            sql: `UPDATE game_sales SET state = 'deposit', reason = 'credited by hand', user_id = ?, claim = ?
                  WHERE id = ? AND state = 'open' AND EXISTS (SELECT 1 FROM wallet_transactions WHERE ${sameDeposit})`,
            args: [user, claim, s.id, ...matchArgs],
          },
          {
            sql: `UPDATE wallet_transactions SET game_sale = ?
                  WHERE id = (SELECT id FROM wallet_transactions WHERE ${sameDeposit} ORDER BY created_at LIMIT 1)
                    AND EXISTS (SELECT 1 FROM game_sales WHERE id = ? AND claim = ?)`,
            args: [s.id, ...matchArgs, s.id, claim],
          },
        ],
        "write"
      );
      if (byHand[0].rowsAffected === 1) continue;

      await creditSale({ ...s, user });
    } catch (err) {
      // One odd trade never stops the others; it is tried again on the next look
      console.error("watcher: trade", s.id, err);
    }
  }
}

/** One look at the game, if a minute has passed since the last (or at once, with `force`): new iron buys and deposit
 *  contracts are remembered and credited to the account of the same name; the deposit listing is read for warnings.
 *  Whatever stops it is kept for the operator panel. */
export async function watch(force = false): Promise<void> {
  await initDb();
  const db = getDb();
  const sealed = await getSetting("watcher_token", "");
  if (!sealed) return;

  // Claim the look in one statement, so parallel triggers (and server instances) look once
  const now = Date.now();
  await db.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('watcher_checked_at', '0')");
  const slot = await db.execute({
    sql: "UPDATE settings SET value = ? WHERE key = 'watcher_checked_at' AND (? = 1 OR CAST(value AS INTEGER) <= ?)",
    args: [String(now), force ? 1 : 0, now - WATCH_EVERY_MS],
  });
  if (slot.rowsAffected === 0) return;

  const token = await unseal(sealed);
  if (!token) {
    await setSetting("watcher_error", "The saved game login can't be read (SESSION_SECRET may have changed). Paste it again.");
    return;
  }

  try {
    let houseId = await getSetting("watcher_house_id", "");
    if (!houseId) {
      const me = await game("/api/me", token);
      if (!rec(me) || !str(me.id)) changed("player profile");
      houseId = (me as Row).id as string;
    }
    const item = (await getSetting("watcher_item", "IRON_RAW")).trim() || "IRON_RAW";
    const exportTax = Number(await getSetting("house_export_tax", "5"));
    const priceCents = Math.round(IRON_UNIT_PRICE * 100);
    const [ledger, contracts, listings] = await Promise.all([
      game("/api/trade/ledger", token),
      game("/api/contracts?box=history", token),
      game("/api/global-market/mine", token),
    ]);
    const seen = [
      ...ironBuys(ledger, priceCents, item, Number.isFinite(exportTax) ? Math.max(0, Math.min(50, exportTax)) : 5),
      ...depositContracts(contracts, houseId, item),
    ];
    const listing = depositListing(listings, priceCents, item);
    const since = Date.parse((await getSetting("watcher_since", "")) || new Date().toISOString());

    // Each trade is remembered once, by the game's own id; those from before the watcher started stay the operator's
    for (const s of seen) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO game_sales (id, kind, at, units, gross, tax, gold, name, state, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [s.id, s.kind, s.at, s.units, round2(s.gross), round2(s.tax), round2(s.gold), s.name, Date.parse(s.at) < since ? "old" : "open", new Date().toISOString()],
      });
    }
    await settleOpen();

    await setSetting("watcher_house_id", houseId);
    await setSetting("watcher_ok_at", new Date().toISOString());
    await setSetting("watcher_error", "");
    await setSetting("watcher_listing", listing ? JSON.stringify(listing) : "");
    scheduleBlobPersist();
  } catch (err) {
    if (!(err instanceof Off)) console.error("watcher", err);
    await setSetting("watcher_error", err instanceof Off ? err.message : "The watcher hit an unexpected error. See the server log.");
  }
}

// ---------- what the operator sees ----------

export interface WatchView {
  on: boolean;
  error: string | null;
  okAt: string | null;
  loginEnds: string | null;
  since: string | null;
  item: string;
  exportTax: number;
  listing: { remaining: number; endsAt: string } | null;
  warnings: string[];
  sales: { id: string; kind: "market" | "contract"; at: string; units: number | null; gross: number; gold: number; name: string; state: string; reason: string | null }[];
}

const utc = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC";

export async function watchView(): Promise<WatchView> {
  await initDb();
  const db = getDb();
  const [token, exp, since, okAt, error, listingText, item, exportTax, sales] = await Promise.all([
    getSetting("watcher_token", ""),
    getSetting("watcher_token_exp", ""),
    getSetting("watcher_since", ""),
    getSetting("watcher_ok_at", ""),
    getSetting("watcher_error", ""),
    getSetting("watcher_listing", ""),
    getSetting("watcher_item", "IRON_RAW"),
    getSetting("house_export_tax", "5"),
    db.execute("SELECT id, kind, at, units, gross, gold, name, state, reason FROM game_sales WHERE state <> 'old' ORDER BY at DESC, id LIMIT 30"),
  ]);
  const on = token !== "";
  const now = Date.now();
  const listing = listingText ? (JSON.parse(listingText) as WatchView["listing"]) : null;
  const ends = exp ? Date.parse(exp) : null;
  const warnings: string[] = [];
  if (on && ends !== null && ends - now < LOGIN_SOON_MS) {
    warnings.push(ends <= now ? "The game login has run out: paste a fresh one." : `The game login runs out ${utc(ends)}: paste a fresh one before then.`);
  }
  if (on && okAt && !error) {
    if (!listing) warnings.push(`No Raw Iron listed at ${IRON_UNIT_PRICE} gold: players can't deposit until you list some.`);
    else {
      if (listing.remaining < LOW_STOCK) warnings.push(`Only ${listing.remaining.toLocaleString("en-US")} Raw Iron left on the deposit listing.`);
      if (Date.parse(listing.endsAt) - now < ENDS_SOON_MS) warnings.push(`The deposit listing ends ${utc(Date.parse(listing.endsAt))}.`);
    }
  }
  if (on && okAt && now - Date.parse(okAt) > 3_600_000) warnings.push(`No good look at the game since ${utc(Date.parse(okAt))}.`);
  return {
    on,
    error: on && error ? error : null,
    okAt: okAt || null,
    loginEnds: ends ? new Date(ends).toISOString() : null,
    since: since || null,
    item,
    exportTax: Number(exportTax),
    listing,
    warnings,
    sales: sales.rows.map((s) => ({
      id: String(s.id),
      kind: String(s.kind) as "market" | "contract",
      at: String(s.at),
      units: s.units === null ? null : Number(s.units),
      gross: Number(s.gross),
      gold: Number(s.gold),
      name: String(s.name),
      state: String(s.state),
      reason: s.reason ? String(s.reason) : null,
    })),
  };
}

// ---------- when it looks ----------

/** Pages give the watcher a chance to look (it skips if it looked within the minute); this instance also skips the
 *  database for a while after its own last try. Meant for next/server's after(). */
let lastTry = 0;
export async function maybeWatch(): Promise<void> {
  if (Date.now() - lastTry < WATCH_EVERY_MS / 3) return;
  lastTry = Date.now();
  if (!(await watcherOn())) return;
  await watch().catch((err) => console.error("watcher", err));
}
