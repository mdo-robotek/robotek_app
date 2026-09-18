export type OutFormLineItem = {
  description: string;
  qty: number;
};

export type OutFormRow = {
  rowIndex: number;
  date: string;
  orderNo: string;
  partyName: string;
  description: string;
  qty: string;
  updated_at: string;
  items: OutFormLineItem[];
  totalQty: number;
};
