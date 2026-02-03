// Re-export everything from the db folder for convenient imports
// This file is marked as .server.ts to ensure it only runs on the server

import "dotenv/config";

export * from "../db/schema";
export { db } from "../db";
