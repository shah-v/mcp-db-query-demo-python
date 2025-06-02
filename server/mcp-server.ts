import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import '../database/database-registry';
import sqlite3 from "sqlite3";
import { promisify } from "util";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs/promises';
import * as dotenv from 'dotenv';
dotenv.config();
import path from 'path';
import fs2 from 'fs';
import { createDatabase, Database, DatabaseConfig } from '../database/database';

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
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logToFile('Schema file not found - starting without schema');
        schemaInfo = null; // Initialize as null if file doesn’t exist
      } else {
        console.error('Unexpected error loading schema.txt:', error);
        throw error; // Throw only for unexpected errors (e.g., permissions)
      }
    }
  }

// Function to ensure schema is loaded
async function ensureSchemaLoaded() {
    if (!schemaInfo) {
      logToFile('Schema not loaded - checking for schema.txt');
      try {
        schemaInfo = await fs.readFile('schema.txt', 'utf8');
        logToFile(`Schema loaded: "${schemaInfo}"`);
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          throw new Error('No database uploaded yet - please upload a database first');
        }
        throw error; // Re-throw unexpected errors
      }
    }
  }

  let db: Database | null = null;

  async function reloadDb(): Promise<void> {
    try {
      if (db) {
        await db.close();
        logToFile('Existing database connection closed');
        db = null;
      }
      const configData = await fs.readFile('db-config.txt', 'utf8');
      const config: DatabaseConfig = JSON.parse(configData);
      db = createDatabase(config);
      await db.connect();
      logToFile(`Connected to ${config.type} database`);
  
      // Reload schema to match the new database
      schemaInfo = await fs.readFile('schema.txt', 'utf8');
      logToFile(`Schema reloaded: "${schemaInfo}"`);
  
      // Clear caches for the new database
      sqlCache.clear();
      resultCache.clear();
      logToFile('SQL and result caches cleared');
    } catch (error: any) {
      logToFile(`Failed to reload database or schema: ${error.message}`);
      throw new Error('Failed to reload database or schema');
    }
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
async function generateQueryWithGemini(mode: string, userQuery: string, dbType: string): Promise<string | object> {
    const cacheKey = `${mode}:${userQuery}:${dbType}`;
    if (sqlCache.has(cacheKey)) {
      console.log(`Query retrieved from cache for: "${cacheKey}"`);
      return sqlCache.get(cacheKey)!;
    }
  
    let prompt;
    if (dbType === 'mongodb') {
      prompt = `${schemaInfo}\n\nUser query: '${userQuery}'\nGenerate a MongoDB query object for the following operation in SEARCH MODE. Wrap the query in a code block:\n\`\`\`json\n{ "collection": "collectionName", "operation": "find", "filter": { ... } }\n\`\`\``;
    } else {
      prompt = `${schemaInfo}\n\nUser query: '${userQuery}'\nYou are in ${mode.toUpperCase()} MODE. Generate an SQL query...`; // Existing SQL prompt
    }
  
    const result = await model.generateContent(prompt);
    const text = result.response.text();
  
    let query: string;
    if (dbType === 'mongodb') {
      const match = text.match(/```json\n([\s\S]*?)\n```/);
      query = match ? JSON.parse(match[1]) : text.trim();
    } else {
      const sqlMatch = text.match(/```sql\n([\s\S]*?)\n```/);
      query = sqlMatch ? sqlMatch[1].trim() : text.trim();
    }
  
    sqlCache.set(cacheKey, query);
    return query;
  }

  async function executeQuery(query: string | object, mode: string, dbType: string): Promise<any[]> {
    const cacheKey = JSON.stringify(query);
    if (resultCache.has(cacheKey)) {
      return resultCache.get(cacheKey)!;
    }
    if (!db) {
      throw new Error('Database connection not initialized');
    }
    let rows: any[];
    if (dbType === 'mongodb') {
      if (typeof query !== 'object') throw new Error('MongoDB query must be an object');
      rows = await db.query(query);
    } else {
      if (typeof query !== 'string') throw new Error('SQL query must be a string');
      if (mode === 'search' && !query.trim().toUpperCase().startsWith('SELECT')) {
        throw new Error('Only SELECT queries are allowed in Search Mode');
      }
      rows = await db.query(query);
    }
    resultCache.set(cacheKey, rows);
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
    async (args) => {
      await ensureSchemaLoaded();
      try {
        await reloadDb();
      } catch (error: any) {
        logToFile(`Failed to reload database: ${error.message}`);
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
      }
  
      const configData = await fs.readFile('db-config.txt', 'utf8');
      const config: DatabaseConfig = JSON.parse(configData);
      const dbType = config.type;
  
      const userQuery = args.query.trim();
      const mode = userQuery.toLowerCase().startsWith('modify:') ? 'modify' : 'search';
      const queryText = userQuery.replace(/^(search|modify):/i, '').trim();
  
      try {
        const query = await generateQueryWithGemini(mode, queryText, dbType);
        const result = await executeQuery(query, mode, dbType);
        const explanation = await generateExplanation(queryText, result);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ results: result, sqlQuery: query, explanation })
          }]
        };
      } catch (error: any) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
      }
    }
  );

// Start the MCP server after loading schema and initializing DB
(async () => {
  try {
    await loadSchema(); // Attempt to load schema, but proceed if not found
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log('MCP server running with StdioServerTransport');
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1); // Exit only for critical errors
  }
})();

// Handle process cleanup
process.on('exit', () => {
    if (db) {
      db.close().catch(error => logToFile(`Error closing DB: ${error}`));
    }
  });