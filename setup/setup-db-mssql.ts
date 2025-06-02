import * as sql from 'mssql';

// MSSQL connection configuration - replace with your actual details
const config = {
    user: 'sa',
    password: 'YourPAssword',
    server: 'localhost', // e.g., 'localhost' or 'your_server_name'
    database: 'Farming', // e.g., 'FarmingDB'
    options: {
        encrypt: true, // Set to true if using Azure MSSQL
        trustServerCertificate: true // Set to true for local development
    }
};

async function setupDatabase() {
    let pool: sql.ConnectionPool | undefined; // Declare pool with TypeScript type
    try {
        // Connect to MSSQL and store the connection pool
        pool = await sql.connect(config);

        // Create farms table
        await pool.query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'farms')
            BEGIN
                CREATE TABLE farms (
                    id INT PRIMARY KEY IDENTITY(1,1),
                    name NVARCHAR(255),
                    location NVARCHAR(255)
                );
            END
        `);

        // Create crops table
        await pool.query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'crops')
            BEGIN
                CREATE TABLE crops (
                    id INT PRIMARY KEY IDENTITY(1,1),
                    farm_id INT,
                    type NVARCHAR(255),
                    planting_date DATE,
                    CONSTRAINT FK_crops_farms FOREIGN KEY (farm_id) REFERENCES farms(id)
                );
            END
        `);

        // Create harvests table
        await pool.query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'harvests')
            BEGIN
                CREATE TABLE harvests (
                    id INT PRIMARY KEY IDENTITY(1,1),
                    crop_id INT,
                    harvest_date DATE,
                    quantity DECIMAL(10,2),
                    CONSTRAINT FK_harvests_crops FOREIGN KEY (crop_id) REFERENCES crops(id)
                );
            END
        `);

        // Insert sample data with parameterized queries
        // Farms
        const farm1Request = new sql.Request(pool); // Use the pool explicitly
        farm1Request.input('name', sql.NVarChar, 'Green Acres');
        farm1Request.input('location', sql.NVarChar, 'California');
        const farm1Result = await farm1Request.query(`
            INSERT INTO farms (name, location) VALUES (@name, @location);
            SELECT SCOPE_IDENTITY() AS id
        `);
        const farm1Id = farm1Result.recordset[0].id;

        const farm2Request = new sql.Request(pool);
        farm2Request.input('name', sql.NVarChar, 'Sunny Fields');
        farm2Request.input('location', sql.NVarChar, 'Texas');
        const farm2Result = await farm2Request.query(`
            INSERT INTO farms (name, location) VALUES (@name, @location);
            SELECT SCOPE_IDENTITY() AS id
        `);
        const farm2Id = farm2Result.recordset[0].id;

        // Crops
        const crop1Request = new sql.Request(pool);
        crop1Request.input('farm_id', sql.Int, farm1Id);
        crop1Request.input('type', sql.NVarChar, 'wheat');
        crop1Request.input('planting_date', sql.Date, '2025-03-01');
        const crop1Result = await crop1Request.query(`
            INSERT INTO crops (farm_id, type, planting_date) VALUES (@farm_id, @type, @planting_date);
            SELECT SCOPE_IDENTITY() AS id
        `);
        const crop1Id = crop1Result.recordset[0].id;

        const crop2Request = new sql.Request(pool);
        crop2Request.input('farm_id', sql.Int, farm1Id);
        crop2Request.input('type', sql.NVarChar, 'corn');
        crop2Request.input('planting_date', sql.Date, '2025-04-01');
        const crop2Result = await crop2Request.query(`
            INSERT INTO crops (farm_id, type, planting_date) VALUES (@farm_id, @type, @planting_date);
            SELECT SCOPE_IDENTITY() AS id
        `);
        const crop2Id = crop2Result.recordset[0].id;

        const crop3Request = new sql.Request(pool);
        crop3Request.input('farm_id', sql.Int, farm2Id);
        crop3Request.input('type', sql.NVarChar, 'soybeans');
        crop3Request.input('planting_date', sql.Date, '2025-03-15');
        const crop3Result = await crop3Request.query(`
            INSERT INTO crops (farm_id, type, planting_date) VALUES (@farm_id, @type, @planting_date);
            SELECT SCOPE_IDENTITY() AS id
        `);
        const crop3Id = crop3Result.recordset[0].id;

        // Harvests
        const harvest1Request = new sql.Request(pool);
        harvest1Request.input('crop_id', sql.Int, crop1Id);
        harvest1Request.input('harvest_date', sql.Date, '2025-07-01');
        harvest1Request.input('quantity', sql.Decimal(10, 2), 10.5);
        await harvest1Request.query(`
            INSERT INTO harvests (crop_id, harvest_date, quantity) VALUES (@crop_id, @harvest_date, @quantity)
        `);

        const harvest2Request = new sql.Request(pool);
        harvest2Request.input('crop_id', sql.Int, crop2Id);
        harvest2Request.input('harvest_date', sql.Date, '2025-08-15');
        harvest2Request.input('quantity', sql.Decimal(10, 2), 15.0);
        await harvest2Request.query(`
            INSERT INTO harvests (crop_id, harvest_date, quantity) VALUES (@crop_id, @harvest_date, @quantity)
        `);

        const harvest3Request = new sql.Request(pool);
        harvest3Request.input('crop_id', sql.Int, crop3Id);
        harvest3Request.input('harvest_date', sql.Date, '2025-09-01');
        harvest3Request.input('quantity', sql.Decimal(10, 2), 8.0);
        await harvest3Request.query(`
            INSERT INTO harvests (crop_id, harvest_date, quantity) VALUES (@crop_id, @harvest_date, @quantity)
        `);

    } catch (err) {
        console.error(err);
    } finally {
        // Close the connection pool if it was created
        if (pool) {
            await pool.close();
        }
    }
}

setupDatabase().catch(console.error);