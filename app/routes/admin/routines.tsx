import { useLoaderData, useFetcher, Link } from "react-router";
import type { Route } from "./+types/routines";
import { requireStaffAuth } from "~/lib/session.server";
import { getRoutines, deleteRoutine } from "~/lib/services/routine.service.server";
import { difficultyLabels } from "~/lib/constants";

export async function loader({ request }: Route.LoaderArgs) {
  await requireStaffAuth(request);

  const routines = await getRoutines({ active: true, limit: 200 });

  return { routines };
}

export async function action({ request }: Route.ActionArgs) {
  await requireStaffAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await deleteRoutine(id);
    return { success: true };
  }

  return { error: "Invalid intent" };
}

export default function AdminRoutinesPage() {
  const { routines } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const systemRoutines = routines.filter(r => r.isSystem);
  const userRoutines = routines.filter(r => !r.isSystem);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rutinas</h1>
          <p className="text-gray-600 mt-1">Gestiona las rutinas del gimnasio</p>
        </div>
        <Link
          to="/admin/routines/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 w-fit"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nueva Rutina
        </Link>
      </div>

      {/* System Routines */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
          Rutinas del Sistema ({systemRoutines.length})
        </h2>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {systemRoutines.map((routine) => (
            <div key={routine.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{routine.name}</h3>
                  {routine.difficulty && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      routine.difficulty === "beginner" ? "bg-green-100 text-green-700" :
                      routine.difficulty === "intermediate" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {difficultyLabels[routine.difficulty]}
                    </span>
                  )}
                </div>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                  Sistema
                </span>
              </div>

              {routine.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{routine.description}</p>
              )}

              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>{routine.exercises?.length || 0} ejercicios</span>
                {routine.estimatedMinutes && (
                  <span>~{routine.estimatedMinutes} min</span>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end gap-2">
                <Link
                  to={`/admin/routines/${routine.id}`}
                  className="px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition"
                >
                  Ver
                </Link>
                <Link
                  to={`/admin/routines/${routine.id}/edit`}
                  className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition"
                >
                  Editar
                </Link>
              </div>
            </div>
          ))}

          {systemRoutines.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-500">
              No hay rutinas del sistema
            </div>
          )}
        </div>
      </div>

      {/* User Routines */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
          Rutinas de Usuarios ({userRoutines.length})
        </h2>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Rutina</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Dificultad</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Ejercicios</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Visibilidad</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {userRoutines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No hay rutinas de usuarios
                  </td>
                </tr>
              ) : (
                userRoutines.map((routine) => (
                  <tr key={routine.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{routine.name}</p>
                        {routine.description && (
                          <p className="text-sm text-gray-500 line-clamp-1">{routine.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {routine.difficulty && (
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          routine.difficulty === "beginner" ? "bg-green-100 text-green-700" :
                          routine.difficulty === "intermediate" ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {difficultyLabels[routine.difficulty]}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {routine.exercises?.length || 0}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        routine.isPublic ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {routine.isPublic ? "Publica" : "Privada"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/admin/routines/${routine.id}`}
                          className="p-2 text-gray-400 hover:text-blue-600 transition"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                        <fetcher.Form method="post" onSubmit={(e) => {
                          if (!confirm("Eliminar esta rutina?")) e.preventDefault();
                        }}>
                          <input type="hidden" name="intent" value="delete" />
                          <input type="hidden" name="id" value={routine.id} />
                          <button
                            type="submit"
                            className="p-2 text-gray-400 hover:text-red-600 transition"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </fetcher.Form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
