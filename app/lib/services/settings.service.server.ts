import { eq } from "drizzle-orm";
import { db, gymSettings } from "~/db.server";

// ============================================
// GET ALL SETTINGS
// ============================================

export async function getSettings(): Promise<Record<string, string>> {
  const settings = await db.select().from(gymSettings);
  const settingsMap: Record<string, string> = {};
  for (const setting of settings) {
    settingsMap[setting.key] = setting.value;
  }
  return settingsMap;
}

// ============================================
// GET SINGLE SETTING
// ============================================

export async function getSetting(key: string): Promise<string | null> {
  const result = await db
    .select()
    .from(gymSettings)
    .where(eq(gymSettings.key, key))
    .limit(1);
  return result[0]?.value ?? null;
}

// ============================================
// SET SETTING
// ============================================

export async function setSetting(key: string, value: string): Promise<void> {
  const existing = await db
    .select()
    .from(gymSettings)
    .where(eq(gymSettings.key, key))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(gymSettings)
      .set({ value, updatedAt: new Date() })
      .where(eq(gymSettings.key, key));
  } else {
    await db.insert(gymSettings).values({ key, value });
  }
}

// ============================================
// PARTIAL PAYMENTS SETTINGS HELPERS
// ============================================

export interface PartialPaymentsConfig {
  enabled: boolean;
  deadlineDays: number;
  gracePeriodDays: number;
  allowAccessWithPartial: boolean;
  requirePaymentToActivate: boolean;
}

export async function getPartialPaymentsConfig(): Promise<PartialPaymentsConfig> {
  const settings = await getSettings();

  return {
    enabled: settings.partial_payments_enabled === "true",
    deadlineDays: parseInt(settings.partial_payments_deadline_days || "15", 10),
    gracePeriodDays: parseInt(settings.partial_payments_grace_days || "5", 10),
    allowAccessWithPartial: settings.partial_payments_allow_access === "true",
    requirePaymentToActivate: settings.require_payment_to_activate === "true",
  };
}

// ============================================
// DEFAULT SETTINGS (for seeding)
// ============================================

export const defaultSettings: Record<string, string> = {
  gym_name: "Mi Gimnasio",
  timezone: "America/Bogota",
  morosity_tolerance_days: "5",
  qr_duration_seconds: "30",
  address: "",
  phone: "",
  email: "",
  // Partial payments settings
  partial_payments_enabled: "false",
  partial_payments_deadline_days: "15",
  partial_payments_grace_days: "5",
  partial_payments_allow_access: "true",
  require_payment_to_activate: "false",
};

export async function seedDefaultSettings(): Promise<void> {
  for (const [key, value] of Object.entries(defaultSettings)) {
    const existing = await getSetting(key);
    if (existing === null) {
      await setSetting(key, value);
    }
  }
}
