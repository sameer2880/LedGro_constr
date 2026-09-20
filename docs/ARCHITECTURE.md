# Architecture

## Data isolation

Every business-owned table (`rentals`, `diary_notes`, `workers`, `worker_attendance`, `worker_payments`,
`worker_feedback`, `worker_locations`) carries a `business_id`. Row-level security in Postgres lets a signed-in
user touch only rows of **their own business**, and only if their role allows it. Triggers stamp `business_id`
on insert and stop rows from being moved to another business, so a browser can't cross the boundary even by
calling the API directly.

The **platform admin** is deliberately outside all of that: they have no business, so the database gives them
no access to any business's data. They can list users across businesses (to manage them) and read/update
`businesses`, nothing else.

## Accounts and sign-in

- Each person is a Supabase Auth user. Business users have a row in `workers` (`role` = worker / manager /
  admin); the platform admin has a row in `platform_admins`.
- A person types their **mobile number, email or username**. `resolveLoginFn` (server, public) finds which
  account that is and returns an opaque login address (`<workers.id>@login.centring.local`); the browser then
  signs in to Supabase with it. No mobile number or other detail is ever returned. The platform admin's own
  email is used as its login address.
- Mobile numbers and usernames are unique across the whole app (database indexes plus a check against the
  platform admin).
- New accounts start with the mobile number as the password and must choose their own at first sign-in.
- One signed-in device per business account (`claim_device`); the platform admin has no such limit.

## Server functions (`src/lib/api`)

They run on the server with the service-role key and re-check who is calling from their own session:

- `auth.functions.ts` — `resolveLoginFn`
- `users.functions.ts` — create / update / reset password / delete a user (platform admin: any business,
  business admin: own business, manager: workers only)
- `businesses.functions.ts` — create a business with its first admin; delete a business and everything in it
- `schemas.ts` — input validation and types (safe for the browser)
- `helpers.server.ts` — caller lookup, account provisioning and other server-only logic. It is loaded
  lazily inside each handler; the folder is deliberately *not* called `server/`, because TanStack Start's
  import protection refuses anything under a `server/` directory in browser code.

The browser has no write access to `workers` at all; that table changes only through these functions.

## Front end

- `src/lib/auth/` — `gate.tsx` (sign-in, first-password step, one-device check, route rules),
  `session.tsx` (who is signed in + their business; snapshot for non-React helpers),
  `access.ts` (what the UI shows per role), `identity.ts`, `roles.ts`.
- Business branding (name, logo, stamp, signature, links) comes from the business's own row; receipts,
  WhatsApp messages, sidebar and dashboard all read it. Business admins edit it in **Business Settings**;
  images live in the public `business-assets` storage bucket, in a folder per business.

## Things to know

- `/mcp` (MCP tools) called the database as an anonymous visitor. After `lockdown.sql` it has no access and
  returns nothing until it is re-implemented with caller authentication.
- The `.lovable/` folder and Lovable packages are untouched; they are safe to keep or replace later.
- Uploaded logos/stamps/signatures are publicly viewable by URL (receipts need them).
