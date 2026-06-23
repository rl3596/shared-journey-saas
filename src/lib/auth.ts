import { createHash } from "node:crypto";

export const SESSION_COOKIE = "couple_session";

/** Deterministic session token derived from the shared password (so it survives restarts). */
export function getSessionToken(): string {
  const secret = process.env.SITE_PASSWORD ?? "";
  return createHash("sha256").update(`couple-site::${secret}`).digest("hex");
}

/** Whether a shared password has been configured. */
export function isPasswordConfigured(): boolean {
  return Boolean(process.env.SITE_PASSWORD && process.env.SITE_PASSWORD.length > 0);
}

/** Validate a submitted password against SITE_PASSWORD. */
export function verifyPassword(input: string): boolean {
  const secret = process.env.SITE_PASSWORD ?? "";
  return secret.length > 0 && input === secret;
}
