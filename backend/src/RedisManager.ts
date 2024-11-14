import { createClient, RedisClientType } from "redis";
import { MessageToEngine } from "./types/to";
import { MessageFromOrderbook } from "./types";

export class RedisManager {
  private static instance: RedisManager;
  private redisClient: RedisClientType;
  private publisher: RedisClientType;

  private constructor() {
    this.redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    this.redisClient.connect();
    this.publisher = createClient();
    this.publisher.connect();
  }

  public static getInstance(): RedisManager {
    if (RedisManager.instance) 
        return RedisManager.instance;

    return (RedisManager.instance = new RedisManager());
  }

  public async sendAndAwait(message:MessageToEngine){
    return new Promise<MessageFromOrderbook>((resolve) => {
        const id = this.getRandomClientId();
        this.redisClient.subscribe( id, (message : any) => {
            this.redisClient.unsubscribe(id)
            resolve(JSON.parse(message))
        } )
        this.publisher.lPush("messages",JSON.stringify({clientId:id, message}))
    })
  }

  public getRandomClientId(){
    return Math.random().toString(36).substring(2,15) + Math.random().toString(36).substring(2,15)
  }
}