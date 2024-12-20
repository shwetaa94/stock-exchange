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
    baseAsset: string; // The asset being traded
    quoteAsset: string = BASE_CURRENCY; // The currency against which the asset is traded
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
      this.baseAsset = baseAsset;
      this.lastTradeId = lastTradeId || 0;
      this.currentPrice = currentPrice || 0;
    }

    public ticker(): string {
      return `${this.baseAsset}_${this.quoteAsset}`;   //e.g baseAsset = TATA  quoteAsset = INR
    }
  /**
   * Gets a snapshot of the current state of the order book.
   *
   * @return An object containing the base asset, bids, asks, last trade ID, and current price.
   */
  getSnapshot() {
    return {
      baseAsset: this.baseAsset,
      bids: this.bids,
      asks: this.asks,
      lastTradeId: this.lastTradeId,
      currentPrice: this.currentPrice,
    };
  }

    public addOrder(order:Order):{
      fills: Fill[];
      executedQty: number;
    }{  
      if(order.side === 'buy'){ 
        const {fills, executedQty} = this.matchBids(order) 
        order.filled = executedQty
      
      if (executedQty === order.quantity) {
        return {
          fills,
          executedQty,
        };
      }
      // ..sare bids khtm ho jai
      this.bids.push(order);
      this.bids.sort((a, b) => b.price - a.price);
      console.log("Bids", this.bids);
      return {
        executedQty,
        fills,
      };
    }
       //if ordr.side==='sell'
      else{ 
      const {fills, executedQty} = this.matchAsk(order)       
      order.filled = executedQty;   
      if (executedQty === order.quantity) {
        return {
          fills,
          executedQty,
        };
      }
      this.asks.push(order);
      this.asks.sort((a, b) => b.price - a.price);
      console.log("Bids", this.bids);
      return {
        executedQty,
        fills,
      };
    }
    }

    // hm. sell krre hai,,,,, to check krege ki kon sbse jada me buy/kran chah ra h , we will check for ask
    public matchAsk(order : Order): {
      fills: Fill[];
      executedQty: number;
    }{
      const fills: Fill[] = [];
      let executedQty = 0;
      // array is sorted 4,3,2,1,
      this.bids.forEach((bid:Order)=>{
        if(bid.price >= order.price && executedQty < order.quantity && bid.userId !== order.userId){
          const filledQty = Math.min(order.quantity- executedQty, bid.quantity - bid.filled) 
          executedQty +=filledQty;
          bid.filled += filledQty;      
        
        fills.push({
          price: bid.price.toString(),
          qty : filledQty,
          tradeId: this.lastTradeId++,
          otherUserId: bid.userId,
          markerOrderId: order.orderId,
        })

      }
      })

      for(let i =0 ;i<this.bids.length; i++){
        if(this.bids[i].filled === this.bids[i].quantity){
          this.bids.splice(i,1) // ek elemnt nikal dege orgianl array se
          i--;
        }
      }

      return {
        fills,
        executedQty: executedQty
      }
      
    }

    // hm khrid rhe h to dekhege ki sabse kam me kon bech rha hai..  chek for sell/bids
    public matchBids(order : Order): {
      fills: Fill[];
      executedQty: number;
    }{

      const fills: Fill[] = [];
      let executedQty = 0;
      // array is sorted 1,2,3,4
      this.asks.forEach((ask: Order)=>{
        if(ask.price <= order.price && executedQty < order.quantity && ask.userId !== order.userId){
          const filledQty = Math.min(order.quantity- executedQty, ask.quantity - ask.filled) 
          executedQty +=filledQty;
          ask.filled += filledQty;      
        
        fills.push({
          price: ask.price.toString(),
          qty : filledQty,
          tradeId: this.lastTradeId++,
          otherUserId: ask.userId,
          markerOrderId: order.orderId,
        })

      }
      })
      //jiski value orderbook me zero hogyi
      for(let i =0 ;i<this.asks.length; i++){
        if(this.asks[i].filled === this.asks[i].quantity){
          this.asks.splice(i,1) // ek elemnt nikal dege orgianl array se
          i--;
        }
      }

    return {
      fills,
      executedQty: executedQty
    }
  }

    public getDepth(){
                  //  quatity, price
      const bids: [string, string][] = [];
      const asks: [string, string][] = [];
                    //TATA_INR:{bids[],asks[]}
      const bidObj: { [key: string]: number } = {};
      const askObj: { [key: string]: number } = {};

      this.bids.forEach((bid:Order)=>{
        if(!bidObj[bid.price]) bidObj[bid.price] = 0
        bidObj[bid.price] += bid.quantity
      })

      this.asks.forEach((ask:Order)=>{
        if(!askObj[ask.price]) askObj[ask.price] = 0
        askObj[ask.price] += ask.quantity
      })

      // Convert bid volumes to array format
      for (const price in bidObj) {
        bids.push([price, bidObj[price].toString()]);
      }

      // Convert ask volumes to array format
      for (const price in askObj) {
        asks.push([price, askObj[price].toString()]);
      }

      return {
        bids,
        asks,
      };

    }

    public getOpenOrders(userId: string):Order[]{
      const asks = this.asks.filter((ask: Order)=> ask.userId === userId)
      const bids = this.bids.filter((bid: Order)=> bid.userId === userId)
      return [...asks, ...bids]
    }

    public cancelAsk(orderId: string):number | undefined{
      const index = this.asks.findIndex((ask)=>ask.orderId === orderId)  // i for value
      if(index !== -1){ 
        const price = this.asks[index].price;
        this.asks.splice(index,1) //remove one elemnet form postion =index
        return price;
      }
    }

    public cancelBid(orderId: string):number | undefined{
      const index = this.bids.findIndex((bid)=>bid.orderId === orderId)  // i for value
      if(index !== -1){ 
        const price = this.bids[index].price;
        this.bids.splice(index,1) //remove one elemnet form postion =index
        return price;
    }
    }


}