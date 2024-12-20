import {createClient} from 'redis'
import {Client} from 'pg'
import { DbMessage } from './types';
import dotenv from 'dotenv'
dotenv.config()

const pgClient = new Client({
    user: process.env.POSTGRES_USER || "postgres",
    host: process.env.POSTGRES_HOST || "postgres-db",
    database: process.env.POSTGRES_DB || "postgres",
    password: process.env.POSTGRES_PASSWORD || "postgres",
    port: Number(process.env.POSTGRES_PORT) || 5432,
  });
  
pgClient.connect();

async function main() {
    const redisClient = createClient({url: process.env.REDIS_URL || "redis://redis:6379"});
    await redisClient.connect();
    console.log("connected to redis");

    while(true){
        const response = await redisClient.rPop("db_processor" as string)
        if(response){
            const data : DbMessage = JSON.parse(response)
            if (data.type === "TRADE_ADDED") {
                console.log("Adding trade data...");
                console.log(data);
            
                const price = parseFloat(data.data.price); // Ensure price is a number
                const timestamp = new Date(data.data.timestamp);
                const rawMarket = data.data.market.split('_')[0]; // Extract the market
                const tableName = `tata_prices`; // Sanitize table name
                const quantity = parseFloat(data.data.quantity); // Ensure quantity is a number
                const isBuyerMaker = data.data.isBuyerMaker;
            
                // Validate table name (ensure it only contains valid characters: letters, digits, underscores)
                if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
                    console.error("Invalid table name:", tableName);
                    return;
                }
            
                // Construct the query
                const query = `INSERT INTO ${tableName} (time, price, quantity, is_buyer_maker) VALUES ($1, $2, $3, $4)`;
                const values = [timestamp, price, quantity, isBuyerMaker];
            
                try {
                    await pgClient.query(query, values);
                    console.log("Data inserted successfully into", tableName);
                } catch (err) {
                    console.error(`Error inserting data into ${tableName}:`, err);
                }
            }
            else if (data.type === "ORDER_UPDATE") {
                console.log("Updating order...");
                console.log(data);
            
                const { orderId, executedQty, market, price, quantity, side } = data.data;
            
                // Sanitize market to avoid injection risks and dynamic table issues
                const rawMarket = market?.split('_')[0]; // Use the first part of the market name
                const tableName = "tata_orders"
            
                // Validate table name
                if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
                    console.error("Invalid table name:", tableName);
                    return;
                }
            
                try {
                    // Step 1: Check if the order already exists
                    const checkQuery = `SELECT * FROM ${tableName} WHERE order_id = $1`;
                    const checkResult = await pgClient.query(checkQuery, [orderId]);
            
                    if (checkResult.rowCount && checkResult.rowCount > 0) {
                        // Step 2: Update the existing order
                        const updateQuery = `
                            UPDATE ${tableName}
                            SET executed_qty = $1, price = $2, quantity = $3, side = $4, updated_at = $5
                            WHERE order_id = $6
                        `;
                        const updateValues = [
                            executedQty,
                            price ? parseFloat(price) : null,
                            quantity ? parseFloat(quantity) : null,
                            side || null,
                            new Date(),
                            orderId,
                        ];
                        await pgClient.query(updateQuery, updateValues);
                        console.log(`Order ${orderId} updated successfully in ${tableName}`);
                    } else {
                        // Step 3: Insert the new order
                        const insertQuery = `
                            INSERT INTO ${tableName} (order_id, executed_qty, price, quantity, side, market, created_at)
                            VALUES ($1, $2, $3, $4, $5, $6, $7)
                        `;
                        const insertValues = [
                            orderId,
                            executedQty,
                            price ? parseFloat(price) : null,
                            quantity ? parseFloat(quantity) : null,
                            side || null,
                            market || null,
                            new Date(),
                        ];
                        await pgClient.query(insertQuery, insertValues);
                        console.log(`Order ${orderId} created successfully in ${tableName}`);
                    }
                } catch (err) {
                    console.error(`Error processing order update for ${orderId} in ${tableName}:`, err);
                }
            }
            
    }

    }}
main()
