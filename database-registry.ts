import { databaseRegistry } from './database';
import { MSSQLDatabaseImpl } from './mssql-database';
import { MongoDBDatabaseImpl } from './mongodb-database';

// Register MSSQL implementation
databaseRegistry.set('mssql', MSSQLDatabaseImpl);

// Register MongoDB implementation
databaseRegistry.set('mongodb', MongoDBDatabaseImpl);