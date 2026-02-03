import {
  Form,
  Link,
  useLoaderData,
  useNavigation,
  useActionData,
} from "react-router";
import type { Route } from "./+types/payments";
import { requireStaffAuth } from "~/lib/session.server";
import {
  getPayments,
  createPayment,
  getRevenueStats,
  getRevenueByMethod,
  cancelPayment,
} from "~/lib/services/payment.service.server";
import { getMembers } from "~/lib/services/member.service.server";
import { getMembersWithPendingPayments } from "~/lib/services/membership.service.server";
import { getPartialPaymentsConfig } from "~/lib/services/settings.service.server";
import { createPaymentSchema } from "~/lib/validations";
import { useState, useEffect, useMemo } from "react";
import { MemberSearchSelect } from "~/components/MemberSearchSelect";

// ============================================
// LOADER
// ============================================

export async function loader({ request }: Route.LoaderArgs) {
  const staff = await requireStaffAuth(request);

  const url = new URL(request.url);
  const memberId = url.searchParams.get("member") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  // Get date range for stats (this month)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [payments, members, revenueStats, revenueByMethod, partialPaymentsConfig] = await Promise.all([
    getPayments({ memberId, limit, offset }),
    getMembers({ limit: 100 }),
    getRevenueStats(startOfMonth, endOfMonth),
    getRevenueByMethod(startOfMonth, endOfMonth),
    getPartialPaymentsConfig(),
  ]);

  // Get pending payments info if partial payments is enabled
  let pendingPaymentsMap: Record<string, { membershipId: string; planName: string; totalAmount: number; paidAmount: number; pendingAmount: number }[]> = {};

  if (partialPaymentsConfig.enabled) {
    const pendingPayments = await getMembersWithPendingPayments();
    for (const p of pendingPayments) {
      if (!pendingPaymentsMap[p.member.id]) {
        pendingPaymentsMap[p.member.id] = [];
      }
      pendingPaymentsMap[p.member.id].push({
        membershipId: p.membership.id,
        planName: p.plan.name,
        totalAmount: p.totalAmount,
        paidAmount: p.paidAmount,
        pendingAmount: p.pendingAmount,
      });
    }
  }

  return {
    payments,
    members,
    revenueStats,
    revenueByMethod,
    page,
    memberId,
    isAdmin: staff.role === "admin",
    partialPaymentsEnabled: partialPaymentsConfig.enabled,
    pendingPaymentsMap,
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
      membershipId: formData.get("membershipId") || undefined,
      amount: formData.get("amount"),
      method: formData.get("method"),
      reference: formData.get("reference") || undefined,
      notes: formData.get("notes") || undefined,
    };

    const result = createPaymentSchema.safeParse(rawData);
    if (!result.success) {
      return {
        error: result.error.errors[0]?.message || "Datos inválidos",
        success: false,
      };
    }

    try {
      await createPayment({
        ...result.data,
        receivedBy: staff.id,
      });
      return { success: true, message: "Pago registrado exitosamente" };
    } catch (error: any) {
      return { error: error.message || "Error al registrar pago", success: false };
    }
  }

  if (intent === "cancel") {
    // Solo admin puede anular pagos
    if (staff.role !== "admin") {
      return { error: "No tienes permisos para anular pagos", success: false };
    }

    const paymentId = formData.get("paymentId") as string;
    const reason = formData.get("reason") as string;

    if (!reason || reason.trim().length < 5) {
      return { error: "El motivo de anulación debe tener al menos 5 caracteres", success: false };
    }

    try {
      await cancelPayment(paymentId, staff.id, reason.trim());
      return { success: true, message: "Pago anulado exitosamente" };
    } catch (error: any) {
      return { error: "Error al anular pago", success: false };
    }
  }

  return { error: "Acción no válida", success: false };
}

// ============================================
// COMPONENT
// ============================================

export default function PaymentsPage() {
  const {
    payments,
    members,
    revenueStats,
    revenueByMethod,
    page,
    memberId,
    isAdmin,
    partialPaymentsEnabled,
    pendingPaymentsMap,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [showModal, setShowModal] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedMembershipId, setSelectedMembershipId] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelPaymentId, setCancelPaymentId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const isSubmitting = navigation.state === "submitting";

  // Get pending payments for selected member
  const selectedMemberPendingPayments = useMemo(() => {
    if (!selectedMemberId || !partialPaymentsEnabled) return [];
    return pendingPaymentsMap[selectedMemberId] || [];
  }, [selectedMemberId, pendingPaymentsMap, partialPaymentsEnabled]);

  // Close modals on successful action
  useEffect(() => {
    if (actionData?.success) {
      setShowModal(false);
      setSelectedMemberId("");
      setSelectedMembershipId("");
      setShowCancelModal(false);
      setCancelPaymentId(null);
      setCancelReason("");
    }
  }, [actionData]);

  // Auto-select membership if only one pending
  useEffect(() => {
    if (selectedMemberPendingPayments.length === 1) {
      setSelectedMembershipId(selectedMemberPendingPayments[0].membershipId);
    } else {
      setSelectedMembershipId("");
    }
  }, [selectedMemberPendingPayments]);

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return num.toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
    });
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case "cash":
        return "Efectivo";
      case "transfer":
        return "Transferencia";
      case "card":
        return "Tarjeta";
      default:
        return method;
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case "cash":
        return "bg-green-500/20 text-green-400";
      case "transfer":
        return "bg-blue-500/20 text-blue-400";
      case "card":
        return "bg-purple-500/20 text-purple-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Pagos</h1>
          <p className="text-gray-400 mt-1">Registro y gestión de pagos</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Registrar Pago
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <p className="text-gray-400 text-sm">Ingresos del Mes</p>
          <p className="text-3xl font-bold text-green-400 mt-2">
            {formatCurrency(revenueStats.total)}
          </p>
          <p className="text-gray-500 text-sm mt-1">
            {revenueStats.count} pago{revenueStats.count !== 1 ? "s" : ""}
          </p>
        </div>

        {revenueByMethod.map((item) => (
          <div
            key={item.method}
            className="bg-gray-800 rounded-xl border border-gray-700 p-6"
          >
            <p className="text-gray-400 text-sm">{getMethodLabel(item.method)}</p>
            <p className="text-2xl font-bold text-white mt-2">
              {formatCurrency(item.total)}
            </p>
            <p className="text-gray-500 text-sm mt-1">
              {item.count} pago{item.count !== 1 ? "s" : ""}
            </p>
          </div>
        ))}
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

      {/* Filter by member */}
      {memberId && (
        <div className="mb-6 flex items-center gap-4">
          <span className="text-gray-400">Filtrando por miembro</span>
          <Link
            to="/admin/payments"
            className="text-blue-400 hover:text-blue-300"
          >
            Limpiar filtro
          </Link>
        </div>
      )}

      {/* Payments Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700/50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                Fecha
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                Miembro
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                Concepto
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                Método
              </th>
              <th className="px-6 py-4 text-right text-sm font-medium text-gray-300">
                Monto
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                Recibió
              </th>
              <th className="px-6 py-4 text-right text-sm font-medium text-gray-300">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  No se encontraron pagos
                </td>
              </tr>
            ) : (
              payments.map((payment) => {
                const isCancelled = !!payment.cancelledAt;
                return (
                  <tr
                    key={payment.id}
                    className={`hover:bg-gray-700/30 transition ${
                      isCancelled ? "opacity-50" : ""
                    }`}
                  >
                    <td className="px-6 py-4 text-gray-300">
                      <span className={isCancelled ? "line-through" : ""}>
                        {new Date(payment.paidAt).toLocaleDateString("es-CO", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        to={`/admin/members/${payment.member.id}`}
                        className={`hover:text-blue-400 ${
                          isCancelled ? "text-gray-400 line-through" : "text-white"
                        }`}
                      >
                        {payment.member.firstName} {payment.member.lastName}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      <span className={isCancelled ? "line-through" : ""}>
                        {payment.membership?.plan?.name || "Pago general"}
                      </span>
                      {payment.reference && (
                        <span className="text-gray-500 text-sm block">
                          Ref: {payment.reference}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isCancelled ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                          ANULADO
                        </span>
                      ) : (
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getMethodColor(
                            payment.method
                          )}`}
                        >
                          {getMethodLabel(payment.method)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-medium">
                      <span
                        className={
                          isCancelled ? "text-gray-500 line-through" : "text-white"
                        }
                      >
                        {formatCurrency(payment.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {isCancelled ? (
                        <div>
                          <span className="text-red-400">
                            Anulado por: {payment.cancelledByStaff?.name || "-"}
                          </span>
                          {payment.cancellationReason && (
                            <span className="block text-xs text-gray-500 truncate max-w-[150px]" title={payment.cancellationReason}>
                              {payment.cancellationReason}
                            </span>
                          )}
                        </div>
                      ) : (
                        payment.receivedByStaff?.name || "-"
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!isCancelled && isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setCancelPaymentId(payment.id);
                            setShowCancelModal(true);
                          }}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Anular
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">
                  Registrar Pago
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
                  warningMemberIds={new Set(Object.keys(pendingPaymentsMap))}
                  warningTooltip="Tiene pagos pendientes"
                />
              </div>

              {/* Pending Payments Info */}
              {selectedMemberId && selectedMemberPendingPayments.length > 0 && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-yellow-400 text-sm font-medium mb-2">
                    Este miembro tiene pagos pendientes:
                  </p>
                  <div className="space-y-2">
                    {selectedMemberPendingPayments.map((pp) => (
                      <label
                        key={pp.membershipId}
                        className={`flex items-center justify-between p-2 rounded cursor-pointer transition ${
                          selectedMembershipId === pp.membershipId
                            ? "bg-yellow-500/20 ring-1 ring-yellow-500"
                            : "bg-gray-700/50 hover:bg-gray-700"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="membershipId"
                            value={pp.membershipId}
                            checked={selectedMembershipId === pp.membershipId}
                            onChange={(e) => setSelectedMembershipId(e.target.value)}
                            className="text-yellow-500"
                          />
                          <span className="text-white text-sm">{pp.planName}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-yellow-400 text-sm font-medium">
                            {formatCurrency(pp.pendingAmount)}
                          </p>
                          <p className="text-gray-500 text-xs">
                            de {formatCurrency(pp.totalAmount)}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Monto *
                  {selectedMembershipId && selectedMemberPendingPayments.length > 0 && (
                    <span className="text-yellow-400 ml-2 font-normal">
                      (Pendiente: {formatCurrency(
                        selectedMemberPendingPayments.find(p => p.membershipId === selectedMembershipId)?.pendingAmount || 0
                      )})
                    </span>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    $
                  </span>
                  <input
                    type="text"
                    name="amount"
                    required
                    pattern="^\d+(\.\d{1,2})?$"
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Método de Pago *
                </label>
                <select
                  name="method"
                  required
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar...</option>
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="card">Tarjeta</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Referencia (opcional)
                </label>
                <input
                  type="text"
                  name="reference"
                  placeholder="Número de transacción, recibo, etc."
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notas (opcional)
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
                  className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg transition"
                >
                  {isSubmitting ? "Guardando..." : "Registrar Pago"}
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}

      {/* Cancel Payment Modal */}
      {showCancelModal && cancelPaymentId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">
                  Anular Pago
                </h2>
                <button
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancelPaymentId(null);
                    setCancelReason("");
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <Form method="post" className="p-6 space-y-4">
              <input type="hidden" name="intent" value="cancel" />
              <input type="hidden" name="paymentId" value={cancelPaymentId} />

              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">
                  <strong>Advertencia:</strong> Esta acción no se puede deshacer.
                  El pago será marcado como anulado y no contará en los reportes de ingresos.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Motivo de anulación *
                </label>
                <textarea
                  name="reason"
                  required
                  minLength={5}
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ingrese el motivo de la anulación (mínimo 5 caracteres)"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-500"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancelPaymentId(null);
                    setCancelReason("");
                  }}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || cancelReason.trim().length < 5}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 disabled:cursor-not-allowed text-white rounded-lg transition"
                >
                  {isSubmitting ? "Anulando..." : "Anular Pago"}
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}
