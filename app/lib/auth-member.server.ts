import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq, and, gt } from "drizzle-orm";
import { db } from "~/db.server";
import { members, memberSessions, type Member } from "~/db.server";

const SESSION_DURATION_DAYS = 30;

// ============================================
// MEMBER AUTHENTICATION
// ============================================

export async function authenticateMember(
  email: string,
  password: string
): Promise<Member | null> {
  const member = await db.query.members.findFirst({
    where: and(eq(members.email, email.toLowerCase()), eq(members.active, true)),
  });

  if (!member) {
    return null;
  }

  const isValid = await bcrypt.compare(password, member.passwordHash);
  if (!isValid) {
    return null;
  }

  return member;
}

// ============================================
// SESSION MANAGEMENT
// ============================================

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getSessionExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + SESSION_DURATION_DAYS);
  return expiry;
}

export async function createMemberSession(
  memberId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const sessionToken = generateSessionToken();
  const expiresAt = getSessionExpiry();

  await db.insert(memberSessions).values({
    memberId,
    sessionToken,
    expiresAt,
    ipAddress,
    userAgent,
  });

  return sessionToken;
}

export async function getMemberBySessionToken(
  sessionToken: string
): Promise<Member | null> {
  const session = await db.query.memberSessions.findFirst({
    where: and(
      eq(memberSessions.sessionToken, sessionToken),
      gt(memberSessions.expiresAt, new Date())
    ),
    with: {
      member: true,
    },
  });

  if (!session || !session.member.active) {
    return null;
  }

  return session.member;
}

export async function deleteMemberSession(sessionToken: string): Promise<void> {
  await db
    .delete(memberSessions)
    .where(eq(memberSessions.sessionToken, sessionToken));
}

// Re-export type
export type { Member };
