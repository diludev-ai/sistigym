import { z } from "zod";

// ============================================
// STAFF AUTH VALIDATIONS
// ============================================

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "El email es requerido")
    .email("Email inválido")
    .transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, "La contraseña es requerida"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ============================================
// STAFF USER VALIDATIONS
// ============================================

export const createStaffSchema = z.object({
  email: z
    .string()
    .min(1, "El email es requerido")
    .email("Email inválido")
    .transform((v) => v.toLowerCase().trim()),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres"),
  name: z.string().min(1, "El nombre es requerido").max(255),
  role: z.enum(["admin", "reception"]),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;

// ============================================
// MEMBER VALIDATIONS
// ============================================

export const createMemberSchema = z.object({
  email: z
    .string()
    .min(1, "El email es requerido")
    .email("Email inválido")
    .transform((v) => v.toLowerCase().trim()),
  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres"),
  firstName: z.string().min(1, "El nombre es requerido").max(100),
  lastName: z.string().min(1, "El apellido es requerido").max(100),
  phone: z.string().max(20).optional(),
  emergencyContact: z.string().max(255).optional(),
  birthDate: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;

export const updateMemberSchema = createMemberSchema
  .omit({ password: true })
  .partial()
  .extend({
    password: z
      .string()
      .min(6, "La contraseña debe tener al menos 6 caracteres")
      .optional()
      .or(z.literal("")),
  });

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

// ============================================
// PLAN VALIDATIONS
// ============================================

export const planSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(100),
  description: z.string().optional(),
  durationDays: z
    .number()
    .int()
    .min(1, "La duración debe ser al menos 1 día"),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Precio inválido")
    .or(z.number().transform((n) => n.toString())),
  active: z.boolean().default(true),
});

export type PlanInput = z.infer<typeof planSchema>;

// ============================================
// MEMBERSHIP VALIDATIONS
// ============================================

export const createMembershipSchema = z.object({
  memberId: z.string().uuid("ID de miembro inválido"),
  planId: z.string().uuid("ID de plan inválido"),
  startsAt: z.string().min(1, "Fecha de inicio requerida").or(z.date()),
});

export type CreateMembershipInput = z.infer<typeof createMembershipSchema>;

export const freezeMembershipSchema = z.object({
  membershipId: z.string().uuid("ID de membresía inválido"),
  days: z
    .number()
    .int()
    .min(1, "Debe congelar al menos 1 día")
    .max(90, "No puede congelar más de 90 días"),
});

export type FreezeMembershipInput = z.infer<typeof freezeMembershipSchema>;

// ============================================
// PAYMENT VALIDATIONS
// ============================================

export const createPaymentSchema = z.object({
  memberId: z.string().uuid("ID de miembro inválido"),
  membershipId: z.string().uuid("ID de membresía inválido").optional(),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Monto inválido")
    .or(z.number().transform((n) => n.toString())),
  method: z.enum(["cash", "transfer", "card"]),
  reference: z.string().max(255).optional(),
  notes: z.string().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

// ============================================
// GYM SETTINGS VALIDATIONS
// ============================================

export const gymSettingsSchema = z.object({
  gym_name: z.string().min(1, "El nombre del gimnasio es requerido").max(255),
  morosity_tolerance_days: z
    .string()
    .regex(/^\d+$/, "Debe ser un número")
    .transform(Number)
    .or(z.number()),
  qr_duration_seconds: z
    .string()
    .regex(/^\d+$/, "Debe ser un número")
    .transform(Number)
    .or(z.number()),
  timezone: z.string().optional(),
  currency: z.string().default("COP"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

export type GymSettingsInput = z.infer<typeof gymSettingsSchema>;

// ============================================
// PROGRESS VALIDATIONS
// ============================================

export const progressSchema = z.object({
  weight: z.number().positive().optional(),
  height: z.number().positive().optional(),
  bodyFat: z.number().min(0).max(100).optional(),
  muscleMass: z.number().positive().optional(),
  chest: z.number().positive().optional(),
  waist: z.number().positive().optional(),
  hips: z.number().positive().optional(),
  arms: z.number().positive().optional(),
  thighs: z.number().positive().optional(),
  notes: z.string().optional(),
});

export type ProgressInput = z.infer<typeof progressSchema>;

// ============================================
// HELPER: Parse form data with Zod
// ============================================

export async function parseFormData<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ data: T; errors: null } | { data: null; errors: z.ZodError }> {
  const formData = await request.formData();
  const rawData = Object.fromEntries(formData);

  // Convert numeric strings to numbers for specific fields
  const processedData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawData)) {
    if (typeof value === "string") {
      // Try to parse as number if it looks like one
      if (/^\d+$/.test(value) && key.includes("Days")) {
        processedData[key] = parseInt(value, 10);
      } else if (/^\d+$/.test(value) && key.includes("seconds")) {
        processedData[key] = parseInt(value, 10);
      } else {
        processedData[key] = value;
      }
    } else {
      processedData[key] = value;
    }
  }

  const result = schema.safeParse(processedData);

  if (!result.success) {
    return { data: null, errors: result.error };
  }

  return { data: result.data, errors: null };
}
