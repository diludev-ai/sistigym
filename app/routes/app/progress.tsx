export default function ClientProgress() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Mi Progreso</h1>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Últimas Medidas</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm">Peso</p>
            <p className="text-2xl font-bold text-white">-- kg</p>
          </div>
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm">Altura</p>
            <p className="text-2xl font-bold text-white">-- cm</p>
          </div>
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm">% Grasa</p>
            <p className="text-2xl font-bold text-white">-- %</p>
          </div>
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm">Masa Muscular</p>
            <p className="text-2xl font-bold text-white">-- kg</p>
          </div>
        </div>
      </div>

      <button className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition">
        + Registrar Medidas
      </button>

      <p className="text-center text-gray-500 mt-6">Próximamente en Fase 4</p>
    </div>
  );
}
