import { WebSocket } from "ws";
import { IncomingMessage, SUBSCRIBE, UNSUBSCRIBE } from "./types/in";
import { OutgoingMessage } from "./types/out";
import { SubscriptionManager } from "./SubscriptionManager";

export class User{
    private id: string;
    private ws:WebSocket;
    private subscriptions: string[] = [];

    constructor(id: string, ws: WebSocket) {
        this.id = id;
        this.ws = ws;
        this.addListeners();
    }

    public subscribe(subscription: string) {
        this.subscriptions.push(subscription);
    }

    public unsubscribe(subscription: string) {
        this.subscriptions = this.subscriptions.filter(s => s !== subscription);
    }

    emit(message: OutgoingMessage) {  //bydefault public
        this.ws.send(JSON.stringify(message));
    }


    private addListeners(){
        this.ws.on("message", (message:string) => {
            const parsedMessage: IncomingMessage = JSON.parse(message);

            if (parsedMessage.method === SUBSCRIBE) {
                parsedMessage.params.forEach(s => SubscriptionManager.getInstance().subscribe(this.id, s));
            }

            if (parsedMessage.method === UNSUBSCRIBE) {
                parsedMessage.params.forEach(s => SubscriptionManager.getInstance().unsubscribe(this.id, parsedMessage.params[0]));
            }

        })
    }
}