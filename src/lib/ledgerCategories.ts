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
  { value: "COMMODITY_SALES", label: "Goods sold (iron, grain, bread, weapons)" },
  { value: "CONTRACT_SERVICES", label: "Contracts and services" },
  { value: "PRESS_SUBSCRIPTIONS", label: "Press and advertising" },
  { value: "DIVIDEND_INCOME", label: "Dividends received" },
  { value: "CAPITAL_INVESTMENT", label: "Capital from founder or partners" },
  { value: "OTHER_INCOME", label: "Other income" },
];

export const EXPENSE_CATEGORIES = [
  { value: "WORKER_WAGES", label: "Wages" },
  { value: "RAW_MATERIALS", label: "Raw materials" },
  { value: "FACILITY_UPGRADE", label: "Factory and workshop upgrades" },
  { value: "MAINTENANCE", label: "Maintenance and couriers" },
  { value: "TAXES_FEES", label: "In-game taxes and fees" },
  { value: "DIVIDEND_PAYOUT", label: "Dividends paid" },
  { value: "OTHER_EXPENSE", label: "Other costs" },
];

// Entries the exchange writes when treasury gold moves; shown as treasury movements, not P&L
export const TREASURY_LABELS: Record<string, string> = {
  IPO_PROCEEDS: "IPO share sale",
  OPERATING_PROFIT: "Profit paid in",
  FOUNDER_DEPOSIT: "From founder's purse",
  FOUNDER_WITHDRAWAL: "To founder's purse",
  DIVIDEND_DISTRIBUTION: "Dividend paid",
};
export const TREASURY_CATEGORIES = Object.keys(TREASURY_LABELS);
