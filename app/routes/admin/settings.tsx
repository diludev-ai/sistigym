import { Form, useLoaderData, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/settings";
import { requireStaffAuth } from "~/lib/session.server";
import { db, gymSettings } from "~/db.server";
import { eq } from "drizzle-orm";
import { useState, useEffect } from "react";

export async function loader({ request }: Route.LoaderArgs) {
  const staff = await requireStaffAuth(request, { roles: ["admin"] });

  const settings = await db.select().from(gymSettings);
  const settingsMap: Record<string, string> = {};
  for (const setting of settings) {
    settingsMap[setting.key] = setting.value;
  }

  return { settings: settingsMap };
}

export async function action({ request }: Route.ActionArgs) {
  await requireStaffAuth(request, { roles: ["admin"] });

  const formData = await request.formData();

  // Helper to upsert a setting
  async function upsertSetting(key: string, value: string) {
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

  const updates = [
    { key: "gym_name", value: formData.get("gym_name") as string },
    { key: "morosity_tolerance_days", value: formData.get("morosity_tolerance_days") as string },
    { key: "qr_duration_seconds", value: formData.get("qr_duration_seconds") as string },
    { key: "timezone", value: formData.get("timezone") as string },
    { key: "address", value: formData.get("address") as string || "" },
    { key: "phone", value: formData.get("phone") as string || "" },
    { key: "email", value: formData.get("email") as string || "" },
    // Partial payments settings
    { key: "partial_payments_enabled", value: formData.get("partial_payments_enabled") === "on" ? "true" : "false" },
    { key: "partial_payments_deadline_days", value: formData.get("partial_payments_deadline_days") as string || "15" },
    { key: "partial_payments_grace_days", value: formData.get("partial_payments_grace_days") as string || "5" },
    { key: "partial_payments_allow_access", value: formData.get("partial_payments_allow_access") === "on" ? "true" : "false" },
    { key: "require_payment_to_activate", value: formData.get("require_payment_to_activate") === "on" ? "true" : "false" },
  ];

  for (const update of updates) {
    if (update.value !== null) {
      await upsertSetting(update.key, update.value);
    }
  }

  return { success: true, message: "Configuración guardada" };
}

export default function SettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [partialPaymentsEnabled, setPartialPaymentsEnabled] = useState(
    settings.partial_payments_enabled === "true"
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Configuración</h1>
        <p className="text-gray-400 mt-1">Ajustes generales del gimnasio</p>
      </div>

      {actionData?.success && (
        <div className="max-w-2xl mb-6 p-4 bg-green-500/10 border border-green-500/50 rounded-lg">
          <p className="text-green-400">{actionData.message}</p>
        </div>
      )}

      <Form method="post" className="max-w-2xl">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-6">
          {/* Gym Info */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Información del Gimnasio</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nombre del Gimnasio
                </label>
                <input
                  type="text"
                  name="gym_name"
                  defaultValue={settings.gym_name || ""}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Dirección
                </label>
                <input
                  type="text"
                  name="address"
                  defaultValue={settings.address || ""}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    name="phone"
                    defaultValue={settings.phone || ""}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={settings.email || ""}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* System Settings */}
          <div className="border-t border-gray-700 pt-6">
            <h2 className="text-lg font-semibold text-white mb-4">Configuración del Sistema</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tolerancia de Morosidad (días)
                </label>
                <input
                  type="number"
                  name="morosity_tolerance_days"
                  min="0"
                  max="30"
                  defaultValue={settings.morosity_tolerance_days || "5"}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-400 mt-1">
                  Días de gracia después de vencer la membresía antes de marcar como moroso
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Duración del QR (segundos)
                </label>
                <input
                  type="number"
                  name="qr_duration_seconds"
                  min="15"
                  max="120"
                  defaultValue={settings.qr_duration_seconds || "30"}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-400 mt-1">
                  Tiempo de validez del código QR para acceso
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Zona Horaria
                </label>
                <select
                  name="timezone"
                  defaultValue={settings.timezone || "America/Bogota"}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="America/Bogota">Colombia (GMT-5)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Partial Payments Settings */}
          <div className="border-t border-gray-700 pt-6">
            <h2 className="text-lg font-semibold text-white mb-4">Sistema de Abonos</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                <div>
                  <p className="font-medium text-white">Habilitar pagos parciales (abonos)</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Permite que los miembros paguen su membresía en cuotas
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="partial_payments_enabled"
                    checked={partialPaymentsEnabled}
                    onChange={(e) => setPartialPaymentsEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {partialPaymentsEnabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Días para completar el pago
                    </label>
                    <input
                      type="number"
                      name="partial_payments_deadline_days"
                      min="1"
                      max="60"
                      defaultValue={settings.partial_payments_deadline_days || "15"}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-sm text-gray-400 mt-1">
                      Días desde el inicio de la membresía para completar el pago total
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Días de gracia
                    </label>
                    <input
                      type="number"
                      name="partial_payments_grace_days"
                      min="0"
                      max="30"
                      defaultValue={settings.partial_payments_grace_days || "5"}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-sm text-gray-400 mt-1">
                      Días adicionales de tolerancia después de la fecha límite antes de bloquear acceso
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                    <div>
                      <p className="font-medium text-white">Permitir acceso con pago parcial</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Si está activo, el miembro puede entrar mientras tenga al menos un abono y no esté en mora
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="partial_payments_allow_access"
                        defaultChecked={settings.partial_payments_allow_access !== "false"}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                </>
              )}

              {/* Requerir pago - independiente del sistema de abonos */}
              <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                <div>
                  <p className="font-medium text-white">Requerir pago para activar membresía</p>
                  <p className="text-sm text-gray-400 mt-1">
                    La membresía permanece inactiva hasta que se registre al menos un pago
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="require_payment_to_activate"
                    defaultChecked={settings.require_payment_to_activate === "true"}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition"
            >
              {isSubmitting ? "Guardando..." : "Guardar Configuración"}
            </button>
          </div>
        </div>
      </Form>
    </div>
  );
}
