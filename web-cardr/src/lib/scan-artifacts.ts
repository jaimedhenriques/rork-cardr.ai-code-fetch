import { supabase } from "@/integrations/supabase/client";

export type Box = { x: number; y: number; w: number; h: number };

export type ScanArtifactInput = {
  userId: string;
  contactId: string | null;
  imageDataUrl: string | null;
  rawText: string | null;
  structured: Record<string, unknown> | null;
  confidence: Record<string, number> | null;
  boxes: Record<string, Box> | null;
  model: string | null;
  scanMode: string | null;
  preprocessGuard: string | null;
};

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [meta, b64] = dataUrl.split(",");
    if (!b64) return null;
    const mime = /data:([^;]+);base64/.exec(meta)?.[1] || "image/jpeg";
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  } catch {
    return null;
  }
}

/**
 * Render the original capture with OCR bounding boxes + recognized text
 * overlaid on top. Returns a PNG Blob, or null if rendering isn't possible
 * (no boxes, no image, no canvas support).
 */
export async function renderOcrDebugOverlay(
  imageDataUrl: string,
  boxes: Record<string, Box>,
  values: Record<string, unknown> | null,
): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const entries = Object.entries(boxes || {}).filter(([, b]) => b && b.w > 0 && b.h > 0);
  if (entries.length === 0) return null;

  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = imageDataUrl;
  });
  if (!img) return null;

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Slight dimming so labels pop against busy backgrounds.
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;

  const palette: Record<string, string> = {
    name: "#22d3ee",
    company: "#a78bfa",
    title: "#f472b6",
    email: "#34d399",
    phone: "#fbbf24",
    linkedin: "#60a5fa",
    website: "#f87171",
    location: "#facc15",
  };

  const fontSize = Math.max(14, Math.round(canvas.width * 0.018));
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = "top";
  ctx.lineWidth = Math.max(2, Math.round(canvas.width * 0.0035));

  for (const [field, b] of entries) {
    const color = palette[field] || "#22d3ee";
    const x = b.x * canvas.width;
    const y = b.y * canvas.height;
    const w = b.w * canvas.width;
    const h = b.h * canvas.height;

    ctx.strokeStyle = color;
    ctx.fillStyle = `${color}22`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    const value = values && typeof values[field] === "string" ? (values[field] as string) : "";
    const label = value ? `${field}: ${value}` : field;
    const trimmed = label.length > 64 ? `${label.slice(0, 61)}…` : label;
    const padX = 6;
    const padY = 4;
    const textW = ctx.measureText(trimmed).width;
    const tagH = fontSize + padY * 2;
    const tagY = y - tagH - 2 < 0 ? y + h + 2 : y - tagH - 2;
    ctx.fillStyle = color;
    ctx.fillRect(x, tagY, textW + padX * 2, tagH);
    ctx.fillStyle = "#0b1220";
    ctx.fillText(trimmed, x + padX, tagY + padY);
  }

  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/png", 0.92);
  });
}

/**
 * Persist a scan artifact (image + raw + structured output + OCR overlay)
 * to the `scan-artifacts` storage bucket and the `scan_artifacts` table.
 * Best-effort — never throws; failures are logged.
 */
export async function persistScanArtifact(input: ScanArtifactInput): Promise<void> {
  try {
    let imagePath: string | null = null;
    let debugImagePath: string | null = null;
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (input.imageDataUrl && input.imageDataUrl.startsWith("data:")) {
      const blob = dataUrlToBlob(input.imageDataUrl);
      if (blob) {
        const ext = (blob.type.split("/")[1] || "jpg").split("+")[0];
        const path = `${input.userId}/${stamp}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("scan-artifacts")
          .upload(path, blob, { contentType: blob.type, upsert: false });
        if (!upErr) imagePath = path;
        else console.warn("scan artifact upload failed:", upErr.message);
      }

      // Best-effort OCR overlay export.
      if (input.boxes && Object.keys(input.boxes).length > 0) {
        try {
          const overlay = await renderOcrDebugOverlay(
            input.imageDataUrl,
            input.boxes,
            input.structured,
          );
          if (overlay) {
            const dbgPath = `${input.userId}/${stamp}-debug.png`;
            const { error: dbgErr } = await supabase.storage
              .from("scan-artifacts")
              .upload(dbgPath, overlay, { contentType: "image/png", upsert: false });
            if (!dbgErr) debugImagePath = dbgPath;
            else console.warn("scan debug overlay upload failed:", dbgErr.message);
          }
        } catch (e) {
          console.warn("scan debug overlay render failed:", e);
        }
      }
    }

    const { error } = await supabase.from("scan_artifacts").insert([
      {
        user_id: input.userId,
        contact_id: input.contactId ?? undefined,
        image_path: imagePath ?? undefined,
        debug_image_path: debugImagePath ?? undefined,
        raw_text: input.rawText ?? undefined,
        structured: (input.structured ?? {}) as never,
        confidence: (input.confidence ?? {}) as never,
        boxes: (input.boxes ?? {}) as never,
        model: input.model ?? undefined,
        scan_mode: input.scanMode ?? undefined,
        preprocess_guard: input.preprocessGuard ?? undefined,
      },
    ]);
    if (error) console.warn("scan artifact insert failed:", error.message);
  } catch (e) {
    console.warn("persistScanArtifact failed:", e);
  }
}
