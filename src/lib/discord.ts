import { getSetting } from "./wallet";

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbedOptions {
  title: string;
  description?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  url?: string;
  footerText?: string;
}

export async function getDiscordConfig(): Promise<{
  webhookUrl: string;
  whaleThreshold: number;
  alertsEnabled: boolean;
}> {
  try {
    const [webhookUrl, whaleThresholdStr, alertsEnabledStr] = await Promise.all([
      getSetting("discord_webhook_url", process.env.DISCORD_WEBHOOK_URL || ""),
      getSetting("discord_whale_threshold", "25"),
      getSetting("discord_alerts_enabled", "true"),
    ]);

    return {
      webhookUrl: webhookUrl.trim(),
      whaleThreshold: parseFloat(whaleThresholdStr) || 25,
      alertsEnabled: alertsEnabledStr !== "false",
    };
  } catch (err) {
    console.error("Failed to fetch Discord config:", err);
    return {
      webhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
      whaleThreshold: 25,
      alertsEnabled: true,
    };
  }
}

export async function sendDiscordEmbed(
  options: DiscordEmbedOptions,
  customWebhookUrl?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const config = await getDiscordConfig();
    const targetUrl = customWebhookUrl || config.webhookUrl;

    if (!targetUrl) {
      return { success: false, message: "No Discord webhook URL configured." };
    }
    if (!/^https:\/\/(?:discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)\/api\/webhooks\//.test(targetUrl)) {
      return { success: false, message: "That isn't a Discord webhook URL (https://discord.com/api/webhooks/…)." };
    }

    if (!customWebhookUrl && !config.alertsEnabled) {
      return { success: false, message: "Discord alerts are disabled." };
    }

    const payload = {
      username: "Grow UR Gold Exchange",
      avatar_url: "https://growurgold.vercel.app/gold-crest.png",
      embeds: [
        {
          title: options.title,
          description: options.description,
          url: options.url || "https://growurgold.vercel.app",
          color: options.color || 0xf59e0b, // Amber Gold
          fields: options.fields || [],
          footer: {
            text: options.footerText || "Grow UR Gold • parlamentum.org/trade",
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("Discord webhook error:", res.status, errText);
      return { success: false, message: `Discord error (${res.status}): ${errText}` };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to send Discord webhook:", error);
    return { success: false, message: error.message };
  }
}

/**
 * Triggered when a trade executes on the order book.
 * Emits a Whale alert if the trade value exceeds the configured threshold.
 */
export async function notifyDiscordTrade(trade: {
  ticker: string;
  companyName: string;
  buyerName: string;
  sellerName: string;
  price: number;
  quantity: number;
  total: number;
}) {
  try {
    const config = await getDiscordConfig();
    if (!config.webhookUrl || !config.alertsEnabled) return;

    const isWhale = trade.total >= config.whaleThreshold;
    const color = isWhale ? 0x10b981 : 0x3b82f6; // Emerald green for whales, blue for standard

    await sendDiscordEmbed({
      title: isWhale
        ? `🚨 WHALE TRADE ALERT: $${trade.ticker}`
        : `⚡ Trade Executed: $${trade.ticker}`,
      description: isWhale
        ? `A massive trade of **${trade.total.toFixed(2)} gold** was just settled on the floor!`
        : `A fill occurred on **${trade.companyName}**.`,
      color,
      url: `https://growurgold.vercel.app/trade/${trade.ticker}`,
      fields: [
        { name: "Ticker", value: `**$${trade.ticker}**`, inline: true },
        { name: "Price", value: `${trade.price.toFixed(2)} gold`, inline: true },
        { name: "Quantity", value: `${trade.quantity.toLocaleString()} sh`, inline: true },
        { name: "Total Settled", value: `**${trade.total.toFixed(2)} gold**`, inline: true },
        { name: "Buyer", value: `@${trade.buyerName}`, inline: true },
        { name: "Seller", value: `@${trade.sellerName}`, inline: true },
      ],
      footerText: `Grow UR Gold Order Book • Floor Rate`,
    });
  } catch (err) {
    console.warn("notifyDiscordTrade non-fatal error:", err);
  }
}

/**
 * Triggered when a player announces an in-game Raw Iron deposit.
 * Alerts the operator immediately so approvals happen with zero delay.
 */
export async function notifyDiscordDepositAnnouncement(deposit: {
  citizenName: string;
  amount: number;
  ironUnits: number;
  txId: string;
}) {
  try {
    const config = await getDiscordConfig();
    if (!config.webhookUrl || !config.alertsEnabled) return;

    await sendDiscordEmbed({
      title: `📥 Deposit Announced: @${deposit.citizenName}`,
      description: `A citizen has purchased Raw Iron in Parlamentum and is awaiting your verification!`,
      color: 0xf59e0b, // Amber Gold
      url: `https://growurgold.vercel.app/admin`,
      fields: [
        { name: "Citizen", value: `@${deposit.citizenName}`, inline: true },
        { name: "Gold Requested", value: `+${deposit.amount.toLocaleString()} gold`, inline: true },
        { name: "Raw Iron Purchased", value: `${deposit.ironUnits} units`, inline: true },
        { name: "Transaction ID", value: `\`${deposit.txId}\``, inline: true },
        { name: "Action Required", value: `[Review & Approve in Admin Panel](https://growurgold.vercel.app/admin)`, inline: false },
      ],
      footerText: `Grow UR Gold Deposit Gateway • Immediate Action Required`,
    });
  } catch (err) {
    console.warn("notifyDiscordDepositAnnouncement non-fatal error:", err);
  }
}

/**
 * Triggered when a new IPO application is filed or approved.
 */
export async function notifyDiscordIPO(ipo: {
  ticker: string;
  companyName: string;
  founderName: string;
  floatShares: number;
  offeringPrice: number;
  totalRaise: number;
  status: "APPLIED" | "APPROVED";
}) {
  try {
    const config = await getDiscordConfig();
    if (!config.webhookUrl || !config.alertsEnabled) return;

    const isLive = ipo.status === "APPROVED";
    await sendDiscordEmbed({
      title: isLive
        ? `🚀 NEW IPO LISTING LIVE: $${ipo.ticker}`
        : `📝 New IPO Application Filed: $${ipo.ticker}`,
      description: isLive
        ? `**${ipo.companyName}** has officially opened its initial public float on the exchange! Orders are live.`
        : `@${ipo.founderName} has submitted a charter application for **${ipo.companyName}**.`,
      color: isLive ? 0x8b5cf6 : 0x64748b, // Violet for live listing, Slate for pending
      url: isLive ? `https://growurgold.vercel.app/trade/${ipo.ticker}` : `https://growurgold.vercel.app/admin`,
      fields: [
        { name: "Company", value: `${ipo.companyName} (\`$${ipo.ticker}\`)`, inline: true },
        { name: "Offering Price", value: `${ipo.offeringPrice.toFixed(2)} gold`, inline: true },
        { name: "Float Shares", value: `${ipo.floatShares.toLocaleString()} shares`, inline: true },
        { name: "Total Capital Raise", value: `**${ipo.totalRaise.toFixed(2)} gold**`, inline: true },
        { name: "Founder", value: `@${ipo.founderName}`, inline: true },
      ],
      footerText: `Grow UR Gold IPO Syndicate`,
    });
  } catch (err) {
    console.warn("notifyDiscordIPO non-fatal error:", err);
  }
}
