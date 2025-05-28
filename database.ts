import { promisify } from 'util';

export abstract class Database {
    abstract connect(): Promise<void>;
    abstract query(sql: string, params?: any[]): Promise<any[]>;
    abstract getSchema(): Promise<string>;
    abstract close(): Promise<void>;
  }
  
  export class SQLiteDatabaseImpl extends Database {
    private db: import('sqlite3').Database | null = null;
    private dbPath: string;
  
    constructor(dbPath: string) {
      super();
      this.dbPath = dbPath;
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