import { createCookie, redirect } from "react-router";
import { getStaffBySessionToken, type StaffUser } from "~/lib/auth.server";

// ============================================
// COOKIE CONFIGURATION
// ============================================

const SESSION_SECRET = process.env.SESSION_SECRET || "default-secret-change-me";

export const staffSessionCookie = createCookie("staff_session", {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 7, // 7 days
  secrets: [SESSION_SECRET],
  path: "/",
});

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

export async function getStaffSessionToken(
  request: Request
): Promise<string | null> {
  const cookieHeader = request.headers.get("Cookie");
  const sessionToken = await staffSessionCookie.parse(cookieHeader);
  return sessionToken || null;
}

export async function getMemberSessionToken(
  request: Request
): Promise<string | null> {
  const cookieHeader = request.headers.get("Cookie");
  const sessionToken = await memberSessionCookie.parse(cookieHeader);
  return sessionToken || null;
}

// ============================================
// STAFF AUTH GUARD
// ============================================

export async function requireStaffAuth(
  request: Request,
  options?: { roles?: Array<"admin" | "reception"> }
): Promise<StaffUser> {
  const sessionToken = await getStaffSessionToken(request);

  if (!sessionToken) {
    throw redirect("/admin/login");
  }

  const staff = await getStaffBySessionToken(sessionToken);

  if (!staff) {
    throw redirect("/admin/login", {
      headers: {
        "Set-Cookie": await staffSessionCookie.serialize("", { maxAge: 0 }),
      },
    });
  }

  // Check role if specified
  if (options?.roles && !options.roles.includes(staff.role)) {
    throw new Response("Forbidden", { status: 403 });
  }

  return staff;
}

// ============================================
// OPTIONAL STAFF AUTH (for login page)
// ============================================

export async function getOptionalStaffAuth(
  request: Request
): Promise<StaffUser | null> {
  const sessionToken = await getStaffSessionToken(request);

  if (!sessionToken) {
    return null;
  }

  return getStaffBySessionToken(sessionToken);
}

// ============================================
// TYPE RE-EXPORTS
// ============================================

export type { StaffUser };
