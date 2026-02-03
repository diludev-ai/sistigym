import { useLoaderData, useFetcher, Form } from "react-router";
import type { Route } from "./+types/exercises";
import { requireStaffAuth } from "~/lib/session.server";
import { getExercises, createExercise, updateExercise, deleteExercise } from "~/lib/services/exercise.service.server";
import { muscleGroupLabels } from "~/lib/constants";
import type { MuscleGroup } from "~/db.server";
import { useState, useEffect } from "react";

export async function loader({ request }: Route.LoaderArgs) {
  await requireStaffAuth(request);
  const url = new URL(request.url);
  const muscleGroup = url.searchParams.get("muscleGroup") as MuscleGroup | null;
  const search = url.searchParams.get("search") || undefined;

  const exercises = await getExercises({
    muscleGroup: muscleGroup || undefined,
    search,
    active: true,
    limit: 200,
  });

  return { exercises, muscleGroup, search };
}

export async function action({ request }: Route.ActionArgs) {
  await requireStaffAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const name = formData.get("name") as string;
    const muscleGroup = formData.get("muscleGroup") as MuscleGroup;
    const description = formData.get("description") as string;
    const equipment = formData.get("equipment") as string;

    await createExercise({
      name,
      muscleGroup,
      description: description || undefined,
      equipment: equipment || undefined,
    });

    return { success: true };
  }

  if (intent === "update") {
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const muscleGroup = formData.get("muscleGroup") as MuscleGroup;
    const description = formData.get("description") as string;
    const equipment = formData.get("equipment") as string;

    await updateExercise(id, {
      name,
      muscleGroup,
      description: description || undefined,
      equipment: equipment || undefined,
    });

    return { success: true };
  }

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await deleteExercise(id);
    return { success: true };
  }

  return { error: "Invalid intent" };
}

export default function AdminExercisesPage() {
  const { exercises, muscleGroup, search } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [showForm, setShowForm] = useState(false);
  const [editingExercise, setEditingExercise] = useState<typeof exercises[0] | null>(null);

  const muscleGroups = Object.entries(muscleGroupLabels) as [MuscleGroup, string][];

  // Close modal on successful action
  useEffect(() => {
    if (fetcher.data?.success) {
      setShowForm(false);
      setEditingExercise(null);
    }
  }, [fetcher.data]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ejercicios</h1>
          <p className="text-gray-600 mt-1">Gestiona el catalogo de ejercicios</p>
        </div>
        <button
          onClick={() => {
            setEditingExercise(null);
            setShowForm(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nuevo Ejercicio
        </button>
      </div>

      {/* Filters */}
      <Form method="get" className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              name="search"
              defaultValue={search || ""}
              placeholder="Buscar ejercicios..."
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            name="muscleGroup"
            defaultValue={muscleGroup || ""}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los grupos</option>
            {muscleGroups.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            Filtrar
          </button>
        </div>
      </Form>

      {/* Exercises Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Nombre</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Grupo Muscular</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Equipo</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {exercises.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  No se encontraron ejercicios
                </td>
              </tr>
            ) : (
              exercises.map((exercise) => (
                <tr key={exercise.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{exercise.name}</p>
                      {exercise.description && (
                        <p className="text-sm text-gray-500 line-clamp-1">{exercise.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                      {muscleGroupLabels[exercise.muscleGroup]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {exercise.equipment || "-"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingExercise(exercise);
                          setShowForm(true);
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 transition"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <fetcher.Form method="post" onSubmit={(e) => {
                        if (!confirm("Eliminar este ejercicio?")) e.preventDefault();
                      }}>
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="id" value={exercise.id} />
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

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-lg">
                {editingExercise ? "Editar Ejercicio" : "Nuevo Ejercicio"}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <fetcher.Form
              method="post"
              className="p-4 space-y-4"
            >
              <input type="hidden" name="intent" value={editingExercise ? "update" : "create"} />
              {editingExercise && <input type="hidden" name="id" value={editingExercise.id} />}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editingExercise?.name || ""}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grupo Muscular *</label>
                <select
                  name="muscleGroup"
                  required
                  defaultValue={editingExercise?.muscleGroup || ""}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar...</option>
                  {muscleGroups.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={editingExercise?.description || ""}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Equipo</label>
                <input
                  type="text"
                  name="equipment"
                  defaultValue={editingExercise?.equipment || ""}
                  placeholder="Ej: Barra, Mancuernas"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {editingExercise ? "Guardar" : "Crear"}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}
    </div>
  );
}
