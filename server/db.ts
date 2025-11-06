import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { users, sessions, projects, tilesets, tilesetPacks, boards, physicsConfigs, materialConfigs, physicsEntities } from "../shared/schema";
import { config } from 'dotenv';

// Load environment variables
config();

// Check if we should use memory storage
let db: any;

if (process.env.USE_MEMORY_STORAGE === 'true') {
  console.log('Using memory storage - database features disabled');
  // Create a mock db object for memory storage mode
  db = {
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([]) }) }),
    update: () => ({ set: () => ({ where: () => Promise.resolve([]) }) }),
    delete: () => ({ where: () => Promise.resolve([]) })
  } as any;
} else {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  
  const sql = neon(process.env.DATABASE_URL);
  db = drizzle(sql);
}

export { db, users, sessions, projects, tilesets, tilesetPacks, boards, physicsConfigs, materialConfigs, physicsEntities };
