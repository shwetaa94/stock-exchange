import { ORDER_UPDATE, TRADE_ADDED } from ".";

interface TradeAddedMessage {
    type: typeof TRADE_ADDED;
    data: {
      id: string;
      isBuyerMaker: boolean;
      price: string;
      quantity: string;
      quoteQuantity: string;
      timestamp: number;
      market: string;
    };
  }
  
  interface OrderUpdateMessage {
    type: typeof ORDER_UPDATE;
    data: {
      orderId: string;
      executedQty: number;
      market?: string;
      price?: string;
      quantity?: string;
      side?: "buy" | "sell";
    };
  }
  
  // Combine the interfaces as a discriminated union
  export type DbMessage = TradeAddedMessage | OrderUpdateMessage;
  