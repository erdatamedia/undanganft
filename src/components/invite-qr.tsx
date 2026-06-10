"use client";

import { QRCodeSVG } from "qrcode.react";

export function InviteQr({ value, size = 220 }: { value: string; size?: number }) {
  return (
    <div
      style={{ padding: 16, background: "#FFFFFF", borderRadius: 12, display: "inline-block" }}
    >
      <QRCodeSVG
        value={value}
        size={size}
        fgColor="#1B4332"
        bgColor="#FFFFFF"
        level="M"
      />
    </div>
  );
}
