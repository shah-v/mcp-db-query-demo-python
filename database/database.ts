// Define a generic config type for all databases
export type DatabaseConfig = {
    type: string; // e.g., 'sqlite', 'mssql', 'mongodb'
    [key: string]: any; // Allow any additional properties for flexibility
};

// Define the abstract Database contract
export abstract class Database {
    abstract connect(): Promise<void>;
    abstract query(query: string | object, params?: any[]): Promise<any[]>;
    abstract getSchema(): Promise<string>;
    abstract close(): Promise<void>;
}

// Registry to hold database implementations
export const databaseRegistry: Map<
    string,
    new (config: DatabaseConfig) => Database
> = new Map();

// Factory function to create database instances
export function createDatabase(config: DatabaseConfig): Database {
    const Impl = databaseRegistry.get(config.type);
    if (!Impl) {
        throw new Error(`Unsupported database type: ${config.type}`);
    }
    return new Impl(config);
}