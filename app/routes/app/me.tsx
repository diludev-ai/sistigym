import { useLoaderData } from "react-router";
import type { Route } from "./+types/me";
import { requireMemberAuth } from "~/lib/session-member.server";
import {
  getActiveMembershipForMember,
  checkMemberOverdue,
} from "~/lib/services/membership.service.server";
import { getAccessLogs } from "~/lib/services/access.service.server";

// ============================================
// LOADER
// ============================================

export async function loader({ request }: Route.LoaderArgs) {
  const member = await requireMemberAuth(request);

  const [membership, overdueStatus, recentAccess] = await Promise.all([
    getActiveMembershipForMember(member.id),
    checkMemberOverdue(member.id),
    getAccessLogs({ memberId: member.id, limit: 5 }),
  ]);

  return {
    member,
    membership,
    overdueStatus,
    recentAccess,
  };
}

// ============================================
// COMPONENT
// ============================================

export default function ClientProfile() {
  const { member, membership, overdueStatus, recentAccess } =
    useLoaderData<typeof loader>();

  const getStatusBadge = () => {
    if (!membership) {
      return (
        <span className="px-3 py-1 bg-gray-500/20 text-gray-400 rounded-full text-sm">
          Sin membresía
        </span>
      );
    }

    const status = membership.calculatedStatus;

    switch (status) {
      case "active":
        return (
          <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
            Activa
          </span>
        );
      case "expired":
        return (
          <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">
            Expirada
          </span>
        );
      case "frozen":
        return (
          <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
            Congelada
          </span>
        );
      case "cancelled":
        return (
          <span className="px-3 py-1 bg-gray-500/20 text-gray-400 rounded-full text-sm">
            Cancelada
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Mi Cuenta</h1>

      {/* Profile Card */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
            <span className="text-2xl font-bold text-white">
              {member.firstName.charAt(0)}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">
              {member.firstName} {member.lastName}
            </h2>
            <p className="text-gray-400">{member.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Membership Status */}
          <div className="flex justify-between items-center p-4 bg-gray-700 rounded-lg">
            <span className="text-gray-300">Estado Membresía</span>
            {getStatusBadge()}
          </div>

          {/* Plan Name */}
          {membership && (
            <div className="flex justify-between items-center p-4 bg-gray-700 rounded-lg">
              <span className="text-gray-300">Plan</span>
              <span className="text-white font-medium">
                {membership.plan.name}
              </span>
            </div>
          )}

          {/* Days Remaining */}
          <div className="flex justify-between items-center p-4 bg-gray-700 rounded-lg">
            <span className="text-gray-300">Días Restantes</span>
            <span
              className={`font-medium ${
                membership && membership.daysRemaining > 7
                  ? "text-green-400"
                  : membership && membership.daysRemaining > 0
                  ? "text-yellow-400"
                  : "text-red-400"
              }`}
            >
              {membership ? membership.daysRemaining : "--"}
            </span>
          </div>

          {/* End Date */}
          {membership && (
            <div className="flex justify-between items-center p-4 bg-gray-700 rounded-lg">
              <span className="text-gray-300">Vence</span>
              <span className="text-white">
                {new Date(membership.endsAt).toLocaleDateString("es-CO", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          )}

          {/* Morosity Warning */}
          {overdueStatus.isOverdue && (
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
              <div className="flex items-center gap-2 text-red-400">
                <svg
                  className="w-5 h-5"
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
                <span className="font-medium">Cuenta en morosidad</span>
              </div>
              <p className="text-red-300 text-sm mt-2">
                Tu membresía expiró hace {overdueStatus.daysPastDue} días.
                Renueva para continuar accediendo al gimnasio.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Access */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Accesos Recientes
        </h3>

        {recentAccess.length > 0 ? (
          <div className="space-y-3">
            {recentAccess.map((log) => (
              <div
                key={log.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  log.allowed ? "bg-green-500/10" : "bg-red-500/10"
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
                    <p className="text-white text-sm font-medium">
                      {new Date(log.accessedAt).toLocaleDateString("es-CO", {
                        weekday: "long",
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                    <p className="text-gray-400 text-xs uppercase">
                      {log.method}
                    </p>
                  </div>
                </div>
                <span className="text-gray-400 text-sm">
                  {new Date(log.accessedAt).toLocaleTimeString("es-CO", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-center py-4">
            No hay accesos registrados
          </p>
        )}
      </div>
    </div>
  );
}
