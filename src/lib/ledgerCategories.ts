export interface CompanyLedgerEntry {
  id: string;
  companyId: string;
  userId: string;
  userName: string;
  entryType: "INCOME" | "EXPENSE";
  category: string;
  amount: number;
  description: string;
  entryDate: string;
  createdAt: string;
}

export interface CompanyLedgerSummary {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  profitMargin: number;
  entriesCount: number;
  // Company treasury balance (gold the company holds on the exchange)
  treasuryBalance?: number;
}

export const INCOME_CATEGORIES = [
  { value: "COMMODITY_SALES", label: "📦 Commodity Market Sales (Iron, Grain, Bread, Weapons)" },
  { value: "CONTRACT_SERVICES", label: "📜 Courier / Escort / Guild Contracts" },
  { value: "PRESS_SUBSCRIPTIONS", label: "📰 Press Circulation & Advertising" },
  { value: "DIVIDEND_INCOME", label: "🪙 Dividends Received from Equity Holdings" },
  { value: "CAPITAL_INVESTMENT", label: "🏛️ Founder / Syndicate Capital Inflow" },
  { value: "OTHER_INCOME", label: "✨ Other Operational Revenue" },
];

export const EXPENSE_CATEGORIES = [
  { value: "WORKER_WAGES", label: "👥 Worker Wages & Labor Payroll" },
  { value: "RAW_MATERIALS", label: "⛏️ Raw Material & Resource Purchases" },
  { value: "FACILITY_UPGRADE", label: "🏭 Factory, Mine & Workshop Upgrades" },
  { value: "MAINTENANCE", label: "🛠️ Machinery, Courier & Tool Maintenance" },
  { value: "TAXES_FEES", label: "🏛️ In-Game Taxes, Tariffs & Market Fees" },
  { value: "DIVIDEND_PAYOUT", label: "💰 Dividend Allocations Paid to Shareholders" },
  { value: "OTHER_EXPENSE", label: "💸 Other Operational Expenses" },
];

// Entries the exchange writes when treasury gold moves; shown as treasury movements, not P&L
export const TREASURY_LABELS: Record<string, string> = {
  IPO_PROCEEDS: "IPO share sale",
  FOUNDER_DEPOSIT: "From founder's purse",
  FOUNDER_WITHDRAWAL: "To founder's purse",
  DIVIDEND_DISTRIBUTION: "Dividend paid",
};
export const TREASURY_CATEGORIES = Object.keys(TREASURY_LABELS);
