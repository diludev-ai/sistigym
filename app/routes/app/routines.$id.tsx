import { useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/routines.$id";
import { requireMemberAuth } from "~/lib/session-member.server";
import { getRoutineById } from "~/lib/services/routine.service.server";
import { difficultyLabels, muscleGroupLabels } from "~/lib/constants";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireMemberAuth(request);
  const routineId = params.id;

  if (!routineId) {
    throw new Response("ID de rutina requerido", { status: 400 });
  }

  const routine = await getRoutineById(routineId);

  if (!routine) {
    throw new Response("Rutina no encontrada", { status: 404 });
  }

  return { routine };
}

export default function RoutineDetailPage() {
  const { routine } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  // Group exercises by muscle group
  const muscleGroups = routine.exercises?.reduce((acc, ex) => {
    const group = ex.exercise?.muscleGroup || "other";
    if (!acc[group]) acc[group] = [];
    acc[group].push(ex);
    return acc;
  }, {} as Record<string, typeof routine.exercises>);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate(-1)} className="p-1 hover:bg-white/10 rounded-lg">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{routine.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {routine.isSystem && (
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Sistema</span>
              )}
              {routine.difficulty && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  routine.difficulty === "beginner" ? "bg-green-400/30" :
                  routine.difficulty === "intermediate" ? "bg-yellow-400/30" :
                  "bg-red-400/30"
                }`}>
                  {difficultyLabels[routine.difficulty]}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Routine Info */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          {routine.description && (
            <p className="text-gray-600 mb-4">{routine.description}</p>
          )}
          {routine.objective && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-500 mb-1">Objetivo</h4>
              <p className="text-gray-900">{routine.objective}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span>{routine.exercises?.length || 0} ejercicios</span>
            </div>
            {routine.estimatedMinutes && (
              <div className="flex items-center gap-2 text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>~{routine.estimatedMinutes} minutos</span>
              </div>
            )}
          </div>
        </div>

        {/* Exercises List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Ejercicios</h3>
          </div>

          {routine.exercises && routine.exercises.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {routine.exercises.map((ex, index) => (
                <div key={index} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-semibold flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium text-gray-900">{ex.exercise?.name}</h4>
                          {ex.exercise?.muscleGroup && (
                            <span className="text-xs text-gray-500">
                              {muscleGroupLabels[ex.exercise.muscleGroup]}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded-lg">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          {ex.sets} series
                        </span>
                        <span className="inline-flex items-center gap-1 text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded-lg">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          {ex.reps} reps
                        </span>
                        {ex.restSeconds && (
                          <span className="inline-flex items-center gap-1 text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded-lg">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {ex.restSeconds}s descanso
                          </span>
                        )}
                      </div>

                      {ex.notes && (
                        <p className="mt-2 text-sm text-gray-500 italic">{ex.notes}</p>
                      )}

                      {ex.exercise?.description && (
                        <p className="mt-2 text-sm text-gray-400">{ex.exercise.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              Esta rutina no tiene ejercicios asignados
            </div>
          )}
        </div>

        {/* Muscle Groups Summary */}
        {muscleGroups && Object.keys(muscleGroups).length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">Musculos Trabajados</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(muscleGroups).map(([group, exercises]) => (
                <span
                  key={group}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm"
                >
                  {muscleGroupLabels[group as keyof typeof muscleGroupLabels] || group} ({exercises?.length})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Creator Info */}
        {routine.createdByMember && (
          <div className="text-center text-sm text-gray-400">
            Creada por {routine.createdByMember.firstName} {routine.createdByMember.lastName}
          </div>
        )}
      </div>
    </div>
  );
}
