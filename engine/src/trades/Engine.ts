import { Orderbook } from "./OrderBook";

// Base currency used in the trading engine
export const BASE_CURRENCY = "INR";

interface UserBalance{
    [userID: string]: {available: number , locked: number}
    // {"1" : { available: 1000, locked: 200}}
}


export class Engine{
    private orderbooks: Orderbook[] = [];
    private balances: Map<string, UserBalance> = new Map();

    constructor(){
        this.orderbooks.push(new Orderbook('TATA',[],[],0,1000 ))    //marketname, bids,ask,lasttradeid, currentPrize
    }

}
