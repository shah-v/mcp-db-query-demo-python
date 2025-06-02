import express from 'express';
import './database-registry';
import cors from 'cors';
import { createDatabase, Database, DatabaseConfig, SQLiteDatabaseImpl } from './database';
import { promisify } from "util";
import fs from 'fs/promises';
import * as dotenv from 'dotenv';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
dotenv.config();

interface DbConfigRequest {
    type: string;
    [key: string]: string; // Flexible for different database config fields
  }

// Initialize Express app
const app = express();
app.use(express.json());
app.use(cors({ origin: 'http://localhost:3000' })); // Allow requests from frontend on port 3000

// Global variable to store schema
let schemaInfo: string | null = null;

async function generateSchemaInfo(db: Database): Promise<string> {
    await db.connect();
    try {
      return await db.getSchema();
    } finally {
      await db.close();
    }
  }

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

app.post('/api/load-db', upload.single('dbFile'), async (req: express.Request, res: express.Response) => {
    try {
      const { type, ...dbConfig } = req.body as DbConfigRequest;
      let config: DatabaseConfig;
  
      if (type === 'sqlite') {
        const file = req.file;
        if (!file) {
          res.status(400).json({ success: false, error: 'No file uploaded for SQLite' });
          return;
        }
        const dbFilePath = path.join(__dirname, 'uploads', 'current.db');
        await fs.rename(file.path, dbFilePath);
        config = { type: 'sqlite', path: dbFilePath, name: file.originalname };
      } else if (type === 'mssql') {
        const { server, database, user, password } = dbConfig;
        if (!server || !database || !user || !password) {
          res.status(400).json({ success: false, error: 'Missing MSSQL connection details' });
          return;
        }
        config = { type: 'mssql', server, database, user, password };
      } else if (type === 'mongodb') {
        const { url, dbName } = dbConfig;
        if (!url || !dbName) {
          res.status(400).json({ success: false, error: 'Missing MongoDB connection details' });
          return;
        }
        config = { type: 'mongodb', url, dbName };
      } else {
        res.status(400).json({ success: false, error: 'Unsupported database type' });
        return;
      }
  
      const db: Database = createDatabase(config);
      schemaInfo = await generateSchemaInfo(db);
      await fs.writeFile('schema.txt', schemaInfo);
      await fs.writeFile('db-config.txt', JSON.stringify(config));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/is-db-loaded', async (req: express.Request, res: express.Response) => {
    try {
      await fs.access('schema.txt');
      const configData = await fs.readFile('db-config.txt', 'utf8');
      const config: DatabaseConfig = JSON.parse(configData);
      const dbName = config.name || (config.type === 'mssql' ? config.database : config.dbName) || 'Unknown';
      res.json({ loaded: true, dbName });
    } catch (error) {
      res.json({ loaded: false });
    }
  });

// Start Express server on port 3001
app.listen(3001, () => {
    console.log('API server running on port 3001');
});