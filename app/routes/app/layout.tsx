import { Outlet, NavLink, Form, useLoaderData, redirect, Link } from "react-router";
import type { Route } from "./+types/layout";
import { requireMemberAuth, memberSessionCookie } from "~/lib/session-member.server";
import { checkMemberPaymentAccess } from "~/lib/services/membership.service.server";
import { getPartialPaymentsConfig } from "~/lib/services/settings.service.server";

// ============================================
// LOADER
// ============================================

export async function loader({ request }: Route.LoaderArgs) {
  const member = await requireMemberAuth(request);

  // Check payment status
  const config = await getPartialPaymentsConfig();
  let paymentInfo = null;

  if (config.enabled) {
    const paymentAccess = await checkMemberPaymentAccess(member.id);
    if (paymentAccess.paymentInfo && paymentAccess.paymentInfo.pendingAmount > 0) {
      paymentInfo = paymentAccess.paymentInfo;
    }
  }

  return { member, paymentInfo };
}

// ============================================
// ACTION
// ============================================

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "logout") {
    return redirect("/app/login", {
      headers: {
        "Set-Cookie": await memberSessionCookie.serialize("", { maxAge: 0 }),
      },
    });
  }

  return null;
}

// ============================================
// COMPONENT
// ============================================

export default function ClientLayout() {
  const { member, paymentInfo } = useLoaderData<typeof loader>();

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 pb-20">
      {/* Payment Pending Banner */}
      {paymentInfo && paymentInfo.pendingAmount > 0 && (
        <div
          className={`px-4 py-3 ${
            paymentInfo.isOverduePayment
              ? "bg-red-500/20 border-b border-red-500/50"
              : "bg-yellow-500/20 border-b border-yellow-500/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-full ${
                paymentInfo.isOverduePayment ? "bg-red-500/30" : "bg-yellow-500/30"
              }`}
            >
              <svg
                className={`w-5 h-5 ${
                  paymentInfo.isOverduePayment ? "text-red-400" : "text-yellow-400"
                }`}
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
            </div>
            <div className="flex-1">
              <p
                className={`font-medium text-sm ${
                  paymentInfo.isOverduePayment ? "text-red-400" : "text-yellow-400"
                }`}
              >
                {paymentInfo.isOverduePayment ? "Pago vencido" : "Pago pendiente"}
              </p>
              <p className="text-gray-300 text-xs">
                Saldo: {formatCurrency(paymentInfo.pendingAmount)}
                {paymentInfo.daysUntilDeadline !== null && paymentInfo.daysUntilDeadline > 0 && (
                  <span className="text-gray-400">
                    {" "}• Vence en {paymentInfo.daysUntilDeadline} día
                    {paymentInfo.daysUntilDeadline !== 1 ? "s" : ""}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">
                {member.firstName.charAt(0)}
              </span>
            </div>
            <div>
              <p className="text-white font-medium text-sm">
                {member.firstName} {member.lastName}
              </p>
              <p className="text-gray-400 text-xs">{member.email}</p>
            </div>
          </div>
          <Form method="post">
            <input type="hidden" name="intent" value="logout" />
            <button
              type="submit"
              className="p-2 text-gray-400 hover:text-white transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </Form>
        </div>
      </header>

      {/* Main content */}
      <main>
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 safe-area-inset-bottom">
        <div className="flex justify-around py-2">
          <NavLink
            to="/app/me"
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition ${
                isActive ? "text-green-400" : "text-gray-400"
              }`
            }
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs font-medium">Cuenta</span>
          </NavLink>

          <NavLink
            to="/app/qr"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition ${
                isActive ? "text-green-400" : "text-gray-400"
              }`
            }
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <span className="text-xs font-medium">QR</span>
          </NavLink>

          <NavLink
            to="/app/my-week"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition ${
                isActive ? "text-green-400" : "text-gray-400"
              }`
            }
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-medium">Mi Semana</span>
          </NavLink>

          <NavLink
            to="/app/history"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition ${
                isActive ? "text-green-400" : "text-gray-400"
              }`
            }
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium">Historial</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
