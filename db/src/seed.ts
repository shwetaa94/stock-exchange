import { Client } from "pg";

const client = new Client({
    user: process.env.POSTGRES_USER || 'postgres',
    host: process.env.POSTGRES_HOST || 'postgres-db',
    database: process.env.POSTGRES_DB || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    port: Number(process.env.POSTGRES_PORT) || 5432,
  });

async function initializeDB() {
  await client.connect();

  // Drop and recreate `tata_prices` table
  await client.query(`
      DROP TABLE IF EXISTS "tata_prices";
      CREATE TABLE "tata_prices" (
          time TIMESTAMPTZ NOT NULL,
          price DOUBLE PRECISION,
          volume DOUBLE PRECISION,
          currency_code VARCHAR(10),
          quantity DOUBLE PRECISION, 
          is_buyer_maker BOOL
      );
  `);

  await client.query(`
    DROP TABLE IF EXISTS "tata_orders";
    CREATE TABLE "tata_orders" (
        order_id TEXT PRIMARY KEY,
        executed_qty DOUBLE PRECISION,
        price DOUBLE PRECISION,
        quantity DOUBLE PRECISION,
        side VARCHAR(4), -- Restrict to "buy" or "sell"
        market VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
`);


  // Create a hypertable (specific to TimescaleDB)
  await client.query(`
      SELECT create_hypertable('TataPrice', 'time', if_not_exists => TRUE);
  `);

  // Create materialized views for different time intervals
  await client.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS klines_1m AS
      SELECT
          time_bucket('1 minute', time) AS bucket,
          first(price, time) AS open,
          max(price) AS high,
          min(price) AS low,
          last(price, time) AS close,
          sum(volume) AS volume,
          currency_code
      FROM "TataPrice"
      GROUP BY bucket, currency_code;
  `);

  await client.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS klines_1h AS
      SELECT
          time_bucket('1 hour', time) AS bucket,
          first(price, time) AS open,
          max(price) AS high,
          min(price) AS low,
          last(price, time) AS close,
          sum(volume) AS volume,
          currency_code
      FROM "TataPrice"
      GROUP BY bucket, currency_code;
  `);

  await client.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS klines_1w AS
      SELECT
          time_bucket('1 week', time) AS bucket,
          first(price, time) AS open,
          max(price) AS high,
          min(price) AS low,
          last(price, time) AS close,
          sum(volume) AS volume,
          currency_code
      FROM "TataPrice"
      GROUP BY bucket, currency_code;
  `);

  await client.end();
  console.log("Database initialized successfully");
}

initializeDB().catch(console.error);