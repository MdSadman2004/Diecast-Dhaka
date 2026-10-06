# Diecast Dhaka local backend

A dependency-free Node HTTP + persistent SQLite demonstration. No uploads, live payments, shipping booking, product authentication, or promise of realized profit.

## Run

Use **Node 22.13+** (or a newer release) for `node:sqlite` without an experimental flag. Node 22.5–22.12 needs `--experimental-sqlite`; SQLite can emit an experimental warning depending on the Node version. This project uses `.mjs` modules and does not require a `package.json` change or `npm install` for the backend.

From `E:/Diecast-Dhaka`:

```sh
node server/index.mjs
```

The default is `http://127.0.0.1:5188`; only loopback is bound. `GET /api/health` is available even before the frontend is built. Static files are served from `dist`; build the parent frontend separately before expecting the homepage. Production builds and API requests share this origin. A dev-server proxy must preserve a same-origin loopback Host/Origin pair; direct cross-origin browser writes are rejected, and this server does not enable CORS.

Optional environment settings are documented in `.env.example`. It deliberately contains **no admin key**. To use a local `.env`, copy the example and set a randomly generated `ADMIN_KEY`, then run:

```sh
node --env-file=.env server/index.mjs
```

Alternatively set `ADMIN_KEY`, `PORT`, `DB_PATH` and/or `STATIC_DIR` in the process environment. Paths should be absolute when overriding defaults. `.env` is NOT automatically read by the bare command. Do not put keys in frontend source, a Vite-prefixed variable, URLs, or version control. A local admin client sends the key as `X-Admin-Key`; the backend never returns it. All admin endpoints return HTTP 503 when it is empty and 401 for missing/incorrect keys when configured. Use a high-entropy key, not a short human password.

## Pricing and demo boundaries

The six records are explicitly `demo: true`, series `Mainline`, scale `1:64`. Stock (12, 8, 10, 9, 11 and 7) is **demo inventory**, not a claim of units available in Bangladesh. Model names describe real castings, but neither the seeded products nor the procedural coupe/sport/muscle/hatch/SUV visuals authenticate a casting, packaging variant, colorway or licensed 3D asset.

Default **illustrative** per-unit allocations in BDT:

| id | landedCost | packaging | overhead | returnReserve | shippingSubsidy | targetMargin | paymentFeeRate | rounded demo price |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| skyline | 190 | 20 | 25 | 10 | 0 | .30 | .015 | 360 |
| porsche | 225 | 20 | 25 | 10 | 0 | .30 | .015 | 410 |
| supra | 205 | 20 | 25 | 10 | 0 | .30 | .015 | 380 |
| mustang | 180 | 20 | 25 | 10 | 0 | .30 | .015 | 350 |
| civic | 195 | 20 | 25 | 10 | 0 | .30 | .015 | 370 |
| defender | 215 | 20 | 25 | 10 | 0 | .30 | .015 | 400 |

These inputs are NOT current market facts, supplier quotes, courier tariffs or payment-provider fees. The `.015` fee is only an illustrative collection/payment allowance; COD does not process a live payment.

```text
allocatedCost = landedCost + packaging + overhead + returnReserve + shippingSubsidy
rawPrice = allocatedCost / (1 - targetMargin - paymentFeeRate)
price = ceil(rawPrice / 10) * 10
allocatedNetProfit = price - allocatedCost - price * paymentFeeRate
allocatedNetMargin = allocatedNetProfit / price
```

This is a **net-margin calculation**, not a 30% markup: costs include an overhead allocation, expected returns reserve and shipping subsidy. Integer arithmetic implements upward BDT-10 rounding without floating-point overshoot at exact grid points. Costs accept up to two decimal places; rates up to six. Costs must be finite, non-negative and at most BDT 1,000,000 per field, with positive combined costs. Margin must be `0 <= targetMargin < .7`, fee non-negative, and `1 - targetMargin - paymentFeeRate > 0`; a computed unit price above BDT 100,000,000 is rejected.

Delivery is separately charged BDT 80 inside Dhaka and 150 outside, **assumed to be an equal-cost pass-through**, so it is excluded from merchandise margin. Actual courier costs must be reconciled. If a courier costs more, allocate the difference to `shippingSubsidy`; other variable fees, duties/taxes, shrinkage, labor, marketing, packaging, refunds and business overhead must be reflected in allocations. Compare this cost-based floor with verified market prices: if buyers will not accept it, change sourcing/costs or decline the sale rather than promise a margin that cannot be realized. The server cannot guarantee business-wide 30% net profit with inaccurate costs, insufficient overhead allocation, uncollected orders or unknown tax obligations.

## API contract

All API JSON responses use `Cache-Control: no-store`. Errors are `{ "error": "message" }` with appropriate HTTP status. Monetary values are numeric BDT; rates and margins are fractions, not percentages.

### Public

- `GET /api/health` → `{ok:true, service:'diecast-dhaka', currency:'BDT', demoMode:true}`; verifies a database read.
- `GET /api/catalog` → `{products:[{id,name,category,color,model,price,stock,series:'Mainline',scale:'1:64',demo:true}],currency:'BDT',demoMode:true,delivery:{dhaka:80,outside:150},pricingNote}`. Private allocations are never included.
- `POST /api/orders` → HTTP 201 `{order:{id,createdAt,status:'placed',items,subtotal,deliveryFee,total,customer},demo:true}`.
- `POST /api/orders/lookup` with `{id,phone}` → the same envelope if the normalized phone matches; unknown IDs and phone mismatches both return the same 404. There is no public order list or `GET /api/orders/:id`.

Order input:

```json
{
  "customer": {
    "name": "Demo Buyer",
    "phone": "01712345678",
    "address": "House 10, Demo Road, Dhaka",
    "zone": "dhaka"
  },
  "items": [{ "id": "skyline", "quantity": 1 }],
  "paymentMethod": "cod"
}
```

`zone` is exactly `dhaka` or `outside`. Bangladesh mobile numbers `01[3-9]xxxxxxxx`, `+8801...` and `8801...` normalize to the local 11-digit format; common separators are accepted. Names are 2–100 characters, addresses 8–500. Quantities are positive integers at most 10,000 and must not exceed stock. A cart contains 1–50 distinct IDs; duplicate IDs must be combined before submission. Client prices, totals, fee fields and cost fields are **ignored**: the server recomputes everything from database allocations. Insufficient stock returns 409; an unknown product 404. Item response: `{id,name,quantity,unitPrice,lineTotal}`.

Orders have random UUID-v4 IDs prefixed `DD-`, not sequential enumerable IDs. They still contain PII: treat ID + phone as a minimal local lookup credential, not strong identity authentication. Lookup is POST so the phone is not placed in URLs. This is suitable for a local demo, not a production customer-authentication system. Repeated checkout submission can create another order: no idempotency guarantee is advertised.

### Private admin

Send `X-Admin-Key: <configured value>` on every request:

- `GET /api/admin/products` → `{products,currency:'BDT',demoMode:true}`. Each product contains public fields plus flat pricing inputs, top-level `netMargin` (a fraction), and `pricing:{price,rawPrice,costTotal,paymentFee,netProfit,netMargin,targetMargin,paymentFeeRate}`.
- `PATCH /api/admin/products/:id` → `{product,demo:true}`. Patch only `landedCost`, `packaging`, `overhead`, `returnReserve`, `shippingSubsidy`, `targetMargin`, `paymentFeeRate`, `stock` and/or optional `demo:true`. All resulting pricing inputs are validated; stock is an integer from 0 to 100,000. Arbitrary price, description or identity overrides and `demo:false` are rejected because this catalog does not authenticate real inventory.
- `GET /api/admin/orders` → `{orders,demoMode:true}`. Contains customer PII; keep it local.
- `PATCH /api/admin/orders/:id` with `{status}` → `{order,demo:true}`. Values: `placed`, `confirmed`, `packed`, `shipped`, `delivered`, `cancelled`. This local demo permits any non-cancelled status change, including cancelling a delivered demonstration. A real fulfillment system needs a stricter state machine and return/refund rules.
- `GET /api/admin/summary` → `{currency,demoMode,orderCount,revenue,estimatedProfit,orders:{total,active,cancelled,delivered},inventory:{units,productCount},forecast:{merchandiseRevenue,allocatedNetProfit,netMargin,deliveryPassThrough,note},products:[{id,stock,...pricing}]}`. `orderCount` includes all orders; `revenue` aliases non-cancelled booked merchandise revenue, and `estimatedProfit` aliases non-cancelled snapshotted allocated net profit. Neither is a claim of collected cash or realized earnings.

Cancellation restocks every ordered item inside one transaction, exactly once. Repeating `cancelled` is idempotent, including after restart; reopening a cancelled order returns 409. A restock exceeding the stock ceiling is rejected with the entire transaction rolled back. Order item prices and allocations are snapshotted at purchase, so later product-cost edits do not rewrite historical order totals or forecast margin. Summary excludes cancelled orders and labels booked allocations as forecasts, not realized revenue or profit.

## Persistence, safeguards and operations

- Default database: `server/data/store.sqlite` with SQLite WAL sidecars. `server/data/.gitignore` ignores generated data. SQLite seeds missing demo IDs only; restarts never reset existing stock, allocations or orders. Schema version is 1; no production migration system is implied.
- Prepared statements are used for data parameters. Product PATCH column names come only from a fixed allowlist. `BEGIN IMMEDIATE` atomically reserves/decrements stock and persists orders; cancellation is also atomic.
- Sensitive writes require JSON (`application/json`, optionally charset) and a body no larger than **32 KiB**, including chunked requests. If `Origin` is supplied it must exactly match the loopback HTTP Host origin; foreign and opaque/null origins are rejected. Do not expose this local HTTP server through a tunnel as a live shop.
- Order creation: **10 attempts/IP/minute**. Lookup: **30 attempts/IP/minute**, separately counted. Validation failures count. Excess returns 429 with `Retry-After`. Limits are in memory and reset on process restart; forwarded-IP headers are deliberately ignored. Use a production reverse proxy, TLS, durable distributed limits and real identity controls before internet deployment.
- Static traversal (including encoded slash/backslash traversal), Windows trailing-dot/space aliases, NTFS alternate data streams, dotfiles and symlink/junction escapes are rejected. HTML, including SPA fallback, is not cached. Missing extension-bearing assets return 404 rather than HTML; `/api` never falls back to the SPA. Static HEAD is supported.
- `createServer({dbPath,adminKey,staticDir,port})` returns an **unlistened `http.Server`**. Use `server.listen(0,'127.0.0.1')` for test ports, or `await server.start()` to bind the configured port/default 5188 on loopback. Closing the server closes SQLite.
- Stop the server before backing up `store.sqlite` so WAL is checkpointed and Windows handles are closed. Backups contain customer data; secure them. To reset only this demo, stop it, back up if desired, and remove the database and its `-wal`/`-shm` sidecars. The next launch reseeds demonstration records.
- Local admin access is bearer-key based; there are no admin sessions, roles, audit logs, payment reconciliation, stock-import workflows, real product verification, automated VAT calculations, or customer notifications. Do not enter real customer information into this demonstration.

## Verify

```sh
node --test tests/backend.test.mjs
```

Tests use real HTTP servers on random loopback ports and persistent temporary SQLite files under the D-drive Hermes scratch directory, then clean fixtures after closing connections. They cover pricing/rounding, catalog, auth, validation, server-owned prices, inventory and concurrency, persistence, phone-protected lookup, private cost snapshots, cancellation, body caps, rate limits, origin checks, static fallback and traversal. They do not mock HTTP or SQLite. Frontend rendering and 3D animation are outside this backend suite.
