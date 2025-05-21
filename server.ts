import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import sqlite3 from "sqlite3";
import { promisify } from "util";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import fs from 'fs/promises';
dotenv.config();

// Initialize Express app
const app = express();
app.use(express.json());
app.use(cors({ origin: 'http://localhost:3000' })); // Allow requests from frontend on port 3000

// Global variable to store schema
let schemaInfo: string | null = null;

// Load schemaInfo from file at startup
(async () => {
    try {
        schemaInfo = await fs.readFile('schema.txt', 'utf8');
    } catch (error) {
        console.log('No schema file found yet; schemaInfo remains null.');
    }
})();

// Function to generate schema from SQLite database
async function generateSchemaInfo(): Promise<string> {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database('farming.db'); // Adjust to your database path
        db.all("SELECT name FROM sqlite_master WHERE type='table';", [], async (err, tables) => {
            if (err) {
                db.close();
                return reject(err);
            }
            let schema = '';
            for (const table of tables as Array<{ name: string }>) {
                const columns = await new Promise<any[]>((res, rej) => {
                    db.all(`PRAGMA table_info(${table.name});`, [], (e, rows) => {
                        if (e) rej(e);
                        else res(rows);
                    });
                });
                const columnNames = columns.map(col => col.name).join(', ');
                schema += `- ${table.name}: ${columnNames}\n`;
            }
            db.close();
            resolve(schema);
        });
    });
}

// Define /api/load-db endpoint
app.post('/api/load-db', async (req, res) => {
    try {
        schemaInfo = await generateSchemaInfo();
        await fs.writeFile('schema.txt', schemaInfo); // Save to file
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/is-db-loaded', async (req, res) => {
    try {
        await fs.access('schema.txt');
        res.json({ loaded: true });
    } catch (error) {
        res.json({ loaded: false });
    }
});

// Start Express server on port 3001
app.listen(3001, () => {
    console.log('API server running on port 3001');
});

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

// server.tool(
//     "load_database",
//     { schema: z.string() },
//     async (args, extra) => {
//         schemaInfo = args.schema;
//         return {
//             content: [{ type: "text", text: "Database loaded successfully." }],
//         };
//     }
// );

// Define the "query_database" tool for MCP
server.tool(
    "query_database",
    { query: z.string() },
    async (args, extra) => {
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

// Start the server
(async () => {
    const transport = new StdioServerTransport();
    await server.connect(transport);
})().catch(console.error);