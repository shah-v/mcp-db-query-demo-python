import { ConnectionPool } from 'mssql';
import { Database, DatabaseConfig } from '../database';

export class MSSQLDatabaseImpl extends Database {
    private pool: ConnectionPool | null = null;
    private config: DatabaseConfig;

    constructor(config: DatabaseConfig) {
        super();
        if (config.type !== 'mssql' || !config.server || !config.database) {
            throw new Error('MSSQLDatabaseImpl requires "server" and "database" in config');
        }
        this.config = config;
    }

    async connect(): Promise<void> {
        this.pool = new ConnectionPool({
            server: this.config.server,
            database: this.config.database,
            user: this.config.user,
            password: this.config.password,
            options: {
                encrypt: true, // For Azure SQL
                trustServerCertificate: true // For local dev
            }
        });
        await this.pool.connect();
    }

    async query(sql: string, params: any[] = []): Promise<any[]> {
        if (!this.pool) throw new Error('Database not connected');
        const request = this.pool.request();
        params.forEach((param, index) => {
            request.input(`param${index}`, param);
        });
        const result = await request.query(sql);
        return result.recordset;
    }

    async getSchema(): Promise<string> {
        if (!this.pool) throw new Error('Database not connected');
        const tables = await this.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
        let schemaText = "Database Schema:\n";
        for (const table of tables) {
            const tableName = table.TABLE_NAME;
            schemaText += `${tableName}: `;
            const columns = await this.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${tableName}'`);
            const columnNames = columns.map((col: any) => col.COLUMN_NAME).join(', ');
            schemaText += `${columnNames}\n`;
        }
        return schemaText;
    }

    async close(): Promise<void> {
        if (this.pool) {
            await this.pool.close();
            this.pool = null;
        }
    }
}
