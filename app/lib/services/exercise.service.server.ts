import { eq, desc, and, ilike, or } from "drizzle-orm";
import { db } from "~/db.server";
import { exercises, type Exercise, type NewExercise, type MuscleGroup } from "~/db.server";

// ============================================
// GET ALL EXERCISES
// ============================================

export async function getExercises(options?: {
  muscleGroup?: MuscleGroup;
  search?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
}) {
  const { muscleGroup, search, active = true, limit = 100, offset = 0 } = options || {};

  const conditions = [];

  if (active !== undefined) {
    conditions.push(eq(exercises.active, active));
  }

  if (muscleGroup) {
    conditions.push(eq(exercises.muscleGroup, muscleGroup));
  }

  if (search) {
    conditions.push(
      or(
        ilike(exercises.name, `%${search}%`),
        ilike(exercises.description, `%${search}%`)
      )
    );
  }

  return db.query.exercises.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [exercises.muscleGroup, exercises.name],
    limit,
    offset,
  });
}

// ============================================
// GET EXERCISE BY ID
// ============================================

export async function getExerciseById(id: string): Promise<Exercise | undefined> {
  return db.query.exercises.findFirst({
    where: eq(exercises.id, id),
  });
}

// ============================================
// CREATE EXERCISE
// ============================================

export async function createExercise(data: {
  name: string;
  muscleGroup: MuscleGroup;
  description?: string;
  instructions?: string;
  equipment?: string;
  imageUrl?: string;
  videoUrl?: string;
  secondaryMuscles?: string;
}): Promise<Exercise> {
  const [exercise] = await db
    .insert(exercises)
    .values({
      name: data.name,
      muscleGroup: data.muscleGroup,
      description: data.description,
      instructions: data.instructions,
      equipment: data.equipment,
      imageUrl: data.imageUrl,
      videoUrl: data.videoUrl,
      secondaryMuscles: data.secondaryMuscles,
    })
    .returning();

  return exercise;
}

// ============================================
// UPDATE EXERCISE
// ============================================

export async function updateExercise(
  id: string,
  data: Partial<{
    name: string;
    muscleGroup: MuscleGroup;
    description: string;
    instructions: string;
    equipment: string;
    imageUrl: string;
    videoUrl: string;
    secondaryMuscles: string;
    active: boolean;
  }>
): Promise<Exercise | null> {
  const [updated] = await db
    .update(exercises)
    .set(data)
    .where(eq(exercises.id, id))
    .returning();

  return updated || null;
}

// ============================================
// DELETE EXERCISE (soft delete)
// ============================================

export async function deleteExercise(id: string): Promise<boolean> {
  const [updated] = await db
    .update(exercises)
    .set({ active: false })
    .where(eq(exercises.id, id))
    .returning();

  return !!updated;
}

// ============================================
// GET EXERCISES BY MUSCLE GROUP
// ============================================

export async function getExercisesByMuscleGroup(muscleGroup: MuscleGroup) {
  return db.query.exercises.findMany({
    where: and(
      eq(exercises.muscleGroup, muscleGroup),
      eq(exercises.active, true)
    ),
    orderBy: [exercises.name],
  });
}

// ============================================
// MUSCLE GROUP LABELS
// ============================================

export const muscleGroupLabels: Record<MuscleGroup, string> = {
  chest: "Pecho",
  back: "Espalda",
  shoulders: "Hombros",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Antebrazos",
  abs: "Abdominales",
  legs: "Piernas",
  glutes: "Gluteos",
  calves: "Pantorrillas",
  cardio: "Cardio",
  full_body: "Cuerpo Completo",
};
