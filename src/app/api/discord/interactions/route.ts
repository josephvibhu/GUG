import { NextResponse } from "next/server";
import crypto from "crypto";
import { getDb, initDb } from "@/lib/db";
import { getSetting } from "@/lib/wallet";

export const dynamic = "force-dynamic";

// Discord Interaction Types
const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
};

// Discord Callback Response Types
const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
};

const DEFAULT_DISCORD_PUBLIC_KEY = "4a6639de9613fbdda1a5337c517cdb4835fe116a9fc6934215596b90eb938265";

function verifyDiscordSignature(
  publicKeyHex: string,
  signatureHex: string,
  timestamp: string,
  rawBody: string
): boolean {
  try {
    if (!publicKeyHex || !signatureHex || !timestamp) return false;
    const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
    const fullSpki = Buffer.concat([spkiPrefix, Buffer.from(publicKeyHex, "hex")]);
    const keyObj = crypto.createPublicKey({ key: fullSpki, format: "der", type: "spki" });
    const msg = Buffer.concat([Buffer.from(timestamp), Buffer.from(rawBody)]);
    return crypto.verify(null, msg, keyObj, Buffer.from(signatureHex, "hex"));
  } catch (err) {
    console.error("Discord signature verification failed:", err);
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-signature-ed25519") || "";
    const timestamp = req.headers.get("x-signature-timestamp") || "";

    // 1. Get Discord Public Key from DB or env, fallback to default
    let discordPublicKey = (process.env.DISCORD_PUBLIC_KEY || "").trim();
    if (!discordPublicKey) {
      try {
        discordPublicKey = (await getSetting("discord_public_key", DEFAULT_DISCORD_PUBLIC_KEY)).trim();
      } catch {
        discordPublicKey = DEFAULT_DISCORD_PUBLIC_KEY;
      }
    }
    if (!discordPublicKey) discordPublicKey = DEFAULT_DISCORD_PUBLIC_KEY;

    // Verify signature
    const isValid = verifyDiscordSignature(discordPublicKey, signature, timestamp, rawBody);
    if (!isValid) {
      return new NextResponse("Invalid request signature", { status: 401 });
    }

    const interaction = JSON.parse(rawBody);

    // 2. Handle PING (Discord endpoint validation challenge)
    if (interaction.type === InteractionType.PING) {
      return NextResponse.json({ type: InteractionResponseType.PONG });
    }
      return NextResponse.json({ type: InteractionResponseType.PONG });
    }

    // 3. Handle Application Slash Commands
    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      await initDb();
      const db = getDb();
      const commandName = interaction.data?.name;
      const options = interaction.data?.options || [];

      // Check subcommands or direct options
      let subcommand = "";
      let subOptions = options;

      if (options.length > 0 && options[0].type === 1) {
        subcommand = options[0].name;
        subOptions = options[0].options || [];
      }

      // === COMMAND 1: /gug price <ticker> ===
      if (subcommand === "price" || commandName === "price") {
        const tickerParam = (
          subOptions.find((o: any) => o.name === "ticker")?.value || "GUG"
        ).toUpperCase().trim();

        const compRes = await db.execute({
          sql: `SELECT * FROM companies WHERE ticker = ?`,
          args: [tickerParam],
        });

        if (compRes.rows.length === 0) {
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ Company ticker **$${tickerParam}** was not found on the Grow UR Gold exchange.`,
            },
          });
        }

        const comp: any = compRes.rows[0];
        const price = Number(comp.current_price) || 0;
        const change24h = Number(comp.change_24h) || 0;
        const high24h = Number(comp.high_24h) || price;
        const low24h = Number(comp.low_24h) || price;
        const volume24h = Number(comp.volume_24h) || 0;
        const marketCap = (Number(comp.total_shares) || 10000) * price;

        // Fetch best bid & ask
        const bidRes = await db.execute({
          sql: "SELECT MAX(price) as best_bid FROM orders WHERE company_id = ? AND type = 'BUY' AND status IN ('OPEN', 'PARTIAL')",
          args: [comp.id],
        });
        const askRes = await db.execute({
          sql: "SELECT MIN(price) as best_ask FROM orders WHERE company_id = ? AND type = 'SELL' AND status IN ('OPEN', 'PARTIAL')",
          args: [comp.id],
        });

        const bestBid = bidRes.rows[0]?.best_bid ? Number(bidRes.rows[0].best_bid).toFixed(2) + "g" : "None";
        const bestAsk = askRes.rows[0]?.best_ask ? Number(askRes.rows[0].best_ask).toFixed(2) + "g" : "None";
        const isUp = change24h >= 0;
        const color = isUp ? 0x10b981 : 0xf43f5e;

        return NextResponse.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [
              {
                title: `${comp.logo_url || "🏛️"} ${comp.name} ($${comp.ticker})`,
                url: `https://growurgold.vercel.app/trade/${comp.ticker}`,
                color,
                description: `Live quote from the Parlamentum Bourse 24/7 trading floor.`,
                fields: [
                  { name: "Current Price", value: `**${price.toFixed(2)} gold**`, inline: true },
                  { name: "24h Move", value: `${isUp ? "+" : ""}${change24h.toFixed(2)}%`, inline: true },
                  { name: "Market Cap", value: `${marketCap.toLocaleString()} gold`, inline: true },
                  { name: "Best Bid", value: bestBid, inline: true },
                  { name: "Best Ask", value: bestAsk, inline: true },
                  { name: "24h Volume", value: `${volume24h.toLocaleString()} shares`, inline: true },
                  { name: "24h High / Low", value: `${high24h.toFixed(2)}g / ${low24h.toFixed(2)}g`, inline: false },
                ],
                footer: {
                  text: "Grow UR Gold • Continuous 24/7 Floor",
                },
                timestamp: new Date().toISOString(),
              },
            ],
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    style: 5,
                    label: `Trade $${comp.ticker}`,
                    url: `https://growurgold.vercel.app/trade/${comp.ticker}`,
                  },
                  {
                    type: 2,
                    style: 5,
                    label: "View Shareholder Card",
                    url: `https://growurgold.vercel.app/api/badge/${comp.ticker}/${comp.creator_name || "JosephArora"}`,
                  },
                ],
              },
            ],
          },
        });
      }

      // === COMMAND 2: /gug portfolio <citizen> ===
      if (subcommand === "portfolio" || commandName === "portfolio") {
        const citizenParam = (
          subOptions.find((o: any) => o.name === "citizen")?.value || ""
        ).trim();

        if (!citizenParam) {
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              flags: 64, // Ephemeral
              content: "Please provide a citizen username: `/gug portfolio <citizen>`",
            },
          });
        }

        const userRes = await db.execute({
          sql: "SELECT id, username, display_name, cash_balance FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(parlamentum_name) = LOWER(?)",
          args: [citizenParam, citizenParam],
        });

        if (userRes.rows.length === 0) {
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              flags: 64,
              content: `❌ Citizen **@${citizenParam}** was not found on Grow UR Gold.`,
            },
          });
        }

        const user: any = userRes.rows[0];
        const purse = Number(user.cash_balance) || 0;

        const holdingsRes = await db.execute({
          sql: `SELECT p.shares, c.ticker, c.name, c.current_price 
                FROM portfolios p JOIN companies c ON p.company_id = c.id 
                WHERE p.user_id = ? AND p.shares > 0`,
          args: [user.id],
        });

        let totalStockValue = 0;
        const lines: string[] = [];

        for (const h of holdingsRes.rows) {
          const shares = Number(h.shares);
          const currentPrice = Number(h.current_price) || 0;
          const val = shares * currentPrice;
          totalStockValue += val;
          lines.push(`• **$${h.ticker}**: ${shares.toLocaleString()} sh (${val.toFixed(1)}g)`);
        }

        const netWorth = purse + totalStockValue;

        return NextResponse.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            flags: 64, // Ephemeral to protect privacy
            embeds: [
              {
                title: `🏛️ Portfolio Statement: @${user.username}`,
                url: "https://growurgold.vercel.app/portfolio",
                color: 0xf59e0b, // Amber Gold
                fields: [
                  { name: "Total Net Worth", value: `**${netWorth.toFixed(2)} gold**`, inline: true },
                  { name: "Liquid Purse", value: `${purse.toFixed(2)} gold`, inline: true },
                  { name: "Stock Valuation", value: `${totalStockValue.toFixed(2)} gold`, inline: true },
                  {
                    name: `Stock Positions (${holdingsRes.rows.length})`,
                    value: lines.length > 0 ? lines.join("\n") : "No active stock holdings.",
                    inline: false,
                  },
                ],
                footer: {
                  text: "Grow UR Gold Citizen Vault • Confidential",
                },
                timestamp: new Date().toISOString(),
              },
            ],
          },
        });
      }

      // === COMMAND 3: /gug market ===
      if (subcommand === "market" || commandName === "market") {
        const compsRes = await db.execute({
          sql: "SELECT ticker, name, current_price, change_24h, volume_24h FROM companies WHERE status = 'ACTIVE' ORDER BY volume_24h DESC LIMIT 8",
        });

        const rows = compsRes.rows.map((c: any) => {
          const move = Number(c.change_24h) >= 0 ? `+${Number(c.change_24h).toFixed(1)}%` : `${Number(c.change_24h).toFixed(1)}%`;
          return `**$${c.ticker}** — **${Number(c.current_price).toFixed(2)}g** (${move}) · Vol: ${Number(c.volume_24h).toLocaleString()} sh`;
        });

        return NextResponse.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [
              {
                title: "🏛️ Grow UR Gold — 24/7 Market Floor Board",
                description: rows.join("\n\n") || "No companies listed currently.",
                color: 0xf59e0b,
                url: "https://growurgold.vercel.app",
                footer: {
                  text: "Continuous Order Matching Active 24/7",
                },
                timestamp: new Date().toISOString(),
              },
            ],
          },
        });
      }

      // Default fallback for unknown command
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: 64,
          content: "Available commands:\n• `/gug price <ticker>`\n• `/gug portfolio <citizen>`\n• `/gug market`",
        },
      });
    }

    return new NextResponse("Unhandled interaction type", { status: 400 });
  } catch (error: any) {
    console.error("Discord interactions route error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
