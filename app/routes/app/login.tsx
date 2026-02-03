import { Form, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/login";
import {
  authenticateMember,
  createMemberSession,
} from "~/lib/auth-member.server";
import {
  memberSessionCookie,
  getOptionalMemberAuth,
} from "~/lib/session-member.server";
import { loginSchema } from "~/lib/validations";

// ============================================
// LOADER: Redirect if already logged in
// ============================================

export async function loader({ request }: Route.LoaderArgs) {
  const member = await getOptionalMemberAuth(request);
  if (member) {
    return redirect("/app/me");
  }
  return null;
}

// ============================================
// ACTION: Handle login
// ============================================

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const result = loginSchema.safeParse(rawData);
  if (!result.success) {
    return { error: result.error.errors[0]?.message || "Datos inválidos" };
  }

  const { email, password } = result.data;

  const member = await authenticateMember(email, password);
  if (!member) {
    return { error: "Credenciales inválidas" };
  }

  const ipAddress =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    undefined;
  const userAgent = request.headers.get("user-agent") || undefined;

  const sessionToken = await createMemberSession(member.id, ipAddress, userAgent);

  return redirect("/app/me", {
    headers: {
      "Set-Cookie": await memberSessionCookie.serialize(sessionToken),
    },
  });
}

// ============================================
// COMPONENT
// ============================================

export default function ClientLogin() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mb-4">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Mi Gimnasio</h1>
            <p className="text-gray-400 mt-2">Accede a tu cuenta</p>
          </div>

          {/* Error Message */}
          {actionData?.error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl">
              <p className="text-red-400 text-sm text-center">
                {actionData.error}
              </p>
            </div>
          )}

          {/* Login Form */}
          <Form method="post" className="space-y-5">
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
                className="w-full px-4 py-3.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                placeholder="tu@email.com"
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
                className="w-full px-4 py-3.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Ingresando...
                </span>
              ) : (
                "Ingresar"
              )}
            </button>
          </Form>
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Portal de Clientes
        </p>
      </div>
    </div>
  );
}
