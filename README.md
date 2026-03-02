# BatuFlow

**BatuFlow** is a Distribution & Wholesale ERP. It covers sales (orders, delivery, invoicing, payments), inventory (warehouses, stock, goods receipts, pick lists, opname, handovers), delivery (vehicles, trips, driver PWA), finance (chart of accounts, journal entries, expenses, reports, fiscal periods), HR (employees, attendance, leave, payroll), and CRM (leads, activities, commissions, sales targets). The app includes a dashboard, notifications, global search, audit trail, and print views.

---

## Tech Stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **Prisma 7** + **PostgreSQL** (with `@prisma/adapter-pg`)
- **NextAuth.js** (credentials), **next-intl** (i18n: EN / ID)
- **Redis** (optional, for audit queue / background jobs)
- **Shadcn UI**, **Tailwind CSS**, **Recharts**

---

## Prerequisites

- Node.js 18+
- PostgreSQL 16 (or use Docker)
- Redis 7 (optional; app runs without it)

---

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd BatuFlow
npm install
```

### 2. Environment

Copy the example env and set at least `DATABASE_URL` and `AUTH_SECRET`:

```bash
cp .env.example .env
```

Edit `.env`:

- **DATABASE_URL** — PostgreSQL connection string (required).
- **AUTH_SECRET** — Required for NextAuth; use a strong random value in production (e.g. `openssl rand -base64 32`).
- **AUTH_URL** — Base URL of the app (e.g. `http://localhost:3000`).
- **REDIS_URL** — Optional; defaults to `redis://localhost:6379` for queues.

See `.env.example` for all variables and descriptions.

### 3. Database (with Docker)

Start PostgreSQL and Redis:

```bash
npm run docker:up
```

Then push schema and seed demo data:

```bash
npm run db:push
npm run db:seed
```

Or in one go:

```bash
npm run setup
```

If you use your own PostgreSQL, set `DATABASE_URL` and run `db:push` and `db:seed` only.

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Log in with seeded users (see below).

---

## Seeded users (after `db:seed`)

| Role            | Email                  | Password   |
|----------------|------------------------|------------|
| Admin          | admin@batuflow.com     | password123 |
| Manager        | manager@batuflow.com   | password123 |
| Staff (Sales)  | staff1@batuflow.com / staff2@batuflow.com | password123 |
| Driver         | driver@batuflow.com    | password123 |
| Warehouse      | warehouse@batuflow.com | password123 |

**Important:** Change these passwords and set a strong `AUTH_SECRET` before any production or exposed deployment.

---

## Scripts

| Command        | Description                    |
|----------------|--------------------------------|
| `npm run dev`  | Start dev server (Turbopack)   |
| `npm run build` | Production build             |
| `npm run start` | Start production server      |
| `npm run test` | Run Vitest unit tests         |
| `npm run db:push` | Push Prisma schema to DB   |
| `npm run db:seed` | Run seed script             |
| `npm run db:studio` | Open Prisma Studio         |
| `npm run docker:up` | Start PostgreSQL + Redis  |
| `npm run docker:down` | Stop Docker services    |
| `npm run setup` | docker:up + db:push + db:seed |

---

## Architecture (high level)

- **Dashboard** (`/dashboard`) — Role-based KPIs, widgets, recent activity.
- **Sales** — Visits → Sales Orders → Delivery Orders → Invoices → Payments; price tiers, PPN, discounts.
- **Inventory** — Products, warehouses, stock ledger, goods receipts, pick lists, stock opname, handovers.
- **Delivery** — Vehicles, trips, driver PWA (`/driver`), delivery board.
- **Finance** — COA, journal entries (manual + auto from invoice/payment/expense/payroll), expenses, fiscal periods, reports (trial balance, income statement, balance sheet, GL, PPN).
- **HR** — Employees, attendance, leave, payroll (BPJS, PPh 21, payslips).
- **CRM** — Leads, customer activities, commissions, sales targets.
- **Settings** — Users, roles, audit trail, notifications, profile, import.

APIs live under `/api/*`; auth is session-based (NextAuth credentials). PWA manifest is at `/manifest.json` for install prompts (e.g. driver/warehouse apps).

---

## Deploy to production (Neon + Vercel)

After creating a Neon database and setting `DATABASE_URL` and `AUTH_SECRET` in Vercel:

1. **Push schema to Neon** (run once, use your Neon connection string from the Neon dashboard):

   ```bash
   DATABASE_URL="postgresql://user:pass@host.neon.tech/neondb?sslmode=require" npx prisma db push
   ```

2. **Seed demo data** (optional):

   ```bash
   DATABASE_URL="postgresql://user:pass@host.neon.tech/neondb?sslmode=require" npm run db:seed
   ```

   Login with `admin@batuflow.com` / `password123` (and other seeded users; change passwords in production).

3. **Set in Vercel** (Project → Settings → Environment Variables):

   - `AUTH_URL` = your app URL (e.g. `https://batuflow.vercel.app`)
   - `NEXT_PUBLIC_APP_URL` = same as `AUTH_URL`
   - `NEXT_PUBLIC_APP_NAME` = `BatuFlow` (optional)

4. **Redeploy** so new env vars apply: Deployments → … → Redeploy, or push a commit to `main`.

---

## Version

**v1.0.0** — Initial release.
