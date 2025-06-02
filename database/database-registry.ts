import { databaseRegistry } from './database';
import { MSSQLDatabaseImpl } from './implementations/mssql-database';
import { MongoDBDatabaseImpl } from './implementations/mongodb-database';
import { SQLiteDatabaseImpl } from './implementations/sqlite-database';

// Register MSSQL implementation
databaseRegistry.set('mssql', MSSQLDatabaseImpl);

// Register MongoDB implementation
databaseRegistry.set('mongodb', MongoDBDatabaseImpl);

// Register SQLite implementation
databaseRegistry.set('sqlite', SQLiteDatabaseImpl);
