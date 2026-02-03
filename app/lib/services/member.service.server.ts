import { eq, and, or, ilike, desc, sql } from "drizzle-orm";
import { db } from "~/db.server";
import {
  members,
  memberships,
  payments,
  type Member,
  type NewMember,
} from "~/db.server";
import { hashPassword } from "~/lib/auth.server";

// ============================================
// GET ALL MEMBERS (with search/filter)
// ============================================

export async function getMembers(options?: {
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const { search, limit = 50, offset = 0 } = options || {};

  let query = db
    .select({
      id: members.id,
      email: members.email,
      firstName: members.firstName,
      lastName: members.lastName,
      phone: members.phone,
      active: members.active,
      createdAt: members.createdAt,
    })
    .from(members)
    .$dynamic();

  if (search) {
    query = query.where(
      or(
        ilike(members.firstName, `%${search}%`),
        ilike(members.lastName, `%${search}%`),
        ilike(members.email, `%${search}%`),
        ilike(members.phone, `%${search}%`)
      )
    );
  }

  const result = await query
    .orderBy(desc(members.createdAt))
    .limit(limit)
    .offset(offset);

  return result;
}

// ============================================
// GET MEMBER BY ID (with memberships)
// ============================================

export async function getMemberById(id: string) {
  const member = await db.query.members.findFirst({
    where: eq(members.id, id),
    with: {
      memberships: {
        with: {
          plan: true,
        },
        orderBy: (memberships, { desc }) => [desc(memberships.createdAt)],
      },
      payments: {
        orderBy: (payments, { desc }) => [desc(payments.paidAt)],
        limit: 10,
      },
    },
  });

  return member;
}

// ============================================
// GET MEMBER BY EMAIL
// ============================================

export async function getMemberByEmail(email: string) {
  return db.query.members.findFirst({
    where: eq(members.email, email.toLowerCase()),
  });
}

// ============================================
// CREATE MEMBER
// ============================================

export async function createMember(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  emergencyContact?: string;
  birthDate?: string;
  notes?: string;
}): Promise<Member> {
  const passwordHash = await hashPassword(data.password);

  const [member] = await db
    .insert(members)
    .values({
      email: data.email.toLowerCase(),
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone || null,
      emergencyContact: data.emergencyContact || null,
      birthDate: data.birthDate || null,
      notes: data.notes || null,
    })
    .returning();

  return member;
}

// ============================================
// UPDATE MEMBER
// ============================================

export async function updateMember(
  id: string,
  data: {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    emergencyContact?: string;
    birthDate?: string;
    notes?: string;
    active?: boolean;
  }
): Promise<Member | null> {
  const updateData: Partial<NewMember> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (data.email) updateData.email = data.email.toLowerCase();
  if (data.firstName) updateData.firstName = data.firstName;
  if (data.lastName) updateData.lastName = data.lastName;
  if (data.phone !== undefined) updateData.phone = data.phone || null;
  if (data.emergencyContact !== undefined)
    updateData.emergencyContact = data.emergencyContact || null;
  if (data.birthDate !== undefined)
    updateData.birthDate = data.birthDate || null;
  if (data.notes !== undefined) updateData.notes = data.notes || null;
  if (data.active !== undefined) updateData.active = data.active;

  if (data.password) {
    updateData.passwordHash = await hashPassword(data.password);
  }

  const [member] = await db
    .update(members)
    .set(updateData)
    .where(eq(members.id, id))
    .returning();

  return member || null;
}

// ============================================
// DELETE MEMBER (soft delete by deactivating)
// ============================================

export async function deleteMember(id: string): Promise<boolean> {
  const [member] = await db
    .update(members)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(members.id, id))
    .returning();

  return !!member;
}

// ============================================
// HARD DELETE MEMBER
// ============================================

export async function hardDeleteMember(id: string): Promise<boolean> {
  const result = await db.delete(members).where(eq(members.id, id));
  return true;
}

// ============================================
// COUNT MEMBERS
// ============================================

export async function countMembers(options?: { search?: string }) {
  const { search } = options || {};

  let query = db.select({ count: sql<number>`count(*)` }).from(members);

  if (search) {
    query = query.where(
      or(
        ilike(members.firstName, `%${search}%`),
        ilike(members.lastName, `%${search}%`),
        ilike(members.email, `%${search}%`)
      )
    ) as typeof query;
  }

  const [result] = await query;
  return Number(result.count);
}
