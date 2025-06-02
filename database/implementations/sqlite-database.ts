import { promisify } from 'util';
import { Database, DatabaseConfig } from '../database';

export class SQLiteDatabaseImpl extends Database {
    private db: import('sqlite3').Database | null = null;
    private dbPath: string;

    constructor(config: DatabaseConfig) {
        super();
        if (config.type !== 'sqlite' || !config.path) {
            throw new Error('SQLiteDatabaseImpl requires a "path" in config');
        }
        this.dbPath = config.path as string;
    }

    async connect(): Promise<void> {
        const sqlite3 = await import('sqlite3');
        this.db = new sqlite3.Database(this.dbPath);
    }

    async query(sql: string, params: any[] = []): Promise<any[]> {
        if (!this.db) throw new Error('Database not connected');
        const allAsync = promisify(this.db.all.bind(this.db)) as (sql: string, params: any[]) => Promise<any[]>;
        return allAsync(sql, params);
    }

    async getSchema(): Promise<string> {
        if (!this.db) throw new Error('Database not connected');
        const tables = await this.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
        let schemaText = "Database Schema:\n";
        for (const table of tables) {
            const tableName = table.name;
            schemaText += `${tableName}: `;
            const columns = await this.query(`PRAGMA table_info(${tableName});`);
            const columnNames = columns.map((col: any) => col.name).join(', ');
            schemaText += `${columnNames}\n`;
        }
        return schemaText;
    }

    async close(): Promise<void> {
        if (this.db) {
            await promisify(this.db.close.bind(this.db))();
            this.db = null;
        }
    }
}