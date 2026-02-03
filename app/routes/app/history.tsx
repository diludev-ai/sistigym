import { useLoaderData, Link } from "react-router";
import type { Route } from "./+types/history";
import { requireMemberAuth } from "~/lib/session-member.server";
import { getAccessLogs } from "~/lib/services/access.service.server";
import { getPaymentsForMember } from "~/lib/services/payment.service.server";

// ============================================
// LOADER
// ============================================

export async function loader({ request }: Route.LoaderArgs) {
  const member = await requireMemberAuth(request);

  const url = new URL(request.url);
  const tab = url.searchParams.get("tab") || "accesos";

  // Get access logs and payment history for member
  const [accessLogs, paymentHistory] = await Promise.all([
    getAccessLogs({ memberId: member.id, limit: 50 }),
    getPaymentsForMember(member.id, 50),
  ]);

  return {
    accessLogs,
    paymentHistory,
    tab,
  };
}

// ============================================
// COMPONENT
// ============================================

export default function ClientHistory() {
  const { accessLogs, paymentHistory, tab } = useLoaderData<typeof loader>();

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("es-CO", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (date: string | Date) => {
    return new Date(date).toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
    }).format(Number(amount));
  };

  // Group access logs by date
  const groupedAccessLogs = accessLogs.reduce((groups: Record<string, typeof accessLogs>, log) => {
    const date = new Date(log.accessedAt).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(log);
    return groups;
  }, {});

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Historial</h1>

      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-2">
          <Link
            to="?tab=accesos"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === "accesos"
                ? "bg-green-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            Accesos
          </Link>
          <Link
            to="?tab=pagos"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === "pagos"
                ? "bg-green-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            Pagos
          </Link>
        </div>

        {/* Access Logs Tab */}
        {tab === "accesos" && (
          <div className="space-y-4">
            {Object.keys(groupedAccessLogs).length > 0 ? (
              Object.entries(groupedAccessLogs).map(([date, logs]) => (
                <div key={date} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-700/50 border-b border-gray-700">
                    <h3 className="text-sm font-medium text-gray-300 capitalize">
                      {formatDate(date)}
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-700">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className={`flex items-center justify-between px-4 py-3 ${
                          log.allowed ? "bg-green-500/5" : "bg-red-500/5"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              log.allowed ? "bg-green-500/20" : "bg-red-500/20"
                            }`}
                          >
                            {log.allowed ? (
                              <svg
                                className="w-4 h-4 text-green-400"
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
                            ) : (
                              <svg
                                className="w-4 h-4 text-red-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            )}
                          </div>
                          <div>
                            <p
                              className={`text-sm font-medium ${
                                log.allowed ? "text-green-400" : "text-red-400"
                              }`}
                            >
                              {log.allowed ? "Acceso permitido" : "Acceso denegado"}
                            </p>
                            <p className="text-xs text-gray-500 capitalize">
                              {log.method === "qr" ? "Codigo QR" : "Manual"}
                            </p>
                          </div>
                        </div>
                        <span className="text-gray-400 text-sm">
                          {formatTime(log.accessedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
                <svg
                  className="w-16 h-16 text-gray-600 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-gray-400">No hay accesos registrados</p>
                <p className="text-gray-500 text-sm mt-2">
                  Tus accesos al gimnasio apareceran aqui
                </p>
              </div>
            )}
          </div>
        )}

        {/* Payments Tab */}
        {tab === "pagos" && (
          <div className="space-y-4">
            {paymentHistory.length > 0 ? (
              paymentHistory.map((payment) => (
                <div
                  key={payment.id}
                  className="bg-gray-800 rounded-xl border border-gray-700 p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">
                      {payment.membership?.plan?.name || "Plan"}
                    </span>
                    <span className="text-green-400 font-bold">
                      {formatCurrency(payment.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">
                      {formatDate(payment.paidAt)}
                    </span>
                    <span className="text-gray-500 capitalize">
                      {payment.method === "cash"
                        ? "Efectivo"
                        : payment.method === "card"
                        ? "Tarjeta"
                        : payment.method === "transfer"
                        ? "Transferencia"
                        : payment.method}
                    </span>
                  </div>
                  {payment.notes && (
                    <p className="text-gray-500 text-xs mt-2">{payment.notes}</p>
                  )}
                </div>
              ))
            ) : (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
                <svg
                  className="w-16 h-16 text-gray-600 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <p className="text-gray-400">No hay pagos registrados</p>
                <p className="text-gray-500 text-sm mt-2">
                  Tu historial de pagos aparecera aqui
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
