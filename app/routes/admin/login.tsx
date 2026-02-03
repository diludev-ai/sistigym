import { Form, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/login";
import {
  authenticateStaff,
  createStaffSession,
} from "~/lib/auth.server";
import {
  staffSessionCookie,
  getOptionalStaffAuth,
} from "~/lib/session.server";
import { loginSchema } from "~/lib/validations";

// ============================================
// LOADER: Redirect if already logged in
// ============================================

export async function loader({ request }: Route.LoaderArgs) {
  const staff = await getOptionalStaffAuth(request);
  if (staff) {
    return redirect("/admin/dashboard");
  }
  return null;
}

// ============================================
// ACTION: Handle login form submission
// ============================================

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  // Validate input
  const result = loginSchema.safeParse(rawData);
  if (!result.success) {
    return {
      error: result.error.errors[0]?.message || "Datos inválidos",
    };
  }

  const { email, password } = result.data;

  // Authenticate
  const staff = await authenticateStaff(email, password);
  if (!staff) {
    return { error: "Credenciales inválidas" };
  }

  // Create session
  const ipAddress =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    undefined;
  const userAgent = request.headers.get("user-agent") || undefined;

  const sessionToken = await createStaffSession(staff.id, ipAddress, userAgent);

  // Set cookie and redirect
  return redirect("/admin/dashboard", {
    headers: {
      "Set-Cookie": await staffSessionCookie.serialize(sessionToken),
    },
  });
}

// ============================================
// COMPONENT
// ============================================

export default function AdminLogin() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="bg-gray-800 rounded-lg shadow-xl p-8">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Panel de Administración</h1>
            <p className="text-gray-400 mt-2">Inicia sesión para continuar</p>
          </div>

          {/* Error Message */}
          {actionData?.error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm text-center">{actionData.error}</p>
            </div>
          )}

          {/* Login Form */}
          <Form method="post" className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                autoComplete="email"
                autoFocus
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="admin@gym.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Contraseña
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Iniciando sesión...
                </span>
              ) : (
                "Iniciar Sesión"
              )}
            </button>
          </Form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          Sistema de Gestión de Gimnasio
        </p>
      </div>
    </div>
  );
}
