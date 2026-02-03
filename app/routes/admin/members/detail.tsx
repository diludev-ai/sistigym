import {
  Form,
  Link,
  useLoaderData,
  useNavigation,
  useActionData,
  redirect,
} from "react-router";
import type { Route } from "./+types/detail";
import { requireStaffAuth } from "~/lib/session.server";
import {
  getMemberById,
  updateMember,
  deleteMember,
} from "~/lib/services/member.service.server";
import {
  getActiveMembershipForMember,
  checkMemberOverdue,
} from "~/lib/services/membership.service.server";
import { getPlans } from "~/lib/services/plan.service.server";
import { updateMemberSchema } from "~/lib/validations";
import { useState } from "react";

// ============================================
// LOADER
// ============================================

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireStaffAuth(request);

  const member = await getMemberById(params.id);
  if (!member) {
    throw new Response("Miembro no encontrado", { status: 404 });
  }

  const [activeMembership, overdueStatus, plans] = await Promise.all([
    getActiveMembershipForMember(params.id),
    checkMemberOverdue(params.id),
    getPlans({ activeOnly: true }),
  ]);

  return {
    member,
    activeMembership,
    overdueStatus,
    plans,
  };
}

// ============================================
// ACTION
// ============================================

export async function action({ request, params }: Route.ActionArgs) {
  await requireStaffAuth(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update") {
    const rawData = {
      email: formData.get("email") || undefined,
      firstName: formData.get("firstName") || undefined,
      lastName: formData.get("lastName") || undefined,
      phone: formData.get("phone") || undefined,
      emergencyContact: formData.get("emergencyContact") || undefined,
      birthDate: formData.get("birthDate") || undefined,
      notes: formData.get("notes") || undefined,
      password: formData.get("password") || undefined,
    };

    const result = updateMemberSchema.safeParse(rawData);
    if (!result.success) {
      return {
        error: result.error.errors[0]?.message || "Datos inválidos",
        success: false,
      };
    }

    // Remove empty password
    const dataToUpdate = { ...result.data };
    if (!dataToUpdate.password) {
      delete dataToUpdate.password;
    }

    try {
      await updateMember(params.id, dataToUpdate);
      return { success: true, message: "Miembro actualizado exitosamente" };
    } catch (error: any) {
      if (error.code === "23505") {
        return { error: "Ya existe un miembro con ese email", success: false };
      }
      return { error: "Error al actualizar miembro", success: false };
    }
  }

  if (intent === "delete") {
    await deleteMember(params.id);
    return redirect("/admin/members");
  }

  if (intent === "toggle-active") {
    const currentActive = formData.get("currentActive") === "true";
    await updateMember(params.id, { active: !currentActive });
    return { success: true, message: `Miembro ${currentActive ? "desactivado" : "activado"}` };
  }

  return { error: "Acción no válida", success: false };
}

// ============================================
// COMPONENT
// ============================================

export default function MemberDetail() {
  const { member, activeMembership, overdueStatus, plans } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isSubmitting = navigation.state === "submitting";

  const statusBadge = () => {
    if (overdueStatus.isOverdue) {
      return (
        <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium">
          Moroso ({overdueStatus.daysPastDue} días)
        </span>
      );
    }
    if (activeMembership) {
      if (activeMembership.calculatedStatus === "active") {
        return (
          <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
            Membresía Activa ({activeMembership.daysRemaining} días)
          </span>
        );
      }
      if (activeMembership.calculatedStatus === "frozen") {
        return (
          <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium">
            Membresía Congelada
          </span>
        );
      }
    }
    return (
      <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium">
        Sin Membresía
      </span>
    );
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          to="/admin/members"
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-white">
            {member.firstName} {member.lastName}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            {statusBadge()}
            {!member.active && (
              <span className="px-3 py-1 bg-gray-500/20 text-gray-400 rounded-full text-sm font-medium">
                Cuenta Inactiva
              </span>
            )}
          </div>
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Member Info Form */}
        <div className="lg:col-span-2">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-white mb-6">
              Información del Miembro
            </h2>

            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="update" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nombre
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    defaultValue={member.firstName}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Apellido
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    defaultValue={member.lastName}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  defaultValue={member.email}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  name="password"
                  placeholder="Dejar vacío para no cambiar"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Teléfono
                </label>
                <input
                  type="tel"
                  name="phone"
                  defaultValue={member.phone || ""}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Contacto de Emergencia
                </label>
                <input
                  type="text"
                  name="emergencyContact"
                  defaultValue={member.emergencyContact || ""}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Fecha de Nacimiento
                </label>
                <input
                  type="date"
                  name="birthDate"
                  defaultValue={member.birthDate || ""}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notas
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={member.notes || ""}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition"
                >
                  {isSubmitting ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </Form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Active Membership Card */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Membresía Actual
            </h3>

            {activeMembership ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Plan</span>
                  <span className="text-white">{activeMembership.plan.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Estado</span>
                  <span
                    className={`font-medium ${
                      activeMembership.calculatedStatus === "active"
                        ? "text-green-400"
                        : activeMembership.calculatedStatus === "frozen"
                        ? "text-blue-400"
                        : "text-red-400"
                    }`}
                  >
                    {activeMembership.calculatedStatus === "active"
                      ? "Activa"
                      : activeMembership.calculatedStatus === "frozen"
                      ? "Congelada"
                      : "Expirada"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Vence</span>
                  <span className="text-white">
                    {new Date(activeMembership.endsAt).toLocaleDateString("es-CO")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Días restantes</span>
                  <span className="text-white font-medium">
                    {activeMembership.daysRemaining}
                  </span>
                </div>

                <div className="pt-4 border-t border-gray-700">
                  <Link
                    to={`/admin/memberships?member=${member.id}`}
                    className="block text-center py-2 text-blue-400 hover:text-blue-300"
                  >
                    Gestionar membresía
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-400 mb-4">Sin membresía activa</p>
                <Link
                  to={`/admin/memberships?newMember=${member.id}`}
                  className="inline-block px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                >
                  Crear Membresía
                </Link>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Acciones</h3>
            <div className="space-y-3">
              <Form method="post">
                <input type="hidden" name="intent" value="toggle-active" />
                <input
                  type="hidden"
                  name="currentActive"
                  value={member.active.toString()}
                />
                <button
                  type="submit"
                  className={`w-full px-4 py-2 rounded-lg transition ${
                    member.active
                      ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                      : "bg-green-600 hover:bg-green-700 text-white"
                  }`}
                >
                  {member.active ? "Desactivar Cuenta" : "Activar Cuenta"}
                </button>
              </Form>

              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
              >
                Eliminar Miembro
              </button>
            </div>
          </div>

          {/* Memberships History */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Historial de Membresías
            </h3>
            {member.memberships.length === 0 ? (
              <p className="text-gray-400 text-sm">Sin historial</p>
            ) : (
              <div className="space-y-3">
                {member.memberships.slice(0, 5).map((m) => (
                  <div
                    key={m.id}
                    className="flex justify-between text-sm border-b border-gray-700 pb-2"
                  >
                    <span className="text-gray-300">{m.plan.name}</span>
                    <span className="text-gray-400">
                      {new Date(m.startsAt).toLocaleDateString("es-CO", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-white mb-4">
              Confirmar Eliminación
            </h3>
            <p className="text-gray-300 mb-6">
              ¿Estás seguro de eliminar a{" "}
              <strong>
                {member.firstName} {member.lastName}
              </strong>
              ? Esta acción desactivará su cuenta.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
              >
                Cancelar
              </button>
              <Form method="post" className="flex-1">
                <input type="hidden" name="intent" value="delete" />
                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                >
                  Eliminar
                </button>
              </Form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
