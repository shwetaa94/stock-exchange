import { RedisManager } from "../RedisManager";
import { ORDER_UPDATE, TRADE_ADDED } from "../types";
import { CANCEL_ORDER, CREATE_ORDER, GET_DEPTH, GET_OPEN_ORDERS, MessageFromApi, ON_RAMP } from "../types/fromApi";
import { GET_USER_BALANCE } from "../types/toApi";
import { Fill, Order, Orderbook } from "./OrderBook";
import fs from 'fs'

// Base currency used in the trading engine
export const BASE_CURRENCY = "INR";

export interface UserBalance{
    [userID: string]: {available: number , locked: number}
    // {"1" : { available: 1000, locked: 200}}
}


export class Engine{
    private orderbooks: Orderbook[] = [];
    private balances: Map<string, UserBalance> = new Map();

    constructor(){
            let snapshot = null;

            try{
                if(process.env.WITH_SNAPSHOT){
                    snapshot = fs.readFileSync('./snapshot.json')
                }
            }catch(err) {console.log('no snapshoet found', err)}

            if(snapshot){
                const snapshotSnapshot = JSON.parse(snapshot.toString())
                this.orderbooks = snapshotSnapshot.orderbooks.map((o: Orderbook) => new Orderbook( 
                    o.baseAsset,
                    o.bids,
                    o.asks,
                    o.lastTradeId,
                    o.currentPrice
                ))
                this.balances = new Map(snapshotSnapshot.balances); //setbalances()
                }
                else {
                    // If no snapshot is found, initialize with default order books and balances
                    this.orderbooks.push(new Orderbook('TATA',[],[],0,1000 ))  //marketname, bids, ask, lasttradeid, currentPrize
                    this.setBaseBalances();
                }
             setInterval(()=> this.saveSnapshot(), 3000)

    }

    private saveSnapshot() {
        const snapshotSnapshot = {
          orderbooks: this.orderbooks.map((o) => o.getSnapshot()),
          balances: Array.from(this.balances.entries()),  
          // Output: Iterator containing:
          // [
          //   ["1", { available: 1000, locked: 200 }],
          //   ["2", { available: 500, locked: 100 }]
          // ]
        };
        fs.writeFileSync('./snapshot.json', JSON.stringify(snapshotSnapshot))
    }
    

    public process({message, clientId}: {message:MessageFromApi, clientId:string}){
        switch(message.type){
            case GET_USER_BALANCE:
                try {
                    const userBalance = this.balances.get(message.data.userId)
                    if (!userBalance) {
                        throw new Error("User Balance not found");
                    }
                    console.log("Sending to api", { clientId: clientId, userBalance: userBalance });
                    RedisManager.getInstance().sendToApi(clientId, {  //pubsub ko btare h, not in QYEuE
                    type: "GET_USER_BALANCE",
                    payload: userBalance,
                    });
                    
                } catch (error) {
                    console.log("problem in fetching user balance", error)
                }
            break;
            case CREATE_ORDER: try {
                // PENDING -  need to create user id here,,,
                const {executedQty, fills, orderId} = this.createOrder(message.data.market, message.data.price, message.data.quantity, message.data.side, message.data.userId)
                RedisManager.getInstance().sendToApi(
                    clientId,
                    {
                        type: "ORDER_PLACED",
                        payload: {   
                            orderId,
                            executedQty,
                            fills: fills.map((fill)=>({
                                qty: fill.qty,
                                price: fill.price,
                                tradeId: fill.tradeId
                            }))
                        }
                })
            } catch (error) {
                RedisManager.getInstance().sendToApi(clientId, {
                    type: "ORDER_CANCELLED",
                    payload: {
                      orderId: "",
                      executedQty: 0,
                      remainingQty: 0,
                    },
                  });    
            }
            break;
            case CANCEL_ORDER:
              try {
                const orderId: string = message.data.orderId.toString();
                const cancelMarket: string = message.data.market.toString();
                const cancelOrderbook = this.orderbooks.find(o => o.ticker() === cancelMarket.toString());
                if (!cancelOrderbook) {
                  throw new Error("No orderbook found");
                }
                const quoteAsset = cancelMarket.split("_")[1];
                console.log("Cancelling order", { orderId: orderId, cancelMarket: cancelMarket, cancelOrderbook: cancelOrderbook, quoteAsset: quoteAsset });
                const order = cancelOrderbook.asks.find(o => o.orderId === orderId) || cancelOrderbook.bids.find(o => o.orderId === orderId);

                if(!order){
                  console.log("Order not found");
                  throw new Error("Order not found");
                }
                const leftQuantity = order.quantity - order.filled
                if(order.side === "buy"){
                  const price = cancelOrderbook.cancelBid(orderId)
                  // @ts-ignore
                  this.balances.get(order.userId)[quoteAsset].locked -= price*leftQuantity
                  // @ts-ignore
                  this.balances.get(order.userId)[quoteAsset].available += price*leftQuantity
                  
                  if(price){
                    this.sendUpdatedDepthAt(price.toString(), cancelMarket);
                    console.log("Cancelling bid order", { price: price });
                  }

                }
                else{
                  const price = cancelOrderbook.cancelAsk(orderId)
                   // @ts-ignore
                  this.balances.get(order.userId)[quoteAsset].locked -= price*leftQuantity
                  // @ts-ignore
                  this.balances.get(order.userId)[quoteAsset].available += price*leftQuantity
                  console.log("Cancelling ask order", { price: price });

                  if(price){
                    this.sendUpdatedDepthAt(price.toString(), cancelMarket);
                    console.log("Cancelling ask order", { price: price });
                  }

               }
               RedisManager.getInstance().sendToApi(clientId, {
                type: "ORDER_CANCELLED",
                payload: {
                  orderId: order.orderId,
                  executedQty: 0,
                  remainingQty: 0,
                },
              });

                
              } catch (error) {
                console.log("Error canceling order", error);
                
              }
            break;
            case ON_RAMP:
              try {
                this.onRamp(message.data.userId, message.data.amount)
                RedisManager.getInstance().sendToApi(clientId,
                  {
                    type: "ON_RAMP",
                    payload: {
                      userId: message.data.userId,
                      amount: message.data.amount
                    }
                  }
                  )
                
              } catch (error) {
                console.log("Error in adding money.. ", error);
                
              }
            break;
            case GET_OPEN_ORDERS:
              try {
                console.log(
                  "Getting open orders",
                  message.data.market,
                  message.data.userId
                )
                const openOrderbook = this.orderbooks.find(o => o.ticker() === message.data.market);
                if(!openOrderbook){
                  throw new Error("No orderbook found");
                }
                console.log("Getting open orders", { openOrderbook: openOrderbook });
                const openOrders = openOrderbook.getOpenOrders(message.data.userId);
                console.log("Getting open orders", { openOrders: openOrders });
                RedisManager.getInstance().sendToApi(clientId, {
                  type: "OPEN_ORDERS",
                  payload: openOrders
                })
               } catch (error) {
                console.log("Error getting open orders", error);
               }
            break;
            case GET_DEPTH:
              try {
                const market = message.data.market
                const orderbook = this.orderbooks.find((o)=>o.ticker()===market.toString())
                if(!orderbook){
                  throw new Error("No orderbook found");
                }
                //pub-sub pe post krdo depth...
                RedisManager.getInstance().sendToApi(clientId, { 
                  type: "DEPTH",
                  payload: orderbook.getDepth()
                });
              } catch (error) {
                console.log("Error getting depth", error);
              }
            break;
            default:
        }

    }

    private createOrder( market: string, price: string, quantity: string, side: "buy" | "sell", userId: string ){
        const orderbook = this.orderbooks.find((order)=>order.ticker() === market)  //baseAsset e.g TATA_INR
        if(!orderbook) throw new Error('orderbook not found');
        const [baseAsset, quoteAsset] = market.split('_')
        this.checkAndLockFunds(baseAsset, quoteAsset, side, userId, quoteAsset , price, quantity)  

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
        const isBuyerMaker = executedQty === order.quantity;

        //user ka balance update krna agar hamra order orderbook me add hojata hai to
        this.updateBalance( userId, baseAsset, quoteAsset, side, fills, executedQty);
        //db me trade banana ki hmari trades ho chuke hen
        this.createDbTrades(fills, market, userId, isBuyerMaker);
        // user k orders save honge (orderbook in memory for instant rresult but parallely we save this data to db...)
        this.updateDbOrders(order, executedQty, fills, market);
        //depth update krna that re redis
        this.publisWsDepthUpdates(fills, price, side, market);
        //depth ko websicket ko dena
        this.publishWsTrades(fills, userId, market);

        console.log("Order created", { executedQuantity: executedQty, fills: fills, orderId: order.orderId });
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

    private createDbTrades(fills: Fill[], market: string, userId: string, isBuyerMaker: boolean) {
       console.log("Creating trades...", { fills: fills, market: market, userId: userId });
       fills.forEach((fill) => {
         console.log("Creating trade", { fill: fill, market: market, userId: userId });
         RedisManager.getInstance().pushMessage({
           type: TRADE_ADDED,
           data: {
             id: fill.tradeId.toString(),
             isBuyerMaker: isBuyerMaker,
             price: fill.price,
             quantity: fill.qty.toString(),
             quoteQuantity: (fill.qty * Number(fill.price)).toString(),
             timestamp: Date.now(),
             market,
           },
         });
       });
     }
    private updateDbOrders(order: Order, executedQuantity: number, fills: Fill[], market: string){
        //self trade -CREATION
        RedisManager.getInstance().pushMessage({
            type: ORDER_UPDATE,
            data: {
              orderId: order.orderId,
              executedQty: executedQuantity,
              market: market,
              price: order.price.toString(),
              quantity: order.quantity.toString(),
              side: order.side,
            },
        })
        //those who fulfills my trade... ALREADY EXITS, JUST UPDATE..send them ids
        fills.forEach((fill) => {
            RedisManager.getInstance().pushMessage({
            type: ORDER_UPDATE,
            data: {
              orderId: fill.markerOrderId,
              executedQty: executedQuantity,
            },
        })
        })
    }

    //when we cancel the order then we send the updated depth
    private sendUpdatedDepthAt(price: string, market: string) {
        const orderbook = this.orderbooks.find((orderbook)=>orderbook.ticker() === market)// TATA_INR === ___
        if (!orderbook) return;
        
        const depth = orderbook.getDepth()
        const updatedBids = depth?.bids.filter(x => x[0] === price);
        const updatedAsks = depth?.asks.filter(x => x[0] === price);

        RedisManager.getInstance().publishMessage(`depth@${market}`,{
           stream: `depth@${market}`,
           data:{
            a: updatedAsks.length?updatedAsks: [[price, '0']],
            b: updatedBids.length?updatedBids: [[price, '0']],
            e:'depth'
           }
        })
    }
    //when any order created, we continuous push update to redis
    private publisWsDepthUpdates( fills: Fill[],
        price: string,
        side: "buy" | "sell",
        market: string){
            const orderbook = this.orderbooks.find((o) => o.ticker() === market);
            if(!orderbook) return;
            const depth = orderbook.getDepth()
            //fills=[[20,1],[30,1],[50,1]]
            if(side === 'buy'){
                const prices = fills.map((fill)=>fill.price) //price of all fills orders
                const updatedAsks = depth.asks.filter((x)=>prices.includes(x[0].toString())) //[[price:50, qty:9]]
                const updatedBid = depth?.bids.find(x => x[0] === price);
                RedisManager.getInstance().publishMessage(`depth@${market}`, {
                    stream: `depth@${market}`,
                    data: {
                        a: updatedAsks,
                        b: updatedBid ? [updatedBid] : [],
                        e: "depth"
                    }
                });
            }
            else{
                //side=== sell
                const updatedBids = depth?.bids.filter(x => fills.map(f => f.price).includes(x[0].toString()));
                const updatedAsk = depth?.asks.find(x => x[0] === price);
                console.log("publish ws depth updates")
                RedisManager.getInstance().publishMessage(`depth@${market}`, {
                    stream: `depth@${market}`,
                    data: {
                        a: updatedAsk ? [updatedAsk] : [],
                        b: updatedBids,
                        e: "depth"
                    }
                });

            }
    }
    private publishWsTrades(fills: Fill[], userId: string, market: string) {
        // 3 trade happen not 4 for 100 rs order, [20,30,50]
        fills.map(fill => {
          console.log("Publishing ws trade", { fill: fill, userId: userId, market: market });
          RedisManager.getInstance().publishMessage(`trade@${market}`, {
            stream: `trade@${market}`,
            data: {
              e: "trade",
              t: fill.tradeId,
              m: fill.otherUserId === userId, // TODO: Is this right?
              p: fill.price,
              q: fill.qty.toString(),
              s: market
            },
          });
        })
      }
    

    private updateBalance( userId: string,
        baseAsset: string,
        quoteAsset: string,
        side: "buy" | "sell",
        fills: Fill[],
        executedQty: number){
            if(side === "buy"){
                fills.forEach((fill)=>{
                    //khud k balance me s less krdia and otherparty k me add krdia INR(quoteAsset)
                     // @ts-ignore
                    this.balances.get(userId)[quoteAsset].locked -= fill.qty*Number(fill.price);
                     // @ts-ignore
                    this.balances.get(fill.otherUserId)[quoteAsset].available +=fill.qty*Number(fill.price);

                    //khud k balance me s ADD krdia and otherparty k me less krdia TATA(baseAsset)
                     // @ts-ignore
                    this.balances.get(userId)[baseAsset].available += fill.qty;
                     // @ts-ignore
                    this.balances.get(fill.otherUserId)[baseAsset].locked -= fill.qty;

                })
            }
            else{
                //side === sell
                fills.forEach((fill)=>{
                    //khud k balance me s ADD krdia and otherparty k me less krdia INR(quoeAsset)
                    // @ts-ignore
                    this.balances.get(userId)[quoteAsset].available +=fill.qty*Number(fill.price);
                    // @ts-ignore
                    this.balances.get(fill.otherUserId)[quoteAsset].locked -=fill.qty*Number(fill.price);
                    //khud k balance me s less krdia and otherparty k me add krdia TATA(baseAsset)
                    // @ts-ignore
                    this.balances.get(userId)[baseAsset].locked -= fill.qty;
                    // @ts-ignore
                    this.balances.get(fill.otherUserId)[baseAsset].available += fill.qty;


                })
            }
    }
    //user account me pese dalega 
    private onRamp(userId: string, amount: string){
        const userBalance = this.balances.get(userId) //return null if not present
        if(!userBalance){
            this.balances.set(userId, {
                [BASE_CURRENCY]: {
                    available: Number(amount),
                    locked: 0,
                  }
            })
        }
        else userBalance[BASE_CURRENCY].available += Number(amount)
    }

    //setting dummy data to initials eout ordebook 
    setBaseBalances() {
        const baseBalances: { [key: string]: UserBalance } = {
          "1": {
            INR: {
              available: 10000,
              locked: 0,
            },
            TATA: {
              available: 100,
              locked: 0,
            },
          },
          "2": {
            INR: {
              available: 50000,
              locked: 0,
            },
            TATA: {
              available: 50,
              locked: 0,
            },
          },
          "3": {
            INR: {
              available: 50000,
              locked: 0,
            },
            TATA: {
              available: 50,
              locked: 0,
            },
          },
          "4": {
            INR: {
              available: 50000,
              locked: 0,
            },
            TATA: {
              available: 50,
              locked: 0,
            },
          },
        };
    
        for (const [userId, balance] of Object.entries(baseBalances)) {
          this.balances.set(userId, balance);
        }
    
        console.log("Setting base balances", { baseBalances: baseBalances });
      }
    

}
