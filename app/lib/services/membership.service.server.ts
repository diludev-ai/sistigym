import { eq, and, gte, lte, desc, sql, or, isNull } from "drizzle-orm";
import { db } from "~/db.server";
import {
  memberships,
  members,
  plans,
  payments,
  gymSettings,
  type Membership,
  type MembershipStatus,
} from "~/db.server";
import { getPartialPaymentsConfig } from "./settings.service.server";

// ============================================
// PAYMENT STATUS TYPES
// ============================================

export type PaymentStatus = "paid" | "partial" | "pending" | "overdue";

export interface MembershipPaymentInfo {
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  paymentStatus: PaymentStatus;
  paymentDeadline: Date | null;
  isOverduePayment: boolean;
  daysUntilDeadline: number | null;
}

// ============================================
// MEMBERSHIP STATUS CALCULATION
// ============================================

export type MembershipWithDetails = Membership & {
  member: { id: string; firstName: string; lastName: string; email: string };
  plan: { id: string; name: string; price: string; durationDays: number };
  daysRemaining: number;
  isOverdue: boolean;
  overdueAmount: number;
};

export function calculateMembershipStatus(membership: {
  status: MembershipStatus;
  endsAt: Date;
  frozenAt: Date | null;
}): {
  calculatedStatus: MembershipStatus;
  daysRemaining: number;
} {
  const now = new Date();
  const endsAt = new Date(membership.endsAt);

  // If frozen, cancelled, or pending_payment, keep that status
  if (membership.status === "frozen" || membership.status === "cancelled" || membership.status === "pending_payment") {
    const diffTime = endsAt.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    return {
      calculatedStatus: membership.status,
      daysRemaining,
    };
  }

  const diffTime = endsAt.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining <= 0) {
    return {
      calculatedStatus: "expired",
      daysRemaining: 0,
    };
  }

  return {
    calculatedStatus: "active",
    daysRemaining,
  };
}

// ============================================
// CALCULATE MEMBERSHIP PAYMENT STATUS
// ============================================

export async function calculateMembershipPaymentInfo(
  membershipId: string
): Promise<MembershipPaymentInfo | null> {
  const config = await getPartialPaymentsConfig();

  // Get membership with its payments
  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.id, membershipId),
    with: {
      plan: true,
      payments: {
        where: isNull(payments.cancelledAt), // Exclude cancelled payments
      },
    },
  });

  if (!membership) return null;

  const totalAmount = membership.totalAmount
    ? parseFloat(membership.totalAmount)
    : parseFloat(membership.plan.price);

  // Sum all valid (non-cancelled) payments for this membership
  const paidAmount = membership.payments.reduce(
    (sum, p) => sum + parseFloat(p.amount),
    0
  );

  const pendingAmount = Math.max(0, totalAmount - paidAmount);

  // Calculate payment deadline
  const startsAt = new Date(membership.startsAt);
  const paymentDeadline = new Date(startsAt);
  paymentDeadline.setDate(paymentDeadline.getDate() + config.deadlineDays);

  // Calculate days until deadline
  const now = new Date();
  const diffTime = paymentDeadline.getTime() - now.getTime();
  const daysUntilDeadline = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Determine payment status
  let paymentStatus: PaymentStatus;
  let isOverduePayment = false;

  if (pendingAmount <= 0) {
    paymentStatus = "paid";
  } else if (paidAmount > 0) {
    // Has partial payment
    if (daysUntilDeadline < -config.gracePeriodDays) {
      // Past grace period
      paymentStatus = "overdue";
      isOverduePayment = true;
    } else {
      paymentStatus = "partial";
    }
  } else {
    // No payments at all
    if (daysUntilDeadline < -config.gracePeriodDays) {
      paymentStatus = "overdue";
      isOverduePayment = true;
    } else {
      paymentStatus = "pending";
    }
  }

  return {
    totalAmount,
    paidAmount,
    pendingAmount,
    paymentStatus,
    paymentDeadline,
    isOverduePayment,
    daysUntilDeadline,
  };
}

// ============================================
// CHECK IF MEMBER CAN ACCESS (considering payment status)
// ============================================

export async function checkMemberPaymentAccess(memberId: string): Promise<{
  canAccess: boolean;
  reason?: string;
  paymentInfo?: MembershipPaymentInfo;
}> {
  const config = await getPartialPaymentsConfig();

  // If partial payments feature is disabled, always allow
  if (!config.enabled) {
    return { canAccess: true };
  }

  // Get active membership
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.memberId, memberId),
      or(eq(memberships.status, "active"), eq(memberships.status, "frozen"))
    ),
    orderBy: [desc(memberships.endsAt)],
  });

  if (!membership) {
    return { canAccess: false, reason: "Sin membresía activa" };
  }

  const paymentInfo = await calculateMembershipPaymentInfo(membership.id);

  if (!paymentInfo) {
    return { canAccess: true };
  }

  // Check access based on payment status
  if (paymentInfo.paymentStatus === "paid") {
    return { canAccess: true, paymentInfo };
  }

  if (paymentInfo.paymentStatus === "overdue") {
    return {
      canAccess: false,
      reason: `Pago vencido. Saldo pendiente: $${paymentInfo.pendingAmount.toLocaleString()}`,
      paymentInfo,
    };
  }

  // Partial or pending payment
  if (config.allowAccessWithPartial) {
    // Allow access but include payment info for warning
    return { canAccess: true, paymentInfo };
  } else {
    // Don't allow access if not fully paid
    if (paymentInfo.paidAmount === 0) {
      return {
        canAccess: false,
        reason: `Pago pendiente. Debe pagar $${paymentInfo.totalAmount.toLocaleString()} para acceder`,
        paymentInfo,
      };
    } else {
      return {
        canAccess: false,
        reason: `Pago incompleto. Saldo pendiente: $${paymentInfo.pendingAmount.toLocaleString()}`,
        paymentInfo,
      };
    }
  }
}

// ============================================
// GET MEMBERS WITH PENDING PAYMENTS
// ============================================

export async function getMembersWithPendingPayments() {
  const config = await getPartialPaymentsConfig();

  if (!config.enabled) {
    return [];
  }

  // Get all active memberships
  const activeMemberships = await db.query.memberships.findMany({
    where: eq(memberships.status, "active"),
    with: {
      member: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      plan: {
        columns: {
          name: true,
          price: true,
        },
      },
      payments: {
        where: isNull(payments.cancelledAt),
      },
    },
  });

  const result = [];

  for (const m of activeMemberships) {
    const totalAmount = m.totalAmount
      ? parseFloat(m.totalAmount)
      : parseFloat(m.plan.price);

    const paidAmount = m.payments.reduce(
      (sum, p) => sum + parseFloat(p.amount),
      0
    );

    if (paidAmount < totalAmount) {
      const startsAt = new Date(m.startsAt);
      const paymentDeadline = new Date(startsAt);
      paymentDeadline.setDate(paymentDeadline.getDate() + config.deadlineDays);

      const now = new Date();
      const daysUntilDeadline = Math.ceil(
        (paymentDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const isOverdue = daysUntilDeadline < -config.gracePeriodDays;

      result.push({
        membership: m,
        member: m.member,
        plan: m.plan,
        totalAmount,
        paidAmount,
        pendingAmount: totalAmount - paidAmount,
        paymentDeadline,
        daysUntilDeadline,
        isOverdue,
      });
    }
  }

  // Sort by days until deadline (most urgent first)
  return result.sort((a, b) => a.daysUntilDeadline - b.daysUntilDeadline);
}

// ============================================
// GET MOROSITY TOLERANCE FROM SETTINGS
// ============================================

async function getMorosityToleranceDays(): Promise<number> {
  const setting = await db.query.gymSettings.findFirst({
    where: eq(gymSettings.key, "morosity_tolerance_days"),
  });
  return parseInt(setting?.value || "5", 10);
}

// ============================================
// CHECK IF MEMBER IS OVERDUE (moroso)
// ============================================

export async function checkMemberOverdue(memberId: string): Promise<{
  isOverdue: boolean;
  daysPastDue: number;
  overdueAmount: number;
}> {
  const toleranceDays = await getMorosityToleranceDays();

  // Get active/expired membership
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.memberId, memberId),
      or(eq(memberships.status, "active"), eq(memberships.status, "expired"))
    ),
    with: {
      plan: true,
    },
    orderBy: [desc(memberships.endsAt)],
  });

  if (!membership) {
    return { isOverdue: false, daysPastDue: 0, overdueAmount: 0 };
  }

  const now = new Date();
  const endsAt = new Date(membership.endsAt);
  const diffTime = now.getTime() - endsAt.getTime();
  const daysPastDue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // If past tolerance, they're overdue
  if (daysPastDue > toleranceDays) {
    return {
      isOverdue: true,
      daysPastDue,
      overdueAmount: parseFloat(membership.plan.price),
    };
  }

  return { isOverdue: false, daysPastDue: 0, overdueAmount: 0 };
}

// ============================================
// GET ALL MEMBERSHIPS
// ============================================

export async function getMemberships(options?: {
  status?: MembershipStatus;
  limit?: number;
  offset?: number;
}) {
  const { status, limit = 50, offset = 0 } = options || {};

  const result = await db.query.memberships.findMany({
    where: status ? eq(memberships.status, status) : undefined,
    with: {
      member: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      plan: {
        columns: {
          id: true,
          name: true,
          price: true,
          durationDays: true,
        },
      },
    },
    orderBy: [desc(memberships.createdAt)],
    limit,
    offset,
  });

  // Calculate status and days remaining for each
  return result.map((m) => {
    const { calculatedStatus, daysRemaining } = calculateMembershipStatus(m);
    return {
      ...m,
      calculatedStatus,
      daysRemaining,
    };
  });
}

// ============================================
// GET MEMBERSHIP BY ID
// ============================================

export async function getMembershipById(id: string) {
  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.id, id),
    with: {
      member: true,
      plan: true,
      payments: {
        orderBy: [desc(payments.paidAt)],
      },
    },
  });

  if (!membership) return null;

  const { calculatedStatus, daysRemaining } =
    calculateMembershipStatus(membership);

  return {
    ...membership,
    calculatedStatus,
    daysRemaining,
  };
}

// ============================================
// GET ACTIVE MEMBERSHIP FOR MEMBER
// ============================================

export async function getActiveMembershipForMember(memberId: string) {
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.memberId, memberId),
      or(
        eq(memberships.status, "active"),
        eq(memberships.status, "frozen"),
        eq(memberships.status, "pending_payment")
      )
    ),
    with: {
      plan: true,
    },
    orderBy: [desc(memberships.endsAt)],
  });

  if (!membership) return null;

  const { calculatedStatus, daysRemaining } =
    calculateMembershipStatus(membership);

  return {
    ...membership,
    calculatedStatus,
    daysRemaining,
  };
}

// ============================================
// CREATE MEMBERSHIP
// ============================================

export async function createMembership(data: {
  memberId: string;
  planId: string;
  startsAt?: Date;
}): Promise<Membership> {
  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, data.planId),
  });

  if (!plan) {
    throw new Error("Plan no encontrado");
  }

  const startsAt = data.startsAt || new Date();
  const endsAt = new Date(startsAt);
  endsAt.setDate(endsAt.getDate() + plan.durationDays);

  // Check if member already has active membership
  const existingActive = await getActiveMembershipForMember(data.memberId);
  if (existingActive && existingActive.calculatedStatus === "active") {
    throw new Error("El miembro ya tiene una membresía activa");
  }

  // Check if payment is required to activate
  const config = await getPartialPaymentsConfig();
  const initialStatus = config.requirePaymentToActivate
    ? "pending_payment"
    : "active";

  const [membership] = await db
    .insert(memberships)
    .values({
      memberId: data.memberId,
      planId: data.planId,
      status: initialStatus,
      startsAt,
      endsAt,
      totalAmount: plan.price, // Save the plan price at creation time
    })
    .returning();

  return membership;
}

// ============================================
// RENEW MEMBERSHIP
// ============================================

export async function renewMembership(data: {
  memberId: string;
  planId: string;
}): Promise<Membership> {
  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, data.planId),
  });

  if (!plan) {
    throw new Error("Plan no encontrado");
  }

  // Get current membership to extend from its end date
  const currentMembership = await getActiveMembershipForMember(data.memberId);

  let startsAt: Date;
  if (
    currentMembership &&
    new Date(currentMembership.endsAt) > new Date()
  ) {
    // Extend from current end date
    startsAt = new Date(currentMembership.endsAt);
  } else {
    // Start from today
    startsAt = new Date();
  }

  const endsAt = new Date(startsAt);
  endsAt.setDate(endsAt.getDate() + plan.durationDays);

  // Mark old membership as expired if exists
  if (currentMembership) {
    await db
      .update(memberships)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(memberships.id, currentMembership.id));
  }

  // Check if payment is required to activate
  const config = await getPartialPaymentsConfig();
  const initialStatus = config.requirePaymentToActivate
    ? "pending_payment"
    : "active";

  const [membership] = await db
    .insert(memberships)
    .values({
      memberId: data.memberId,
      planId: data.planId,
      status: initialStatus,
      startsAt,
      endsAt,
      totalAmount: plan.price, // Save the plan price at creation time
    })
    .returning();

  return membership;
}

// ============================================
// ACTIVATE MEMBERSHIP (when first payment is made)
// ============================================

export async function activateMembership(membershipId: string): Promise<Membership | null> {
  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.id, membershipId),
  });

  if (!membership || membership.status !== "pending_payment") {
    return membership || null;
  }

  const [updated] = await db
    .update(memberships)
    .set({
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(memberships.id, membershipId))
    .returning();

  return updated || null;
}

// ============================================
// FREEZE MEMBERSHIP
// ============================================

export async function freezeMembership(
  membershipId: string,
  days: number
): Promise<Membership | null> {
  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.id, membershipId),
  });

  if (!membership || membership.status !== "active") {
    return null;
  }

  // Extend end date by frozen days
  const newEndsAt = new Date(membership.endsAt);
  newEndsAt.setDate(newEndsAt.getDate() + days);

  const [updated] = await db
    .update(memberships)
    .set({
      status: "frozen",
      frozenAt: new Date(),
      frozenDays: (membership.frozenDays || 0) + days,
      endsAt: newEndsAt,
      updatedAt: new Date(),
    })
    .where(eq(memberships.id, membershipId))
    .returning();

  return updated || null;
}

// ============================================
// UNFREEZE MEMBERSHIP
// ============================================

export async function unfreezeMembership(
  membershipId: string
): Promise<Membership | null> {
  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.id, membershipId),
  });

  if (!membership || membership.status !== "frozen") {
    return null;
  }

  const [updated] = await db
    .update(memberships)
    .set({
      status: "active",
      frozenAt: null,
      updatedAt: new Date(),
    })
    .where(eq(memberships.id, membershipId))
    .returning();

  return updated || null;
}

// ============================================
// CANCEL MEMBERSHIP
// ============================================

export async function cancelMembership(
  membershipId: string
): Promise<Membership | null> {
  const [updated] = await db
    .update(memberships)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(memberships.id, membershipId))
    .returning();

  return updated || null;
}

// ============================================
// UPDATE EXPIRED MEMBERSHIPS (cron job)
// ============================================

export async function updateExpiredMemberships(): Promise<number> {
  const now = new Date();

  const result = await db
    .update(memberships)
    .set({ status: "expired", updatedAt: new Date() })
    .where(
      and(eq(memberships.status, "active"), lte(memberships.endsAt, now))
    );

  return 0; // Drizzle doesn't easily return count
}

// ============================================
// GET OVERDUE MEMBERS (morosos)
// ============================================

export async function getOverdueMembers() {
  const toleranceDays = await getMorosityToleranceDays();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - toleranceDays);

  const overdueList = await db.query.memberships.findMany({
    where: and(
      eq(memberships.status, "expired"),
      lte(memberships.endsAt, cutoffDate)
    ),
    with: {
      member: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      plan: {
        columns: {
          name: true,
          price: true,
        },
      },
    },
    orderBy: [memberships.endsAt],
  });

  return overdueList.map((m) => {
    const daysPastDue = Math.floor(
      (new Date().getTime() - new Date(m.endsAt).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return {
      ...m,
      daysPastDue,
    };
  });
}

// ============================================
// GET MEMBERSHIP STATS
// ============================================

export async function getMembershipStats() {
  const [activeCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(memberships)
    .where(
      and(eq(memberships.status, "active"), gte(memberships.endsAt, new Date()))
    );

  const [expiredCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(memberships)
    .where(eq(memberships.status, "expired"));

  const [frozenCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(memberships)
    .where(eq(memberships.status, "frozen"));

  return {
    active: Number(activeCount.count),
    expired: Number(expiredCount.count),
    frozen: Number(frozenCount.count),
  };
}
