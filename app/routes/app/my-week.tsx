import { useLoaderData, Link } from "react-router";
import type { Route } from "./+types/my-week";
import { requireMemberAuth } from "~/lib/session-member.server";
import { getMemberWeeklyPlan } from "~/lib/services/routine.service.server";
import { dayLabels } from "~/lib/constants";

export async function loader({ request }: Route.LoaderArgs) {
  const member = await requireMemberAuth(request);
  const weekPlan = await getMemberWeeklyPlan(member.id);

  // Get current day of week (0 = Sunday, 6 = Saturday)
  const today = new Date().getDay();

  return { weekPlan, today, member };
}

export default function MyWeekPage() {
  const { weekPlan, today } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
        <h1 className="text-xl font-bold">Mi Semana</h1>
        <p className="text-blue-100 text-sm">Organiza tu rutina semanal</p>
      </div>

      {/* Week View */}
      <div className="p-4 space-y-3">
        {weekPlan.map((day, index) => {
          const isToday = index === today;
          const isRestDay = day.isRestDay;
          const hasRoutine = day.routine || (day.customExercises && day.customExercises.length > 0);

          return (
            <Link
              key={index}
              to={`/app/my-week/${index}`}
              className={`block rounded-xl p-4 transition-all ${
                isToday
                  ? "bg-blue-600 text-white shadow-lg ring-2 ring-blue-300"
                  : "bg-white shadow-sm hover:shadow-md"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${
                    isToday
                      ? "bg-white/20"
                      : isRestDay
                      ? "bg-gray-100 text-gray-400"
                      : hasRoutine
                      ? "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    {dayLabels[index].slice(0, 3)}
                  </div>

                  <div>
                    <p className={`font-semibold ${isToday ? "text-white" : "text-gray-900"}`}>
                      {dayLabels[index]}
                      {isToday && <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-full">Hoy</span>}
                    </p>
                    <p className={`text-sm ${isToday ? "text-blue-100" : "text-gray-500"}`}>
                      {isRestDay ? (
                        "Dia de descanso"
                      ) : day.routine ? (
                        day.routine.name
                      ) : day.customName ? (
                        day.customName
                      ) : (
                        "Sin rutina asignada"
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isRestDay && hasRoutine && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      isToday ? "bg-white/20" : "bg-blue-50 text-blue-600"
                    }`}>
                      {day.routine?.exercises?.length || day.customExercises?.length || 0} ejercicios
                    </span>
                  )}
                  <svg className={`w-5 h-5 ${isToday ? "text-white/60" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>

              {/* Show exercises preview if routine is assigned */}
              {!isRestDay && hasRoutine && (
                <div className={`mt-3 pt-3 border-t ${isToday ? "border-white/20" : "border-gray-100"}`}>
                  <div className="flex flex-wrap gap-1.5">
                    {(day.routine?.exercises || day.customExercises)?.slice(0, 4).map((ex, i) => (
                      <span
                        key={i}
                        className={`text-xs px-2 py-1 rounded-full ${
                          isToday ? "bg-white/10" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {ex.exercise?.name}
                      </span>
                    ))}
                    {(day.routine?.exercises?.length || day.customExercises?.length || 0) > 4 && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        isToday ? "bg-white/10" : "bg-gray-100 text-gray-600"
                      }`}>
                        +{(day.routine?.exercises?.length || day.customExercises?.length || 0) - 4} mas
                      </span>
                    )}
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="fixed bottom-20 left-0 right-0 p-4">
        <Link
          to="/app/routines"
          className="block w-full bg-blue-600 text-white text-center py-3 rounded-xl font-semibold shadow-lg hover:bg-blue-700 transition-colors"
        >
          Ver Catalogo de Rutinas
        </Link>
      </div>
    </div>
  );
}
