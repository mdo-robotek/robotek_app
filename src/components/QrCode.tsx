"use client";

import React, { useMemo } from "react";
import qrcode from "@/lib/vendor/qrcode-generator";

/** Crisp, scalable QR code (SVG) for any text/URL. */
export default function QrCode({ value, size = 240, className = "" }: { value: string; size?: number; className?: string }) {
  const svg = useMemo(() => {
    if (!value) return "";
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) as string;
  }, [value]);
  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`QR code for ${value}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
