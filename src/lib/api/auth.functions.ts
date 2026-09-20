import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { UNKNOWN_LOGIN_EMAIL, workerAuthEmail } from "@/lib/auth/identity";


/**
 * Sign-in: turns whatever the person typed — mobile number, email or username —
 * into the address their Supabase Auth account uses. Public on purpose (nobody
 * is signed in yet). It returns only that opaque address, never a mobile number
 * or any other detail, and an unknown identifier just gets an address that
 * cannot sign in.
 *
 * Works the same for every kind of user: workers, managers, business admins and
 * the platform admin.
 */
export const resolveLoginFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ identifier: z.string().trim().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const h = await import("./helpers.server");
    const admin = await h.adminClient();
    const raw = data.identifier;
    const digits = raw.replace(/[\s+-]/g, "");

    let column: "phone" | "email" | "username";
    let value: string;
    if (/^\d{10,12}$/.test(digits)) {
      column = "phone";
      value = digits.slice(-10);
    } else if (raw.includes("@")) {
      column = "email";
      value = raw.toLowerCase();
    } else {
      column = "username";
      value = raw.toLowerCase();
    }

    // 1. Business users (worker / manager / admin)
    let staff = admin.from("workers").select("id").not("auth_user_id", "is", null).eq("active", true);
    staff = column === "phone" ? staff.eq("phone", value) : staff.ilike(column, h.escapeLike(value));
    const { data: staffRows } = await staff.limit(2);
    if (staffRows && staffRows.length === 1) return { email: workerAuthEmail(staffRows[0].id as string) };
    if (staffRows && staffRows.length > 1) return { email: UNKNOWN_LOGIN_EMAIL }; // ambiguous

    // 2. The platform admin
    let platform = admin.from("platform_admins").select("email");
    platform = column === "phone" ? platform.eq("phone", value) : platform.ilike(column, h.escapeLike(value));
    const { data: platformRows } = await platform.limit(2);
    if (platformRows && platformRows.length === 1 && platformRows[0].email) return { email: platformRows[0].email as string };

    // 3. Nothing matched: an email may still be an Auth address as typed.
    if (column === "email") return { email: value };
    return { email: UNKNOWN_LOGIN_EMAIL };
  });
