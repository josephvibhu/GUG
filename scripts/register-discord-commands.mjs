/**
 * Register Discord Slash Commands for Grow UR Gold (/gug)
 * 
 * Usage:
 *   DISCORD_BOT_TOKEN="your_bot_token" DISCORD_CLIENT_ID="your_client_id" node scripts/register-discord-commands.mjs
 * 
 * Or set DISCORD_GUILD_ID to register instantly to your specific server during testing.
 */

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || process.env.DISCORD_APPLICATION_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!BOT_TOKEN || !CLIENT_ID) {
  console.log("-------------------------------------------------------------------");
  console.log("Usage: To register /gug slash commands with Discord:");
  console.log("node scripts/register-discord-commands.mjs");
  console.log("");
  console.log("Environment variables required:");
  console.log("  DISCORD_BOT_TOKEN       (From Discord Developer Portal > Bot > Token)");
  console.log("  DISCORD_CLIENT_ID      (From Discord Developer Portal > General Information > Application ID)");
  console.log("  DISCORD_GUILD_ID       (Optional: Instant registration to test server)");
  console.log("-------------------------------------------------------------------");
  process.exit(0);
}

const commands = [
  {
    name: "gug",
    description: "Grow UR Gold stock exchange commands",
    options: [
      {
        name: "price",
        description: "Fetch live price, 24h change, and order book spread for a company",
        type: 1, // SUB_COMMAND
        options: [
          {
            name: "ticker",
            description: "Stock ticker symbol (e.g. GUG, BCKRM, EI)",
            type: 3, // STRING
            required: false,
          },
        ],
      },
      {
        name: "portfolio",
        description: "Check a citizen's stock holdings, gold purse, and net worth",
        type: 1, // SUB_COMMAND
        options: [
          {
            name: "citizen",
            description: "Parlamentum or Grow UR Gold username",
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: "market",
        description: "View the 24/7 market floor board and top active stocks",
        type: 1, // SUB_COMMAND
      },
    ],
  },
];

const url = GUILD_ID
  ? `https://discord.com/api/v10/applications/${CLIENT_ID}/guilds/${GUILD_ID}/commands`
  : `https://discord.com/api/v10/applications/${CLIENT_ID}/commands`;

console.log(`Registering slash commands to: ${url}`);

async function main() {
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`Failed to register commands (${res.status}):`, errorText);
    process.exit(1);
  }

  const data = await res.json();
  console.log("Successfully registered /gug commands with Discord!");
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
