import { BASE_CURRENCY } from "./Engine";

export interface Order {
    price: number; // The price at which the order is placed
    quantity: number; // The amount of asset to be traded
    orderId: string; // Unique identifier for the order
    filled: number; // Quantity of the order that has been filled
    side: "buy" | "sell"; // Indicates whether the order is a buy or sell order
    userId: string; // Identifier for the user who placed the order
  }

  export interface Fill {
    price: string; // The price at which the trade was executed
    qty: number; // The quantity that was filled in the trade
    tradeId: number; // Unique identifier for the trade
    otherUserId: string; // The user ID of the counterparty
    markerOrderId: string; // The order ID of the maker order
  }

  export class Orderbook {
    bids: Order[]; // Array to store all the buy orders
    asks: Order[]; // Array to store all the sell orders
    baseAssets: string; // The asset being traded
    quoteAssets: string = BASE_CURRENCY; // The currency against which the asset is traded
    lastTradeId: number; // The ID of the last executed trade
    currentPrice: number; // The last traded price
  
 
    constructor(
      baseAsset: string,
      bids: Order[],
      asks: Order[],
      lastTradeId: number,
      currentPrice: number
    ) {
      this.bids = bids;
      this.asks = asks;
      this.baseAssets = baseAsset;
      this.lastTradeId = lastTradeId || 0;
      this.currentPrice = currentPrice || 0;
    }

    public ticker(): string {
      return `${this.baseAssets}_${this.quoteAssets}`;   //e.g baseAsset = TATA  quoteAsset = INR
    }

    public addOrder(order:Order){  
      if(order.side === 'buy') this.matchAsk()
      else if(order.side === 'sell') this.matchBids()

    }
    public matchAsk(){
      if(user)
      
    }
    public matchBids(){

    }
    

}