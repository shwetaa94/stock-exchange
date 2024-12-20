import { createClient } from "redis"
import { Engine } from "./trades/Engine"

async function main(){

    const client = createClient()
    await client.connect()
    const engine = new Engine()
    while(true){
        const data = await client.rPop('messages')
        if(data){
            engine.process(JSON.parse(data))
        }
    }
    

}

main()