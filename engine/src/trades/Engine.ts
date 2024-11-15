import { CANCEL_ORDER, CREATE_ORDER, GET_DEPTH, GET_OPEN_ORDERS, MessageFromApi, ON_RAMP } from "../types/fromApi";
import { Order, Orderbook } from "./OrderBook";

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

    public process({message, clientId}: {message:MessageFromApi, clientId:string}){
        switch(message.type){
            case CREATE_ORDER: try {
                // PENDING -  need to create user id here,,,
                this.createOrder(message.data.market, message.data.price, message.data.quantity, message.data.side, message.data.userId)
            } catch (error) {
                
            }
            break;
            case CANCEL_ORDER:
            break;
            case ON_RAMP:
            break;
            case GET_OPEN_ORDERS:
            break;
            case GET_DEPTH:
            break;
            default:
        }

    }
    private createOrder( market: string, price: string, quantity: string, side: "buy" | "sell", userId: string ){
        const orderbook = this.orderbooks.find((order)=>order.ticker() === market)  //baseAsset e.g TATA_INR
        if(!orderbook) throw new Error('orderbook not found');
        const [baseAsset, quoteAsset] = market.split('_')
        this.checkAndLockFunds(baseAsset, quoteAsset, side, userId, quoteAsset , price, quantity)  
        export interface Order {
            price: number; // The price at which the order is placed
            quantity: number; // The amount of asset to be traded
            orderId: string; // Unique identifier for the order
            filled: number; // Quantity of the order that has been filled
            side: "buy" | "sell"; // Indicates whether the order is a buy or sell order
            userId: string; // Identifier for the user who placed the order
          } 
        const order:Order = {
            price: Number(price),
            quantity: Number(quantity),
            orderId: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
            filled: 0,
            side,
            userId
        } 
        const {fills,executedQty} = orderbook.addOrder(order)
        //PENDING 
        //user ka balance update krna
        //db me trade banana
        //depth update krna
        //depth ko websicket ko dena
        return {orderId: order.orderId, fills, executedQty}

    }

    private checkAndLockFunds(  
        baseAsset: string,
        quoteAsset: string,
        side: "buy" | "sell",
        userId: string,
        asset: string,
        price: string,
        quantity: string){

        const userBalance = this.balances.get(userId)?.[quoteAsset]?.available || 0
        if(side ==='buy'){
            if(userBalance< Number(price)*Number(quantity)) throw new Error('not sufficient balance')
             // @ts-ignore
            this.balances.get(userId)?.[quoteAsset]?.available  -= Number(price)*Number(quantity) 
             // @ts-ignore
            this.balances.get(userId)?.[quoteAsset]?.locked += Number(price)*Number(quantity)
      
        }
        else if(side ==='sell'){
            if((this.balances.get(userId)?.[baseAsset]?.available || 0) < Number(quantity)) throw new Error('not sufficient stocks')
            // @ts-ignore
            this.balances.get(userId)?.[baseAsset]?.available -=Number(quantity)
            // @ts-ignore
            this.balances.get(userId)?.[baseAsset]?.locked -=Number(quantity)
        }

    }


}
