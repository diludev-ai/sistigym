import { createCookie, redirect } from "react-router";
import { getMemberBySessionToken, type Member } from "~/lib/auth-member.server";

// ============================================
// COOKIE CONFIGURATION
// ============================================

const SESSION_SECRET = process.env.SESSION_SECRET || "default-secret-change-me";

export const memberSessionCookie = createCookie("member_session", {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 30, // 30 days
  secrets: [SESSION_SECRET],
  path: "/",
});

// ============================================
// SESSION HELPERS
// ============================================

export async function getMemberSessionToken(
  request: Request
): Promise<string | null> {
  const cookieHeader = request.headers.get("Cookie");
  const sessionToken = await memberSessionCookie.parse(cookieHeader);
  return sessionToken || null;
}

// ============================================
// MEMBER AUTH GUARD
// ============================================

export async function requireMemberAuth(request: Request): Promise<Member> {
  const sessionToken = await getMemberSessionToken(request);

  if (!sessionToken) {
    throw redirect("/app/login");
  }

  const member = await getMemberBySessionToken(sessionToken);

  if (!member) {
    throw redirect("/app/login", {
      headers: {
        "Set-Cookie": await memberSessionCookie.serialize("", { maxAge: 0 }),
      },
    });
  }

  return member;
}

// ============================================
// OPTIONAL MEMBER AUTH
// ============================================

export async function getOptionalMemberAuth(
  request: Request
): Promise<Member | null> {
  const sessionToken = await getMemberSessionToken(request);

  if (!sessionToken) {
    return null;
  }

  return getMemberBySessionToken(sessionToken);
}

// Re-export
export type { Member };
