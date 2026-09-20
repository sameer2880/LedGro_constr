# LedGro

Rentals, returns, payments, diary notes and worker attendance for centring / shuttering businesses —
**one app, many businesses**. Each business has its own data, users and branding, and the database
keeps them completely separate.

Built with TanStack Start (React) and Supabase.

## Who uses it

| Role | What they do |
|---|---|
| **Platform admin** | Adds, edits, switches off and deletes businesses, and manages their users. Never sees a business's rentals, diary, labour or reports. |
| **Business admin** | Runs one business: everything, including deleting. Adds that business's managers and workers, and sets its branding. |
| **Manager** | Rentals, diary, labour, receipts. Can add workers. Deleting (except rentals) needs the admin. |
| **Worker** | Their own attendance and payments, read-only. |

Everyone signs in with **mobile number, email or username** plus a password.

## Quick start

```bash
npm install
cp .env.example .env        # then fill in the secret key
npm run dev
```

First-time database and admin setup: **[docs/SETUP.md](docs/SETUP.md)**.
How it fits together: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Project layout

```
.
├── docs/                      Setup guide and architecture notes
├── scripts/
│   └── bootstrap.mjs          One-off admin tasks (create the platform admin, migrate old users)
├── supabase/
│   ├── migrations/            Database schema, applied in filename order
│   └── manual/
│       ├── setup-database.sql All migrations in one file (fresh project, paste & run once)
│       └── lockdown.sql       Run once after the admin exists: closes all anonymous access
├── public/                    Static files (logo, manifest, service worker, brand images)
└── src/
    ├── routes/
    │   ├── index.tsx, __root.tsx
    │   └── _authenticated/    Every screen behind sign-in
    │       ├── dashboard, rentals, receipts/, labour/, diary, reports,
    │       │   feedback, worker-locations, reels     Business screens
    │       ├── manage-worker, business-settings      Business admin screens
    │       ├── worker                                Worker's own page
    │       └── platform.businesses, platform.users   Platform admin screens
    ├── components/            UI (layout/, ui/ = shadcn, plus shared dialogs)
    ├── lib/
    │   ├── auth/              session, gate (sign-in), access rules, roles, identity
    │   ├── api/               Server functions: auth, users, businesses (+ schemas, server-only helpers)
    │   ├── mcp/               MCP tools (see docs/ARCHITECTURE.md)
    │   └── brand.ts, rentals.ts, utils.ts, ...
    └── integrations/supabase/ Supabase clients and generated types
```

## Configuration

Copy `.env.example` to `.env`. The same five variables must be set in your hosting settings, and the
app redeployed after any change. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser or commit it.

To rename the product, edit `PLATFORM_NAME` in `src/lib/brand.ts`.
