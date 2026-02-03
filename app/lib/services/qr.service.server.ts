import crypto from "crypto";
import QRCode from "qrcode";
import { eq, and, lte } from "drizzle-orm";
import { db } from "~/db.server";
import { qrTokens, gymSettings } from "~/db.server";

// ============================================
// GET QR DURATION FROM SETTINGS
// ============================================

async function getQrDurationSeconds(): Promise<number> {
  const setting = await db.query.gymSettings.findFirst({
    where: eq(gymSettings.key, "qr_duration_seconds"),
  });
  return parseInt(setting?.value || "30", 10);
}

// ============================================
// GENERATE QR TOKEN
// ============================================

export async function generateQrToken(memberId: string): Promise<{
  token: string;
  tokenHash: string;
  expiresAt: Date;
  qrDataUrl: string;
  durationSeconds: number;
}> {
  const durationSeconds = await getQrDurationSeconds();

  // Generate cryptographically secure random token
  const token = crypto.randomBytes(32).toString("hex");

  // Hash the token with SHA256 (never store plain token)
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  // Calculate expiry
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + durationSeconds);

  // Store ONLY the hash in database
  await db.insert(qrTokens).values({
    memberId,
    tokenHash,
    expiresAt,
  });

  // Generate QR code as data URL (contains plain token)
  const qrDataUrl = await QRCode.toDataURL(token, {
    width: 300,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "M",
  });

  return {
    token,
    tokenHash,
    expiresAt,
    qrDataUrl,
    durationSeconds,
  };
}

// ============================================
// VALIDATE QR TOKEN (called from access.service.ts)
// ============================================

export async function findQrTokenByPlainToken(plainToken: string) {
  // Hash the provided token
  const tokenHash = crypto.createHash("sha256").update(plainToken).digest("hex");

  // Find in database by hash
  const qrToken = await db.query.qrTokens.findFirst({
    where: eq(qrTokens.tokenHash, tokenHash),
    with: {
      member: true,
    },
  });

  return qrToken;
}

// ============================================
// MARK TOKEN AS USED
// ============================================

export async function markTokenAsUsed(tokenId: string): Promise<void> {
  await db
    .update(qrTokens)
    .set({ usedAt: new Date() })
    .where(eq(qrTokens.id, tokenId));
}

// ============================================
// CHECK TOKEN STATUS
// ============================================

export type TokenValidationResult = {
  valid: boolean;
  reason: "valid" | "not_found" | "expired" | "already_used";
  token?: typeof qrTokens.$inferSelect & {
    member: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      active: boolean;
    };
  };
};

export async function validateQrTokenStatus(
  plainToken: string
): Promise<TokenValidationResult> {
  const tokenHash = crypto.createHash("sha256").update(plainToken).digest("hex");

  const qrToken = await db.query.qrTokens.findFirst({
    where: eq(qrTokens.tokenHash, tokenHash),
    with: {
      member: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          active: true,
        },
      },
    },
  });

  if (!qrToken) {
    return { valid: false, reason: "not_found" };
  }

  if (qrToken.usedAt) {
    return { valid: false, reason: "already_used", token: qrToken };
  }

  if (new Date() > qrToken.expiresAt) {
    return { valid: false, reason: "expired", token: qrToken };
  }

  return { valid: true, reason: "valid", token: qrToken };
}

// ============================================
// CLEANUP OLD TOKENS
// ============================================

export async function cleanupOldQrTokens(): Promise<void> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 24);

  await db.delete(qrTokens).where(lte(qrTokens.expiresAt, cutoff));
}

// ============================================
// GET ACTIVE TOKEN FOR MEMBER (if any)
// ============================================

export async function getActiveTokenForMember(memberId: string) {
  const now = new Date();

  return db.query.qrTokens.findFirst({
    where: and(
      eq(qrTokens.memberId, memberId),
      // Not used and not expired
      eq(qrTokens.usedAt, null as any), // Will be null
    ),
    orderBy: (qrTokens, { desc }) => [desc(qrTokens.createdAt)],
  });
}
