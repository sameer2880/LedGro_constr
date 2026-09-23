import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public on purpose: this powers the "Share receipt" WhatsApp links, which a
 * customer opens without ever signing in. It only ever returns what already
 * prints on a receipt (rental line items + the business's public letterhead
 * fields) — never login-only data like usernames, worker records, etc.
 */
export const getPublicReceiptFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const h = await import("./helpers.server");
    const admin = await h.adminClient();

    const { data: rental, error } = await admin.from("rentals").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!rental) return null;

    const groupId = (rental as { group_id: string | null }).group_id;
    const { data: rows, error: rowsError } = groupId
      ? await admin.from("rentals").select("*").eq("group_id", groupId).order("created_at", { ascending: true })
      : { data: [rental], error: null };
    if (rowsError) throw new Error(rowsError.message);

    const businessId = (rental as { business_id: string | null }).business_id;
    let business: {
      name: string;
      location: string | null;
      owner_line: string | null;
      phone: string | null;
      logo_url: string | null;
      stamp_url: string | null;
      signature_url: string | null;
    } | null = null;
    if (businessId) {
      const { data: b, error: bError } = await admin
        .from("businesses")
        .select("name, location, owner_line, phone, logo_url, stamp_url, signature_url")
        .eq("id", businessId)
        .maybeSingle();
      if (bError) throw new Error(bError.message);
      business = b;
    }

    return { rows: (rows ?? [rental]) as Record<string, unknown>[], business };
  });