import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import sqlite3 from "sqlite3";
import { promisify } from "util";
import { z } from "zod";
import { URL } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from 'dotenv';
dotenv.config();

// Database connection helper
const getDb = () => {
  const db = new sqlite3.Database("farming.db");
  return {
    all: promisify(db.all.bind(db)) as (sql: string, params: any[]) => Promise<any[]>,
    close: promisify(db.close.bind(db)) as () => Promise<void>,
  };
};

// Initialize MCP Server
const server = new McpServer({
  name: "Farming Database Server",
  version: "1.0.0",
});

// Set up Gemini API client
const apiKey = process.env.GEMINI_API_KEY || "";
if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in the .env file");
}
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Define the database schema for Gemini
const schemaInfo = `
You have a database with these tables:
- farms: id, name, location
- crops: id, farm_id, type, planting_date
- harvests: id, crop_id, harvest_date, quantity
`;

// Function to generate SQL with Gemini
async function generateSqlWithGemini(userQuery: string): Promise<string> {
    const prompt = `${schemaInfo}\n\nBased on the user's query: '${userQuery}', generate an SQL query to retrieve the answer.`;
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
  
    // Extract the SQL query from the markdown code block
    const sqlMatch = text.match(/```sql\n([\s\S]*?)\n```/);
    if (sqlMatch) {
      return sqlMatch[1].trim();  // Return the clean SQL query
    } else {
      throw new Error("No SQL query found in the response.");
    }
  }

// Function to execute SQL on the database
async function executeSql(sql: string): Promise<any> {
  const db = getDb();
  try {
    const rows = await db.all(sql, []);
    return rows; // Returns the query results
  } finally {
    await db.close();
  }
}

// Define the "query_database" tool for MCP
server.tool(
  "query_database",
  { query: z.string() },
  async (args, extra) => {
    const userQuery = args.query; // Example: "how many farms are there?"
    try {
      const sqlQuery = await generateSqlWithGemini(userQuery);
      const result = await executeSql(sqlQuery);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Start the server
(async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
})().catch(console.error);