import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../server/index.mjs';
import { calculatePricing } from '../server/pricing.mjs';

const ADMIN_KEY = 'local-test-admin-key-not-a-production-secret';
const DEFAULT_COSTS = { landedCost: 190, packaging: 20, overhead: 25, returnReserve: 10, shippingSubsidy: 0, targetMargin: 0.3, paymentFeeRate: 0.015 };
const CUSTOMER = { name: 'Demo Buyer', phone: '01712345678', address: 'House 10, Demo Road, Dhaka', zone: 'dhaka' };
const orderBody = (items = [{ id: 'skyline', quantity: 1 }], overrides = {}) => ({ customer: CUSTOMER, items, paymentMethod: 'cod', ...overrides });

async function fixture(t, options = {}) {
  const configuredScratch = process.env.TMPDIR;
  const scratch = configuredScratch && /^[de]:[\\/]/iu.test(configuredScratch) ? configuredScratch : 'D:/.hermes/cache/scratch';
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(resolve(scratch, 'diecast-backend-test-'));
  const staticDir = resolve(root, 'dist');
  await mkdir(staticDir);
  await writeFile(resolve(staticDir, 'index.html'), '<!doctype html><title>Backend test frontend</title><p>SPA fixture</p>');
  await writeFile(resolve(staticDir, 'app.js'), 'console.log("fixture");');
  await writeFile(resolve(staticDir, '.secret'), 'private fixture');
  const dbPath = resolve(root, 'store.sqlite');
  let server;
  let base;
  const start = async () => {
    server = createServer({ dbPath, staticDir, adminKey: ADMIN_KEY, ...options });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
  };
  const close = async () => {
    if (!server?.listening) return;
    await new Promise((accept, reject) => server.close((error) => error ? reject(error) : accept()));
  };
  await start();
  t.after(async () => { await close(); await rm(root, { recursive: true, force: true }); });
  const api = async (path, { method = 'GET', body, admin = false, headers = {} } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(admin ? { 'X-Admin-Key': ADMIN_KEY } : {}), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, headers: response.headers, data: await response.json() };
  };
  const raw = (path, { method = 'GET', body = '', headers = {} } = {}) => new Promise((accept, reject) => {
    const request = httpRequest(base, { path, method, headers }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => accept({ status: response.statusCode, headers: response.headers, text: Buffer.concat(chunks).toString() }));
    });
    request.on('error', reject);
    request.end(body);
  });
  return { api, raw, root, staticDir, dbPath, get base() { return base; }, restart: async () => { await close(); await start(); } };
}

function hasError(result, status) {
  assert.equal(result.status, status);
  assert.equal(typeof result.data.error, 'string');
  assert.deepEqual(Object.keys(result.data), ['error']);
}

test('pricing rounds UP to BDT 10 and calculates at least 30% allocated net margin', () => {
  const pricing = calculatePricing(DEFAULT_COSTS);
  assert.equal(pricing.price, 360);
  assert.equal(pricing.costTotal, 245);
  assert.ok(Math.abs(pricing.rawPrice - 245 / 0.685) < 1e-9);
  assert.ok(Math.abs(pricing.netProfit - (360 - 245 - 360 * 0.015)) < 1e-9);
  assert.ok(pricing.netMargin >= 0.3);
  assert.ok(pricing.netMargin < 0.31);
  const exact = calculatePricing({ ...DEFAULT_COSTS, landedCost: 195, packaging: 0, overhead: 0, returnReserve: 0, targetMargin: 0.3, paymentFeeRate: 0.05 });
  assert.equal(exact.price, 300, 'exact grid point must not incorrectly round to 310');
  const next = calculatePricing({ ...DEFAULT_COSTS, landedCost: 195.01, packaging: 0, overhead: 0, returnReserve: 0, targetMargin: 0.3, paymentFeeRate: 0.05 });
  assert.equal(next.price, 310);
});

test('pricing validates every cost, bounded rates, precision and positive denominator', () => {
  for (const field of ['landedCost', 'packaging', 'overhead', 'returnReserve', 'shippingSubsidy']) {
    for (const value of [-1, NaN, Infinity, '190', 0.001, 1000001]) assert.throws(() => calculatePricing({ ...DEFAULT_COSTS, [field]: value }));
  }
  for (const changes of [{ targetMargin: 0.7 }, { targetMargin: -0.1 }, { targetMargin: 0.3000001 }, { paymentFeeRate: 1 }, { paymentFeeRate: 0.7 }, { paymentFeeRate: -0.1 }, { targetMargin: 0.699999, paymentFeeRate: 0.3 }]) {
    assert.throws(() => calculatePricing({ ...DEFAULT_COSTS, ...changes }));
  }
  assert.throws(() => calculatePricing({ ...DEFAULT_COSTS, landedCost: 0, packaging: 0, overhead: 0, returnReserve: 0 }));
});

test('health and exact six-item demo catalog never expose private costs', async (t) => {
  const { api } = await fixture(t);
  const health = await api('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.data.ok, true);
  const catalog = await api('/api/catalog');
  assert.equal(catalog.status, 200);
  assert.equal(catalog.headers.get('cache-control'), 'no-store');
  assert.equal(catalog.data.currency, 'BDT');
  assert.equal(catalog.data.demoMode, true);
  assert.deepEqual(catalog.data.delivery, { dhaka: 80, outside: 150 });
  assert.match(catalog.data.pricingNote, /illustrative/i);
  assert.deepEqual(catalog.data.products.map(({ id, name, category, model, color }) => [id, name, category, model, color]), [
    ['skyline', 'Nissan Skyline GT-R (R34)', 'JDM', 'coupe', '#779eab'],
    ['porsche', 'Porsche 911 GT3', 'European', 'sport', '#e86527'],
    ['supra', 'Toyota Supra', 'JDM', 'coupe', '#b62f32'],
    ['mustang', "'67 Ford Mustang", 'Muscle', 'muscle', '#445e36'],
    ['civic', 'Honda Civic Custom', 'JDM', 'hatch', '#d6b44e'],
    ['defender', 'Land Rover Defender 90', 'Adventure', 'suv', '#b7b3a4'],
  ]);
  for (const product of catalog.data.products) {
    assert.deepEqual(Object.keys(product).sort(), ['id', 'name', 'category', 'color', 'model', 'price', 'stock', 'series', 'scale', 'demo'].sort());
    assert.equal(product.demo, true);
    assert.equal(product.series, 'Mainline');
    assert.equal(product.scale, '1:64');
    assert.equal(product.price % 10, 0);
  }
});

test('admin is disabled with 503 when no ADMIN_KEY is configured', async (t) => {
  const { api } = await fixture(t, { adminKey: '' });
  for (const path of ['/api/admin/products', '/api/admin/orders', '/api/admin/summary']) hasError(await api(path, { admin: true }), 503);
  hasError(await api('/api/admin/products/skyline', { method: 'PATCH', admin: true, body: { stock: 1 } }), 503);
});

test('every admin route requires correct credentials and returns private pricing only after auth', async (t) => {
  const { api } = await fixture(t);
  for (const path of ['/api/admin/products', '/api/admin/orders', '/api/admin/summary']) {
    hasError(await api(path), 401);
    hasError(await api(path, { headers: { 'X-Admin-Key': 'wrong' } }), 401);
    assert.equal((await api(path, { admin: true })).status, 200);
  }
  for (const path of ['/api/admin/products/skyline', '/api/admin/orders/DD-unknown']) {
    hasError(await api(path, { method: 'PATCH', body: { stock: 1 } }), 401);
  }
  const products = (await api('/api/admin/products', { admin: true })).data.products;
  assert.equal(products[0].landedCost, 190);
  assert.equal(products[0].pricing.price, 360);
  assert.equal(products[0].netMargin, products[0].pricing.netMargin);
  assert.ok(products.every((product) => product.pricing.netMargin >= product.targetMargin));
});

test('orders ignore injected client prices, charge zone delivery, decrement stock and snapshot private costs', async (t) => {
  const { api } = await fixture(t);
  const before = (await api('/api/catalog')).data.products;
  const items = [{ id: 'skyline', quantity: 2, price: 1, unitPrice: 1, costTotal: 0 }, { id: 'porsche', quantity: 1, price: -99, unitPrice: -99 }];
  const result = await api('/api/orders', { method: 'POST', body: orderBody(items, { subtotal: 1, total: 1, deliveryFee: 0, customer: { ...CUSTOMER, phone: '+8801712345678', zone: 'outside' } }) });
  assert.equal(result.status, 201);
  assert.equal(result.data.demo, true);
  const order = result.data.order;
  assert.match(order.id, /^DD-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  assert.equal(order.status, 'placed');
  assert.ok(Number.isFinite(Date.parse(order.createdAt)));
  assert.equal(order.customer.phone, CUSTOMER.phone);
  assert.equal(order.items[0].unitPrice, before[0].price);
  assert.deepEqual(Object.keys(order.items[0]).sort(), ['id', 'name', 'quantity', 'unitPrice', 'lineTotal'].sort());
  assert.equal(order.items[0].lineTotal, before[0].price * 2);
  assert.equal(order.subtotal, before[0].price * 2 + before[1].price);
  assert.equal(order.deliveryFee, 150);
  assert.equal(order.total, order.subtotal + 150);
  assert.equal(Object.hasOwn(order.items[0], 'costTotal'), false);
  const after = (await api('/api/catalog')).data.products;
  assert.equal(after[0].stock, before[0].stock - 2);
  assert.equal(after[1].stock, before[1].stock - 1);
  const summary = (await api('/api/admin/summary', { admin: true })).data;
  assert.equal(summary.orders.total, 1);
  assert.equal(summary.orderCount, 1);
  assert.equal(summary.revenue, order.subtotal);
  assert.equal(summary.estimatedProfit, summary.forecast.allocatedNetProfit);
  assert.equal(summary.forecast.merchandiseRevenue, order.subtotal);
  assert.ok(summary.forecast.netMargin >= 0.3);
  assert.equal(summary.forecast.deliveryPassThrough, 150);
});

test('order validation rejects malformed customer, unknown payment, bad items and SQL-looking ids', async (t) => {
  const { api } = await fixture(t);
  const invalid = [
    orderBody([], {}),
    orderBody([{ id: 'skyline', quantity: 0 }]),
    orderBody([{ id: 'skyline', quantity: 1.5 }]),
    orderBody([{ id: "skyline' OR 1=1 --", quantity: 1 }]),
    orderBody([{ id: 'skyline', quantity: 1 }, { id: 'skyline', quantity: 1 }]),
    orderBody(undefined, { paymentMethod: 'card' }),
    orderBody(undefined, { customer: { ...CUSTOMER, phone: '01212345678' } }),
    orderBody(undefined, { customer: { ...CUSTOMER, zone: 'world' } }),
    orderBody(undefined, { customer: { ...CUSTOMER, address: 'short' } }),
  ];
  for (const body of invalid) hasError(await api('/api/orders', { method: 'POST', body }), 400);
  assert.equal((await api('/api/admin/orders', { admin: true })).data.orders.length, 0);
  assert.equal((await api('/api/catalog')).data.products[0].stock, 12);
});

test('insufficient or missing inventory rolls back the entire cart', async (t) => {
  const { api } = await fixture(t);
  hasError(await api('/api/orders', { method: 'POST', body: orderBody([{ id: 'skyline', quantity: 1 }, { id: 'porsche', quantity: 99 }]) }), 409);
  hasError(await api('/api/orders', { method: 'POST', body: orderBody([{ id: 'skyline', quantity: 1 }, { id: 'unknown', quantity: 1 }]) }), 404);
  assert.equal((await api('/api/catalog')).data.products[0].stock, 12);
  assert.equal((await api('/api/admin/orders', { admin: true })).data.orders.length, 0);
});

test('concurrent requests cannot oversell the last available stock', async (t) => {
  const { api } = await fixture(t);
  assert.equal((await api('/api/admin/products/skyline', { method: 'PATCH', admin: true, body: { stock: 1 } })).status, 200);
  const results = await Promise.all(Array.from({ length: 5 }, () => api('/api/orders', { method: 'POST', body: orderBody() })));
  assert.equal(results.filter((result) => result.status === 201).length, 1);
  assert.equal(results.filter((result) => result.status === 409).length, 4);
  assert.equal((await api('/api/catalog')).data.products[0].stock, 0);
  assert.equal((await api('/api/admin/orders', { admin: true })).data.orders.length, 1);
});

test('SQLite restart preserves orders, changed allocations and stock without reseeding', async (t) => {
  const env = await fixture(t);
  const placed = await env.api('/api/orders', { method: 'POST', body: orderBody() });
  const patch = await env.api('/api/admin/products/skyline', { method: 'PATCH', admin: true, body: { landedCost: 210, overhead: 40, stock: 4 } });
  assert.equal(patch.status, 200);
  await env.restart();
  const catalog = (await env.api('/api/catalog')).data;
  assert.equal(catalog.products[0].stock, 4);
  assert.equal(catalog.products[0].price, patch.data.product.price);
  const lookup = await env.api('/api/orders/lookup', { method: 'POST', body: { id: placed.data.order.id, phone: CUSTOMER.phone } });
  assert.equal(lookup.status, 200);
  assert.equal(lookup.data.order.items[0].unitPrice, 360, 'persisted order price is not repriced');
  assert.equal(lookup.data.order.total, 440);
  const bytes = await readFile(env.dbPath);
  assert.equal(bytes.subarray(0, 15).toString(), 'SQLite format 3');
  const summary = (await env.api('/api/admin/summary', { admin: true })).data;
  assert.ok(Math.abs(summary.forecast.allocatedNetProfit - (360 - 245 - 360 * 0.015)) < 1e-9, 'snapshot profit survives product cost changes');
});

test('lookup requires BOTH opaque order id and matching normalized phone; GET never exposes PII', async (t) => {
  const { api } = await fixture(t);
  const placed = (await api('/api/orders', { method: 'POST', body: orderBody() })).data.order;
  const lookup = await api('/api/orders/lookup', { method: 'POST', body: { id: placed.id, phone: '8801712345678' } });
  assert.equal(lookup.status, 200);
  assert.deepEqual(lookup.data.order.customer, CUSTOMER);
  const mismatch = await api('/api/orders/lookup', { method: 'POST', body: { id: placed.id, phone: '01812345678' } });
  const unknown = await api('/api/orders/lookup', { method: 'POST', body: { id: 'DD-unknown', phone: CUSTOMER.phone } });
  hasError(mismatch, 404);
  hasError(unknown, 404);
  assert.deepEqual(mismatch.data, unknown.data);
  hasError(await api(`/api/orders/${placed.id}`), 404);
  hasError(await api('/api/orders'), 404);
  hasError(await api('/api/orders/lookup'), 404);
});

test('admin product PATCH validates stock and all pricing fields before committing', async (t) => {
  const { api } = await fixture(t);
  const invalid = [{ stock: -1 }, { stock: 1.5 }, { stock: 100001 }, { landedCost: -1 }, { packaging: '20' }, { overhead: 0.001 }, { returnReserve: null }, { shippingSubsidy: -1 }, { targetMargin: 0.7 }, { paymentFeeRate: 0.7 }, { targetMargin: 0.6, paymentFeeRate: 0.4 }, { price: 1 }, { demo: false }, {}];
  for (const body of invalid) hasError(await api('/api/admin/products/skyline', { method: 'PATCH', admin: true, body }), 400);
  const unchanged = (await api('/api/admin/products', { admin: true })).data.products[0];
  assert.equal(unchanged.price, 360);
  assert.equal(unchanged.stock, 12);
  const valid = await api('/api/admin/products/skyline', { method: 'PATCH', admin: true, body: { landedCost: 200, packaging: 15, overhead: 30, returnReserve: 12, shippingSubsidy: 5, targetMargin: 0.35, paymentFeeRate: 0.02, stock: 3, demo: true } });
  assert.equal(valid.status, 200);
  assert.equal(valid.data.product.price, 420);
  assert.ok(valid.data.product.pricing.netMargin >= 0.35);
  assert.equal((await api('/api/catalog')).data.products[0].price, 420);
  hasError(await api('/api/admin/products/unknown', { method: 'PATCH', admin: true, body: { stock: 1 } }), 404);
});

test('status transitions persist; cancellation restocks exactly once and can never be reopened', async (t) => {
  const env = await fixture(t);
  const placed = (await env.api('/api/orders', { method: 'POST', body: orderBody([{ id: 'skyline', quantity: 2 }, { id: 'civic', quantity: 1 }]) })).data.order;
  const path = `/api/admin/orders/${placed.id}`;
  for (const status of ['confirmed', 'packed', 'shipped', 'delivered']) {
    const patched = await env.api(path, { method: 'PATCH', admin: true, body: { status } });
    assert.equal(patched.status, 200);
    assert.equal(patched.data.order.status, status);
  }
  hasError(await env.api(path, { method: 'PATCH', admin: true, body: { status: 'paid' } }), 400);
  assert.equal((await env.api(path, { method: 'PATCH', admin: true, body: { status: 'cancelled' } })).status, 200);
  assert.equal((await env.api('/api/catalog')).data.products[0].stock, 12);
  assert.equal((await env.api('/api/catalog')).data.products[4].stock, 11);
  await env.restart();
  assert.equal((await env.api(path, { method: 'PATCH', admin: true, body: { status: 'cancelled' } })).status, 200);
  assert.equal((await env.api('/api/catalog')).data.products[0].stock, 12);
  hasError(await env.api(path, { method: 'PATCH', admin: true, body: { status: 'placed' } }), 409);
  assert.equal((await env.api('/api/admin/summary', { admin: true })).data.forecast.merchandiseRevenue, 0);
  assert.equal((await env.api('/api/admin/orders', { admin: true })).data.orders[0].status, 'cancelled');
});

test('failed cancellation at stock ceiling rolls back all restocks and order status', async (t) => {
  const { api } = await fixture(t);
  const placed = (await api('/api/orders', { method: 'POST', body: orderBody([{ id: 'skyline', quantity: 1 }, { id: 'porsche', quantity: 1 }]) })).data.order;
  await api('/api/admin/products/porsche', { method: 'PATCH', admin: true, body: { stock: 100000 } });
  hasError(await api(`/api/admin/orders/${placed.id}`, { method: 'PATCH', admin: true, body: { status: 'cancelled' } }), 409);
  assert.equal((await api('/api/catalog')).data.products[0].stock, 11);
  assert.equal((await api('/api/admin/orders', { admin: true })).data.orders[0].status, 'placed');
});

test('sensitive writes reject foreign/null Origin and accept exact same origin', async (t) => {
  const env = await fixture(t);
  for (const origin of ['https://evil.example', 'null', 'http://127.0.0.1:1234']) {
    hasError(await env.api('/api/orders', { method: 'POST', body: orderBody(), headers: { Origin: origin } }), 403);
  }
  hasError(await env.api('/api/admin/products/skyline', { method: 'PATCH', admin: true, body: { stock: 1 }, headers: { Origin: 'https://evil.example' } }), 403);
  const allowed = await env.api('/api/orders', { method: 'POST', body: orderBody(), headers: { Origin: env.base } });
  assert.equal(allowed.status, 201);
  const rebinding = await env.raw('/api/orders', { method: 'POST', body: JSON.stringify(orderBody()), headers: { Host: 'evil.example', 'Content-Type': 'application/json' } });
  assert.equal(rebinding.status, 403);
});

test('JSON content type, malformed body and 32 KiB cap are enforced for fixed and chunked bodies', async (t) => {
  const { api, raw } = await fixture(t);
  hasError(await api('/api/orders', { method: 'POST', body: orderBody(), headers: { 'Content-Type': 'text/plain' } }), 415);
  for (const body of ['{broken', 'null', '[]']) {
    const result = await raw('/api/orders', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
    assert.equal(result.status, 400);
    assert.equal(typeof JSON.parse(result.text).error, 'string');
  }
  const large = JSON.stringify({ extra: 'x'.repeat(32768) });
  const fixed = await raw('/api/orders', { method: 'POST', body: large, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(large) } });
  assert.equal(fixed.status, 413);
  const chunked = await raw('/api/orders', { method: 'POST', body: large, headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' } });
  assert.equal(chunked.status, 413);
  hasError(await api('/api/admin/products/skyline', { method: 'PATCH', admin: true, body: { stock: 1 }, headers: { 'Content-Type': 'text/plain' } }), 415);
});

test('orders and lookup have independent per-IP rate limits with Retry-After', async (t) => {
  const { api } = await fixture(t);
  for (let index = 0; index < 10; index += 1) hasError(await api('/api/orders', { method: 'POST', body: {} }), 400);
  const limited = await api('/api/orders', { method: 'POST', body: orderBody() });
  hasError(limited, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  for (let index = 0; index < 30; index += 1) hasError(await api('/api/orders/lookup', { method: 'POST', body: { id: 'unknown', phone: CUSTOMER.phone } }), 404);
  hasError(await api('/api/orders/lookup', { method: 'POST', body: { id: 'unknown', phone: CUSTOMER.phone } }), 429);
  assert.equal((await api('/api/health')).status, 200);
});

test('static serving has SPA fallback, no cached index, HEAD and no API fallback', async (t) => {
  const { raw } = await fixture(t);
  for (const path of ['/', '/index.html', '/collection/jdm']) {
    const response = await raw(path);
    assert.equal(response.status, 200);
    assert.match(response.text, /SPA fixture/);
    assert.equal(response.headers['cache-control'], 'no-store');
  }
  const asset = await raw('/app.js');
  assert.equal(asset.status, 200);
  assert.match(asset.headers['content-type'], /javascript/);
  const head = await raw('/', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.text, '');
  assert.ok(Number(head.headers['content-length']) > 0);
  assert.equal((await raw('/missing.js')).status, 404);
  assert.equal((await raw('/assets/missing')).status, 404);
  assert.equal((await raw('/api/not-a-route')).status, 404);
  assert.equal((await raw('/api')).status, 404);
  assert.equal((await raw('/collection', { method: 'POST' })).status, 405);
});

test('raw and encoded traversal, dotfiles, backslashes and symlink escapes cannot expose files', async (t) => {
  const { raw, root, staticDir } = await fixture(t);
  for (const path of ['/../store.sqlite', '/%2e%2e/store.sqlite', '/..%2fstore.sqlite', '/%2e%2e%5cstore.sqlite', '/.secret', '/%00index.html', '/index.html%3asecret', '/index.html.', '/..%20/store.sqlite']) {
    const response = await raw(path);
    assert.equal(response.status, 403, path);
    assert.equal(typeof JSON.parse(response.text).error, 'string');
  }
  assert.equal((await raw('/%XX')).status, 400);
  const privateDir = resolve(root, 'private');
  await mkdir(privateDir);
  await writeFile(resolve(privateDir, 'secret.txt'), 'must never be served');
  await symlink(privateDir, resolve(staticDir, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  const escaped = await raw('/escape/secret.txt');
  assert.equal(escaped.status, 403);
  assert.doesNotMatch(escaped.text, /must never be served/);
});

test('createServer start helper honors configurable port and defaults to loopback', async (t) => {
  const server = createServer({ dbPath: ':memory:', adminKey: '', port: 0 });
  await server.start();
  t.after(() => new Promise((accept) => server.close(accept)));
  assert.equal(server.address().address, '127.0.0.1');
  assert.ok(server.address().port > 0);
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
});

test('non-string or hostile JSON zone values produce validation errors, never 500', async (t) => {
  const { api } = await fixture(t);
  for (const zone of [null, [], {}, 123, { toString: 'not callable' }]) {
    hasError(await api('/api/orders', { method: 'POST', body: orderBody(undefined, { customer: { ...CUSTOMER, zone } }) }), 400);
  }
});

test('chunked upload is rejected as soon as it exceeds the cap, without waiting for end', async (t) => {
  const env = await fixture(t);
  const result = await new Promise((accept, reject) => {
    const request = httpRequest(`${env.base}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' } }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        accept({ status: response.statusCode, data: JSON.parse(Buffer.concat(chunks).toString()) });
        request.destroy();
      });
    });
    request.on('error', reject);
    request.setTimeout(3000, () => { reject(new Error('Body cap waited for request end.')); request.destroy(); });
    request.write('x'.repeat(32769));
    // Deliberately do not call end(): the server must still return HTTP 413.
  });
  hasError(result, 413);
});

test('CLI entry point really starts, reads environment and serves HTTP on loopback', async (t) => {
  const env = await fixture(t);
  const child = spawn(process.execPath, [fileURLToPath(new URL('../server/index.mjs', import.meta.url))], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, PORT: '0', ADMIN_KEY: '', DB_PATH: resolve(env.root, 'cli-store.sqlite'), STATIC_DIR: env.staticDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  try {
    const base = await new Promise((accept, reject) => {
      let stdout = '';
      const timer = setTimeout(() => reject(new Error(`CLI startup timed out: ${stderr}`)), 10000);
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`CLI exited with ${code}: ${stderr}`)); });
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
        const match = /http:\/\/127\.0\.0\.1:\d+/u.exec(stdout);
        if (match) { clearTimeout(timer); accept(match[0]); }
      });
    });
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);
    const catalog = await fetch(`${base}/api/catalog`);
    assert.equal((await catalog.json()).products.length, 6);
    assert.equal((await fetch(`${base}/api/admin/orders`)).status, 503);
    const homepage = await fetch(base);
    assert.equal(homepage.status, 200);
    assert.match(await homepage.text(), /SPA fixture/);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exit = once(child, 'exit');
      child.kill('SIGTERM');
      await exit;
    }
  }
});
