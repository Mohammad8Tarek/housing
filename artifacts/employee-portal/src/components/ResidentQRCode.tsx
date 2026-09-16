import React, { useState, useEffect } from "react";
import QRCode from "qrcode";

interface ResidentQRCodeProps {
  data: string;
  qrDataUrl?: string | null;
  size?: number;
  className?: string;
}

/**
 * High-resolution authentic QR Code renderer.
 * If server qrDataUrl is provided, renders the genuine scannable QR Code image.
 * Otherwise, generates an authentic scannable QR Code PNG on the fly using standard QRCode specs.
 */
export function ResidentQRCode({
  data,
  qrDataUrl,
  size = 180,
  className = "",
}: ResidentQRCodeProps) {
  const [localQrUrl, setLocalQrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (qrDataUrl) {
      setLocalQrUrl(null);
      return;
    }
    if (!data) return;

    let isMounted = true;
    QRCode.toDataURL(data, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: Math.max(360, size * 2),
      color: {
        dark: "#0F2A44",
        light: "#FFFFFF",
      },
    })
      .then((url) => {
        if (isMounted) setLocalQrUrl(url);
      })
      .catch((err) => {
        console.error("[ResidentQRCode] Failed to generate QR code:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [data, qrDataUrl, size]);

  const activeUrl = qrDataUrl || localQrUrl;

  return (
    <div
      className={`inline-flex items-center justify-center p-2 rounded-2xl bg-white shadow-md border border-border/40 ${className}`}
      style={{ width: size, height: size }}
      title={`Resident QR: ${data}`}
    >
      {activeUrl ? (
        <img
          src={activeUrl}
          alt={`Resident QR: ${data}`}
          className="w-full h-full object-contain rounded-xl"
          loading="eager"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted/20 rounded-xl animate-pulse">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

