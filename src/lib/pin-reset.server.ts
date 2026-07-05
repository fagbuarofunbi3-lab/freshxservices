// Server-only helpers to mint/verify short-lived HMAC tokens used for
// "forgot transaction PIN" email reset links.
import { createHmac, timingSafeEqual } from "crypto";

const SECRET =
  process.env.PIN_RESET_SECRET ??
  "freshx-services-pin-reset-static-secret-please-rotate-in-production";

const TTL_MS = 30 * 60 * 1000; // 30 minutes

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signPinResetToken(profileId: string): string {
  const payload = { p: profileId, e: Date.now() + TTL_MS };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", SECRET).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyPinResetToken(token: string): { profileId: string } | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = b64url(createHmac("sha256", SECRET).update(body).digest());
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as {
      p: string;
      e: number;
    };
    if (!payload.p || typeof payload.e !== "number") return null;
    if (Date.now() > payload.e) return null;
    return { profileId: payload.p };
  } catch {
    return null;
  }
}
