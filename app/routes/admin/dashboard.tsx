import { useLoaderData, Link } from "react-router";
import type { Route } from "./+types/dashboard";
import { db, members, memberships, payments, accessLogs } from "~/db.server";
import { count, eq, and, gte, lte, sql, isNull } from "drizzle-orm";
import { getMembersWithPendingPayments } from "~/lib/services/membership.service.server";
import { getPartialPaymentsConfig } from "~/lib/services/settings.service.server";

// ============================================
// LOADER: Get dashboard stats
// ============================================

export async function loader({ request }: Route.LoaderArgs) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get all stats in parallel
  const [
    totalMembersResult,
    activeMembershipsResult,
    todayAccessResult,
    monthRevenueResult,
  ] = await Promise.all([
    // Total active members
    db
      .select({ count: count() })
      .from(members)
      .where(eq(members.active, true)),

    // Active memberships
    db
      .select({ count: count() })
      .from(memberships)
      .where(
        and(
          eq(memberships.status, "active"),
          gte(memberships.endsAt, now)
        )
      ),

    // Today's check-ins
    db
      .select({ count: count() })
      .from(accessLogs)
      .where(
        and(
          gte(accessLogs.accessedAt, startOfDay),
          eq(accessLogs.allowed, true)
        )
      ),

    // This month's revenue (excluding cancelled payments)
    db
      .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(payments)
      .where(and(gte(payments.paidAt, startOfMonth), isNull(payments.cancelledAt))),
  ]);

  // Get partial payments config and pending payments
  const partialPaymentsConfig = await getPartialPaymentsConfig();
  let pendingPayments: Awaited<ReturnType<typeof getMembersWithPendingPayments>> = [];

  if (partialPaymentsConfig.enabled) {
    pendingPayments = await getMembersWithPendingPayments();
  }

  return {
    stats: {
      totalMembers: totalMembersResult[0]?.count ?? 0,
      activeMemberships: activeMembershipsResult[0]?.count ?? 0,
      todayAccess: todayAccessResult[0]?.count ?? 0,
      monthRevenue: parseFloat(monthRevenueResult[0]?.total ?? "0"),
    },
    pendingPayments,
    partialPaymentsEnabled: partialPaymentsConfig.enabled,
  };
}

// ============================================
// COMPONENT
// ============================================

export default function AdminDashboard() {
  const { stats, pendingPayments, partialPaymentsEnabled } = useLoaderData<typeof loader>();

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    });
  };

  const statCards: Array<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    subtitle?: string;
  }> = [
    {
      title: "Miembros Activos",
      value: stats.totalMembers,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      color: "bg-blue-600",
    },
    {
      title: "Membresías Vigentes",
      value: stats.activeMemberships,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
      ),
      color: "bg-green-600",
    },
    {
      title: "Check-ins Hoy",
      value: stats.todayAccess,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "bg-purple-600",
    },
    {
      title: "Ingresos del Mes",
      value: `$${stats.monthRevenue.toLocaleString("es-CO", { minimumFractionDigits: 2 })}`,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "bg-amber-600",
    },
  ];

  // Add pending payments card if enabled
  if (partialPaymentsEnabled) {
    const overdueCount = pendingPayments.filter(p => p.isOverdue).length;
    statCards.push({
      title: "Pagos Pendientes",
      value: pendingPayments.length,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      color: overdueCount > 0 ? "bg-red-600" : "bg-yellow-600",
      subtitle: overdueCount > 0 ? `${overdueCount} en mora` : undefined,
    });
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Resumen general del gimnasio</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 mb-8">
        {statCards.map((card) => (
          <div
            key={card.title}
            className="bg-gray-800 rounded-xl p-6 border border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">{card.title}</p>
                <p className="text-3xl font-bold text-white mt-2">{card.value}</p>
                {card.subtitle && (
                  <p className="text-red-400 text-xs mt-1">{card.subtitle}</p>
                )}
              </div>
              <div className={`${card.color} p-3 rounded-lg text-white`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Placeholder */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">Acciones Rápidas</h2>
          <div className="grid grid-cols-2 gap-4">
            <a
              href="/admin/members"
              className="flex items-center gap-3 p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
            >
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <span className="text-white text-sm font-medium">Nuevo Miembro</span>
            </a>
            <a
              href="/admin/access"
              className="flex items-center gap-3 p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
            >
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <span className="text-white text-sm font-medium">Escanear QR</span>
            </a>
            <a
              href="/admin/payments"
              className="flex items-center gap-3 p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
            >
              <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-white text-sm font-medium">Registrar Pago</span>
            </a>
            <a
              href="/admin/reports"
              className="flex items-center gap-3 p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
            >
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-white text-sm font-medium">Ver Reportes</span>
            </a>
          </div>
        </div>

        {/* Pending Payments or System Info */}
        {partialPaymentsEnabled && pendingPayments.length > 0 ? (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Pagos Pendientes
              </h2>
              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium">
                {pendingPayments.length}
              </span>
            </div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {pendingPayments.slice(0, 5).map((item) => (
                <div
                  key={item.membership.id}
                  className={`p-3 rounded-lg ${
                    item.isOverdue ? "bg-red-500/10 border border-red-500/30" : "bg-yellow-500/10 border border-yellow-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <Link
                        to={`/admin/members/${item.member.id}`}
                        className="text-white font-medium hover:text-blue-400"
                      >
                        {item.member.firstName} {item.member.lastName}
                      </Link>
                      <p className="text-sm text-gray-400">{item.plan.name}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${item.isOverdue ? "text-red-400" : "text-yellow-400"}`}>
                        {formatCurrency(item.pendingAmount)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.isOverdue ? (
                          <span className="text-red-400">Vencido hace {Math.abs(item.daysUntilDeadline)} días</span>
                        ) : item.daysUntilDeadline <= 0 ? (
                          <span className="text-orange-400">Vence hoy</span>
                        ) : (
                          <span>Vence en {item.daysUntilDeadline} días</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {pendingPayments.length > 5 && (
              <Link
                to="/admin/payments"
                className="block mt-4 text-center text-sm text-blue-400 hover:text-blue-300"
              >
                Ver todos ({pendingPayments.length})
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">Estado del Sistema</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <span className="text-gray-300">Base de datos</span>
                <span className="flex items-center gap-2 text-green-400">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  Conectada
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <span className="text-gray-300">Servidor</span>
                <span className="flex items-center gap-2 text-green-400">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  Activo
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <span className="text-gray-300">Sistema de Abonos</span>
                <span className={`flex items-center gap-2 ${partialPaymentsEnabled ? "text-green-400" : "text-gray-400"}`}>
                  <span className={`w-2 h-2 rounded-full ${partialPaymentsEnabled ? "bg-green-400" : "bg-gray-400"}`}></span>
                  {partialPaymentsEnabled ? "Activo" : "Desactivado"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
