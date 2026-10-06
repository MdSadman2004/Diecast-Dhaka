import { createServer as createHttpServer } from 'node:http';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, transaction } from './database.mjs';
import { calculatePricing, PRICING_FIELDS } from './pricing.mjs';
import { DELIVERY, PRICING_NOTE } from './catalog.mjs';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BODY_BYTES = 32 * 1024;
const ORDER_STATUSES = Object.freeze(['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled']);
const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
});

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(response, status, value, additionalHeaders = {}) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...(status === 413 ? { Connection: 'close' } : {}),
    ...additionalHeaders,
  });
  response.end(body);
}

function object(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, `${label} must be a JSON object.`);
  }
  return value;
}

function text(value, label, min, max) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new HttpError(400, `${label} must contain ${min}-${max} characters without control characters.`);
  }
  return value.trim();
}

export function normalizePhone(value) {
  const phone = text(value, 'phone', 11, 32).replace(/[\s()-]/gu, '').replace(/^\+?880/u, '0');
  if (!/^01[3-9]\d{8}$/u.test(phone)) {
    throw new HttpError(400, 'Use a Bangladesh mobile number such as 01712345678 or +8801712345678.');
  }
  return phone;
}

function customerInput(value) {
  const customer = object(value, 'customer');
  if (typeof customer.zone !== 'string' || !Object.hasOwn(DELIVERY, customer.zone)) {
    throw new HttpError(400, 'zone must be dhaka or outside.');
  }
  return {
    name: text(customer.name, 'name', 2, 100),
    phone: normalizePhone(customer.phone),
    address: text(customer.address, 'address', 8, 500),
    zone: customer.zone,
  };
}

function itemInput(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) {
    throw new HttpError(400, 'items must contain 1-50 products.');
  }
  const items = value.map((item) => {
    object(item, 'item');
    const id = text(item.id, 'product id', 1, 64);
    if (!/^[a-z0-9-]+$/u.test(id)) throw new HttpError(400, 'Invalid product id.');
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000) {
      throw new HttpError(400, 'quantity must be an integer from 1 to 10000.');
    }
    return { id, quantity: item.quantity };
  });
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw new HttpError(400, 'Duplicate product ids are not allowed; combine their quantities.');
  }
  return items;
}

async function readJson(request) {
  const contentType = request.headers['content-type'] ?? '';
  if (!/^application\/json(?:\s*;.*)?$/iu.test(contentType)) {
    throw new HttpError(415, 'Content-Type must be application/json.');
  }
  const declared = request.headers['content-length'];
  if (declared !== undefined && (!/^\d+$/u.test(declared) || Number(declared) > MAX_BODY_BYTES)) {
    request.resume();
    throw new HttpError(413, 'Request body exceeds 32 KiB.');
  }
  const body = await new Promise((accept, reject) => {
    const chunks = [];
    let bytes = 0;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      request.removeListener('data', onData);
      request.removeListener('end', onEnd);
      request.resume();
      reject(error);
    };
    const onData = (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) return fail(new HttpError(413, 'Request body exceeds 32 KiB.'));
      chunks.push(chunk);
    };
    const onEnd = () => {
      if (settled) return;
      settled = true;
      accept(Buffer.concat(chunks).toString('utf8'));
    };
    request.on('data', onData);
    request.once('end', onEnd);
    request.once('aborted', () => fail(new HttpError(400, 'Request body was interrupted.')));
    request.once('error', () => fail(new HttpError(400, 'Request body was interrupted.')));
  });
  try {
    return object(JSON.parse(body), 'body');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Malformed JSON body.');
  }
}

function checkOrigin(request) {
  const host = request.headers.host ?? '';
  // Also reject browser DNS-rebinding to a non-loopback Host name.
  if (!/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?$/iu.test(host)) {
    throw new HttpError(403, 'Only a loopback Host is allowed.');
  }
  if (request.headers.origin !== undefined) {
    let actual;
    try { actual = new URL(request.headers.origin).origin; } catch { /* Reject below. */ }
    if (actual !== `http://${host.toLowerCase()}`) {
      throw new HttpError(403, 'Cross-origin requests are not allowed.');
    }
  }
}

function authorizeAdmin(request, adminKey) {
  if (!adminKey) throw new HttpError(503, 'Admin is not configured. Set ADMIN_KEY locally.');
  const provided = request.headers['x-admin-key'];
  if (typeof provided !== 'string' || !timingSafeEqual(
    createHash('sha256').update(provided).digest(),
    createHash('sha256').update(adminKey).digest(),
  )) throw new HttpError(401, 'Invalid admin credentials.');
}

function createRateLimiter() {
  const windows = new Map();
  return (request, route) => {
    const now = Date.now();
    if (windows.size > 1000) {
      for (const [key, window] of windows) if (window.resetAt <= now) windows.delete(key);
    }
    const key = `${request.socket.remoteAddress}:${route}`;
    const previous = windows.get(key);
    const window = !previous || previous.resetAt <= now ? { count: 0, resetAt: now + 60000 } : previous;
    window.count += 1;
    windows.set(key, window);
    const maximum = route === 'orders' ? 10 : 30;
    if (window.count > maximum) {
      const error = new HttpError(429, 'Too many requests. Try again in one minute.');
      error.retryAfter = Math.max(1, Math.ceil((window.resetAt - now) / 1000));
      throw error;
    }
  };
}

function publicProduct(product) {
  return {
    id: product.id, name: product.name, category: product.category,
    color: product.color, model: product.model,
    price: calculatePricing(product).price, stock: product.stock,
    series: product.series, scale: product.scale, demo: true,
  };
}

function privateProduct(product) {
  const pricing = calculatePricing(product);
  return { ...publicProduct(product), ...Object.fromEntries(PRICING_FIELDS.map((field) => [field, product[field]])), netMargin: pricing.netMargin, pricing };
}

function publicOrder(row) {
  return {
    id: row.id, createdAt: row.createdAt, status: row.status,
    items: JSON.parse(row.itemsJson).map(({ id, name, quantity, price, lineTotal }) => ({ id, name, quantity, unitPrice: price, lineTotal })),
    subtotal: row.subtotal, deliveryFee: row.deliveryFee, total: row.total,
    customer: { name: row.customerName, phone: row.customerPhone, address: row.customerAddress, zone: row.zone },
  };
}

function placeOrder(database, body) {
  const customer = customerInput(body.customer);
  const requestedItems = itemInput(body.items);
  if (body.paymentMethod !== 'cod') throw new HttpError(400, 'Only demo cash-on-delivery (cod) is supported.');
  return transaction(database, () => {
    const items = requestedItems.map(({ id, quantity }) => {
      const product = database.prepare('SELECT * FROM products WHERE id = ?').get(id);
      if (!product) throw new HttpError(404, 'Product not found.');
      if (quantity > product.stock) throw new HttpError(409, `Not enough demo stock for ${product.name}.`);
      const pricing = calculatePricing(product);
      return {
        id, name: product.name, quantity, price: pricing.price, lineTotal: pricing.price * quantity,
        costTotal: pricing.costTotal, paymentFeeRate: product.paymentFeeRate,
        netProfit: pricing.netProfit * quantity,
      };
    });
    for (const item of items) {
      const result = database.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?').run(item.quantity, item.id, item.quantity);
      if (result.changes !== 1) throw new HttpError(409, 'Stock changed; please refresh your cart.');
    }
    const id = `DD-${randomUUID()}`;
    const createdAt = new Date().toISOString();
    const subtotal = items.reduce((total, item) => total + item.lineTotal, 0);
    const deliveryFee = DELIVERY[customer.zone];
    database.prepare(`INSERT INTO orders
      (id, createdAt, status, customerName, customerPhone, customerAddress, zone, itemsJson, subtotal, deliveryFee, total, paymentMethod)
      VALUES (?, ?, 'placed', ?, ?, ?, ?, ?, ?, ?, ?, 'cod')`).run(
      id, createdAt, customer.name, customer.phone, customer.address, customer.zone,
      JSON.stringify(items), subtotal, deliveryFee, subtotal + deliveryFee,
    );
    return publicOrder(database.prepare('SELECT * FROM orders WHERE id = ?').get(id));
  });
}

function updateProduct(database, id, body) {
  const allowed = [...PRICING_FIELDS, 'stock', 'demo'];
  if (Object.keys(body).length === 0 || Object.keys(body).some((field) => !allowed.includes(field))) {
    throw new HttpError(400, `Patch only: ${allowed.join(', ')}.`);
  }
  if (Object.hasOwn(body, 'demo') && body.demo !== true) {
    throw new HttpError(400, 'This catalog supports demo:true only; real inventory is not authenticated.');
  }
  return transaction(database, () => {
    const current = database.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!current) throw new HttpError(404, 'Product not found.');
    const next = { ...current, ...body };
    if (!Number.isSafeInteger(next.stock) || next.stock < 0 || next.stock > 100000) {
      throw new HttpError(400, 'stock must be an integer from 0 to 100000.');
    }
    try { calculatePricing(next); } catch (error) { throw new HttpError(400, error.message); }
    const fields = Object.keys(body);
    database.prepare(`UPDATE products SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`).run(...fields.map((field) => field === 'demo' ? 1 : next[field]), id);
    return privateProduct(database.prepare('SELECT * FROM products WHERE id = ?').get(id));
  });
}

function updateOrder(database, id, body) {
  if (Object.keys(body).length !== 1 || !ORDER_STATUSES.includes(body.status)) {
    throw new HttpError(400, `Patch only status: ${ORDER_STATUSES.join(', ')}.`);
  }
  return transaction(database, () => {
    const current = database.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!current) throw new HttpError(404, 'Order not found.');
    if (current.status === 'cancelled' && body.status !== 'cancelled') {
      throw new HttpError(409, 'Cancelled orders cannot be reopened.');
    }
    if (body.status === 'cancelled' && !current.restocked) {
      for (const item of JSON.parse(current.itemsJson)) {
        const result = database.prepare('UPDATE products SET stock = stock + ? WHERE id = ? AND stock + ? <= 100000').run(item.quantity, item.id, item.quantity);
        if (result.changes !== 1) throw new HttpError(409, 'Cannot restock beyond the inventory limit.');
      }
      database.prepare("UPDATE orders SET status = 'cancelled', restocked = 1 WHERE id = ?").run(id);
    } else {
      database.prepare('UPDATE orders SET status = ? WHERE id = ?').run(body.status, id);
    }
    return publicOrder(database.prepare('SELECT * FROM orders WHERE id = ?').get(id));
  });
}

function adminSummary(database) {
  const products = database.prepare('SELECT * FROM products ORDER BY rowid').all();
  const orders = database.prepare('SELECT * FROM orders').all();
  const active = orders.filter((order) => order.status !== 'cancelled');
  const revenue = active.reduce((sum, order) => sum + order.subtotal, 0);
  const forecastProfit = active.reduce((sum, order) => sum + JSON.parse(order.itemsJson).reduce((subtotal, item) => subtotal + item.netProfit, 0), 0);
  return {
    currency: 'BDT', demoMode: true,
    orderCount: orders.length, revenue, estimatedProfit: forecastProfit,
    orders: { total: orders.length, active: active.length, cancelled: orders.length - active.length, delivered: active.filter((order) => order.status === 'delivered').length },
    inventory: { units: products.reduce((sum, product) => sum + product.stock, 0), productCount: products.length },
    forecast: {
      merchandiseRevenue: revenue, allocatedNetProfit: forecastProfit,
      netMargin: revenue > 0 ? forecastProfit / revenue : null,
      deliveryPassThrough: active.reduce((sum, order) => sum + order.deliveryFee, 0),
      note: 'Booked demo orders, not collected revenue or realized profit. Snapshot allocations include reserves and overhead. Delivery is excluded from merchandise margin.',
    },
    products: products.map((product) => ({ id: product.id, stock: product.stock, ...calculatePricing(product) })),
  };
}

function requestPath(request) {
  const raw = (request.url ?? '/').split('?')[0];
  let pathname;
  try { pathname = decodeURIComponent(raw); } catch { throw new HttpError(400, 'Invalid URL encoding.'); }
  if (!pathname.startsWith('/') || pathname.includes('\\') || /[\u0000-\u001f\u007f:]/u.test(pathname) || pathname.split('/').some((part) => part === '..' || part === '.' || /[. ]$/u.test(part))) {
    // Colons also forbid Windows NTFS alternate data streams; trailing dots/spaces
    // forbid Windows path aliases that could otherwise bypass the dotfile checks.
    throw new HttpError(403, 'Unsafe path.');
  }
  return pathname;
}

function withinRoot(root, target) {
  const path = relative(root, target);
  return path !== '..' && !path.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(path);
}

async function staticFile(response, pathname, staticDir, method) {
  let root;
  try { root = await realpath(staticDir); } catch { throw new HttpError(404, 'Frontend build not found. Build the dist directory first.'); }
  // Never expose dotfiles, even if a build accidentally copies credentials.
  if (pathname.split('/').some((part) => part.startsWith('.'))) throw new HttpError(403, 'Unsafe path.');
  let candidate = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!withinRoot(root, candidate)) throw new HttpError(403, 'Unsafe path.');
  try {
    candidate = await realpath(candidate);
    if (!withinRoot(root, candidate)) throw new HttpError(403, 'Unsafe path.');
    if (!(await stat(candidate)).isFile()) throw new HttpError(404, 'File not found.');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
    if (extname(pathname) || pathname.startsWith('/assets/')) throw new HttpError(404, 'File not found.');
    candidate = await realpath(resolve(root, 'index.html')).catch(() => { throw new HttpError(404, 'Frontend build not found.'); });
    if (!withinRoot(root, candidate)) throw new HttpError(403, 'Unsafe path.');
  }
  const body = await readFile(candidate);
  response.writeHead(200, {
    'Content-Type': MIME[extname(candidate).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': extname(candidate).toLowerCase() === '.html' ? 'no-store' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  });
  response.end(method === 'HEAD' ? undefined : body);
}

/** Returns an unlistened http.Server. Call listen(0, '127.0.0.1') in tests, or start(). */
export function createServer({
  dbPath = resolve(PROJECT_ROOT, 'server/data/store.sqlite'),
  adminKey = process.env.ADMIN_KEY ?? '',
  staticDir = resolve(PROJECT_ROOT, 'dist'),
  port = 5188,
} = {}) {
  if (typeof adminKey !== 'string') throw new TypeError('adminKey must be a string.');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new RangeError('port must be between 0 and 65535.');
  const database = openDatabase(dbPath);
  const rateLimit = createRateLimiter();
  const server = createHttpServer(async (request, response) => {
    try {
      const pathname = requestPath(request);
      const method = request.method;
      if (pathname === '/api' || pathname.startsWith('/api/')) {
        if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) checkOrigin(request);
        if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) authorizeAdmin(request, adminKey);
        if (method === 'GET' && pathname === '/api/health') {
          database.prepare('SELECT 1').get();
          return json(response, 200, { ok: true, service: 'diecast-dhaka', currency: 'BDT', demoMode: true });
        }
        if (method === 'GET' && pathname === '/api/catalog') {
          const products = database.prepare('SELECT * FROM products ORDER BY rowid').all().map(publicProduct);
          return json(response, 200, { products, currency: 'BDT', demoMode: true, delivery: DELIVERY, pricingNote: PRICING_NOTE });
        }
        if (method === 'POST' && pathname === '/api/orders') {
          rateLimit(request, 'orders');
          return json(response, 201, { order: placeOrder(database, await readJson(request)), demo: true });
        }
        if (method === 'POST' && pathname === '/api/orders/lookup') {
          rateLimit(request, 'lookup');
          const body = await readJson(request);
          const id = text(body.id, 'order id', 1, 80);
          const phone = normalizePhone(body.phone);
          const order = database.prepare('SELECT * FROM orders WHERE id = ? AND customerPhone = ?').get(id, phone);
          if (!order) throw new HttpError(404, 'Order not found.');
          return json(response, 200, { order: publicOrder(order), demo: true });
        }
        if (method === 'GET' && pathname === '/api/admin/products') {
          return json(response, 200, { products: database.prepare('SELECT * FROM products ORDER BY rowid').all().map(privateProduct), currency: 'BDT', demoMode: true });
        }
        if (method === 'GET' && pathname === '/api/admin/orders') {
          return json(response, 200, { orders: database.prepare('SELECT * FROM orders ORDER BY createdAt DESC').all().map(publicOrder), demoMode: true });
        }
        if (method === 'GET' && pathname === '/api/admin/summary') {
          return json(response, 200, adminSummary(database));
        }
        const productPatch = /^\/api\/admin\/products\/([a-z0-9-]+)$/u.exec(pathname);
        if (method === 'PATCH' && productPatch) {
          return json(response, 200, { product: updateProduct(database, productPatch[1], await readJson(request)), demo: true });
        }
        const orderPatch = /^\/api\/admin\/orders\/([a-zA-Z0-9-]+)$/u.exec(pathname);
        if (method === 'PATCH' && orderPatch) {
          return json(response, 200, { order: updateOrder(database, orderPatch[1], await readJson(request)), demo: true });
        }
        throw new HttpError(404, 'API endpoint not found.');
      }
      if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'Method not allowed.');
      await staticFile(response, pathname, staticDir, method);
    } catch (error) {
      if (!response.headersSent && !response.destroyed) {
        const status = error instanceof HttpError ? error.status : 500;
        if (status === 500) console.error('Backend request failed:', error.message);
        json(response, status, { error: status === 500 ? 'Internal server error.' : error.message }, error.retryAfter ? { 'Retry-After': error.retryAfter } : {});
      }
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.on('close', () => database.close());
  server.start = () => new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      accept(server);
    });
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = process.env.PORT === undefined ? 5188 : Number(process.env.PORT);
  const server = createServer({
    port, adminKey: process.env.ADMIN_KEY ?? '',
    dbPath: process.env.DB_PATH || resolve(PROJECT_ROOT, 'server/data/store.sqlite'),
    staticDir: process.env.STATIC_DIR || resolve(PROJECT_ROOT, 'dist'),
  });
  server.start().then(() => {
    console.log(`Diecast Dhaka demo backend: http://127.0.0.1:${server.address().port}`);
    console.log(process.env.ADMIN_KEY ? 'Local admin enabled.' : 'Admin disabled: ADMIN_KEY is not configured.');
  }).catch((error) => {
    console.error(`Cannot start backend: ${error.message}`);
    server.close();
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
}
