export interface StockGift {
  id: string;
  code: string;
  senderId: string;
  senderName: string;
  companyId: string;
  ticker: string;
  companyName: string;
  shares: number;
  note?: string;
  status: "ACTIVE" | "REDEEMED" | "CANCELLED";
  recipientId?: string;
  recipientName?: string;
  redeemedAt?: string;
  createdAt: string;
}
