import { redirect, useLoaderData, useFetcher, Link, useNavigate } from "react-router";
import type { Route } from "./+types/my-week.$day";
import { requireMemberAuth } from "~/lib/session-member.server";
import { getMemberWeeklyPlan, setDayPlan, getRoutines } from "~/lib/services/routine.service.server";
import { dayLabels, difficultyLabels } from "~/lib/constants";
import { useState } from "react";

export async function loader({ request, params }: Route.LoaderArgs) {
  const member = await requireMemberAuth(request);
  const dayOfWeek = parseInt(params.day || "0", 10);

  if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new Response("Dia invalido", { status: 400 });
  }

  const weekPlan = await getMemberWeeklyPlan(member.id);
  const dayPlan = weekPlan[dayOfWeek];
  const routines = await getRoutines({ memberId: member.id, active: true });

  return { dayPlan, dayOfWeek, routines, memberId: member.id };
}

export async function action({ request, params }: Route.ActionArgs) {
  const member = await requireMemberAuth(request);
  const formData = await request.formData();
  const dayOfWeek = parseInt(params.day || "0", 10);

  const intent = formData.get("intent");

  if (intent === "setRoutine") {
    const routineId = formData.get("routineId") as string | null;
    await setDayPlan(member.id, dayOfWeek, {
      routineId: routineId || null,
      isRestDay: false,
    });
  } else if (intent === "setRestDay") {
    await setDayPlan(member.id, dayOfWeek, {
      routineId: null,
      isRestDay: true,
    });
  } else if (intent === "clearDay") {
    await setDayPlan(member.id, dayOfWeek, {
      routineId: null,
      isRestDay: false,
    });
  }

  return redirect(`/app/my-week/${dayOfWeek}`);
}

export default function DayDetailPage() {
  const { dayPlan, dayOfWeek, routines } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [showRoutineSelector, setShowRoutineSelector] = useState(false);

  const isRestDay = dayPlan.isRestDay;
  const hasRoutine = dayPlan.routine || (dayPlan.customExercises && dayPlan.customExercises.length > 0);
  const exercises = dayPlan.routine?.exercises || dayPlan.customExercises || [];

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
          <h1 className="text-xl font-bold">{dayLabels[dayOfWeek]}</h1>
        </div>
        <p className="text-blue-100 text-sm ml-10">
          {isRestDay ? "Dia de descanso" : dayPlan.routine?.name || dayPlan.customName || "Sin rutina"}
        </p>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Current Status */}
        {isRestDay ? (
          <div className="bg-white rounded-xl p-6 text-center shadow-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 text-lg">Dia de Descanso</h3>
            <p className="text-gray-500 mt-1">Recupera tus musculos y energia</p>
          </div>
        ) : hasRoutine ? (
          <>
            {/* Routine Info */}
            {dayPlan.routine && (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{dayPlan.routine.name}</h3>
                  {dayPlan.routine.difficulty && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      dayPlan.routine.difficulty === "beginner" ? "bg-green-100 text-green-700" :
                      dayPlan.routine.difficulty === "intermediate" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {difficultyLabels[dayPlan.routine.difficulty]}
                    </span>
                  )}
                </div>
                {dayPlan.routine.description && (
                  <p className="text-sm text-gray-600 mb-3">{dayPlan.routine.description}</p>
                )}
                <div className="flex gap-4 text-sm text-gray-500">
                  <span>{exercises.length} ejercicios</span>
                  {dayPlan.routine.estimatedMinutes && (
                    <span>~{dayPlan.routine.estimatedMinutes} min</span>
                  )}
                </div>
              </div>
            )}

            {/* Exercises List */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Ejercicios</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {exercises.map((ex, index) => (
                  <div key={index} className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-semibold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{ex.exercise?.name}</p>
                      <p className="text-sm text-gray-500">
                        {ex.sets} series x {ex.reps} reps
                        {ex.restSeconds && ` • ${ex.restSeconds}s descanso`}
                      </p>
                      {ex.notes && (
                        <p className="text-xs text-gray-400 mt-1">{ex.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl p-6 text-center shadow-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 text-lg">Sin rutina asignada</h3>
            <p className="text-gray-500 mt-1">Asigna una rutina o marcalo como descanso</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => setShowRoutineSelector(true)}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            {hasRoutine ? "Cambiar Rutina" : "Asignar Rutina"}
          </button>

          <div className="flex gap-3">
            {!isRestDay && (
              <fetcher.Form method="post" className="flex-1">
                <input type="hidden" name="intent" value="setRestDay" />
                <button
                  type="submit"
                  className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  Marcar Descanso
                </button>
              </fetcher.Form>
            )}

            {(hasRoutine || isRestDay) && (
              <fetcher.Form method="post" className="flex-1">
                <input type="hidden" name="intent" value="clearDay" />
                <button
                  type="submit"
                  className="w-full bg-red-50 text-red-600 py-3 rounded-xl font-semibold hover:bg-red-100 transition-colors"
                >
                  Limpiar Dia
                </button>
              </fetcher.Form>
            )}
          </div>
        </div>
      </div>

      {/* Routine Selector Modal */}
      {showRoutineSelector && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl max-h-[80vh] overflow-hidden animate-slide-up">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="font-semibold text-lg">Seleccionar Rutina</h3>
              <button
                onClick={() => setShowRoutineSelector(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(80vh-60px)] p-4 space-y-3">
              {routines.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No hay rutinas disponibles</p>
              ) : (
                routines.map((routine) => (
                  <fetcher.Form key={routine.id} method="post">
                    <input type="hidden" name="intent" value="setRoutine" />
                    <input type="hidden" name="routineId" value={routine.id} />
                    <button
                      type="submit"
                      onClick={() => setShowRoutineSelector(false)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        dayPlan.routine?.id === routine.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-100 hover:border-blue-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-900">{routine.name}</span>
                        <div className="flex items-center gap-2">
                          {routine.isSystem && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                              Sistema
                            </span>
                          )}
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
                      </div>
                      {routine.description && (
                        <p className="text-sm text-gray-600 mb-2">{routine.description}</p>
                      )}
                      <div className="flex gap-3 text-xs text-gray-500">
                        <span>{routine.exercises?.length || 0} ejercicios</span>
                        {routine.estimatedMinutes && (
                          <span>~{routine.estimatedMinutes} min</span>
                        )}
                      </div>
                    </button>
                  </fetcher.Form>
                ))
              )}

              <Link
                to="/app/routines"
                className="block w-full text-center py-4 text-blue-600 font-medium hover:bg-blue-50 rounded-xl"
                onClick={() => setShowRoutineSelector(false)}
              >
                Ver todas las rutinas
              </Link>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
