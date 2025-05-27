import express from 'express';
import cors from 'cors';
import sqlite3 from "sqlite3";
import { promisify } from "util";
import fs from 'fs/promises';
import * as dotenv from 'dotenv';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
dotenv.config();

// Initialize Express app
const app = express();
app.use(express.json());
app.use(cors({ origin: 'http://localhost:3000' })); // Allow requests from frontend on port 3000

// Global variable to store schema
let schemaInfo: string | null = null;

// Database connection helper
const getDb = (dbFile: string) => {
    const db = new sqlite3.Database(dbFile);
    return {
        all: promisify(db.all.bind(db)) as (sql: string, params: any[]) => Promise<any[]>,
        close: promisify(db.close.bind(db)) as () => Promise<void>,
    };
};

// Function to generate schema from SQLite database
async function generateSchemaInfo(dbFile: string): Promise<string> {
    const db = getDb(dbFile);
    try {
        const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';", []);
        let schemaText = "Database Schema:\n";
        for (const table of tables) {
            const tableName = table.name;
            schemaText += `${tableName}: `;
            const columns = await db.all(`PRAGMA table_info(${tableName});`, []);
            const columnNames = columns.map(col => col.name).join(', ');
            schemaText += `${columnNames}\n`;
        }
        return schemaText;
    } finally {
        await db.close();
    }
}

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Define /api/load-db endpoint
app.post('/api/load-db', upload.single('dbFile'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            res.status(400).json({ success: false, error: 'No file uploaded' });
            return;
        }
        const dbFilePath = path.join(__dirname, 'uploads', 'current.db');
        await fs.rename(file.path, dbFilePath);
        schemaInfo = await generateSchemaInfo(dbFilePath);
        await fs.writeFile('schema.txt', schemaInfo);
        const config: { path: string; name: string } = { path: dbFilePath, name: file.originalname };
        await fs.writeFile('db-config.txt', JSON.stringify(config));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/is-db-loaded', async (req, res) => {
    try {
        await fs.access('schema.txt');
        const configData = await fs.readFile('db-config.txt', 'utf8');
        const config: { path: string; name: string } = JSON.parse(configData);
        res.json({ loaded: true, dbName: config.name });
    } catch (error) {
        res.json({ loaded: false });
    }
});

// Start Express server on port 3001
app.listen(3001, () => {
    console.log('API server running on port 3001');
});