import { useLoaderData, useFetcher } from "react-router";
import { useState, useEffect, useCallback } from "react";
import type { Route } from "./+types/qr";
import { requireMemberAuth } from "~/lib/session-member.server";
import { generateQrToken } from "~/lib/services/access.service.server";
import {
  getActiveMembershipForMember,
  checkMemberOverdue,
} from "~/lib/services/membership.service.server";

// ============================================
// LOADER
// ============================================

export async function loader({ request }: Route.LoaderArgs) {
  const member = await requireMemberAuth(request);

  // Check if member can access (has active membership and not overdue)
  const [membership, overdueStatus] = await Promise.all([
    getActiveMembershipForMember(member.id),
    checkMemberOverdue(member.id),
  ]);

  const canGenerateQr =
    membership &&
    membership.calculatedStatus === "active" &&
    !overdueStatus.isOverdue;

  if (!canGenerateQr) {
    return {
      canGenerateQr: false,
      reason: !membership
        ? "no_membership"
        : membership.calculatedStatus !== "active"
        ? "inactive_membership"
        : "overdue",
      qrData: null,
      durationSeconds: 30,
    };
  }

  // Generate QR token
  const { token, expiresAt } = await generateQrToken(member.id);

  // Generate QR code using qrcode library
  const QRCode = await import("qrcode");
  const qrDataUrl = await QRCode.default.toDataURL(token, {
    width: 300,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "M",
  });

  // Get duration from settings (already embedded in expiresAt calculation)
  const durationSeconds = Math.ceil(
    (expiresAt.getTime() - Date.now()) / 1000
  );

  return {
    canGenerateQr: true,
    reason: null,
    qrData: {
      dataUrl: qrDataUrl,
      expiresAt: expiresAt.toISOString(),
    },
    durationSeconds,
  };
}

// ============================================
// ACTION (for refreshing QR)
// ============================================

export async function action({ request }: Route.ActionArgs) {
  const member = await requireMemberAuth(request);

  const [membership, overdueStatus] = await Promise.all([
    getActiveMembershipForMember(member.id),
    checkMemberOverdue(member.id),
  ]);

  const canGenerateQr =
    membership &&
    membership.calculatedStatus === "active" &&
    !overdueStatus.isOverdue;

  if (!canGenerateQr) {
    return { qrData: null, durationSeconds: 30 };
  }

  const { token, expiresAt } = await generateQrToken(member.id);

  const QRCode = await import("qrcode");
  const qrDataUrl = await QRCode.default.toDataURL(token, {
    width: 300,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "M",
  });

  const durationSeconds = Math.ceil(
    (expiresAt.getTime() - Date.now()) / 1000
  );

  return {
    qrData: {
      dataUrl: qrDataUrl,
      expiresAt: expiresAt.toISOString(),
    },
    durationSeconds,
  };
}

// ============================================
// COMPONENT
// ============================================

export default function ClientQR() {
  const loaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  // Get current QR data (from loader or latest action)
  const currentQrData = fetcher.data?.qrData || loaderData.qrData;
  const durationSeconds =
    fetcher.data?.durationSeconds || loaderData.durationSeconds;

  // Calculate seconds remaining
  const calculateSecondsRemaining = useCallback(() => {
    if (!currentQrData?.expiresAt) return 0;
    const expiresAt = new Date(currentQrData.expiresAt).getTime();
    const now = Date.now();
    return Math.max(0, Math.ceil((expiresAt - now) / 1000));
  }, [currentQrData?.expiresAt]);

  // Initialize and update countdown
  useEffect(() => {
    if (!currentQrData?.expiresAt) return;

    const updateCountdown = () => {
      const remaining = calculateSecondsRemaining();
      setSecondsRemaining(remaining);
      setIsExpired(remaining <= 0);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [currentQrData?.expiresAt, calculateSecondsRemaining]);

  // Auto-refresh when expired (with debounce to prevent loops)
  useEffect(() => {
    if (isExpired && loaderData.canGenerateQr && fetcher.state === "idle") {
      const timer = setTimeout(() => {
        fetcher.submit({}, { method: "post" });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isExpired, loaderData.canGenerateQr, fetcher.state]);

  const handleManualRefresh = () => {
    if (fetcher.state === "idle") {
      fetcher.submit({}, { method: "post" });
    }
  };

  // Progress percentage for the circular timer
  const progressPercentage =
    durationSeconds > 0 ? (secondsRemaining / durationSeconds) * 100 : 0;

  // Get color based on time remaining
  const getTimerColor = () => {
    if (secondsRemaining <= 5) return "text-red-400";
    if (secondsRemaining <= 10) return "text-yellow-400";
    return "text-green-400";
  };

  // Can't generate QR - show error message
  if (!loaderData.canGenerateQr) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Mi Codigo QR
        </h1>

        <div className="bg-gray-800 rounded-xl border border-gray-700 p-8">
          <div className="text-center">
            <div className="w-24 h-24 mx-auto bg-red-500/20 rounded-full flex items-center justify-center mb-6">
              <svg
                className="w-12 h-12 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-xl font-semibold text-white mb-2">
              QR no disponible
            </h2>

            <p className="text-gray-400">
              {loaderData.reason === "no_membership"
                ? "No tienes una membresia activa. Contacta a recepcion para adquirir un plan."
                : loaderData.reason === "inactive_membership"
                ? "Tu membresia no esta activa. Puede estar expirada, congelada o cancelada."
                : loaderData.reason === "overdue"
                ? "Tu cuenta esta en morosidad. Por favor regulariza tu pago en recepcion."
                : "No puedes generar un codigo QR en este momento."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isLoading = fetcher.state !== "idle";

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6 text-center">
        Mi Codigo QR
      </h1>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-8">
        {/* QR Code Display */}
        <div className="relative aspect-square max-w-xs mx-auto mb-6">
          {currentQrData?.dataUrl ? (
            <>
              <img
                src={currentQrData.dataUrl}
                alt="Codigo QR de acceso"
                className={`w-full h-full rounded-lg transition-opacity ${
                  isLoading || isExpired ? "opacity-30" : "opacity-100"
                }`}
              />

              {/* Overlay when loading */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full bg-gray-700 rounded-lg flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Countdown Timer */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative w-20 h-20">
            {/* Background circle */}
            <svg className="w-20 h-20 transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className="text-gray-700"
              />
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 36}`}
                strokeDashoffset={`${
                  2 * Math.PI * 36 * (1 - progressPercentage / 100)
                }`}
                className={`transition-all duration-1000 ${getTimerColor()}`}
                strokeLinecap="round"
              />
            </svg>
            {/* Timer text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-2xl font-bold ${getTimerColor()}`}>
                {secondsRemaining}
              </span>
            </div>
          </div>
          <p className="text-gray-400 text-sm mt-2">segundos restantes</p>
        </div>

        {/* Manual Refresh Button */}
        <button
          onClick={handleManualRefresh}
          disabled={isLoading}
          className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-xl transition flex items-center justify-center gap-2"
        >
          <svg
            className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {isLoading ? "Generando..." : "Generar nuevo QR"}
        </button>

        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            Muestra este codigo en recepcion para acceder al gimnasio
          </p>
          <p className="text-gray-500 text-xs mt-2">
            El codigo se actualiza automaticamente cada {durationSeconds}{" "}
            segundos
          </p>
        </div>
      </div>
    </div>
  );
}
