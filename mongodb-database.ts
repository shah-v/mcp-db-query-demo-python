import { MongoClient, Db } from 'mongodb';
import { Database, DatabaseConfig } from './database';

export class MongoDBDatabaseImpl extends Database {
    private client: MongoClient | null = null;
    private db: Db | null = null;
    private config: DatabaseConfig;

    constructor(config: DatabaseConfig) {
        super();
        if (config.type !== 'mongodb' || !config.url || !config.dbName) {
            throw new Error('MongoDBDatabaseImpl requires "url" and "dbName" in config');
        }
        this.config = config;
    }

    async connect(): Promise<void> {
        this.client = new MongoClient(this.config.url);
        await this.client.connect();
        this.db = this.client.db(this.config.dbName);
    }

    async query(query: object, params?: any[]): Promise<any[]> {
        if (!this.db) throw new Error('Database not connected');
        const { collection, operation, ...rest } = query as any;
        if (!collection || !operation) {
            throw new Error('MongoDB query requires "collection" and "operation"');
        }
        const coll = this.db.collection(collection);
        switch (operation) {
            case 'find':
                return coll.find(rest.filter || {}).toArray();
            case 'aggregate':
                return coll.aggregate(rest.pipeline || []).toArray();
            default:
                throw new Error(`Unsupported MongoDB operation: ${operation}`);
        }
    }

    async getSchema(): Promise<string> {
        if (!this.db) throw new Error('Database not connected');
        const collections = await this.db.listCollections().toArray();
        let schemaText = "Database Schema:\n";
        for (const coll of collections) {
            schemaText += `${coll.name}: (MongoDB collection)\n`;
        }
        return schemaText;
    }

    async close(): Promise<void> {
        if (this.client) {
            await this.client.close();
            this.client = null;
            this.db = null;
        }
    }
}