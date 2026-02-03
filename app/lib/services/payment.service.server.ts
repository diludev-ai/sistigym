import { eq, desc, inArray, and, gte, lte, sql, between, isNull } from "drizzle-orm";
import { db } from "~/db.server";
import { payments, memberships, members, plans } from "~/db.server";
import { activateMembership } from "./membership.service.server";

// ============================================
// GET PAYMENTS (with filters)
// ============================================

export async function getPayments(options: {
  memberId?: string;
  method?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
} = {}) {
  const { memberId, method, startDate, endDate, limit = 50, offset = 0 } = options;

  const conditions = [];

  if (memberId) {
    conditions.push(eq(payments.memberId, memberId));
  }

  if (method) {
    conditions.push(eq(payments.method, method as "cash" | "card" | "transfer"));
  }

  if (startDate) {
    conditions.push(gte(payments.paidAt, startDate));
  }

  if (endDate) {
    conditions.push(lte(payments.paidAt, endDate));
  }

  return db.query.payments.findMany({
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
      membership: {
        with: {
          plan: {
            columns: {
              name: true,
            },
          },
        },
      },
      receivedByStaff: {
        columns: {
          name: true,
        },
      },
      cancelledByStaff: {
        columns: {
          name: true,
        },
      },
    },
    orderBy: [desc(payments.paidAt)],
    limit,
    offset,
  });
}

// ============================================
// GET PAYMENTS FOR MEMBER
// ============================================

export async function getPaymentsForMember(memberId: string, limit = 50) {
  const membershipsList = await db.query.memberships.findMany({
    where: eq(memberships.memberId, memberId),
    columns: { id: true },
  });

  const membershipIds = membershipsList.map((m) => m.id);

  if (membershipIds.length === 0) {
    return [];
  }

  return db.query.payments.findMany({
    where: inArray(payments.membershipId, membershipIds),
    with: {
      membership: {
        with: {
          plan: {
            columns: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: [desc(payments.paidAt)],
    limit,
  });
}

// ============================================
// CREATE PAYMENT
// ============================================

export async function createPayment(data: {
  memberId: string;
  membershipId?: string;
  amount: string;
  method: "cash" | "card" | "transfer";
  receivedBy: string;
  reference?: string;
  notes?: string;
}) {
  let membershipId = data.membershipId;

  // If no membershipId provided, check if member has a pending_payment membership
  if (!membershipId) {
    const pendingMembership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.memberId, data.memberId),
        eq(memberships.status, "pending_payment")
      ),
      orderBy: [desc(memberships.createdAt)],
    });
    if (pendingMembership) {
      membershipId = pendingMembership.id;
    }
  }

  const [payment] = await db
    .insert(payments)
    .values({
      memberId: data.memberId,
      membershipId: membershipId,
      amount: data.amount,
      method: data.method,
      receivedBy: data.receivedBy,
      reference: data.reference,
      notes: data.notes,
      paidAt: new Date(),
    })
    .returning();

  // If payment is linked to a membership, try to activate it (if pending_payment)
  if (membershipId) {
    await activateMembership(membershipId);
  }

  return payment;
}

// ============================================
// CANCEL PAYMENT (soft delete with audit trail)
// ============================================

export async function cancelPayment(
  id: string,
  cancelledBy: string,
  reason: string
) {
  const [cancelled] = await db
    .update(payments)
    .set({
      cancelledAt: new Date(),
      cancelledBy,
      cancellationReason: reason,
    })
    .where(eq(payments.id, id))
    .returning();

  return cancelled;
}

// ============================================
// GET REVENUE STATS
// ============================================

export async function getRevenueStats(startDate?: Date, endDate?: Date) {
  const conditions = [isNull(payments.cancelledAt)]; // Exclude cancelled payments

  if (startDate) {
    conditions.push(gte(payments.paidAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(payments.paidAt, endDate));
  }

  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(payments)
    .where(and(...conditions));

  return {
    total: Number(result[0]?.total) || 0,
    count: Number(result[0]?.count) || 0,
  };
}

// ============================================
// GET REVENUE BY METHOD
// ============================================

export async function getRevenueByMethod(startDate?: Date, endDate?: Date) {
  const conditions = [isNull(payments.cancelledAt)]; // Exclude cancelled payments

  if (startDate) {
    conditions.push(gte(payments.paidAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(payments.paidAt, endDate));
  }

  const result = await db
    .select({
      method: payments.method,
      total: sql<number>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(payments)
    .where(and(...conditions))
    .groupBy(payments.method);

  return result.map((r) => ({
    method: r.method,
    total: Number(r.total),
    count: Number(r.count),
  }));
}

// ============================================
// GET DAILY REVENUE (for charts)
// ============================================

export async function getDailyRevenue(startDate?: Date, endDate?: Date) {
  const conditions = [isNull(payments.cancelledAt)]; // Exclude cancelled payments

  if (startDate) {
    conditions.push(gte(payments.paidAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(payments.paidAt, endDate));
  }

  const result = await db
    .select({
      date: sql<string>`DATE(${payments.paidAt})`,
      total: sql<number>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(payments)
    .where(and(...conditions))
    .groupBy(sql`DATE(${payments.paidAt})`)
    .orderBy(sql`DATE(${payments.paidAt})`);

  return result.map((r) => ({
    date: r.date,
    total: Number(r.total),
    count: Number(r.count),
  }));
}
