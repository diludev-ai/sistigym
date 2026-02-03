import {
  Form,
  useLoaderData,
  useNavigation,
  useActionData,
  useFetcher,
} from "react-router";
import type { Route } from "./+types/access";
import { requireStaffAuth } from "~/lib/session.server";
import {
  registerManualAccess,
  validateQrToken,
  getAccessLogs,
  getTodayAccessStats,
} from "~/lib/services/access.service.server";
import { getMembers } from "~/lib/services/member.service.server";
import { useState, useEffect, useRef, lazy, Suspense, useCallback } from "react";

// Lazy load the QR scanner (client-side only)
const QrScanner = lazy(() => import("~/components/QrScanner"));

// ============================================
// LOADER
// ============================================

export async function loader({ request }: Route.LoaderArgs) {
  await requireStaffAuth(request);

  const [recentLogs, todayStats, members] = await Promise.all([
    getAccessLogs({ limit: 20 }),
    getTodayAccessStats(),
    getMembers({ limit: 100 }),
  ]);

  return {
    recentLogs,
    todayStats,
    members,
  };
}

// ============================================
// ACTION
// ============================================

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaffAuth(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "check-recent-access") {
    const memberId = formData.get("memberId") as string;
    if (!memberId) {
      return { hasRecentAccess: false, minutesAgo: 0 };
    }

    // Check if member entered recently (last 10 minutes)
    const { checkRecentAccess } = await import("~/lib/services/access.service.server");
    const recentAccess = await checkRecentAccess(memberId, 10);

    return {
      hasRecentAccess: !!recentAccess,
      minutesAgo: recentAccess ? Math.floor((Date.now() - new Date(recentAccess.accessedAt).getTime()) / 60000) : 0,
      memberName: recentAccess ? `${recentAccess.member.firstName} ${recentAccess.member.lastName}` : null,
    };
  }

  if (intent === "manual-checkin") {
    const memberId = formData.get("memberId") as string;
    const forceEntry = formData.get("force") === "true";

    if (!memberId) {
      return {
        success: false,
        result: null,
        error: "Selecciona un miembro",
      };
    }

    try {
      const { validation } = await registerManualAccess(memberId, staff.id, forceEntry);
      return {
        success: true,
        result: validation,
        error: null,
      };
    } catch (error: any) {
      return {
        success: false,
        result: null,
        error: error.message || "Error al registrar acceso",
      };
    }
  }

  if (intent === "qr-checkin") {
    const token = formData.get("token") as string;

    if (!token) {
      return {
        success: false,
        result: null,
        error: "Token QR no proporcionado",
      };
    }

    try {
      const { validation } = await validateQrToken(token, staff.id);
      return {
        success: true,
        result: validation,
        error: null,
      };
    } catch (error: any) {
      if (error.message === "TOKEN_INVALID") {
        return {
          success: false,
          result: {
            allowed: false,
            reason: "Token QR invalido o no existe",
          },
          error: null,
        };
      }
      return {
        success: false,
        result: null,
        error: error.message || "Error al validar QR",
      };
    }
  }

  return {
    success: false,
    result: null,
    error: "Accion no valida",
  };
}

// ============================================
// COMPONENT
// ============================================

export default function AccessPage() {
  const { recentLogs, todayStats, members } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const fetcher = useFetcher<typeof action>();

  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [qrInput, setQrInput] = useState("");
  const [scanMode, setScanMode] = useState<"input" | "camera">("input");
  const [showResultPopup, setShowResultPopup] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState<{ memberName: string; minutesAgo: number } | null>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);
  const checkAccessFetcher = useFetcher();
  const manualCheckinFetcher = useFetcher<typeof action>();

  const isSubmitting = navigation.state === "submitting";
  const isFetcherSubmitting = fetcher.state === "submitting";

  // Get the latest result (from form submit or fetcher)
  const currentResult = manualCheckinFetcher.data || fetcher.data || actionData;

  // Handle check-recent-access response
  useEffect(() => {
    if (checkAccessFetcher.data && checkAccessFetcher.state === "idle") {
      const data = checkAccessFetcher.data as { hasRecentAccess: boolean; minutesAgo: number; memberName: string | null };
      if (data.hasRecentAccess) {
        setConfirmData({ memberName: data.memberName || "Usuario", minutesAgo: data.minutesAgo });
        setShowConfirmModal(true);
      } else {
        // No recent access, proceed with check-in
        const formData = new FormData();
        formData.set("intent", "manual-checkin");
        formData.set("memberId", selectedMemberId);
        manualCheckinFetcher.submit(formData, { method: "post" });
      }
    }
  }, [checkAccessFetcher.data, checkAccessFetcher.state]);

  // Sound functions using Web Audio API
  const playBeep = useCallback((frequency: number, duration: number, type: OscillatorType = "sine") => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;
      gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
      console.error("Error playing sound:", e);
    }
  }, []);

  const playSuccessSound = useCallback(() => {
    // Two ascending tones for success
    playBeep(800, 0.15);
    setTimeout(() => playBeep(1200, 0.2), 150);
  }, [playBeep]);

  const playErrorSound = useCallback(() => {
    // Low buzzer sound for error
    playBeep(300, 0.3, "square");
    setTimeout(() => playBeep(200, 0.4, "square"), 200);
  }, [playBeep]);

  // Play sound when result arrives
  const lastResultRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentResult?.result) {
      const resultKey = JSON.stringify(currentResult.result);
      if (lastResultRef.current !== resultKey) {
        lastResultRef.current = resultKey;
        if (currentResult.result.allowed) {
          playSuccessSound();
        } else {
          playErrorSound();
        }
      }
    }
  }, [currentResult, playSuccessSound, playErrorSound]);

  // Filter members by search
  const filteredMembers = members.filter((m) => {
    const query = searchQuery.toLowerCase();
    return (
      m.firstName.toLowerCase().includes(query) ||
      m.lastName.toLowerCase().includes(query) ||
      m.email.toLowerCase().includes(query)
    );
  });

  // Auto-focus QR input when in input mode
  useEffect(() => {
    if (scanMode === "input") {
      qrInputRef.current?.focus();
    }
  }, [scanMode]);

  // Show popup and auto-close after 4 seconds
  useEffect(() => {
    if (currentResult?.result) {
      setShowResultPopup(true);
      const timer = setTimeout(() => {
        setShowResultPopup(false);
        setQrInput("");
        setSelectedMemberId("");
        if (scanMode === "input") {
          qrInputRef.current?.focus();
        }
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [currentResult, scanMode]);

  // Handle camera scan
  const handleCameraScan = (token: string) => {
    if (!isFetcherSubmitting) {
      const formData = new FormData();
      formData.set("intent", "qr-checkin");
      formData.set("token", token);
      fetcher.submit(formData, { method: "post" });
    }
  };

  const renderResultPopup = () => {
    if (!showResultPopup || !currentResult?.result) return null;

    const { allowed, reason, member, membership, paymentWarning, paymentInfo } = currentResult.result;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={() => setShowResultPopup(false)}
      >
        <div
          className={`mx-4 w-full max-w-md rounded-3xl p-8 text-center shadow-2xl transform transition-all ${
            allowed
              ? "bg-gradient-to-b from-green-900 to-gray-900 border-2 border-green-500"
              : "bg-gradient-to-b from-red-900 to-gray-900 border-2 border-red-500"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={`w-28 h-28 mx-auto rounded-full flex items-center justify-center mb-6 ${
              allowed ? "bg-green-500 shadow-lg shadow-green-500/50" : "bg-red-500 shadow-lg shadow-red-500/50"
            }`}
          >
            {allowed ? (
              <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>

          <h2
            className={`text-5xl font-bold mb-3 ${
              allowed ? "text-green-400" : "text-red-400"
            }`}
          >
            {allowed ? "APROBADO" : "DENEGADO"}
          </h2>

          {member && (
            <p className="text-3xl text-white font-semibold mb-2">
              {member.firstName} {member.lastName}
            </p>
          )}

          <p
            className={`text-xl ${allowed ? "text-green-300" : "text-red-300"}`}
          >
            {reason}
          </p>

          {/* Payment Warning Alert */}
          {allowed && paymentWarning && (
            <div className="mt-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-xl">
              <div className="flex items-center justify-center gap-2 text-yellow-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-bold text-lg">PAGO PENDIENTE</span>
              </div>
              <p className="text-yellow-300 mt-2">{paymentWarning}</p>
            </div>
          )}

          {/* Payment Info when denied due to payment */}
          {!allowed && paymentInfo && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-red-300">
                <strong>Total:</strong> ${paymentInfo.totalAmount?.toLocaleString()}
              </p>
              <p className="text-red-300">
                <strong>Abonado:</strong> ${paymentInfo.paidAmount?.toLocaleString()}
              </p>
              <p className="text-red-300">
                <strong>Pendiente:</strong> ${paymentInfo.pendingAmount?.toLocaleString()}
              </p>
            </div>
          )}

          {membership && allowed && (
            <div className="mt-6 p-4 bg-gray-800/80 rounded-xl">
              <p className="text-gray-300 text-lg">
                Plan: <span className="text-white font-semibold">{membership.planName}</span>
              </p>
              <p className="text-gray-300 text-lg">
                Días restantes:{" "}
                <span className="text-white font-bold text-2xl">
                  {membership.daysRemaining}
                </span>
              </p>
            </div>
          )}

          {/* Close hint */}
          <p className="mt-6 text-gray-500 text-sm">
            Toca para cerrar o espera 4 segundos
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Control de Acceso</h1>
        <p className="text-gray-400 mt-1">
          Escanea QR o registra entrada manual
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 text-center">
          <p className="text-gray-400 text-sm">Accesos Hoy</p>
          <p className="text-3xl font-bold text-white">{todayStats.total}</p>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 text-center">
          <p className="text-gray-400 text-sm">Aprobados</p>
          <p className="text-3xl font-bold text-green-400">{todayStats.allowed}</p>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 text-center">
          <p className="text-gray-400 text-sm">Denegados</p>
          <p className="text-3xl font-bold text-red-400">{todayStats.denied}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Check-in Methods */}
        <div className="space-y-6">
          {/* QR Scanner Section */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                Escanear QR
              </h2>

              {/* Mode Toggle */}
              <div className="flex bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setScanMode("input")}
                  className={`px-3 py-1 text-sm rounded-md transition ${
                    scanMode === "input"
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Texto
                </button>
                <button
                  onClick={() => setScanMode("camera")}
                  className={`px-3 py-1 text-sm rounded-md transition ${
                    scanMode === "camera"
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Camara
                </button>
              </div>
            </div>

            {scanMode === "input" ? (
              <Form method="post">
                <input type="hidden" name="intent" value="qr-checkin" />
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Escanea o pega el codigo QR
                    </label>
                    <input
                      ref={qrInputRef}
                      type="text"
                      name="token"
                      value={qrInput}
                      onChange={(e) => setQrInput(e.target.value)}
                      autoFocus
                      autoComplete="off"
                      className="w-full px-4 py-4 bg-gray-700 border border-gray-600 rounded-lg text-white text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Token QR..."
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting || !qrInput}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition"
                  >
                    {isSubmitting ? "Verificando..." : "Verificar QR"}
                  </button>
                </div>
              </Form>
            ) : (
              <Suspense
                fallback={
                  <div className="aspect-square bg-gray-900 rounded-xl flex items-center justify-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                }
              >
                <QrScanner
                  onScan={handleCameraScan}
                  isProcessing={isFetcherSubmitting}
                />
              </Suspense>
            )}
          </div>

          {/* Manual Check-in */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Check-in Manual
            </h2>

            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar miembro..."
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2">
                {filteredMembers.slice(0, 10).map((member) => (
                  <label
                    key={member.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${
                      selectedMemberId === member.id
                        ? "bg-blue-600"
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="memberId"
                      value={member.id}
                      checked={selectedMemberId === member.id}
                      onChange={(e) => setSelectedMemberId(e.target.value)}
                      className="sr-only"
                    />
                    <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-white">
                        {member.firstName.charAt(0)}
                        {member.lastName.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">
                        {member.firstName} {member.lastName}
                      </p>
                      <p className="text-gray-400 text-sm truncate">
                        {member.email}
                      </p>
                    </div>
                  </label>
                ))}
                {filteredMembers.length === 0 && (
                  <p className="text-gray-400 text-center py-4">
                    No se encontraron miembros
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={checkAccessFetcher.state !== "idle" || manualCheckinFetcher.state !== "idle" || !selectedMemberId}
                onClick={() => {
                  const formData = new FormData();
                  formData.set("intent", "check-recent-access");
                  formData.set("memberId", selectedMemberId);
                  checkAccessFetcher.submit(formData, { method: "post" });
                }}
                className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition"
              >
                {checkAccessFetcher.state !== "idle" || manualCheckinFetcher.state !== "idle" ? "Registrando..." : "Registrar Entrada"}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Recent Access Logs */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Accesos Recientes
          </h2>

          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {recentLogs.map((log) => (
              <div
                key={log.id}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  log.allowed ? "bg-green-500/10" : "bg-red-500/10"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    log.allowed ? "bg-green-500/20" : "bg-red-500/20"
                  }`}
                >
                  {log.allowed ? (
                    <svg
                      className="w-5 h-5 text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5 text-red-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">
                    {log.member.firstName} {log.member.lastName}
                  </p>
                  <p
                    className={`text-sm truncate ${
                      log.allowed ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {log.reason}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-gray-400 text-sm">
                    {new Date(log.accessedAt).toLocaleTimeString("es-CO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-gray-500 text-xs uppercase">
                    {log.method}
                  </p>
                </div>
              </div>
            ))}

            {recentLogs.length === 0 && (
              <p className="text-gray-400 text-center py-8">
                No hay accesos registrados hoy
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Result Popup */}
      {renderResultPopup()}

      {/* Confirmation Modal */}
      {showConfirmModal && confirmData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto bg-yellow-500/20 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                Usuario ya ingresó
              </h3>
              <p className="text-gray-300">
                <span className="font-semibold text-white">{confirmData.memberName}</span> ya ingresó hace{" "}
                <span className="font-semibold text-yellow-400">{confirmData.minutesAgo} minuto{confirmData.minutesAgo !== 1 ? "s" : ""}</span>
              </p>
              <p className="text-gray-400 mt-2">
                ¿Desea registrar otra entrada de todos modos?
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmData(null);
                }}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmData(null);
                  // Force entry
                  const formData = new FormData();
                  formData.set("intent", "manual-checkin");
                  formData.set("memberId", selectedMemberId);
                  formData.set("force", "true");
                  manualCheckinFetcher.submit(formData, { method: "post" });
                }}
                className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded-lg transition"
              >
                Sí, registrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
