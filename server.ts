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

// Define the database schema with examples for Gemini
const schemaInfo = `
You have a database with these tables:
- farms: id, name, location
- crops: id, farm_id, type, planting_date
- harvests: id, crop_id, harvest_date, quantity

Examples of user queries and corresponding SQL queries:
1. User query: "List all farms"
   SQL: SELECT * FROM farms;

2. User query: "Crops in Green Acres"
   SQL: SELECT * FROM crops WHERE farm_id = (SELECT id FROM farms WHERE name = 'Green Acres');

3. User query: "What is wheat?"
   SQL: SELECT c.*, f.name as farm_name, h.harvest_date, h.quantity 
        FROM crops c 
        JOIN farms f ON c.farm_id = f.id 
        LEFT JOIN harvests h ON c.id = h.crop_id 
        WHERE c.type = 'wheat';

4. User query: "How many farms are there?"
   SQL: SELECT COUNT(*) FROM farms;

Based on the user's query, generate an appropriate SQL query to retrieve the relevant information.
`;

// Function to generate SQL with Gemini
async function generateSqlWithGemini(userQuery: string): Promise<string> {
    const prompt = `${schemaInfo}\n\nUser query: '${userQuery}'\nBased on the user's query, generate an appropriate SQL query to retrieve the relevant information, and wrap it in a code block like in the examples.\nSQL:`;
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Extract the SQL query from the Markdown code block
    const sqlMatch = text.match(/```(?:sql)?\n([\s\S]*?)\n```/);
    if (sqlMatch) {
        return sqlMatch[1].trim();  // Return the clean SQL query
    } else {
        // Fallback: if no code block is found, assume the entire response is the SQL query
        return text.trim();
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

// Function to generate explanation with Gemini
async function generateExplanation(userQuery: string, results: any[]): Promise<string> {
    let prompt;
    if (results.length === 0) {
        prompt = `The user's query was: '${userQuery}'. No data was found in the database. Provide a natural language response indicating that no information is available.`;
    } else {
        prompt = `The user's query was: '${userQuery}'. The database returned the following results: ${JSON.stringify(results)}. Provide a concise natural language summary of these results, strictly based on the data provided. Do not include any information not present in the results.`;
    }
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    return text;
}

// Define the "query_database" tool for MCP
server.tool(
    "query_database",
    { query: z.string() },
    async (args, extra) => {
        const userQuery = args.query;
        try {
            const sqlQuery = await generateSqlWithGemini(userQuery);
            const result = await executeSql(sqlQuery);
            const explanation = await generateExplanation(userQuery, result);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ results: result, sqlQuery, explanation }),
                    },
                ],
            };
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