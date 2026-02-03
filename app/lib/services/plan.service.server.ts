import { eq, desc, and } from "drizzle-orm";
import { db } from "~/db.server";
import { plans, type Plan, type NewPlan } from "~/db.server";

// ============================================
// GET ALL PLANS
// ============================================

export async function getPlans(options?: { activeOnly?: boolean }) {
  const { activeOnly = false } = options || {};

  let query = db.select().from(plans).$dynamic();

  if (activeOnly) {
    query = query.where(eq(plans.active, true));
  }

  return query.orderBy(plans.durationDays);
}

// ============================================
// GET PLAN BY ID
// ============================================

export async function getPlanById(id: string): Promise<Plan | null> {
  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, id),
  });

  return plan || null;
}

// ============================================
// CREATE PLAN
// ============================================

export async function createPlan(data: {
  name: string;
  description?: string;
  durationDays: number;
  price: string;
  active?: boolean;
}): Promise<Plan> {
  const [plan] = await db
    .insert(plans)
    .values({
      name: data.name,
      description: data.description || null,
      durationDays: data.durationDays,
      price: data.price,
      active: data.active ?? true,
    })
    .returning();

  return plan;
}

// ============================================
// UPDATE PLAN
// ============================================

export async function updatePlan(
  id: string,
  data: {
    name?: string;
    description?: string;
    durationDays?: number;
    price?: string;
    active?: boolean;
  }
): Promise<Plan | null> {
  const updateData: Partial<NewPlan> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined)
    updateData.description = data.description || null;
  if (data.durationDays !== undefined)
    updateData.durationDays = data.durationDays;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.active !== undefined) updateData.active = data.active;

  const [plan] = await db
    .update(plans)
    .set(updateData)
    .where(eq(plans.id, id))
    .returning();

  return plan || null;
}

// ============================================
// DELETE PLAN (soft delete)
// ============================================

export async function deletePlan(id: string): Promise<boolean> {
  const [plan] = await db
    .update(plans)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(plans.id, id))
    .returning();

  return !!plan;
}

// ============================================
// TOGGLE PLAN ACTIVE STATUS
// ============================================

export async function togglePlanActive(id: string): Promise<Plan | null> {
  const plan = await getPlanById(id);
  if (!plan) return null;

  const [updated] = await db
    .update(plans)
    .set({ active: !plan.active, updatedAt: new Date() })
    .where(eq(plans.id, id))
    .returning();

  return updated || null;
}
