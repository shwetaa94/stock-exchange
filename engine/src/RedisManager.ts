import { RedisClientType, createClient } from "redis"
import { Engine } from "./trades/Engine"
import { WsMessage } from "./types/toWS";
import { MessageToApi } from "./types/toApi";
import { DbMessage } from "./types/toDB";
import dotenv from 'dotenv'
dotenv.config()

export class RedisManager{
    private client:RedisClientType;
    private static instance: RedisManager;
    
    constructor(){
        this.client = createClient({url: process.env.REDIS_URL || "redis://redis:6379",})
        this.client.connect();
    }

    public static getInstance(){
        if(this.instance)return this.instance;
        return this.instance = new RedisManager()
    }

    public pushMessage(message: DbMessage){
        this.client.rPush("db_processor", JSON.stringify(message))
    }
    public publishMessage(channel: string, message: WsMessage){
        this.client.publish(channel, JSON.stringify(message))
    }
    public sendToApi(clientId: string, message: MessageToApi): void {
        this.client.publish(clientId, JSON.stringify(message));
      }

}