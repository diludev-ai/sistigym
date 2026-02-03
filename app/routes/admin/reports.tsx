import { Link, useLoaderData, useSearchParams } from "react-router";
import type { Route } from "./+types/reports";
import { requireStaffAuth } from "~/lib/session.server";
import {
  getMembershipStats,
  getOverdueMembers,
} from "~/lib/services/membership.service.server";
import {
  getRevenueStats,
  getRevenueByMethod,
  getDailyRevenue,
} from "~/lib/services/payment.service.server";
import {
  getTodayAccessStats,
  getHourlyAccessDistribution,
} from "~/lib/services/access.service.server";
import { useState } from "react";

// ============================================
// LOADER
// ============================================

export async function loader({ request }: Route.LoaderArgs) {
  await requireStaffAuth(request);

  const url = new URL(request.url);
  const tab = url.searchParams.get("tab") || "overview";

  // Date ranges
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 7);

  const [
    membershipStats,
    overdueMembers,
    revenueStats,
    revenueByMethod,
    dailyRevenue,
    todayAccessStats,
    hourlyDistribution,
  ] = await Promise.all([
    getMembershipStats(),
    getOverdueMembers(),
    getRevenueStats(startOfMonth, endOfMonth),
    getRevenueByMethod(startOfMonth, endOfMonth),
    getDailyRevenue(startOfWeek, now),
    getTodayAccessStats(),
    getHourlyAccessDistribution(now),
  ]);

  return {
    tab,
    membershipStats,
    overdueMembers,
    revenueStats,
    revenueByMethod,
    dailyRevenue,
    todayAccessStats,
    hourlyDistribution,
  };
}

// ============================================
// COMPONENT
// ============================================

export default function ReportsPage() {
  const {
    tab,
    membershipStats,
    overdueMembers,
    revenueStats,
    revenueByMethod,
    dailyRevenue,
    todayAccessStats,
    hourlyDistribution,
  } = useLoaderData<typeof loader>();

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
    });
  };

  const tabs = [
    { id: "overview", label: "Resumen" },
    { id: "revenue", label: "Ingresos" },
    { id: "attendance", label: "Asistencia" },
    { id: "overdue", label: `Morosos (${overdueMembers.length})` },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Reportes</h1>
        <p className="text-gray-400 mt-1">
          Estadísticas y análisis del gimnasio
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-gray-700 pb-4">
        {tabs.map((t) => (
          <Link
            key={t.id}
            to={`?tab=${t.id}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.id
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <p className="text-gray-400 text-sm">Membresías Activas</p>
              <p className="text-3xl font-bold text-green-400 mt-2">
                {membershipStats.active}
              </p>
            </div>
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <p className="text-gray-400 text-sm">Membresías Congeladas</p>
              <p className="text-3xl font-bold text-blue-400 mt-2">
                {membershipStats.frozen}
              </p>
            </div>
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <p className="text-gray-400 text-sm">Membresías Expiradas</p>
              <p className="text-3xl font-bold text-red-400 mt-2">
                {membershipStats.expired}
              </p>
            </div>
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <p className="text-gray-400 text-sm">Morosos</p>
              <p className="text-3xl font-bold text-orange-400 mt-2">
                {overdueMembers.length}
              </p>
            </div>
          </div>

          {/* Revenue & Access Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Ingresos del Mes
              </h3>
              <p className="text-4xl font-bold text-green-400">
                {formatCurrency(revenueStats.total)}
              </p>
              <p className="text-gray-400 mt-2">
                {revenueStats.count} pagos registrados
              </p>
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Accesos Hoy
              </h3>
              <p className="text-4xl font-bold text-white">
                {todayAccessStats.total}
              </p>
              <div className="flex gap-4 mt-2">
                <span className="text-green-400">
                  {todayAccessStats.allowed} aprobados
                </span>
                <span className="text-red-400">
                  {todayAccessStats.denied} denegados
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Tab */}
      {tab === "revenue" && (
        <div className="space-y-8">
          {/* Revenue by Method */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-6">
              Ingresos por Método de Pago
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {revenueByMethod.map((item) => (
                <div
                  key={item.method}
                  className="bg-gray-700 rounded-lg p-4"
                >
                  <p className="text-gray-400 text-sm capitalize">
                    {item.method === "cash"
                      ? "Efectivo"
                      : item.method === "transfer"
                      ? "Transferencia"
                      : "Tarjeta"}
                  </p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {formatCurrency(item.total)}
                  </p>
                  <p className="text-gray-500 text-sm">
                    {item.count} pagos
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Daily Revenue */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-6">
              Ingresos Últimos 7 Días
            </h3>
            <div className="space-y-3">
              {dailyRevenue.map((day) => (
                <div
                  key={day.date}
                  className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                >
                  <span className="text-gray-300">
                    {new Date(day.date).toLocaleDateString("es-CO", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <span className="text-white font-medium">
                    {formatCurrency(day.total)}
                  </span>
                </div>
              ))}
              {dailyRevenue.length === 0 && (
                <p className="text-gray-400 text-center py-4">
                  Sin datos de ingresos en este período
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Attendance Tab */}
      {tab === "attendance" && (
        <div className="space-y-8">
          {/* Today Stats */}
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 text-center">
              <p className="text-gray-400 text-sm">Total Accesos Hoy</p>
              <p className="text-4xl font-bold text-white mt-2">
                {todayAccessStats.total}
              </p>
            </div>
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 text-center">
              <p className="text-gray-400 text-sm">Aprobados</p>
              <p className="text-4xl font-bold text-green-400 mt-2">
                {todayAccessStats.allowed}
              </p>
            </div>
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 text-center">
              <p className="text-gray-400 text-sm">Denegados</p>
              <p className="text-4xl font-bold text-red-400 mt-2">
                {todayAccessStats.denied}
              </p>
            </div>
          </div>

          {/* Hourly Distribution */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-6">
              Distribución por Hora (Hoy)
            </h3>
            <div className="flex items-end gap-1 h-48">
              {hourlyDistribution.map((item) => {
                const maxCount = Math.max(
                  ...hourlyDistribution.map((h) => h.count),
                  1
                );
                const height = (item.count / maxCount) * 100;
                return (
                  <div
                    key={item.hour}
                    className="flex-1 flex flex-col items-center"
                  >
                    <div
                      className="w-full bg-blue-500 rounded-t transition-all"
                      style={{ height: `${height}%`, minHeight: item.count > 0 ? "4px" : "0" }}
                      title={`${item.hour}:00 - ${item.count} accesos`}
                    />
                    <span className="text-xs text-gray-500 mt-1">
                      {item.hour.toString().padStart(2, "0")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Overdue Tab */}
      {tab === "overdue" && (
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">
                Miembros Morosos
              </h3>
              <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium">
                {overdueMembers.length} moroso{overdueMembers.length !== 1 ? "s" : ""}
              </span>
            </div>

            {overdueMembers.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="text-gray-400">No hay miembros morosos</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-700">
                <table className="w-full">
                  <thead className="bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                        Miembro
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                        Plan
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                        Venció
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                        Días de Atraso
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">
                        Debe
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {overdueMembers.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-700/30 transition"
                      >
                        <td className="px-4 py-3">
                          <Link
                            to={`/admin/members/${item.member.id}`}
                            className="text-white hover:text-blue-400 font-medium"
                          >
                            {item.member.firstName} {item.member.lastName}
                          </Link>
                          <p className="text-gray-400 text-sm">
                            {item.member.email}
                          </p>
                          {item.member.phone && (
                            <p className="text-gray-500 text-sm">
                              {item.member.phone}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {item.plan.name}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {new Date(item.endsAt).toLocaleDateString("es-CO")}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium">
                            {item.daysPastDue} días
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-red-400 font-medium">
                          {formatCurrency(parseFloat(item.plan.price))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/admin/memberships?newMember=${item.member.id}`}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition"
                          >
                            Renovar
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Morosos Alert Info */}
            {overdueMembers.length > 0 && (
              <div className="mt-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div>
                    <p className="text-orange-400 font-medium">
                      Estos miembros tienen acceso BLOQUEADO
                    </p>
                    <p className="text-gray-400 text-sm mt-1">
                      Los miembros morosos no pueden ingresar al gimnasio hasta
                      regularizar su situación. Al intentar check-in, el sistema
                      mostrará "DENEGADO - Moroso".
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
