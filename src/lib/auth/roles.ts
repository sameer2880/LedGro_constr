/**
 * Roles inside ONE business. (The platform admin who creates businesses is a
 * separate concept — see AppRole in lib/auth/session.tsx.)
 *
 *  - "worker"  — attendance/payments only, no management access.
 *  - "manager" — full management access (Rentals, Diary, Labour Charges), but
 *    outside Rentals a delete just tells them to ask the admin. In Manage Users
 *    they can only see and add Workers.
 *  - "admin"   — the business's administrator: can delete anything and can
 *    create Worker, Manager or Admin users for that business.
 *
 * The role is a real column on `workers` and is enforced by the database
 * (row-level security) and the server functions — not by the browser.
 */
export type UserRole = "worker" | "manager" | "admin";
