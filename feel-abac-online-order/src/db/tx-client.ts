import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Configure Neon to use the ws WebSocket implementation in Node.js
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString });

export const dbTx = drizzle({ client: pool, schema });

