export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "borrow"
  | "repay"
  | "collateral_deposit"
  | "collateral_withdrawal"
  | "liquidation"
  | "bridge";

export type TransactionStatus = "confirmed" | "pending" | "failed";

export interface Transaction {
  id: string;
  type: TransactionType;
  asset: string;
  amount: number;
  timestamp: number;
  txHash: string;
  blockNumber: number;
  status: TransactionStatus;
}

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  borrow: "Borrow",
  repay: "Repay",
  collateral_deposit: "Collateral Deposit",
  collateral_withdrawal: "Collateral Withdrawal",
  liquidation: "Liquidation",
  bridge: "Bridge",
};
