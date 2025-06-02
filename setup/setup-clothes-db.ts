import sqlite3 from "sqlite3";
import { promisify } from "util";

const db = new sqlite3.Database("clothes.db");
const run = promisify(db.run.bind(db));
const close = promisify(db.close.bind(db));

async function setupDatabase() {
  // Enable foreign key constraints for data integrity
  await run('PRAGMA foreign_keys = ON;');

  // Create manufacturers table
  await run(`CREATE TABLE IF NOT EXISTS manufacturers (
    id INTEGER PRIMARY KEY,
    name TEXT,
    location TEXT
  )`);

  // Create clothes table
  await run(`CREATE TABLE IF NOT EXISTS clothes (
    id INTEGER PRIMARY KEY,
    manufacturer_id INTEGER,
    type TEXT,
    size TEXT,
    color TEXT,
    price REAL,
    FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id)
  )`);

  // Create stores table
  await run(`CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY,
    name TEXT,
    location TEXT
  )`);

  // Create customers table
  await run(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY,
    name TEXT,
    email TEXT,
    address TEXT
  )`);

  // Create sales table
  await run(`CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER,
    clothing_id INTEGER,
    store_id INTEGER,
    sale_date TEXT,
    quantity INTEGER,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (clothing_id) REFERENCES clothes(id),
    FOREIGN KEY (store_id) REFERENCES stores(id)
  )`);

  // Start transaction for efficient data insertion
  await run('BEGIN TRANSACTION;');

  // Insert 10 manufacturers
  for (let i = 1; i <= 10; i++) {
    await run(`INSERT INTO manufacturers (name, location) VALUES ('Manufacturer ${i}', 'Location ${i}')`);
  }

  // Insert 50 clothes with varied attributes
  const types = ['shirt', 'pants', 'dress', 'jacket', 'skirt'];
  const sizes = ['S', 'M', 'L', 'XL'];
  const colors = ['red', 'blue', 'green', 'yellow', 'black'];
  for (let i = 1; i <= 50; i++) {
    const manufacturer_id = Math.ceil(i / 5); // Assigns 5 clothes per manufacturer
    const type = types[(i - 1) % 5];
    const size = sizes[(i - 1) % 4];
    const color = colors[(i - 1) % 5];
    const price = 10.0 + ((i - 1) % 40); // Prices range from 10.0 to 49.0
    await run(`INSERT INTO clothes (manufacturer_id, type, size, color, price) VALUES (${manufacturer_id}, '${type}', '${size}', '${color}', ${price})`);
  }

  // Insert 20 stores
  for (let i = 1; i <= 20; i++) {
    await run(`INSERT INTO stores (name, location) VALUES ('Store ${i}', 'City ${i}')`);
  }

  // Insert 100 customers
  for (let i = 1; i <= 100; i++) {
    await run(`INSERT INTO customers (name, email, address) VALUES ('Customer ${i}', 'customer${i}@example.com', 'Address ${i}')`);
  }

  // Insert 200 sales
  for (let i = 1; i <= 200; i++) {
    const customer_id = ((i - 1) % 100) + 1; // Cycles through 100 customers
    const clothing_id = ((i - 1) % 50) + 1;  // Cycles through 50 clothes
    const store_id = ((i - 1) % 20) + 1;     // Cycles through 20 stores
    const month = String(((i - 1) % 12) + 1).padStart(2, '0');
    const day = String(((i - 1) % 28) + 1).padStart(2, '0');
    const sale_date = `2025-${month}-${day}`; // Dates throughout 2025
    const quantity = ((i - 1) % 5) + 1;      // Quantities from 1 to 5
    await run(`INSERT INTO sales (customer_id, clothing_id, store_id, sale_date, quantity) VALUES (${customer_id}, ${clothing_id}, ${store_id}, '${sale_date}', ${quantity})`);
  }

  // Commit transaction
  await run('COMMIT;');

  // Close the database
  await close();
}

setupDatabase().catch(console.error);