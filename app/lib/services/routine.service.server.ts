import { eq, desc, and, or } from "drizzle-orm";
import { db } from "~/db.server";
import {
  routines,
  routineExercises,
  memberWeeklyPlan,
  memberPlanExercises,
  workoutLogs,
  workoutLogExercises,
  type Routine,
  type Difficulty,
} from "~/db.server";

export type { Difficulty };

// ============================================
// GET ROUTINES (public or owned by member)
// ============================================

export async function getRoutines(options?: {
  memberId?: string;
  isPublic?: boolean;
  isSystem?: boolean;
  active?: boolean;
  limit?: number;
}) {
  const { memberId, isPublic, isSystem, active = true, limit = 100 } = options || {};

  const conditions = [];

  if (active !== undefined) {
    conditions.push(eq(routines.active, active));
  }

  if (isPublic !== undefined) {
    conditions.push(eq(routines.isPublic, isPublic));
  }

  if (isSystem !== undefined) {
    conditions.push(eq(routines.isSystem, isSystem));
  }

  // If memberId provided, show public + system + their own
  if (memberId) {
    conditions.push(
      or(
        eq(routines.isPublic, true),
        eq(routines.isSystem, true),
        eq(routines.createdBy, memberId)
      )
    );
  }

  return db.query.routines.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      exercises: {
        with: {
          exercise: true,
        },
        orderBy: [routineExercises.orderIndex],
      },
    },
    orderBy: [desc(routines.isSystem), routines.name],
    limit,
  });
}

// ============================================
// GET ROUTINE BY ID
// ============================================

export async function getRoutineById(id: string) {
  return db.query.routines.findFirst({
    where: eq(routines.id, id),
    with: {
      exercises: {
        with: {
          exercise: true,
        },
        orderBy: [routineExercises.orderIndex],
      },
      createdByMember: {
        columns: { firstName: true, lastName: true },
      },
    },
  });
}

// ============================================
// CREATE ROUTINE
// ============================================

export async function createRoutine(data: {
  name: string;
  description?: string;
  difficulty?: Difficulty;
  objective?: string;
  estimatedMinutes?: number;
  isPublic?: boolean;
  isSystem?: boolean;
  createdBy?: string;
  createdByStaff?: string;
  exercises?: Array<{
    exerciseId: string;
    sets?: number;
    reps?: string;
    restSeconds?: number;
    notes?: string;
  }>;
}): Promise<Routine> {
  const [routine] = await db
    .insert(routines)
    .values({
      name: data.name,
      description: data.description,
      difficulty: data.difficulty,
      objective: data.objective,
      estimatedMinutes: data.estimatedMinutes,
      isPublic: data.isPublic ?? false,
      isSystem: data.isSystem ?? false,
      createdBy: data.createdBy,
      createdByStaff: data.createdByStaff,
    })
    .returning();

  // Add exercises if provided
  if (data.exercises && data.exercises.length > 0) {
    await db.insert(routineExercises).values(
      data.exercises.map((ex, index) => ({
        routineId: routine.id,
        exerciseId: ex.exerciseId,
        orderIndex: index,
        sets: ex.sets ?? 3,
        reps: ex.reps ?? "10",
        restSeconds: ex.restSeconds ?? 60,
        notes: ex.notes,
      }))
    );
  }

  return routine;
}

// ============================================
// UPDATE ROUTINE
// ============================================

export async function updateRoutine(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    difficulty: Difficulty;
    objective: string;
    estimatedMinutes: number;
    isPublic: boolean;
    active: boolean;
  }>
): Promise<Routine | null> {
  const [updated] = await db
    .update(routines)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(routines.id, id))
    .returning();

  return updated || null;
}

// ============================================
// UPDATE ROUTINE EXERCISES
// ============================================

export async function updateRoutineExercises(
  routineId: string,
  exercises: Array<{
    exerciseId: string;
    sets?: number;
    reps?: string;
    restSeconds?: number;
    notes?: string;
  }>
): Promise<void> {
  // Delete existing exercises
  await db.delete(routineExercises).where(eq(routineExercises.routineId, routineId));

  // Insert new exercises
  if (exercises.length > 0) {
    await db.insert(routineExercises).values(
      exercises.map((ex, index) => ({
        routineId,
        exerciseId: ex.exerciseId,
        orderIndex: index,
        sets: ex.sets ?? 3,
        reps: ex.reps ?? "10",
        restSeconds: ex.restSeconds ?? 60,
        notes: ex.notes,
      }))
    );
  }
}

// ============================================
// DELETE ROUTINE
// ============================================

export async function deleteRoutine(id: string): Promise<boolean> {
  const [deleted] = await db
    .update(routines)
    .set({ active: false })
    .where(eq(routines.id, id))
    .returning();

  return !!deleted;
}

// ============================================
// MEMBER WEEKLY PLAN
// ============================================

export async function getMemberWeeklyPlan(memberId: string) {
  const plans = await db.query.memberWeeklyPlan.findMany({
    where: eq(memberWeeklyPlan.memberId, memberId),
    with: {
      routine: {
        with: {
          exercises: {
            with: {
              exercise: true,
            },
            orderBy: [routineExercises.orderIndex],
          },
        },
      },
      customExercises: {
        with: {
          exercise: true,
        },
        orderBy: [memberPlanExercises.orderIndex],
      },
    },
    orderBy: [memberWeeklyPlan.dayOfWeek],
  });

  // Create array for all 7 days
  const weekPlan = Array.from({ length: 7 }, (_, i) => {
    const existing = plans.find((p) => p.dayOfWeek === i);
    return existing || { dayOfWeek: i, isRestDay: true, routine: null, customExercises: [], customName: null };
  });

  return weekPlan;
}

// ============================================
// SET DAY PLAN
// ============================================

export async function setDayPlan(
  memberId: string,
  dayOfWeek: number,
  data: {
    routineId?: string | null;
    customName?: string | null;
    isRestDay?: boolean;
  }
): Promise<void> {
  // Check if plan exists for this day
  const existing = await db.query.memberWeeklyPlan.findFirst({
    where: and(
      eq(memberWeeklyPlan.memberId, memberId),
      eq(memberWeeklyPlan.dayOfWeek, dayOfWeek)
    ),
  });

  if (existing) {
    // Update existing
    await db
      .update(memberWeeklyPlan)
      .set({
        routineId: data.routineId,
        customName: data.customName,
        isRestDay: data.isRestDay ?? false,
        updatedAt: new Date(),
      })
      .where(eq(memberWeeklyPlan.id, existing.id));

    // If switching to routine or rest day, clear custom exercises
    if (data.routineId || data.isRestDay) {
      await db.delete(memberPlanExercises).where(eq(memberPlanExercises.weeklyPlanId, existing.id));
    }
  } else {
    // Create new
    await db.insert(memberWeeklyPlan).values({
      memberId,
      dayOfWeek,
      routineId: data.routineId,
      customName: data.customName,
      isRestDay: data.isRestDay ?? false,
    });
  }
}

// ============================================
// SET CUSTOM EXERCISES FOR DAY
// ============================================

export async function setCustomExercisesForDay(
  memberId: string,
  dayOfWeek: number,
  customName: string,
  exercises: Array<{
    exerciseId: string;
    sets?: number;
    reps?: string;
    weight?: string;
    restSeconds?: number;
    notes?: string;
  }>
): Promise<void> {
  // Get or create the weekly plan for this day
  let plan = await db.query.memberWeeklyPlan.findFirst({
    where: and(
      eq(memberWeeklyPlan.memberId, memberId),
      eq(memberWeeklyPlan.dayOfWeek, dayOfWeek)
    ),
  });

  if (!plan) {
    const [newPlan] = await db
      .insert(memberWeeklyPlan)
      .values({
        memberId,
        dayOfWeek,
        customName,
        isRestDay: false,
      })
      .returning();
    plan = newPlan;
  } else {
    // Update to custom routine
    await db
      .update(memberWeeklyPlan)
      .set({
        routineId: null,
        customName,
        isRestDay: false,
        updatedAt: new Date(),
      })
      .where(eq(memberWeeklyPlan.id, plan.id));
  }

  // Clear existing custom exercises
  await db.delete(memberPlanExercises).where(eq(memberPlanExercises.weeklyPlanId, plan.id));

  // Insert new exercises
  if (exercises.length > 0) {
    await db.insert(memberPlanExercises).values(
      exercises.map((ex, index) => ({
        weeklyPlanId: plan!.id,
        exerciseId: ex.exerciseId,
        orderIndex: index,
        sets: ex.sets ?? 3,
        reps: ex.reps ?? "10",
        weight: ex.weight,
        restSeconds: ex.restSeconds ?? 60,
        notes: ex.notes,
      }))
    );
  }
}

// ============================================
// LOG WORKOUT
// ============================================

export async function logWorkout(data: {
  memberId: string;
  routineId?: string;
  weeklyPlanId?: string;
  workoutDate: string;
  durationMinutes?: number;
  notes?: string;
  rating?: number;
  exercises: Array<{
    exerciseId: string;
    setsCompleted?: number;
    repsPerSet?: string;
    weightUsed?: string;
    completed?: boolean;
    notes?: string;
  }>;
}): Promise<typeof workoutLogs.$inferSelect> {
  const [log] = await db
    .insert(workoutLogs)
    .values({
      memberId: data.memberId,
      routineId: data.routineId,
      weeklyPlanId: data.weeklyPlanId,
      workoutDate: data.workoutDate,
      durationMinutes: data.durationMinutes,
      notes: data.notes,
      rating: data.rating,
      completedAt: new Date(),
    })
    .returning();

  // Add exercise logs
  if (data.exercises.length > 0) {
    await db.insert(workoutLogExercises).values(
      data.exercises.map((ex, index) => ({
        workoutLogId: log.id,
        exerciseId: ex.exerciseId,
        orderIndex: index,
        setsCompleted: ex.setsCompleted,
        repsPerSet: ex.repsPerSet,
        weightUsed: ex.weightUsed,
        completed: ex.completed ?? true,
        notes: ex.notes,
      }))
    );
  }

  return log;
}

// ============================================
// GET WORKOUT HISTORY
// ============================================

export async function getWorkoutHistory(
  memberId: string,
  limit = 30
) {
  return db.query.workoutLogs.findMany({
    where: eq(workoutLogs.memberId, memberId),
    with: {
      routine: {
        columns: { name: true },
      },
      exercises: {
        with: {
          exercise: {
            columns: { name: true, muscleGroup: true },
          },
        },
      },
    },
    orderBy: [desc(workoutLogs.workoutDate)],
    limit,
  });
}

// ============================================
// DAY LABELS
// ============================================

export const dayLabels = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miercoles",
  "Jueves",
  "Viernes",
  "Sabado",
];

export const dayLabelsShort = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

// ============================================
// DIFFICULTY LABELS
// ============================================

export const difficultyLabels: Record<NonNullable<Difficulty>, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};
