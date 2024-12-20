import { UserBalance } from "../trades/Engine";
import { Order } from "../trades/OrderBook";


export const CREATE_ORDER = "CREATE_ORDER";
export const GET_USER_BALANCE = "GET_USER_BALANCE";
export const CANCEL_ORDER = "CANCEL_ORDER";
export const ON_RAMP = "ON_RAMP";

export const GET_DEPTH = "GET_DEPTH";

export type MessageToApi =
  | {
      type: "DEPTH";
      payload: {
        bids: [string, string][];
        asks: [string, string][];
      };
    }
  | {
      type: "ORDER_PLACED";
      payload: {
        orderId: string;
        executedQty: number;
        fills: {
          price: string;
          qty: number;
          tradeId: number;
        }[];
      };
    }
  | {
      type: "ORDER_CANCELLED";
      payload: {
        orderId: string;
        executedQty: number;
        remainingQty: number;
      };
    }
  | {
      type: "OPEN_ORDERS";
      payload: Order[];
    }
  | {
      type: "GET_USER_BALANCE";
      payload: UserBalance;
    }
  | {
      type: "ON_RAMP";
      payload: {
        userId: string;
        amount: string;
      };
    };