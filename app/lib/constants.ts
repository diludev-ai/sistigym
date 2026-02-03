import type { MuscleGroup, Difficulty } from "~/db.server";

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

// ============================================
// DIFFICULTY LABELS
// ============================================

export const difficultyLabels: Record<NonNullable<Difficulty>, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

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
