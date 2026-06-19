import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/startupforge";
const client = new MongoClient(uri);

let db = null;

export async function connectDB() {
  if (db) return { db, client };
  try {
    await client.connect();
    db = client.db();
    console.log("Connected successfully to MongoDB");
    return { db, client };
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
}

export function getDB() {
  if (!db) {
    throw new Error("Database not initialized. Call connectDB() first.");
  }
  return db;
}

export { client };
