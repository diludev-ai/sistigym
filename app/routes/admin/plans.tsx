import {
  Form,
  useLoaderData,
  useNavigation,
  useActionData,
} from "react-router";
import type { Route } from "./+types/plans";
import { requireStaffAuth } from "~/lib/session.server";
import {
  getPlans,
  createPlan,
  updatePlan,
  togglePlanActive,
} from "~/lib/services/plan.service.server";
import { planSchema } from "~/lib/validations";
import { useState, useEffect } from "react";

// ============================================
// LOADER
// ============================================

export async function loader({ request }: Route.LoaderArgs) {
  await requireStaffAuth(request);
  const plans = await getPlans();
  return { plans };
}

// ============================================
// ACTION
// ============================================

export async function action({ request }: Route.ActionArgs) {
  await requireStaffAuth(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create" || intent === "update") {
    const rawData = {
      name: formData.get("name"),
      description: formData.get("description") || undefined,
      durationDays: parseInt(formData.get("durationDays") as string, 10),
      price: formData.get("price"),
      active: formData.get("active") === "true",
    };

    const result = planSchema.safeParse(rawData);
    if (!result.success) {
      return {
        error: result.error.errors[0]?.message || "Datos inválidos",
        success: false,
      };
    }

    try {
      if (intent === "create") {
        await createPlan(result.data);
        return { success: true, message: "Plan creado exitosamente" };
      } else {
        const planId = formData.get("planId") as string;
        await updatePlan(planId, result.data);
        return { success: true, message: "Plan actualizado exitosamente" };
      }
    } catch (error: any) {
      return { error: "Error al guardar plan", success: false };
    }
  }

  if (intent === "toggle-active") {
    const planId = formData.get("planId") as string;
    await togglePlanActive(planId);
    return { success: true, message: "Estado del plan actualizado" };
  }

  return { error: "Acción no válida", success: false };
}

// ============================================
// COMPONENT
// ============================================

export default function PlansPage() {
  const { plans } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<typeof plans[0] | null>(null);

  const isSubmitting = navigation.state === "submitting";

  // Close modal on successful creation/update
  useEffect(() => {
    if (actionData?.success) {
      setShowModal(false);
      setEditingPlan(null);
    }
  }, [actionData]);

  const openCreateModal = () => {
    setEditingPlan(null);
    setShowModal(true);
  };

  const openEditModal = (plan: typeof plans[0]) => {
    setEditingPlan(plan);
    setShowModal(true);
  };

  const formatPrice = (price: string) => {
    return parseFloat(price).toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
    });
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Planes</h1>
          <p className="text-gray-400 mt-1">
            Gestión de planes de membresía
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Plan
        </button>
      </div>

      {/* Messages */}
      {actionData?.success && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/50 rounded-lg">
          <p className="text-green-400">{actionData.message}</p>
        </div>
      )}
      {actionData?.error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
          <p className="text-red-400">{actionData.error}</p>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-gray-800 rounded-xl border p-6 ${
              plan.active ? "border-gray-700" : "border-gray-700/50 opacity-60"
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                <span
                  className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                    plan.active
                      ? "bg-green-500/20 text-green-400"
                      : "bg-gray-500/20 text-gray-400"
                  }`}
                >
                  {plan.active ? "Activo" : "Inactivo"}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(plan)}
                  className="p-2 text-gray-400 hover:text-white transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>
            </div>

            {plan.description && (
              <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
            )}

            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Duración</span>
                <span className="text-white font-medium">
                  {plan.durationDays} días
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Precio</span>
                <span className="text-white font-semibold text-lg">
                  {formatPrice(plan.price)}
                </span>
              </div>
            </div>

            <Form method="post">
              <input type="hidden" name="intent" value="toggle-active" />
              <input type="hidden" name="planId" value={plan.id} />
              <button
                type="submit"
                className={`w-full py-2 rounded-lg text-sm font-medium transition ${
                  plan.active
                    ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                    : "bg-green-600 hover:bg-green-700 text-white"
                }`}
              >
                {plan.active ? "Desactivar" : "Activar"}
              </button>
            </Form>
          </div>
        ))}
      </div>

      {plans.length === 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
          <p className="text-gray-400">No hay planes registrados</p>
          <button
            onClick={openCreateModal}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            Crear primer plan
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">
                  {editingPlan ? "Editar Plan" : "Nuevo Plan"}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <Form method="post" className="p-6 space-y-4">
              <input
                type="hidden"
                name="intent"
                value={editingPlan ? "update" : "create"}
              />
              {editingPlan && (
                <input type="hidden" name="planId" value={editingPlan.id} />
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nombre del Plan *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editingPlan?.name || ""}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Mensual, Trimestral..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Descripción
                </label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={editingPlan?.description || ""}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Descripción del plan..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Duración (días) *
                  </label>
                  <input
                    type="number"
                    name="durationDays"
                    required
                    min="1"
                    defaultValue={editingPlan?.durationDays || "30"}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Precio (COP) *
                  </label>
                  <input
                    type="text"
                    name="price"
                    required
                    pattern="^\d+(\.\d{1,2})?$"
                    defaultValue={editingPlan?.price || ""}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="500.00"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="active"
                  value="true"
                  defaultChecked={editingPlan?.active ?? true}
                  id="plan-active"
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="plan-active" className="text-gray-300">
                  Plan activo (visible para nuevas membresías)
                </label>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition"
                >
                  {isSubmitting ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}
