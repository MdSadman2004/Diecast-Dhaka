import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEMO_PRODUCTS } from './catalog.mjs';
import { PRICING_FIELDS } from './pricing.mjs';

export function openDatabase(dbPath) {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const database = new DatabaseSync(dbPath);
  try {
    database.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
        color TEXT NOT NULL, model TEXT NOT NULL,
        series TEXT NOT NULL DEFAULT 'Mainline', scale TEXT NOT NULL DEFAULT '1:64',
        demo INTEGER NOT NULL DEFAULT 1 CHECK (demo = 1),
        stock INTEGER NOT NULL CHECK (stock >= 0 AND stock <= 100000),
        landedCost REAL NOT NULL CHECK (landedCost >= 0),
        packaging REAL NOT NULL CHECK (packaging >= 0),
        overhead REAL NOT NULL CHECK (overhead >= 0),
        returnReserve REAL NOT NULL CHECK (returnReserve >= 0),
        shippingSubsidy REAL NOT NULL CHECK (shippingSubsidy >= 0),
        targetMargin REAL NOT NULL CHECK (targetMargin >= 0 AND targetMargin < 0.7),
        paymentFeeRate REAL NOT NULL CHECK (paymentFeeRate >= 0 AND paymentFeeRate < 1),
        CHECK (targetMargin + paymentFeeRate < 1)
      );
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY, createdAt TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('placed','confirmed','packed','shipped','delivered','cancelled')),
        customerName TEXT NOT NULL, customerPhone TEXT NOT NULL,
        customerAddress TEXT NOT NULL, zone TEXT NOT NULL CHECK (zone IN ('dhaka','outside')),
        itemsJson TEXT NOT NULL, subtotal INTEGER NOT NULL,
        deliveryFee INTEGER NOT NULL, total INTEGER NOT NULL,
        paymentMethod TEXT NOT NULL CHECK (paymentMethod = 'cod'),
        restocked INTEGER NOT NULL DEFAULT 0 CHECK (restocked IN (0,1))
      );
      CREATE INDEX IF NOT EXISTS orders_created_at ON orders(createdAt);
      PRAGMA user_version = 1;
    `);
    const columns = ['id', 'name', 'category', 'color', 'model', 'series', 'scale', 'demo', 'stock', ...PRICING_FIELDS];
    const insert = database.prepare(`INSERT OR IGNORE INTO products (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`);
    transaction(database, () => {
      for (const product of DEMO_PRODUCTS) insert.run(...columns.map((field) => field === 'demo' ? 1 : product[field]));
    });
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

// No await inside this transaction: stock reads, decrements and order writes are atomic.
export function transaction(database, operation) {
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
