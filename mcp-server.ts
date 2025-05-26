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

// Cache for generated SQL queries (userQuery -> sqlQuery)
const sqlCache: Map<string, string> = new Map();

// Cache for query results (sqlQuery -> results)
const resultCache: Map<string, any[]> = new Map();

// Load schemaInfo from file
async function loadSchema() {
    try {
        schemaInfo = await fs.readFile('schema.txt', 'utf8');
        console.log('Schema loaded successfully from disk.');
    } catch (error) {
        console.error('Failed to load schema.txt:', error);
        throw new Error('Schema file not found or unreadable');
    }
}

// Function to ensure schema is loaded
async function ensureSchemaLoaded() {
    if (!schemaInfo) {
        throw new Error('Schema not loaded');
    }
}

// Global database connection
let db: {
    all: (sql: string, params: any[]) => Promise<any[]>;
    close: () => Promise<void>;
} | null = null;

// Function to initialize the database connection
async function initDb() {
    const sqliteDb = new sqlite3.Database("farming.db");
    db = {
        all: promisify(sqliteDb.all.bind(sqliteDb)) as (sql: string, params: any[]) => Promise<any[]>,
        close: promisify(sqliteDb.close.bind(sqliteDb)) as () => Promise<void>,
    };
    console.log('Database connection opened');
}

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
    // Check if the SQL query is already cached
    if (sqlCache.has(userQuery)) {
        console.log(`SQL query retrieved from cache for: "${userQuery}"`);
        return sqlCache.get(userQuery)!; // Non-null assertion since we checked with .has()
    }

    // Generate SQL if not in cache
    const prompt = `${schemaInfo}\n\nUser query: '${userQuery}'\nBased on the user's query, generate an appropriate SQL query using the provided schema (tables and column names only). Wrap the SQL query in a code block:\n\`\`\`sql\n<your query here>\n\`\`\``;
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    const sqlMatch = text.match(/```(?:sql)?\n([\s\S]*?)\n```/);
    const sqlQuery = sqlMatch ? sqlMatch[1].trim() : text.trim();

    // Cache the generated SQL query
    sqlCache.set(userQuery, sqlQuery);
    console.log(`SQL query generated and cached for: "${userQuery}"`);
    return sqlQuery;
}

// Function to execute SQL on the database
async function executeSql(sql: string): Promise<any> {
    // Check if the query results are already cached
    if (resultCache.has(sql)) {
        console.log(`Query results retrieved from cache for SQL: "${sql}"`);
        return resultCache.get(sql)!; // Non-null assertion since we checked with .has()
    }

    // Execute query if not in cache
    if (!db) {
        throw new Error('Database connection not initialized');
    }
    const rows = await db.all(sql, []);
    
    // Cache the results
    resultCache.set(sql, rows);
    console.log(`Query executed and results cached for SQL: "${sql}"`);
    return rows;
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
    return response.text();
}

// Define the "query_database" tool for MCP
server.tool(
    "query_database",
    { query: z.string() },
    async (args, extra) => {
        await ensureSchemaLoaded();
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

// Start the MCP server after loading schema and initializing DB
(async () => {
    try {
        await loadSchema(); // Load schema first
        await initDb();     // Initialize the database connection
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.log('MCP server running with StdioServerTransport');
    } catch (error) {
        console.error('Failed to start MCP server:', error);
        process.exit(1); // Exit if schema loading or DB init fails
    }
})();

// Function to close the database connection
async function closeDb() {
    if (db) {
        await db.close();
        console.log('Database connection closed');
    }
}

// Handle process cleanup
process.on('exit', () => {
    closeDb().catch(console.error);
});