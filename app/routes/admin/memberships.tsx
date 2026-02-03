import {
  Form,
  Link,
  useLoaderData,
  useNavigation,
  useActionData,
  useSearchParams,
} from "react-router";
import type { Route } from "./+types/memberships";
import { requireStaffAuth } from "~/lib/session.server";
import {
  getMemberships,
  createMembership,
  renewMembership,
  freezeMembership,
  unfreezeMembership,
  cancelMembership,
  getMembershipStats,
  activateMembership,
} from "~/lib/services/membership.service.server";
import { getPlans } from "~/lib/services/plan.service.server";
import { getMembers, getMemberById } from "~/lib/services/member.service.server";
import { createMembershipSchema, freezeMembershipSchema } from "~/lib/validations";
import { useState, useEffect } from "react";
import { MemberSearchSelect } from "~/components/MemberSearchSelect";

// ============================================
// LOADER
// ============================================

export async function loader({ request }: Route.LoaderArgs) {
  await requireStaffAuth(request);

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status") as any;
  const newMemberId = url.searchParams.get("newMember");

  const [memberships, plans, stats, members] = await Promise.all([
    getMemberships({ status: statusFilter || undefined }),
    getPlans({ activeOnly: true }),
    getMembershipStats(),
    getMembers({ limit: 100 }),
  ]);

  let preselectedMember = null;
  if (newMemberId) {
    preselectedMember = await getMemberById(newMemberId);
  }

  return {
    memberships,
    plans,
    stats,
    members,
    preselectedMember,
    statusFilter: statusFilter || "all",
  };
}

// ============================================
// ACTION
// ============================================

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaffAuth(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const rawData = {
      memberId: formData.get("memberId"),
      planId: formData.get("planId"),
      startsAt: formData.get("startsAt") || new Date().toISOString(),
    };

    const result = createMembershipSchema.safeParse(rawData);
    if (!result.success) {
      return {
        error: result.error.errors[0]?.message || "Datos inválidos",
        success: false,
      };
    }

    try {
      await createMembership({
        memberId: result.data.memberId,
        planId: result.data.planId,
        startsAt: new Date(result.data.startsAt as string),
      });
      return { success: true, message: "Membresía creada exitosamente" };
    } catch (error: any) {
      return { error: error.message || "Error al crear membresía", success: false };
    }
  }

  if (intent === "renew") {
    const memberId = formData.get("memberId") as string;
    const planId = formData.get("planId") as string;

    if (!memberId || !planId) {
      return { error: "Datos incompletos", success: false };
    }

    try {
      await renewMembership({ memberId, planId });
      return { success: true, message: "Membresía renovada exitosamente" };
    } catch (error: any) {
      return { error: error.message || "Error al renovar membresía", success: false };
    }
  }

  if (intent === "freeze") {
    const rawData = {
      membershipId: formData.get("membershipId"),
      days: parseInt(formData.get("days") as string, 10),
    };

    const result = freezeMembershipSchema.safeParse(rawData);
    if (!result.success) {
      return {
        error: result.error.errors[0]?.message || "Datos inválidos",
        success: false,
      };
    }

    try {
      await freezeMembership(result.data.membershipId, result.data.days);
      return { success: true, message: `Membresía congelada por ${result.data.days} días` };
    } catch (error: any) {
      return { error: error.message || "Error al congelar membresía", success: false };
    }
  }

  if (intent === "unfreeze") {
    const membershipId = formData.get("membershipId") as string;
    try {
      await unfreezeMembership(membershipId);
      return { success: true, message: "Membresía descongelada" };
    } catch (error: any) {
      return { error: error.message || "Error al descongelar membresía", success: false };
    }
  }

  if (intent === "cancel") {
    const membershipId = formData.get("membershipId") as string;
    try {
      await cancelMembership(membershipId);
      return { success: true, message: "Membresía cancelada" };
    } catch (error: any) {
      return { error: error.message || "Error al cancelar membresía", success: false };
    }
  }

  if (intent === "activate") {
    const membershipId = formData.get("membershipId") as string;
    try {
      await activateMembership(membershipId);
      return { success: true, message: "Membresía activada exitosamente" };
    } catch (error: any) {
      return { error: error.message || "Error al activar membresía", success: false };
    }
  }

  return { error: "Acción no válida", success: false };
}

// ============================================
// COMPONENT
// ============================================

export default function MembershipsPage() {
  const { memberships, plans, stats, members, preselectedMember, statusFilter } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFreezeModal, setShowFreezeModal] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");

  const isSubmitting = navigation.state === "submitting";

  // Open modal if newMember param is present
  useEffect(() => {
    if (preselectedMember) {
      setSelectedMemberId(preselectedMember.id);
      setShowCreateModal(true);
    }
  }, [preselectedMember]);

  // Close modals on successful action
  useEffect(() => {
    if (actionData?.success) {
      setShowCreateModal(false);
      setShowFreezeModal(null);
      setSelectedMemberId("");
    }
  }, [actionData]);

  const getStatusBadge = (status: string, daysRemaining: number) => {
    switch (status) {
      case "pending_payment":
        return (
          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-medium">
            Pendiente de Pago
          </span>
        );
      case "active":
        return (
          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
            Activa ({daysRemaining}d)
          </span>
        );
      case "frozen":
        return (
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
            Congelada
          </span>
        );
      case "expired":
        return (
          <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-medium">
            Expirada
          </span>
        );
      case "cancelled":
        return (
          <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded-full text-xs font-medium">
            Cancelada
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Membresías</h1>
          <p className="text-gray-400 mt-1">
            Gestión de membresías de miembros
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedMemberId("");
            setShowCreateModal(true);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Membresía
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Activas</p>
              <p className="text-3xl font-bold text-green-400">{stats.active}</p>
            </div>
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Congeladas</p>
              <p className="text-3xl font-bold text-blue-400">{stats.frozen}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Expiradas</p>
              <p className="text-3xl font-bold text-red-400">{stats.expired}</p>
            </div>
            <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
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

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {["all", "pending_payment", "active", "frozen", "expired", "cancelled"].map((status) => (
          <Link
            key={status}
            to={status === "all" ? "/admin/memberships" : `?status=${status}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              statusFilter === status
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            {status === "all"
              ? "Todas"
              : status === "pending_payment"
              ? "Pend. Pago"
              : status === "active"
              ? "Activas"
              : status === "frozen"
              ? "Congeladas"
              : status === "expired"
              ? "Expiradas"
              : "Canceladas"}
          </Link>
        ))}
      </div>

      {/* Memberships Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700/50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                Miembro
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                Plan
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                Estado
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                Inicio
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                Vence
              </th>
              <th className="px-6 py-4 text-right text-sm font-medium text-gray-300">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {memberships.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  No se encontraron membresías
                </td>
              </tr>
            ) : (
              memberships.map((membership) => (
                <tr key={membership.id} className="hover:bg-gray-700/30 transition">
                  <td className="px-6 py-4">
                    <Link
                      to={`/admin/members/${membership.member.id}`}
                      className="text-white hover:text-blue-400 font-medium"
                    >
                      {membership.member.firstName} {membership.member.lastName}
                    </Link>
                    <p className="text-gray-400 text-sm">{membership.member.email}</p>
                  </td>
                  <td className="px-6 py-4 text-white">{membership.plan.name}</td>
                  <td className="px-6 py-4">
                    {getStatusBadge(
                      membership.calculatedStatus,
                      membership.daysRemaining
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-300">
                    {new Date(membership.startsAt).toLocaleDateString("es-CO")}
                  </td>
                  <td className="px-6 py-4 text-gray-300">
                    {new Date(membership.endsAt).toLocaleDateString("es-CO")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {membership.calculatedStatus === "pending_payment" && (
                        <Form method="post" className="inline">
                          <input type="hidden" name="intent" value="activate" />
                          <input
                            type="hidden"
                            name="membershipId"
                            value={membership.id}
                          />
                          <button
                            type="submit"
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition"
                          >
                            Activar
                          </button>
                        </Form>
                      )}
                      {membership.calculatedStatus === "active" && (
                        <button
                          onClick={() => setShowFreezeModal(membership.id)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition"
                        >
                          Congelar
                        </button>
                      )}
                      {membership.calculatedStatus === "frozen" && (
                        <Form method="post" className="inline">
                          <input type="hidden" name="intent" value="unfreeze" />
                          <input
                            type="hidden"
                            name="membershipId"
                            value={membership.id}
                          />
                          <button
                            type="submit"
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition"
                          >
                            Descongelar
                          </button>
                        </Form>
                      )}
                      {(membership.calculatedStatus === "active" ||
                        membership.calculatedStatus === "frozen" ||
                        membership.calculatedStatus === "pending_payment") && (
                        <Form method="post" className="inline">
                          <input type="hidden" name="intent" value="cancel" />
                          <input
                            type="hidden"
                            name="membershipId"
                            value={membership.id}
                          />
                          <button
                            type="submit"
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition"
                          >
                            Cancelar
                          </button>
                        </Form>
                      )}
                      {(membership.calculatedStatus === "expired" ||
                        membership.calculatedStatus === "cancelled") && (
                        <Form method="post" className="inline">
                          <input type="hidden" name="intent" value="renew" />
                          <input
                            type="hidden"
                            name="memberId"
                            value={membership.member.id}
                          />
                          <input
                            type="hidden"
                            name="planId"
                            value={membership.plan.id}
                          />
                          <button
                            type="submit"
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition"
                          >
                            Renovar
                          </button>
                        </Form>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Membership Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">
                  Nueva Membresía
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <Form method="post" className="p-6 space-y-4">
              <input type="hidden" name="intent" value="create" />

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Miembro *
                </label>
                <MemberSearchSelect
                  members={members}
                  value={selectedMemberId}
                  onChange={setSelectedMemberId}
                  name="memberId"
                  required
                  placeholder="Buscar por nombre o email..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Plan *
                </label>
                <select
                  name="planId"
                  required
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar plan...</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - ${parseFloat(plan.price).toLocaleString()} ({plan.durationDays} días)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Fecha de Inicio
                </label>
                <input
                  type="date"
                  name="startsAt"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition"
                >
                  {isSubmitting ? "Creando..." : "Crear Membresía"}
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}

      {/* Freeze Modal */}
      {showFreezeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-sm w-full">
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">
                Congelar Membresía
              </h2>
            </div>

            <Form method="post" className="p-6 space-y-4">
              <input type="hidden" name="intent" value="freeze" />
              <input type="hidden" name="membershipId" value={showFreezeModal} />

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Días a congelar
                </label>
                <input
                  type="number"
                  name="days"
                  required
                  min="1"
                  max="90"
                  defaultValue="7"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Los días congelados se agregarán a la fecha de vencimiento
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowFreezeModal(null)}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition"
                >
                  {isSubmitting ? "Congelando..." : "Congelar"}
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}
