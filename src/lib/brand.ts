/**
 * Name of the platform itself — shown on the sign-in screen, the landing
 * page and browser tab titles, i.e. anywhere no business is known yet.
 * Everything that belongs to ONE business (name, logo, receipts, WhatsApp
 * messages…) comes from that business's row instead — see lib/auth/session.tsx.
 */
/** The name is split in two so the title can be two-toned: "Plinth" in black, "ora" in green (see BrandName). */
export const PLATFORM_NAME_PARTS = ["Plinth", "ora"] as const;
export const PLATFORM_NAME: string = PLATFORM_NAME_PARTS.join("");
export const PLATFORM_TAGLINE =
  "The foundation for your rental business — rentals, returns, payments and worker records in one place.";