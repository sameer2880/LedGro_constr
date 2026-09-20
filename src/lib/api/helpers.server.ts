/**
 * SERVER-ONLY building blocks for the server functions (auth / users / businesses).
 * Named *.server.ts so it can never be bundled for the browser; the .functions.ts
 * files load it lazily inside their handlers.
 */
import { workerAuthEmail } from "@/lib/auth/identity";
import type { Caller, Role, UserContext, WorkerRow } from "./schemas";

export const cleanUsername = (v?: string | null) => v?.trim().toLowerCase() || null;
export const cleanEmail = (v?: string | null) => v?.trim().toLowerCase() || null;
export const escapeLike = (v: string) => v.replace(/[\\%_]/g, "\\$&");

const DUPLICATE_PHONE = "This mobile number is already used by another account";

export function friendly(message: string) {
  if (/username/i.test(message) && /unique|duplicate|already/i.test(message)) return "This username is already taken";
  return /already|registered|exists|duplicate|unique/i.test(message) ? DUPLICATE_PHONE : message;
}

/* ------------------------------------------------------------------ */
/* Clients                                                             */
/* ------------------------------------------------------------------ */
export async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
type Admin = Awaited<ReturnType<typeof adminClient>>;

/* ------------------------------------------------------------------ */
/* Who is calling?                                                     */
/* ------------------------------------------------------------------ */
/** Reads the caller's identity through THEIR session, so row-level security vouches for it. */
export async function getCaller(context: UserContext): Promise<Caller> {
  const { supabase, userId } = context;
  const [superRes, businessRes, workerRes] = await Promise.all([
    supabase.rpc("is_super_admin"),
    supabase.rpc("my_business_id"),
    supabase.from("workers").select("id, role").eq("auth_user_id", userId).maybeSingle(),
  ]);
  const isSuper = superRes.data === true;
  const worker = workerRes.data as { id: string; role: Role } | null;
  const role = isSuper ? "admin" : worker?.role;
  if (role !== "admin" && role !== "manager") throw new Error("You don't have permission to manage users");
  return {
    userId,
    isSuper,
    role,
    businessId: isSuper ? null : ((businessRes.data as string | null) ?? null),
    workerId: worker?.id ?? null,
  };
}

export async function requireSuperAdmin(context: UserContext) {
  const { data } = await context.supabase.rpc("is_super_admin");
  if (data !== true) throw new Error("Only the platform admin can do this");
}

/** Business admins/managers always act inside their own business; the platform admin must name one. */
export async function targetBusinessId(caller: Caller, requested?: string | null) {
  if (!caller.isSuper) {
    if (!caller.businessId) throw new Error("Your business is not active");
    return caller.businessId;
  }
  if (!requested) throw new Error("Choose a business");
  const admin = await adminClient();
  const { data } = await admin.from("businesses").select("id").eq("id", requested).maybeSingle();
  if (!data) throw new Error("Business not found");
  return requested;
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */
export async function loadTarget(caller: Caller, id: string): Promise<WorkerRow> {
  const admin = await adminClient();
  const { data, error } = await admin
    .from("workers")
    .select("id, business_id, name, phone, role, active, auth_user_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  // Same message for "missing" and "someone else's" so ids can't be probed.
  if (!data || (!caller.isSuper && data.business_id !== caller.businessId)) throw new Error("User not found");
  if (caller.role === "manager" && data.role !== "worker") {
    throw new Error("You can only manage worker accounts. Ask the admin for this change.");
  }
  return data as WorkerRow;
}

/**
 * Mobile numbers and usernames are unique among staff/workers by database index;
 * this covers the other table so a business user can never clash with the platform admin.
 */
export async function assertPlatformIdentityFree(admin: Admin, input: { phone?: string | null; username?: string | null }) {
  const phone = input.phone?.trim();
  const username = cleanUsername(input.username);
  if (phone) {
    const { data } = await admin.from("platform_admins").select("user_id").eq("phone", phone).limit(1);
    if (data && data.length > 0) throw new Error(DUPLICATE_PHONE);
  }
  if (username) {
    const { data } = await admin.from("platform_admins").select("user_id").ilike("username", escapeLike(username)).limit(1);
    if (data && data.length > 0) throw new Error("This username is already taken");
  }
}

/** Creates the Auth account (password = mobile number, must be changed at first sign-in) and the workers row. */
export async function provisionUser(input: {
  businessId: string;
  name: string;
  phone: string;
  email?: string | null;
  username?: string | null;
  role: Role;
  daily_wage: number;
  notes?: string | null;
}) {
  const admin = await adminClient();
  await assertPlatformIdentityFree(admin, input);

  const workerId = crypto.randomUUID();
  const { data: created, error } = await admin.auth.admin.createUser({
    email: workerAuthEmail(workerId),
    password: input.phone,
    email_confirm: true,
    user_metadata: { name: input.name, business_id: input.businessId, role: input.role },
  });
  if (error || !created.user) throw new Error(friendly(error?.message ?? "Unable to create the account"));

  const { data: row, error: insertError } = await admin
    .from("workers")
    .insert({
      id: workerId,
      business_id: input.businessId,
      name: input.name,
      phone: input.phone,
      email: cleanEmail(input.email),
      username: cleanUsername(input.username),
      role: input.role,
      daily_wage: input.role === "worker" ? input.daily_wage : 0,
      notes: input.notes?.trim() || null,
      active: true,
      auth_user_id: created.user.id,
      must_set_password: true,
    })
    .select("id")
    .single();
  if (insertError || !row) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw new Error(friendly(insertError?.message ?? "Unable to save the user"));
  }
  return { workerId: row.id as string, authUserId: created.user.id };
}
