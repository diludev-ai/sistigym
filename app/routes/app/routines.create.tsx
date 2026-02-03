import { redirect, useLoaderData, useFetcher, useNavigate } from "react-router";
import type { Route } from "./+types/routines.create";
import { requireMemberAuth } from "~/lib/session-member.server";
import { getExercises } from "~/lib/services/exercise.service.server";
import { muscleGroupLabels } from "~/lib/constants";
import { createRoutine, type Difficulty } from "~/lib/services/routine.service.server";
import { useState } from "react";

export async function loader({ request }: Route.LoaderArgs) {
  await requireMemberAuth(request);
  const exercises = await getExercises({ active: true, limit: 200 });

  // Group by muscle group
  const grouped = exercises.reduce((acc, ex) => {
    if (!acc[ex.muscleGroup]) acc[ex.muscleGroup] = [];
    acc[ex.muscleGroup].push(ex);
    return acc;
  }, {} as Record<string, typeof exercises>);

  return { exercisesByGroup: grouped };
}

export async function action({ request }: Route.ActionArgs) {
  const member = await requireMemberAuth(request);
  const formData = await request.formData();

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const difficulty = formData.get("difficulty") as Difficulty;
  const exercisesJson = formData.get("exercises") as string;

  if (!name || !exercisesJson) {
    return { error: "Nombre y ejercicios son requeridos" };
  }

  try {
    const exercises = JSON.parse(exercisesJson);

    const routine = await createRoutine({
      name,
      description,
      difficulty,
      isPublic: false,
      isSystem: false,
      createdBy: member.id,
      exercises: exercises.map((ex: { id: string; sets: number; reps: string; rest: number }) => ({
        exerciseId: ex.id,
        sets: ex.sets,
        reps: ex.reps,
        restSeconds: ex.rest,
      })),
    });

    return redirect(`/app/routines/${routine.id}`);
  } catch {
    return { error: "Error al crear la rutina" };
  }
}

export default function CreateRoutinePage() {
  const { exercisesByGroup } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [selectedExercises, setSelectedExercises] = useState<Array<{
    id: string;
    name: string;
    muscleGroup: string;
    sets: number;
    reps: string;
    rest: number;
  }>>([]);
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const addExercise = (exercise: { id: string; name: string; muscleGroup: string }) => {
    setSelectedExercises((prev) => [
      ...prev,
      { ...exercise, sets: 3, reps: "10", rest: 60 },
    ]);
    setShowExerciseSelector(false);
    setSelectedGroup(null);
  };

  const removeExercise = (index: number) => {
    setSelectedExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const updateExercise = (index: number, field: string, value: string | number) => {
    setSelectedExercises((prev) =>
      prev.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex))
    );
  };

  const moveExercise = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= selectedExercises.length) return;

    const newExercises = [...selectedExercises];
    [newExercises[index], newExercises[newIndex]] = [newExercises[newIndex], newExercises[index]];
    setSelectedExercises(newExercises);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      alert("Por favor ingresa un nombre para la rutina");
      return;
    }
    if (selectedExercises.length === 0) {
      alert("Por favor agrega al menos un ejercicio");
      return;
    }

    fetcher.submit(
      {
        name,
        description,
        difficulty,
        exercises: JSON.stringify(selectedExercises),
      },
      { method: "post" }
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1 hover:bg-white/10 rounded-lg">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">Crear Rutina</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Basic Info */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la rutina *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Mi rutina de pecho"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripcion (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe tu rutina..."
              rows={2}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dificultad
            </label>
            <div className="flex gap-2">
              {(["beginner", "intermediate", "advanced"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficulty(level)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
                    difficulty === level
                      ? level === "beginner"
                        ? "bg-green-500 text-white"
                        : level === "intermediate"
                        ? "bg-yellow-500 text-white"
                        : "bg-red-500 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {level === "beginner" ? "Principiante" : level === "intermediate" ? "Intermedio" : "Avanzado"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Exercises List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              Ejercicios ({selectedExercises.length})
            </h3>
            <button
              onClick={() => setShowExerciseSelector(true)}
              className="text-blue-600 font-medium text-sm flex items-center gap-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Agregar
            </button>
          </div>

          {selectedExercises.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No hay ejercicios agregados</p>
              <button
                onClick={() => setShowExerciseSelector(true)}
                className="mt-3 text-blue-600 font-medium"
              >
                Agregar primer ejercicio
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {selectedExercises.map((ex, index) => (
                <div key={index} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveExercise(index, "up")}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveExercise(index, "down")}
                        disabled={index === selectedExercises.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">{ex.name}</p>
                          <p className="text-xs text-gray-500">
                            {muscleGroupLabels[ex.muscleGroup as keyof typeof muscleGroupLabels]}
                          </p>
                        </div>
                        <button
                          onClick={() => removeExercise(index)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-xs text-gray-500">Series</label>
                          <input
                            type="number"
                            value={ex.sets}
                            onChange={(e) => updateExercise(index, "sets", parseInt(e.target.value) || 1)}
                            min={1}
                            max={10}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-center text-sm"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-gray-500">Reps</label>
                          <input
                            type="text"
                            value={ex.reps}
                            onChange={(e) => updateExercise(index, "reps", e.target.value)}
                            placeholder="10-12"
                            className="w-full px-2 py-1 border border-gray-200 rounded text-center text-sm"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-gray-500">Descanso</label>
                          <select
                            value={ex.rest}
                            onChange={(e) => updateExercise(index, "rest", parseInt(e.target.value))}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                          >
                            <option value={30}>30s</option>
                            <option value={45}>45s</option>
                            <option value={60}>60s</option>
                            <option value={90}>90s</option>
                            <option value={120}>2min</option>
                            <option value={180}>3min</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={fetcher.state !== "idle" || !name.trim() || selectedExercises.length === 0}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {fetcher.state !== "idle" ? "Creando..." : "Crear Rutina"}
        </button>
      </div>

      {/* Exercise Selector Modal */}
      {showExerciseSelector && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-lg">
                {selectedGroup ? muscleGroupLabels[selectedGroup as keyof typeof muscleGroupLabels] : "Seleccionar Grupo Muscular"}
              </h3>
              <button
                onClick={() => {
                  if (selectedGroup) {
                    setSelectedGroup(null);
                  } else {
                    setShowExerciseSelector(false);
                  }
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                {selectedGroup ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(85vh-60px)] p-4">
              {!selectedGroup ? (
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(exercisesByGroup).map(([group, exercises]) => (
                    <button
                      key={group}
                      onClick={() => setSelectedGroup(group)}
                      className="p-4 bg-gray-50 rounded-xl text-left hover:bg-gray-100 transition"
                    >
                      <p className="font-medium text-gray-900">
                        {muscleGroupLabels[group as keyof typeof muscleGroupLabels]}
                      </p>
                      <p className="text-sm text-gray-500">{exercises.length} ejercicios</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {exercisesByGroup[selectedGroup]?.map((exercise) => {
                    const isSelected = selectedExercises.some((e) => e.id === exercise.id);
                    return (
                      <button
                        key={exercise.id}
                        onClick={() => !isSelected && addExercise({
                          id: exercise.id,
                          name: exercise.name,
                          muscleGroup: exercise.muscleGroup,
                        })}
                        disabled={isSelected}
                        className={`w-full p-4 rounded-xl text-left transition ${
                          isSelected
                            ? "bg-green-50 border-2 border-green-200"
                            : "bg-gray-50 hover:bg-gray-100"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{exercise.name}</p>
                            {exercise.equipment && (
                              <p className="text-sm text-gray-500">{exercise.equipment}</p>
                            )}
                          </div>
                          {isSelected && (
                            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
