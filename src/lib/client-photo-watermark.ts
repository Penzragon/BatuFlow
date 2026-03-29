/**
 * Client-side caption bar for proof/selfie photos (visit check-in, delivery proof, attendance gate).
 * Keeps visual evidence styling consistent across flows before upload.
 */

export type PhotoCaptionVariant = "standard" | "compact";

/**
 * Formats a WIB-style timestamp line for photo captions (local device time, labeled WIB for operator consistency).
 */
export function formatPhotoCaptionTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())} WIB`;
}

interface DrawCaptionOptions {
  line1: string;
  line2: string;
  /** Compact bar/fonts — use for file-picker captures that tend to be very tall */
  variant?: PhotoCaptionVariant;
}

/**
 * Draws the bottom semi-transparent bar and two text lines on an image canvas.
 * Call after `drawImage` so the bar sits on top of the photo.
 */
export function drawPhotoCaptionBar(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  { line1, line2, variant = "standard" }: DrawCaptionOptions
): void {
  const w = canvas.width;
  const h = canvas.height;
  const isCompact = variant === "compact";
  const minBarH = isCompact ? 44 : 42;
  const heightRatio = isCompact ? 0.12 : 0.14;
  const barH = Math.max(minBarH, Math.round(h * heightRatio));

  const line1Factor = isCompact ? 0.028 : 0.034;
  const line2Factor = isCompact ? 0.022 : 0.027;
  const line2YFactor = isCompact ? 0.2 : 0.18;

  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.fillRect(0, h - barH, w, barH);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `${Math.max(14, Math.round(w * line1Factor))}px Arial, sans-serif`;
  ctx.fillText(line1, 10, h - Math.round(barH * 0.58));

  ctx.fillStyle = "#FFD700";
  ctx.font = `${Math.max(12, Math.round(w * line2Factor))}px Arial, sans-serif`;
  ctx.fillText(line2, 10, h - Math.round(barH * line2YFactor));
}
