import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { orderRouter } from './routes/order'
dotenv.config()
const PORT = 8000

const app = express()
app.use(express.json())
app.use(cors({origin:['*']}))


app.use("api/v1/order",orderRouter)
app.use("api/v1/ticket",ticketRouter)
app.use("api/v1/klines",klinesRouter)
app.use("api/v1/depth",depthRouter)
app.use("api/v1/tickers",tickersRouter)

app.get('/',(req:Request,res: Response)=>{
    res.status(200).send('backend connected successfully')
})
app.listen(PORT, ()=>{
    console.log("server started on PORT ",PORT)
})