import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import sqlite3 from "sqlite3";
import { promisify } from "util";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs/promises';
import * as dotenv from 'dotenv';
dotenv.config();

// Global variable to store schema
let schemaInfo: string | null = null;

let schemaLoadPromise: Promise<void> | null = null;

// Load schemaInfo from file at startup
schemaLoadPromise = (async () => {
    try {
        schemaInfo = await fs.readFile('schema.txt', 'utf8');
    } catch (error) {
        console.log('No schema file found yet; schemaInfo remains null.');
    }
})();

// Function to ensure schema is loaded before proceeding
async function ensureSchemaLoaded() {
    if (schemaLoadPromise) {
        await schemaLoadPromise;
        schemaLoadPromise = null; // Clear after loading
    }
}

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

// Function to generate SQL with Gemini
async function generateSqlWithGemini(userQuery: string): Promise<string> {
    const prompt = `${schemaInfo}\n\nUser query: '${userQuery}'\nBased on the user's query, generate an appropriate SQL query to retrieve the relevant information, and wrap it in a code block like in the examples.\nSQL:`;
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    const sqlMatch = text.match(/```(?:sql)?\n([\s\S]*?)\n```/);
    if (sqlMatch) {
        return sqlMatch[1].trim();
    } else {
        return text.trim();
    }
}

// Function to execute SQL on the database
async function executeSql(sql: string): Promise<any> {
    const db = getDb();
    try {
        const rows = await db.all(sql, []);
        return rows;
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
        await ensureSchemaLoaded(); // Ensure schema is loaded before proceeding
        if (!schemaInfo) {
            return {
                content: [{ type: "text", text: "Error: Database schema not loaded." }],
                isError: true,
            };
        }
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

// Start the MCP server after ensuring schema is loaded
(async () => {
    await ensureSchemaLoaded(); // Wait for schema to load
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log('MCP server running with StdioServerTransport');
})().catch(console.error);