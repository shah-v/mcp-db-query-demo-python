import express from 'express';
import cors from 'cors';
import sqlite3 from "sqlite3";
import { promisify } from "util";
import fs from 'fs/promises';
import * as dotenv from 'dotenv';
dotenv.config();

// Initialize Express app
const app = express();
app.use(express.json());
app.use(cors({ origin: 'http://localhost:3000' })); // Allow requests from frontend on port 3000

// Global variable to store schema
let schemaInfo: string | null = null;

// Database connection helper
const getDb = () => {
    const db = new sqlite3.Database("farming.db");
    return {
        all: promisify(db.all.bind(db)) as (sql: string, params: any[]) => Promise<any[]>,
        close: promisify(db.close.bind(db)) as () => Promise<void>,
    };
};

// Function to generate schema from SQLite database
async function generateSchemaInfo(): Promise<string> {
    const db = getDb();
    try {
        const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';", []);
        let schemaText = "Database Schema:\n";
        for (const table of tables) {
            const tableName = table.name;
            schemaText += `\nTable: ${tableName}\n`;
            const columns = await db.all(`PRAGMA table_info(${tableName});`, []);
            for (const column of columns) {
                schemaText += `  - ${column.name} (${column.type}${column.pk ? ', PRIMARY KEY' : ''}${column.notnull ? ', NOT NULL' : ''})\n`;
            }
        }
        return schemaText;
    } finally {
        await db.close();
    }
}

// Define /api/load-db endpoint
app.post('/api/load-db', async (req, res) => {
    console.log('SERVER: /api/load-db hit');
    try {
        schemaInfo = await generateSchemaInfo();
        await fs.writeFile('schema.txt', schemaInfo); // Save to file
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/is-db-loaded', async (req, res) => {
    console.log('SERVER: /api/is-db-loaded hit');
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