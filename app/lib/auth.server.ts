import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq, and, gt, lte } from "drizzle-orm";
import { db } from "~/db.server";
import { staffUsers, staffSessions, type StaffUser } from "../../db/schema";

const SESSION_DURATION_DAYS = 7;
const SALT_ROUNDS = 12;

// ============================================
// PASSWORD UTILITIES
// ============================================

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================
// SESSION UTILITIES
// ============================================

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getSessionExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + SESSION_DURATION_DAYS);
  return expiry;
}

// ============================================
// STAFF AUTHENTICATION
// ============================================

export async function authenticateStaff(
  email: string,
  password: string
): Promise<StaffUser | null> {
  const user = await db.query.staffUsers.findFirst({
    where: and(eq(staffUsers.email, email.toLowerCase()), eq(staffUsers.active, true)),
  });

  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  return user;
}

export async function createStaffSession(
  staffId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const sessionToken = generateSessionToken();
  const expiresAt = getSessionExpiry();

  await db.insert(staffSessions).values({
    staffId,
    sessionToken,
    expiresAt,
    ipAddress,
    userAgent,
  });

  return sessionToken;
}

export async function getStaffBySessionToken(
  sessionToken: string
): Promise<StaffUser | null> {
  const session = await db.query.staffSessions.findFirst({
    where: and(
      eq(staffSessions.sessionToken, sessionToken),
      gt(staffSessions.expiresAt, new Date())
    ),
    with: {
      staff: true,
    },
  });

  if (!session || !session.staff.active) {
    return null;
  }

  return session.staff;
}

export async function deleteStaffSession(sessionToken: string): Promise<void> {
  await db
    .delete(staffSessions)
    .where(eq(staffSessions.sessionToken, sessionToken));
}

export async function deleteAllStaffSessions(staffId: string): Promise<void> {
  await db.delete(staffSessions).where(eq(staffSessions.staffId, staffId));
}

// ============================================
// CLEANUP EXPIRED SESSIONS
// ============================================

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db
    .delete(staffSessions)
    .where(lte(staffSessions.expiresAt, new Date()));

  return 0; // Drizzle doesn't return count easily, would need raw query
}

// Re-export StaffUser type
export type { StaffUser };
