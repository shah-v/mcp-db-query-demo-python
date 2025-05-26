import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import sqlite3 from "sqlite3";
import { promisify } from "util";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs/promises';
import * as dotenv from 'dotenv';
dotenv.config();
import path from 'path';
import fs2 from 'fs';

// Logging setup
const logFile = path.join(__dirname, 'mcp-server.log');
function logToFile(message: string) {
  fs2.appendFileSync(logFile, `${new Date().toISOString()} - ${message}\n`);
}

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
    logToFile(`Schema content: "${schemaInfo}"`);
  } catch (error) {
    console.error('Failed to load schema.txt:', error);
    throw new Error('Schema file not found or unreadable');
  }
}

// Function to ensure schema is loaded
async function ensureSchemaLoaded() {
  if (!schemaInfo) {
    logToFile('Schema not loaded - throwing error');
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
}

// Initialize MCP Server
const server = new McpServer({
  name: "Farming Database Server",
  version: "1.0.0",
});

// Set up Gemini API client
const apiKey = process.env.GEMINI_API_KEY || "";
if (!apiKey) {
  logToFile('GEMINI_API_KEY is not set in the .env file - throwing error');
  throw new Error("GEMINI_API_KEY is not set in the .env file");
}
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Function to generate SQL with Gemini
async function generateSqlWithGemini(mode: string, userQuery: string): Promise<string> {
  // Check if the SQL query is already cached
  const cacheKey = `${mode}:${userQuery}`;
  if (sqlCache.has(cacheKey)) {
    console.log(`SQL query retrieved from cache for: "${cacheKey}"`);
    return sqlCache.get(cacheKey)!;
  }

  // Detect mode from user query
  let actualQuery = userQuery.trim();
  if (actualQuery.toLowerCase().startsWith('search:')) {
    mode = 'search';
    actualQuery = actualQuery.substring(7).trim();
  } else if (actualQuery.toLowerCase().startsWith('modify:')) {
    mode = 'modify';
    actualQuery = actualQuery.substring(7).trim();
  }

  // Generate mode-specific prompt
  let prompt;
  if (mode === 'search') {
    prompt = `${schemaInfo}\n\nUser query: '${actualQuery}'\nYou are in SEARCH MODE. Generate a SELECT SQL query to retrieve the relevant information based on the user's query. Do not generate any queries that modify the database (e.g., INSERT, UPDATE, DELETE, CREATE, ALTER). Wrap the SQL query in a code block:\n\`\`\`sql\n<your query here>\n\`\`\``;
    logToFile(`Generated SEARCH MODE prompt: "${prompt}"`);
} else {
    prompt = `${schemaInfo}\n\nUser query: '${actualQuery}'\nYou are in MODIFY MODE. Generate an appropriate SQL query based on the user's query, which may include INSERT, UPDATE, DELETE, CREATE, ALTER, etc. Wrap the SQL query in a code block:\n\`\`\`sql\n<your query here>\n\`\`\``;
    logToFile(`Generated MODIFY MODE prompt: "${prompt}"`);
  }

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  const sqlMatch = text.match(/```(?:sql)?\n([\s\S]*?)\n```/);
  const sqlQuery = sqlMatch ? sqlMatch[1].trim() : text.trim();

  // Cache the generated SQL query
  sqlCache.set(cacheKey, sqlQuery);
  return sqlQuery;
}

// Function to execute SQL on the database
async function executeSql(sql: string, mode: string): Promise<any> {
  // Check if the query results are already cached
  if (resultCache.has(sql)) {
    return resultCache.get(sql)!;
  }

  // Enforce Search Mode constraints
  if (mode === 'search' && !sql.trim().toUpperCase().startsWith('SELECT')) {
    throw new Error('Only SELECT queries are allowed in Search Mode');
  }

  // Execute query if not in cache
  if (!db) {
    throw new Error('Database connection not initialized');
  }
  const rows = await db.all(sql, []);

  // Cache the results
  resultCache.set(sql, rows);
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
  const text = response.text();
  return text;
}

// Define the "query_database" tool for MCP
server.tool(
  "query_database",
  { query: z.string() },
  async (args, extra) => {
    await ensureSchemaLoaded();
    let originalQuery = args.query;
    let userQuery = originalQuery.trim();

    let mode = 'search'; // Default to search mode
    if (userQuery.toLowerCase().startsWith('search:')) {
      mode = 'search';
      userQuery = userQuery.substring(7).trim();
    } else if (userQuery.toLowerCase().startsWith('modify:')) {
      mode = 'modify';
      userQuery = userQuery.substring(7).trim();
    }

    try {
      const sqlQuery = await generateSqlWithGemini(mode, userQuery);
      const result = await executeSql(sqlQuery, mode);
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
    closeDb().catch(error => logToFile(`Error closing DB: ${error}`));
  });