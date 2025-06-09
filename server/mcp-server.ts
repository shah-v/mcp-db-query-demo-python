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
import { createAIProvider } from "./ai-provider-factory";
import { GeminiAIProvider } from "./gemini-ai-provider";
import { HuggingFaceAIProvider } from "./huggingface-ai-provider";
import { AIProvider } from "./ai-provider";
import { NovitaAIProvider } from "./novita-ai-provider";

// Logging setup
const logFile = path.join(__dirname, 'mcp-server.log');
export function logToFile(message: string) {
  fs2.appendFileSync(logFile, `${new Date().toISOString()} - ${message}\n`);
}

// Global variable to store schema
let schemaInfo: string | null = null;

// Cache for generated SQL queries (userQuery -> sqlQuery)
const sqlCache: Map<string, string | object> = new Map();

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

const aiProvider = createAIProvider();



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


// Define the "query_database" tool for MCP
server.tool(
  "query_database",
  {
    query: z.string(),
    aiProvider: z.string(),
    includeQuery: z.boolean(),
    includeExplanation: z.boolean(),
    includeResults: z.boolean()
  },
  async (args) => {
    const { query, aiProvider: aiProviderStr, includeQuery, includeExplanation, includeResults } = args;
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

    const userQuery = query.trim();
    const mode = userQuery.toLowerCase().startsWith('modify:') ? 'modify' : 'search';
    const queryText = userQuery.replace(/^(search|modify):/i, '').trim();

    // Dynamically create AI provider
    let aiProvider: AIProvider;
    if (aiProviderStr === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
      aiProvider = new GeminiAIProvider(apiKey);
    } else if (aiProviderStr.startsWith('huggingface:')) {
      const model = aiProviderStr.split(':')[1];
      const apiKey = process.env.HUGGINGFACE_API_KEY;
      if (!apiKey) throw new Error('HUGGINGFACE_API_KEY is not set');
      aiProvider = new HuggingFaceAIProvider(apiKey, model);
    } else if (aiProviderStr.startsWith('novita:')) {
      const model = aiProviderStr.split(':')[1];
      const apiKey = process.env.HUGGINGFACE_API_KEY; // Reuse HF key, or use NOVITA_API_KEY if separate
      if (!apiKey) throw new Error('HUGGINGFACE_API_KEY is not set');
      aiProvider = new NovitaAIProvider(apiKey, model);
    } else {
      throw new Error(`Unsupported AI provider: ${aiProviderStr}`);
    }

    logToFile(`Using AI provider: ${aiProviderStr}`);

    try {
      const generatedQuery = await aiProvider.generateQuery({
        schemaInfo: schemaInfo!,
        mode,
        userQuery: queryText,
        dbType,
      });
      let result: any[] | undefined;
      if (includeResults) {
        result = await executeQuery(generatedQuery, mode, dbType);
      }
      let explanation: string | null = null;
      if (includeExplanation) {
        explanation = includeResults
          ? await aiProvider.generateExplanation({
              userQuery: queryText,
              results: result!,
            })
          : "Explanation not available without query results.";
      }
      const responseObj: { results?: any[]; query?: string | object; explanation?: string | null } = {};
      if (includeQuery) {
        responseObj.query = generatedQuery;
      }
      if (includeResults) {
        responseObj.results = result;
      }
      if (includeExplanation) {
        responseObj.explanation = explanation;
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify(responseObj)
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