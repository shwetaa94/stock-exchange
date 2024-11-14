import {Request,Response, Router} from 'express'
import { GET_DEPTH } from '../types'
import { RedisManager } from '../RedisManager'

export const depthRouter = Router()

depthRouter.get("/", async(req:Request, res:Response) => {
    const { symbol } = req.query;
    const response = await RedisManager.getInstance().sendAndAwait(
     {  type: GET_DEPTH,
        data: {
            market: symbol as string    // symbol.toString() -->undefined=>"undefined"
        }
    }
    )
    res.json(response.payload);
})