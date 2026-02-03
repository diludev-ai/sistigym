import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  decimal,
  pgEnum,
  index,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================
// ENUMS
// ============================================

export const staffRoleEnum = pgEnum("staff_role", ["admin", "reception"]);
export const membershipStatusEnum = pgEnum("membership_status", [
  "pending_payment",
  "active",
  "expired",
  "frozen",
  "cancelled",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "transfer",
  "card",
]);
export const accessMethodEnum = pgEnum("access_method", ["qr", "manual"]);
export const muscleGroupEnum = pgEnum("muscle_group", [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "legs",
  "glutes",
  "calves",
  "cardio",
  "full_body",
]);
export const difficultyEnum = pgEnum("difficulty", [
  "beginner",
  "intermediate",
  "advanced",
]);

// ============================================
// STAFF USERS (Admin/Reception)
// ============================================

export const staffUsers = pgTable(
  "staff_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    role: staffRoleEnum("role").notNull().default("reception"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("staff_users_email_idx").on(table.email)]
);

// ============================================
// MEMBERS (Gym Clients)
// ============================================

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    emergencyContact: varchar("emergency_contact", { length: 255 }),
    birthDate: date("birth_date"),
    notes: text("notes"),
    photoUrl: text("photo_url"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("members_email_idx").on(table.email),
    index("members_name_idx").on(table.firstName, table.lastName),
  ]
);

// ============================================
// PLANS (Membership Plans)
// ============================================

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  durationDays: integer("duration_days").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================
// MEMBERSHIPS
// ============================================

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    status: membershipStatusEnum("status").notNull().default("active"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    // Total amount to pay for this membership (copied from plan price at creation time)
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
    frozenAt: timestamp("frozen_at", { withTimezone: true }),
    frozenDays: integer("frozen_days").default(0),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("memberships_member_id_idx").on(table.memberId),
    index("memberships_status_idx").on(table.status),
    index("memberships_ends_at_idx").on(table.endsAt),
  ]
);

// ============================================
// PAYMENTS
// ============================================

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    method: paymentMethodEnum("method").notNull(),
    reference: varchar("reference", { length: 255 }),
    notes: text("notes"),
    receivedBy: uuid("received_by").references(() => staffUsers.id, {
      onDelete: "set null",
    }),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    // Cancellation fields
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by").references(() => staffUsers.id, {
      onDelete: "set null",
    }),
    cancellationReason: text("cancellation_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("payments_member_id_idx").on(table.memberId),
    index("payments_paid_at_idx").on(table.paidAt),
  ]
);

// ============================================
// QR TOKENS (for access control)
// ============================================

export const qrTokens = pgTable(
  "qr_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(), // SHA256 hash
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("qr_tokens_token_hash_idx").on(table.tokenHash),
    index("qr_tokens_member_id_idx").on(table.memberId),
    index("qr_tokens_expires_at_idx").on(table.expiresAt),
  ]
);

// ============================================
// ACCESS LOG
// ============================================

export const accessLogs = pgTable(
  "access_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    method: accessMethodEnum("method").notNull(),
    allowed: boolean("allowed").notNull(),
    reason: varchar("reason", { length: 255 }),
    qrTokenId: uuid("qr_token_id").references(() => qrTokens.id, {
      onDelete: "set null",
    }),
    verifiedBy: uuid("verified_by").references(() => staffUsers.id, {
      onDelete: "set null",
    }),
    accessedAt: timestamp("accessed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("access_logs_member_id_idx").on(table.memberId),
    index("access_logs_accessed_at_idx").on(table.accessedAt),
    index("access_logs_allowed_idx").on(table.allowed),
  ]
);

// ============================================
// MEMBER PROGRESS (optional weight/measurements)
// ============================================

export const memberProgress = pgTable(
  "member_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    weight: decimal("weight", { precision: 5, scale: 2 }), // kg
    height: decimal("height", { precision: 5, scale: 2 }), // cm
    bodyFat: decimal("body_fat", { precision: 4, scale: 2 }), // percentage
    muscleMass: decimal("muscle_mass", { precision: 5, scale: 2 }), // kg
    chest: decimal("chest", { precision: 5, scale: 2 }), // cm
    waist: decimal("waist", { precision: 5, scale: 2 }), // cm
    hips: decimal("hips", { precision: 5, scale: 2 }), // cm
    arms: decimal("arms", { precision: 5, scale: 2 }), // cm
    thighs: decimal("thighs", { precision: 5, scale: 2 }), // cm
    notes: text("notes"),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("member_progress_member_id_idx").on(table.memberId),
    index("member_progress_recorded_at_idx").on(table.recordedAt),
  ]
);

// ============================================
// GYM SETTINGS
// ============================================

export const gymSettings = pgTable("gym_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================
// EXERCISES (Catalog)
// ============================================

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    muscleGroup: muscleGroupEnum("muscle_group").notNull(),
    secondaryMuscles: text("secondary_muscles"), // comma-separated
    instructions: text("instructions"),
    imageUrl: varchar("image_url", { length: 500 }),
    videoUrl: varchar("video_url", { length: 500 }),
    equipment: varchar("equipment", { length: 100 }), // e.g., "barbell", "dumbbell", "machine"
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("exercises_muscle_group_idx").on(table.muscleGroup),
    index("exercises_name_idx").on(table.name),
  ]
);

// ============================================
// ROUTINES (Templates)
// ============================================

export const routines = pgTable(
  "routines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    difficulty: difficultyEnum("difficulty").default("intermediate"),
    objective: varchar("objective", { length: 50 }), // hypertrophy, strength, endurance, weight_loss
    estimatedMinutes: integer("estimated_minutes"),
    isPublic: boolean("is_public").notNull().default(true), // visible to all members
    isSystem: boolean("is_system").notNull().default(false), // created by gym, not member
    createdBy: uuid("created_by").references(() => members.id, { onDelete: "set null" }),
    createdByStaff: uuid("created_by_staff").references(() => staffUsers.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("routines_is_public_idx").on(table.isPublic),
    index("routines_created_by_idx").on(table.createdBy),
  ]
);

// ============================================
// ROUTINE EXERCISES (Exercises in a routine)
// ============================================

export const routineExercises = pgTable(
  "routine_exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routineId: uuid("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    sets: integer("sets").default(3),
    reps: varchar("reps", { length: 20 }).default("10"), // can be "10-12" or "8"
    restSeconds: integer("rest_seconds").default(60),
    notes: text("notes"),
  },
  (table) => [
    index("routine_exercises_routine_id_idx").on(table.routineId),
  ]
);

// ============================================
// MEMBER WEEKLY PLAN
// ============================================

export const memberWeeklyPlan = pgTable(
  "member_weekly_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday, 1=Monday...6=Saturday
    routineId: uuid("routine_id").references(() => routines.id, { onDelete: "set null" }),
    customName: varchar("custom_name", { length: 100 }), // if not using predefined routine
    isRestDay: boolean("is_rest_day").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("member_weekly_plan_member_id_idx").on(table.memberId),
    index("member_weekly_plan_day_idx").on(table.memberId, table.dayOfWeek),
  ]
);

// ============================================
// MEMBER CUSTOM EXERCISES (personalized in weekly plan)
// ============================================

export const memberPlanExercises = pgTable(
  "member_plan_exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weeklyPlanId: uuid("weekly_plan_id")
      .notNull()
      .references(() => memberWeeklyPlan.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    sets: integer("sets").default(3),
    reps: varchar("reps", { length: 20 }).default("10"),
    weight: varchar("weight", { length: 20 }), // personalized weight
    restSeconds: integer("rest_seconds").default(60),
    notes: text("notes"),
  },
  (table) => [
    index("member_plan_exercises_plan_id_idx").on(table.weeklyPlanId),
  ]
);

// ============================================
// WORKOUT LOGS (Completed workouts)
// ============================================

export const workoutLogs = pgTable(
  "workout_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    routineId: uuid("routine_id").references(() => routines.id, { onDelete: "set null" }),
    weeklyPlanId: uuid("weekly_plan_id").references(() => memberWeeklyPlan.id, { onDelete: "set null" }),
    workoutDate: date("workout_date").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMinutes: integer("duration_minutes"),
    notes: text("notes"),
    rating: integer("rating"), // 1-5 how the workout felt
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("workout_logs_member_id_idx").on(table.memberId),
    index("workout_logs_date_idx").on(table.workoutDate),
  ]
);

// ============================================
// WORKOUT LOG EXERCISES (Exercises completed in workout)
// ============================================

export const workoutLogExercises = pgTable(
  "workout_log_exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workoutLogId: uuid("workout_log_id")
      .notNull()
      .references(() => workoutLogs.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    setsCompleted: integer("sets_completed"),
    repsPerSet: varchar("reps_per_set", { length: 50 }), // "12,10,8"
    weightUsed: varchar("weight_used", { length: 50 }), // "50,50,55"
    completed: boolean("completed").notNull().default(false),
    notes: text("notes"),
  },
  (table) => [
    index("workout_log_exercises_log_id_idx").on(table.workoutLogId),
  ]
);

// ============================================
// STAFF SESSIONS
// ============================================

export const staffSessions = pgTable(
  "staff_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
    sessionToken: varchar("session_token", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("staff_sessions_token_idx").on(table.sessionToken),
    index("staff_sessions_staff_id_idx").on(table.staffId),
    index("staff_sessions_expires_at_idx").on(table.expiresAt),
  ]
);

// ============================================
// MEMBER SESSIONS
// ============================================

export const memberSessions = pgTable(
  "member_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    sessionToken: varchar("session_token", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("member_sessions_token_idx").on(table.sessionToken),
    index("member_sessions_member_id_idx").on(table.memberId),
    index("member_sessions_expires_at_idx").on(table.expiresAt),
  ]
);

// ============================================
// RELATIONS
// ============================================

export const membersRelations = relations(members, ({ many }) => ({
  memberships: many(memberships),
  payments: many(payments),
  accessLogs: many(accessLogs),
  qrTokens: many(qrTokens),
  progress: many(memberProgress),
  sessions: many(memberSessions),
  weeklyPlans: many(memberWeeklyPlan),
  routinesCreated: many(routines),
  workoutLogs: many(workoutLogs),
}));

export const membershipsRelations = relations(memberships, ({ one, many }) => ({
  member: one(members, {
    fields: [memberships.memberId],
    references: [members.id],
  }),
  plan: one(plans, {
    fields: [memberships.planId],
    references: [plans.id],
  }),
  payments: many(payments),
}));

export const plansRelations = relations(plans, ({ many }) => ({
  memberships: many(memberships),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  member: one(members, {
    fields: [payments.memberId],
    references: [members.id],
  }),
  membership: one(memberships, {
    fields: [payments.membershipId],
    references: [memberships.id],
  }),
  receivedByStaff: one(staffUsers, {
    fields: [payments.receivedBy],
    references: [staffUsers.id],
  }),
  cancelledByStaff: one(staffUsers, {
    fields: [payments.cancelledBy],
    references: [staffUsers.id],
  }),
}));

export const accessLogsRelations = relations(accessLogs, ({ one }) => ({
  member: one(members, {
    fields: [accessLogs.memberId],
    references: [members.id],
  }),
  qrToken: one(qrTokens, {
    fields: [accessLogs.qrTokenId],
    references: [qrTokens.id],
  }),
  verifiedByStaff: one(staffUsers, {
    fields: [accessLogs.verifiedBy],
    references: [staffUsers.id],
  }),
}));

export const qrTokensRelations = relations(qrTokens, ({ one }) => ({
  member: one(members, {
    fields: [qrTokens.memberId],
    references: [members.id],
  }),
}));

export const memberProgressRelations = relations(memberProgress, ({ one }) => ({
  member: one(members, {
    fields: [memberProgress.memberId],
    references: [members.id],
  }),
}));

export const staffUsersRelations = relations(staffUsers, ({ many }) => ({
  sessions: many(staffSessions),
  paymentsReceived: many(payments),
  accessVerified: many(accessLogs),
}));

export const staffSessionsRelations = relations(staffSessions, ({ one }) => ({
  staff: one(staffUsers, {
    fields: [staffSessions.staffId],
    references: [staffUsers.id],
  }),
}));

export const memberSessionsRelations = relations(memberSessions, ({ one }) => ({
  member: one(members, {
    fields: [memberSessions.memberId],
    references: [members.id],
  }),
}));

// Exercises relations
export const exercisesRelations = relations(exercises, ({ many }) => ({
  routineExercises: many(routineExercises),
  memberPlanExercises: many(memberPlanExercises),
  workoutLogExercises: many(workoutLogExercises),
}));

// Routines relations
export const routinesRelations = relations(routines, ({ one, many }) => ({
  createdByMember: one(members, {
    fields: [routines.createdBy],
    references: [members.id],
  }),
  createdByStaffUser: one(staffUsers, {
    fields: [routines.createdByStaff],
    references: [staffUsers.id],
  }),
  exercises: many(routineExercises),
  weeklyPlans: many(memberWeeklyPlan),
  workoutLogs: many(workoutLogs),
}));

// Routine Exercises relations
export const routineExercisesRelations = relations(routineExercises, ({ one }) => ({
  routine: one(routines, {
    fields: [routineExercises.routineId],
    references: [routines.id],
  }),
  exercise: one(exercises, {
    fields: [routineExercises.exerciseId],
    references: [exercises.id],
  }),
}));

// Member Weekly Plan relations
export const memberWeeklyPlanRelations = relations(memberWeeklyPlan, ({ one, many }) => ({
  member: one(members, {
    fields: [memberWeeklyPlan.memberId],
    references: [members.id],
  }),
  routine: one(routines, {
    fields: [memberWeeklyPlan.routineId],
    references: [routines.id],
  }),
  customExercises: many(memberPlanExercises),
  workoutLogs: many(workoutLogs),
}));

// Member Plan Exercises relations
export const memberPlanExercisesRelations = relations(memberPlanExercises, ({ one }) => ({
  weeklyPlan: one(memberWeeklyPlan, {
    fields: [memberPlanExercises.weeklyPlanId],
    references: [memberWeeklyPlan.id],
  }),
  exercise: one(exercises, {
    fields: [memberPlanExercises.exerciseId],
    references: [exercises.id],
  }),
}));

// Workout Logs relations
export const workoutLogsRelations = relations(workoutLogs, ({ one, many }) => ({
  member: one(members, {
    fields: [workoutLogs.memberId],
    references: [members.id],
  }),
  routine: one(routines, {
    fields: [workoutLogs.routineId],
    references: [routines.id],
  }),
  weeklyPlan: one(memberWeeklyPlan, {
    fields: [workoutLogs.weeklyPlanId],
    references: [memberWeeklyPlan.id],
  }),
  exercises: many(workoutLogExercises),
}));

// Workout Log Exercises relations
export const workoutLogExercisesRelations = relations(workoutLogExercises, ({ one }) => ({
  workoutLog: one(workoutLogs, {
    fields: [workoutLogExercises.workoutLogId],
    references: [workoutLogs.id],
  }),
  exercise: one(exercises, {
    fields: [workoutLogExercises.exerciseId],
    references: [exercises.id],
  }),
}));

// ============================================
// TYPE EXPORTS
// ============================================

export type StaffUser = typeof staffUsers.$inferSelect;
export type NewStaffUser = typeof staffUsers.$inferInsert;
export type StaffRole = StaffUser["role"];

export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;

export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
export type MembershipStatus = Membership["status"];

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type PaymentMethod = Payment["method"];

export type QrToken = typeof qrTokens.$inferSelect;
export type NewQrToken = typeof qrTokens.$inferInsert;

export type AccessLog = typeof accessLogs.$inferSelect;
export type NewAccessLog = typeof accessLogs.$inferInsert;
export type AccessMethod = AccessLog["method"];

export type MemberProgress = typeof memberProgress.$inferSelect;
export type NewMemberProgress = typeof memberProgress.$inferInsert;

export type GymSetting = typeof gymSettings.$inferSelect;
export type NewGymSetting = typeof gymSettings.$inferInsert;

export type StaffSession = typeof staffSessions.$inferSelect;
export type MemberSession = typeof memberSessions.$inferSelect;

export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;
export type MuscleGroup = Exercise["muscleGroup"];

export type Routine = typeof routines.$inferSelect;
export type NewRoutine = typeof routines.$inferInsert;
export type Difficulty = Routine["difficulty"];

export type RoutineExercise = typeof routineExercises.$inferSelect;
export type NewRoutineExercise = typeof routineExercises.$inferInsert;

export type MemberWeeklyPlan = typeof memberWeeklyPlan.$inferSelect;
export type NewMemberWeeklyPlan = typeof memberWeeklyPlan.$inferInsert;

export type MemberPlanExercise = typeof memberPlanExercises.$inferSelect;
export type NewMemberPlanExercise = typeof memberPlanExercises.$inferInsert;

export type WorkoutLog = typeof workoutLogs.$inferSelect;
export type NewWorkoutLog = typeof workoutLogs.$inferInsert;

export type WorkoutLogExercise = typeof workoutLogExercises.$inferSelect;
export type NewWorkoutLogExercise = typeof workoutLogExercises.$inferInsert;
