import { getMe } from "./session";

/**
 * Who can do what. The role comes from the signed-in account's database row
 * (see lib/auth/session.tsx) — and the database enforces the same rules with
 * row-level security, so these helpers only decide what the UI shows.
 *
 *  - super_admin — the platform admin. Manages businesses and their users
 *    (Platform screens only). Never sees a business's rentals, diary, labour
 *    or reports.
 *  - admin       — full rights in their own business, including deleting.
 *  - manager     — full access everywhere in their business, but delete is
 *    blocked (ask the admin) except in Rentals, and Manage Users only
 *    shows/lets them add Workers.
 *  - worker      — never reaches these screens (own attendance page only).
 */

export function isSuperAdmin(): boolean {
  return getMe()?.role === "super_admin";
}

/** The admin of the current business. */
export function isMasterAdmin(): boolean {
  return getMe()?.role === "admin";
}

export function isManager(): boolean {
  return getMe()?.role === "manager";
}

/**
 * Rentals is the one place managers are allowed to delete directly.
 * Everywhere else, deleting is restricted to isMasterAdmin().
 */
export function canDeleteRentals(): boolean {
  return isMasterAdmin() || isManager();
}
