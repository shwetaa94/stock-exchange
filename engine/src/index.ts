import { createClient } from "redis"

async function main(){

    const client = createClient()
    await client.connect()
    while(true){
    
        const data = await client.rPop('messages')

    }
    

}

main()