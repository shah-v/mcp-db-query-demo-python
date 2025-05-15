import sqlite3 from "sqlite3";
import { promisify } from "util";

const db = new sqlite3.Database("farming.db");
const run = promisify(db.run.bind(db));
const close = promisify(db.close.bind(db));

async function setupDatabase() {
  // Create farms table
  await run(`CREATE TABLE IF NOT EXISTS farms (
    id INTEGER PRIMARY KEY,
    name TEXT,
    location TEXT
  )`);

  // Create crops table
  await run(`CREATE TABLE IF NOT EXISTS crops (
    id INTEGER PRIMARY KEY,
    farm_id INTEGER,
    type TEXT,
    planting_date TEXT,
    FOREIGN KEY (farm_id) REFERENCES farms(id)
  )`);

  // Create harvests table
  await run(`CREATE TABLE IF NOT EXISTS harvests (
    id INTEGER PRIMARY KEY,
    crop_id INTEGER,
    harvest_date TEXT,
    quantity REAL,
    FOREIGN KEY (crop_id) REFERENCES crops(id)
  )`);

  // Insert sample data
  await run(`INSERT INTO farms (name, location) VALUES ('Green Acres', 'California')`);
  await run(`INSERT INTO farms (name, location) VALUES ('Sunny Fields', 'Texas')`);
  await run(`INSERT INTO crops (farm_id, type, planting_date) VALUES (1, 'wheat', '2025-03-01')`);
  await run(`INSERT INTO crops (farm_id, type, planting_date) VALUES (1, 'corn', '2025-04-01')`);
  await run(`INSERT INTO crops (farm_id, type, planting_date) VALUES (2, 'soybeans', '2025-03-15')`);
  await run(`INSERT INTO harvests (crop_id, harvest_date, quantity) VALUES (1, '2025-07-01', 10.5)`);
  await run(`INSERT INTO harvests (crop_id, harvest_date, quantity) VALUES (2, '2025-08-15', 15.0)`);
  await run(`INSERT INTO harvests (crop_id, harvest_date, quantity) VALUES (3, '2025-09-01', 8.0)`);

  await close();
}

setupDatabase().catch(console.error);