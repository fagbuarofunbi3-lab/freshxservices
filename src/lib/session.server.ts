// Server-only session helpers. Stores the signed-in profile id in an encrypted cookie.
import { useSession } from "@tanstack/react-start/server";

export type FreshXSession = { profileId?: string };

// Long static password (>= 32 chars) used to encrypt the session cookie.
// Tradeoff for MVP: hardcoded; rotating later means existing sessions invalidate.
const SESSION_PASSWORD =
  "freshx-services-mvp-session-secret-please-rotate-in-production-32";

export const SESSION_CONFIG = {
  password: SESSION_PASSWORD,
  name: "freshx_session",
  maxAge: 60 * 60 * 24 * 60, // 60 days
  cookie: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: true,
    path: "/",
  },
};

export async function getFreshXSession() {
  return useSession<FreshXSession>(SESSION_CONFIG);
}
