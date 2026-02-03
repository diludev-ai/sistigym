import crypto from "crypto";
import { eq, and, gt, desc, gte, lte, sql } from "drizzle-orm";
import { db } from "~/db.server";
import {
  accessLogs,
  qrTokens,
  members,
  memberships,
  gymSettings,
  type AccessMethod,
  type AccessLog,
} from "~/db.server";
import {
  getActiveMembershipForMember,
  checkMemberOverdue,
  checkMemberPaymentAccess,
  type MembershipPaymentInfo,
} from "./membership.service.server";

// ============================================
// ACCESS VALIDATION RESULT
// ============================================

export type AccessValidationResult = {
  allowed: boolean;
  reason: string;
  member?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  membership?: {
    planName: string;
    daysRemaining: number;
    endsAt: Date;
  };
  paymentInfo?: MembershipPaymentInfo;
  paymentWarning?: string; // Warning message if payment is pending but access allowed
};

// ============================================
// GET SETTING
// ============================================

async function getSetting(key: string, defaultValue: string): Promise<string> {
  const setting = await db.query.gymSettings.findFirst({
    where: eq(gymSettings.key, key),
  });
  return setting?.value || defaultValue;
}

// ============================================
// VALIDATE MEMBER ACCESS
// ============================================

export async function validateMemberAccess(
  memberId: string
): Promise<AccessValidationResult> {
  // 1. Get member
  const member = await db.query.members.findFirst({
    where: eq(members.id, memberId),
  });

  if (!member) {
    return {
      allowed: false,
      reason: "Miembro no encontrado",
    };
  }

  if (!member.active) {
    return {
      allowed: false,
      reason: "Cuenta de miembro inactiva",
      member: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
      },
    };
  }

  // 2. Check active membership
  const activeMembership = await getActiveMembershipForMember(memberId);

  if (!activeMembership) {
    return {
      allowed: false,
      reason: "Sin membresía activa",
      member: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
      },
    };
  }

  if (activeMembership.calculatedStatus === "expired") {
    return {
      allowed: false,
      reason: "Membresía expirada",
      member: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
      },
    };
  }

  if (activeMembership.calculatedStatus === "frozen") {
    return {
      allowed: false,
      reason: "Membresía congelada",
      member: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
      },
    };
  }

  if (activeMembership.calculatedStatus === "cancelled") {
    return {
      allowed: false,
      reason: "Membresía cancelada",
      member: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
      },
    };
  }

  // Check if membership is pending payment activation
  if (activeMembership.status === "pending_payment") {
    return {
      allowed: false,
      reason: "Membresía pendiente de pago - Registre un pago para activar",
      member: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
      },
      membership: {
        planName: activeMembership.plan.name,
        daysRemaining: activeMembership.daysRemaining,
        endsAt: new Date(activeMembership.endsAt),
      },
    };
  }

  // 3. Check morosity (membership expiration)
  const overdueStatus = await checkMemberOverdue(memberId);

  if (overdueStatus.isOverdue) {
    return {
      allowed: false,
      reason: `Moroso (${overdueStatus.daysPastDue} días de atraso)`,
      member: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
      },
    };
  }

  // 4. Check payment status (partial payments system)
  const paymentAccess = await checkMemberPaymentAccess(memberId);

  if (!paymentAccess.canAccess) {
    return {
      allowed: false,
      reason: paymentAccess.reason || "Pago pendiente",
      member: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
      },
      membership: {
        planName: activeMembership.plan.name,
        daysRemaining: activeMembership.daysRemaining,
        endsAt: new Date(activeMembership.endsAt),
      },
      paymentInfo: paymentAccess.paymentInfo,
    };
  }

  // 5. All checks passed - build payment warning if needed
  let paymentWarning: string | undefined;
  if (paymentAccess.paymentInfo && paymentAccess.paymentInfo.pendingAmount > 0) {
    const daysLeft = paymentAccess.paymentInfo.daysUntilDeadline;
    if (daysLeft !== null && daysLeft <= 5 && daysLeft > 0) {
      paymentWarning = `Saldo pendiente: $${paymentAccess.paymentInfo.pendingAmount.toLocaleString()}. Fecha límite en ${daysLeft} día${daysLeft !== 1 ? "s" : ""}`;
    } else if (daysLeft !== null && daysLeft <= 0) {
      paymentWarning = `Saldo pendiente: $${paymentAccess.paymentInfo.pendingAmount.toLocaleString()}. ¡Fecha límite vencida!`;
    } else if (paymentAccess.paymentInfo.pendingAmount > 0) {
      paymentWarning = `Saldo pendiente: $${paymentAccess.paymentInfo.pendingAmount.toLocaleString()}`;
    }
  }

  return {
    allowed: true,
    reason: "Acceso permitido",
    member: {
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
    },
    membership: {
      planName: activeMembership.plan.name,
      daysRemaining: activeMembership.daysRemaining,
      endsAt: new Date(activeMembership.endsAt),
    },
    paymentInfo: paymentAccess.paymentInfo,
    paymentWarning,
  };
}

// ============================================
// REGISTER ACCESS (manual check-in)
// ============================================

export async function registerManualAccess(
  memberId: string,
  verifiedBy: string
): Promise<{ accessLog: AccessLog; validation: AccessValidationResult }> {
  const validation = await validateMemberAccess(memberId);

  const [accessLog] = await db
    .insert(accessLogs)
    .values({
      memberId,
      method: "manual",
      allowed: validation.allowed,
      reason: validation.reason,
      verifiedBy,
      accessedAt: new Date(),
    })
    .returning();

  return { accessLog, validation };
}

// ============================================
// QR TOKEN GENERATION
// ============================================

export async function generateQrToken(memberId: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  // Get QR duration from settings
  const durationSeconds = parseInt(
    await getSetting("qr_duration_seconds", "30"),
    10
  );

  // Generate random token
  const token = crypto.randomBytes(32).toString("hex");

  // Hash the token for storage (never store plain token)
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  // Calculate expiry
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + durationSeconds);

  // Store hashed token in DB
  await db.insert(qrTokens).values({
    memberId,
    tokenHash,
    expiresAt,
  });

  // Return plain token (to be shown in QR) and expiry
  return { token, expiresAt };
}

// ============================================
// VALIDATE QR TOKEN
// ============================================

export async function validateQrToken(
  token: string,
  verifiedBy: string
): Promise<{ accessLog: AccessLog; validation: AccessValidationResult }> {
  // Hash the provided token
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  // Find token in DB
  const qrToken = await db.query.qrTokens.findFirst({
    where: eq(qrTokens.tokenHash, tokenHash),
    with: {
      member: true,
    },
  });

  // Token not found
  if (!qrToken) {
    // Can't create access log without member, return error
    throw new Error("TOKEN_INVALID");
  }

  // Token expired
  if (new Date() > qrToken.expiresAt) {
    const [accessLog] = await db
      .insert(accessLogs)
      .values({
        memberId: qrToken.memberId,
        method: "qr",
        allowed: false,
        reason: "Token QR expirado",
        qrTokenId: qrToken.id,
        verifiedBy,
        accessedAt: new Date(),
      })
      .returning();

    return {
      accessLog,
      validation: {
        allowed: false,
        reason: "Token QR expirado",
        member: {
          id: qrToken.member.id,
          firstName: qrToken.member.firstName,
          lastName: qrToken.member.lastName,
          email: qrToken.member.email,
        },
      },
    };
  }

  // Check if member already entered recently (prevents QR sharing)
  const recentAccessMinutes = 10; // Configurable: minutes to wait between entries
  const recentCutoff = new Date();
  recentCutoff.setMinutes(recentCutoff.getMinutes() - recentAccessMinutes);

  const recentAccess = await db.query.accessLogs.findFirst({
    where: and(
      eq(accessLogs.memberId, qrToken.memberId),
      eq(accessLogs.allowed, true),
      gte(accessLogs.accessedAt, recentCutoff)
    ),
    orderBy: [desc(accessLogs.accessedAt)],
  });

  if (recentAccess) {
    const minutesAgo = Math.floor((Date.now() - new Date(recentAccess.accessedAt).getTime()) / 60000);
    const [accessLog] = await db
      .insert(accessLogs)
      .values({
        memberId: qrToken.memberId,
        method: "qr",
        allowed: false,
        reason: `Ya ingresó hace ${minutesAgo} minuto${minutesAgo !== 1 ? "s" : ""}`,
        qrTokenId: qrToken.id,
        verifiedBy,
        accessedAt: new Date(),
      })
      .returning();

    return {
      accessLog,
      validation: {
        allowed: false,
        reason: `Ya ingresó hace ${minutesAgo} minuto${minutesAgo !== 1 ? "s" : ""}`,
        member: {
          id: qrToken.member.id,
          firstName: qrToken.member.firstName,
          lastName: qrToken.member.lastName,
          email: qrToken.member.email,
        },
      },
    };
  }

  // Atomically mark token as used (prevents race condition)
  // Only updates if usedAt is NULL, returns the updated row
  const [updatedToken] = await db
    .update(qrTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(qrTokens.id, qrToken.id), sql`${qrTokens.usedAt} IS NULL`))
    .returning();

  // If no row was updated, token was already used by another request
  if (!updatedToken) {
    const [accessLog] = await db
      .insert(accessLogs)
      .values({
        memberId: qrToken.memberId,
        method: "qr",
        allowed: false,
        reason: "Token QR ya utilizado",
        qrTokenId: qrToken.id,
        verifiedBy,
        accessedAt: new Date(),
      })
      .returning();

    return {
      accessLog,
      validation: {
        allowed: false,
        reason: "Token QR ya utilizado",
        member: {
          id: qrToken.member.id,
          firstName: qrToken.member.firstName,
          lastName: qrToken.member.lastName,
          email: qrToken.member.email,
        },
      },
    };
  }

  // Validate member access
  const validation = await validateMemberAccess(qrToken.memberId);

  // Create access log
  const [accessLog] = await db
    .insert(accessLogs)
    .values({
      memberId: qrToken.memberId,
      method: "qr",
      allowed: validation.allowed,
      reason: validation.reason,
      qrTokenId: qrToken.id,
      verifiedBy,
      accessedAt: new Date(),
    })
    .returning();

  return { accessLog, validation };
}

// ============================================
// GET ACCESS LOGS
// ============================================

export async function getAccessLogs(options?: {
  memberId?: string;
  startDate?: Date;
  endDate?: Date;
  allowed?: boolean;
  limit?: number;
  offset?: number;
}) {
  const { memberId, startDate, endDate, allowed, limit = 50, offset = 0 } =
    options || {};

  const conditions = [];

  if (memberId) {
    conditions.push(eq(accessLogs.memberId, memberId));
  }
  if (startDate) {
    conditions.push(gte(accessLogs.accessedAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(accessLogs.accessedAt, endDate));
  }
  if (allowed !== undefined) {
    conditions.push(eq(accessLogs.allowed, allowed));
  }

  return db.query.accessLogs.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      member: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      verifiedByStaff: {
        columns: {
          name: true,
        },
      },
    },
    orderBy: [desc(accessLogs.accessedAt)],
    limit,
    offset,
  });
}

// ============================================
// GET TODAY'S ACCESS STATS
// ============================================

export async function getTodayAccessStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [stats] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      allowed: sql<number>`SUM(CASE WHEN allowed = true THEN 1 ELSE 0 END)`,
      denied: sql<number>`SUM(CASE WHEN allowed = false THEN 1 ELSE 0 END)`,
    })
    .from(accessLogs)
    .where(gte(accessLogs.accessedAt, today));

  return {
    total: Number(stats.total),
    allowed: Number(stats.allowed),
    denied: Number(stats.denied),
  };
}

// ============================================
// GET HOURLY ACCESS DISTRIBUTION
// ============================================

export async function getHourlyAccessDistribution(date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const result = await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM accessed_at)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(accessLogs)
    .where(
      and(
        gte(accessLogs.accessedAt, startOfDay),
        lte(accessLogs.accessedAt, endOfDay),
        eq(accessLogs.allowed, true)
      )
    )
    .groupBy(sql`EXTRACT(HOUR FROM accessed_at)`)
    .orderBy(sql`EXTRACT(HOUR FROM accessed_at)`);

  // Fill in all hours
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: 0,
  }));

  for (const row of result) {
    hourlyData[Number(row.hour)].count = Number(row.count);
  }

  return hourlyData;
}

// ============================================
// CLEANUP OLD QR TOKENS
// ============================================

export async function cleanupExpiredQrTokens(): Promise<number> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 24); // Delete tokens older than 24 hours

  await db.delete(qrTokens).where(lte(qrTokens.expiresAt, cutoff));

  return 0;
}
