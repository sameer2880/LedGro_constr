/**
 * Everyone signs in with a real Supabase Auth account. People type whatever
 * they remember — mobile number, email or username — and the server looks up
 * which account that is (see resolveLoginFn), so nothing personal (like a
 * mobile number) is baked into the account's login address.
 *
 * Each staff/worker account's Auth address is simply "<their workers.id>@<domain>".
 * The platform admin signs in with their own real email.
 *
 * Keep AUTH_EMAIL_DOMAIN identical to the one in scripts/bootstrap.mjs.
 */
export const AUTH_EMAIL_DOMAIN = "login.centring.local";

/** Local (per-device) token used to allow one signed-in device per account. */
export const DEVICE_TOKEN_KEY = "centring-device-token";

export const MOBILE_REGEX = /^[6789]\d{9}$/;

export function workerAuthEmail(workerId: string) {
  return `${workerId}@${AUTH_EMAIL_DOMAIN}`;
}

/** An address that never exists — returned for unknown identifiers so sign-in just fails. */
export const UNKNOWN_LOGIN_EMAIL = `unknown@${AUTH_EMAIL_DOMAIN}`;
