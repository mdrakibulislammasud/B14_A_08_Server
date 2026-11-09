
import "dotenv/config";
import { MongoClient } from "mongodb";

// Validate required environment variables
if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is missing in .env");
}

if (!process.env.DB_NAME) {
  throw new Error("DB_NAME is missing in .env");
}

// Create MongoDB client
export const client = new MongoClient(
  process.env.MONGODB_URI
);

// Reuse the same connection promise
let connectionPromise = null;

export async function connectDB() {
  if (!connectionPromise) {
    connectionPromise = (async () => {
      await client.connect();

      const database = client.db(process.env.DB_NAME);

      const events = database.collection("events");
      const joins = database.collection("joins");

      // Prevent duplicate event joining by the same user
      await joins.createIndex(
        { eventId: 1, userEmail: 1 },
        { unique: true }
      );

      // Improve event query performance
      await events.createIndex({ date: 1 });
      await events.createIndex({ creatorEmail: 1 });

      console.log("MongoDB Connected Successfully");

      return database;
    })().catch((error) => {
      connectionPromise = null;
      throw error;
    });
  }

  return connectionPromise;
}

// Get application collections
export async function getCollections() {
  const database = await connectDB();

  return {
    events: database.collection("events"),
    joins: database.collection("joins")
  };
}
