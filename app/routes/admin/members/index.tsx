import {
  Form,
  Link,
  useLoaderData,
  useSearchParams,
  useNavigation,
  useActionData,
} from "react-router";
import type { Route } from "./+types/index";
import { requireStaffAuth } from "~/lib/session.server";
import {
  getMembers,
  createMember,
  countMembers,
} from "~/lib/services/member.service.server";
import { createMemberSchema } from "~/lib/validations";
import { useState, useEffect } from "react";

// ============================================
// LOADER
// ============================================

export async function loader({ request }: Route.LoaderArgs) {
  await requireStaffAuth(request);

  const url = new URL(request.url);
  const search = url.searchParams.get("search") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  const [members, total] = await Promise.all([
    getMembers({ search, limit, offset }),
    countMembers({ search }),
  ]);

  return {
    members,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    search: search || "",
  };
}

// ============================================
// ACTION
// ============================================

export async function action({ request }: Route.ActionArgs) {
  await requireStaffAuth(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const rawData = {
      email: formData.get("email"),
      password: formData.get("password"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      phone: formData.get("phone") || undefined,
      emergencyContact: formData.get("emergencyContact") || undefined,
      birthDate: formData.get("birthDate") || undefined,
      notes: formData.get("notes") || undefined,
    };

    const result = createMemberSchema.safeParse(rawData);
    if (!result.success) {
      return {
        error: result.error.errors[0]?.message || "Datos inválidos",
        success: false,
      };
    }

    try {
      await createMember(result.data);
      return { success: true, message: "Miembro creado exitosamente" };
    } catch (error: any) {
      if (error.code === "23505") {
        return { error: "Ya existe un miembro con ese email", success: false };
      }
      return { error: "Error al crear miembro", success: false };
    }
  }

  return { error: "Acción no válida", success: false };
}

// ============================================
// COMPONENT
// ============================================

export default function MembersIndex() {
  const { members, total, page, totalPages, search } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showModal, setShowModal] = useState(false);

  const isSubmitting = navigation.state === "submitting";

  // Close modal on successful creation
  useEffect(() => {
    if (actionData?.success) {
      setShowModal(false);
    }
  }, [actionData]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Miembros</h1>
          <p className="text-gray-400 mt-1">
            {total} miembro{total !== 1 ? "s" : ""} registrado
            {total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Miembro
        </button>
      </div>

      {/* Success/Error Messages */}
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

      {/* Search */}
      <div className="mb-6">
        <Form method="get" className="flex gap-4">
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Buscar por nombre, email o teléfono..."
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
          >
            Buscar
          </button>
        </Form>
      </div>

      {/* Members Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700/50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                Nombre
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                Email
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                Teléfono
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                Estado
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                Registro
              </th>
              <th className="px-6 py-4 text-right text-sm font-medium text-gray-300">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {members.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  No se encontraron miembros
                </td>
              </tr>
            ) : (
              members.map((member) => (
                <tr key={member.id} className="hover:bg-gray-700/30 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-white">
                          {member.firstName.charAt(0)}
                          {member.lastName.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-medium">
                          {member.firstName} {member.lastName}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-300">{member.email}</td>
                  <td className="px-6 py-4 text-gray-300">
                    {member.phone || "-"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        member.active
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {member.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">
                    {new Date(member.createdAt).toLocaleDateString("es-CO")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/admin/members/${member.id}`}
                      className="text-blue-400 hover:text-blue-300 transition"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-gray-400 text-sm">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                to={`?page=${page - 1}${search ? `&search=${search}` : ""}`}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
              >
                Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link
                to={`?page=${page + 1}${search ? `&search=${search}` : ""}`}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
              >
                Siguiente
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Create Member Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">
                  Nuevo Miembro
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    required
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Apellido *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    required
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Contraseña *
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Mínimo 6 caracteres</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Teléfono
                </label>
                <input
                  type="tel"
                  name="phone"
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
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition"
                >
                  {isSubmitting ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}
