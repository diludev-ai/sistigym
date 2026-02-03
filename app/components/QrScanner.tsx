import { useEffect, useRef, useState, useCallback } from "react";

interface QrScannerProps {
  onScan: (token: string) => void;
  isProcessing?: boolean;
}

export function QrScanner({ onScan, isProcessing = false }: QrScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const lastScannedRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);

  const handleScan = useCallback(
    (decodedText: string) => {
      // Debounce: prevent duplicate scans within 3 seconds
      const now = Date.now();
      if (
        decodedText === lastScannedRef.current &&
        now - lastScanTimeRef.current < 3000
      ) {
        return;
      }

      lastScannedRef.current = decodedText;
      lastScanTimeRef.current = now;

      onScan(decodedText);
    },
    [onScan]
  );

  const startScanner = useCallback(async () => {
    if (!scannerRef.current || html5QrCodeRef.current) return;

    try {
      // Dynamic import for html5-qrcode (client-side only)
      const { Html5Qrcode } = await import("html5-qrcode");

      const html5QrCode = new Html5Qrcode("qr-reader");
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1,
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        handleScan,
        () => {} // Error callback (ignore)
      );

      setIsScanning(true);
      setHasPermission(true);
      setError(null);
    } catch (err: any) {
      console.error("Error starting scanner:", err);
      setHasPermission(false);

      if (err.message?.includes("Permission")) {
        setError("Se requiere permiso para acceder a la camara");
      } else if (err.message?.includes("NotFound")) {
        setError("No se encontro una camara disponible");
      } else {
        setError("Error al iniciar el escaner de QR");
      }
    }
  }, [handleScan]);

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
      html5QrCodeRef.current = null;
      setIsScanning(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const toggleScanner = async () => {
    if (isScanning) {
      await stopScanner();
    } else {
      await startScanner();
    }
  };

  return (
    <div className="space-y-4">
      {/* Scanner Container */}
      <div
        ref={scannerRef}
        className="relative bg-gray-900 rounded-xl overflow-hidden"
      >
        {isScanning ? (
          <div id="qr-reader" className="w-full" />
        ) : (
          <div className="aspect-square flex items-center justify-center bg-gray-800">
            <div className="text-center p-8">
              <svg
                className="w-16 h-16 text-gray-500 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <p className="text-gray-400">Camara desactivada</p>
              <p className="text-gray-500 text-sm mt-1">
                Presiona el boton para activar
              </p>
            </div>
          </div>
        )}

        {/* Processing overlay */}
        {isProcessing && isScanning && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-white font-medium">Verificando...</p>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={toggleScanner}
        disabled={isProcessing}
        className={`w-full py-3 font-medium rounded-xl transition flex items-center justify-center gap-2 ${
          isScanning
            ? "bg-red-600 hover:bg-red-700 text-white"
            : "bg-blue-600 hover:bg-blue-700 text-white"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isScanning ? (
          <>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
              />
            </svg>
            Detener Camara
          </>
        ) : (
          <>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Activar Camara
          </>
        )}
      </button>

      {/* Permission note */}
      {hasPermission === null && (
        <p className="text-gray-500 text-xs text-center">
          Se solicitara permiso para acceder a la camara
        </p>
      )}
    </div>
  );
}

export default QrScanner;
