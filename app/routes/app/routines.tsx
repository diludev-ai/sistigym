import { useLoaderData, Link, useNavigate } from "react-router";
import type { Route } from "./+types/routines";
import { requireMemberAuth } from "~/lib/session-member.server";
import { getRoutines } from "~/lib/services/routine.service.server";
import { difficultyLabels } from "~/lib/constants";

export async function loader({ request }: Route.LoaderArgs) {
  const member = await requireMemberAuth(request);
  const routines = await getRoutines({ memberId: member.id, active: true });

  // Group routines by type
  const systemRoutines = routines.filter(r => r.isSystem);
  const publicRoutines = routines.filter(r => r.isPublic && !r.isSystem);
  const myRoutines = routines.filter(r => r.createdBy === member.id);

  return { systemRoutines, publicRoutines, myRoutines, memberId: member.id };
}

export default function RoutinesCatalogPage() {
  const { systemRoutines, publicRoutines, myRoutines } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const RoutineCard = ({ routine }: { routine: typeof systemRoutines[0] }) => (
    <Link
      to={`/app/routines/${routine.id}`}
      className="block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-2">
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
      {routine.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{routine.description}</p>
      )}
      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            {routine.exercises?.length || 0} ejercicios
          </span>
          {routine.estimatedMinutes && (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {routine.estimatedMinutes} min
            </span>
          )}
        </div>
        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );

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
          <h1 className="text-xl font-bold">Catalogo de Rutinas</h1>
        </div>
        <p className="text-blue-100 text-sm ml-10">Explora y asigna rutinas a tu semana</p>
      </div>

      <div className="p-4 space-y-6">
        {/* System Routines */}
        {systemRoutines.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-semibold text-gray-900">Rutinas del Gimnasio</h2>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                {systemRoutines.length}
              </span>
            </div>
            <div className="space-y-3">
              {systemRoutines.map((routine) => (
                <RoutineCard key={routine.id} routine={routine} />
              ))}
            </div>
          </section>
        )}

        {/* My Routines */}
        {myRoutines.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-semibold text-gray-900">Mis Rutinas</h2>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {myRoutines.length}
              </span>
            </div>
            <div className="space-y-3">
              {myRoutines.map((routine) => (
                <RoutineCard key={routine.id} routine={routine} />
              ))}
            </div>
          </section>
        )}

        {/* Public Routines */}
        {publicRoutines.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-semibold text-gray-900">Rutinas Publicas</h2>
              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                {publicRoutines.length}
              </span>
            </div>
            <div className="space-y-3">
              {publicRoutines.map((routine) => (
                <RoutineCard key={routine.id} routine={routine} />
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {systemRoutines.length === 0 && publicRoutines.length === 0 && myRoutines.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 text-lg">No hay rutinas disponibles</h3>
            <p className="text-gray-500 mt-1">Las rutinas apareceran aqui cuando esten disponibles</p>
          </div>
        )}

        {/* Create Routine CTA */}
        <div className="pt-4">
          <Link
            to="/app/routines/create"
            className="block w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white text-center py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Crear Mi Propia Rutina
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
