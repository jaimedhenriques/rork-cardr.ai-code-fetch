/**
 * PreprocessPreviewDialog
 * -----------------------
 * Lets an operator inspect what the OCR pipeline will actually "see" before a
 * scan is sent to the backend. Compares the original capture against the
 * auto-cropped + deskewed + contrast-boosted version produced by
 * `preprocessScanImage`.
 *
 * Why this exists:
 *   The preprocessing pipeline is a heuristic chain (auto-crop → deskew →
 *   contrast stretch). When OCR misreads a badge, the first question is
 *   always "did preprocessing chop off a line of text or rotate the wrong
 *   way?". This dialog answers that without round-tripping through the
 *   edge function.
 *
 * Modes:
 *   - "side":   render both images next to each other for direct comparison.
 *   - "toggle": render a single image with a Original/Preprocessed switch.
 *               Better on narrow screens where side-by-side becomes
 *               postage-stamp small.
 *
 * The preprocessed image is computed lazily the first time the dialog opens
 * and cached for the lifetime of the dialog instance — re-running the
 * pipeline on every toggle would make the switch feel laggy on large
 * captures.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, Columns2, ToggleLeft, RefreshCw, RotateCcw, Download, Bug, Zap, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { analyzeScanImage, preprocessScanImage, clearSlowDeviceFlag, isSlowDevice } from "@/lib/image-preprocess";
import {
  toPreprocessOptions,
  useScanPreprocessOptions,
} from "@/lib/scan-preprocess-options";

type ViewMode = "side" | "toggle";

interface PreprocessPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The raw captured image (data URL or http URL). */
  imageSrc: string | null;
}

const PreprocessPreviewDialog = ({
  open,
  onOpenChange,
  imageSrc,
}: PreprocessPreviewDialogProps) => {
  const [processed, setProcessed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<ViewMode>("side");
  // Toggle-mode local state: which side is currently visible.
  const [showProcessed, setShowProcessed] = useState(true);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const { options, update, reset } = useScanPreprocessOptions();

  // Approximate output size — useful when tuning JPEG quality so the
  // operator can see the bandwidth trade-off in real units.
  const [outputBytes, setOutputBytes] = useState<number | null>(null);
  const [debugBusy, setDebugBusy] = useState(false);
  const [slowDeviceActive, setSlowDeviceActive] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Run the pipeline with the current options. Extracted so both the
  // initial-load effect and the explicit re-run share one code path.
  const run = useCallback(
    (signal?: { cancelled: boolean }) => {
      if (!imageSrc) return;
      setProcessed(null);
      setElapsedMs(null);
      setOutputBytes(null);
      setLoading(true);
      const start = performance.now();
      // Preview must always run end-to-end so users can compare results,
      // even on devices that hit the slow-device timeout during live scans.
      void preprocessScanImage(imageSrc, { ...toPreprocessOptions(options), ignoreSlowDeviceFlag: true })
        .then((result) => {
          if (signal?.cancelled) return;
          setProcessed(result.image);
          setElapsedMs(Math.round(performance.now() - start));
          // Rough byte-size estimate: data:image/jpeg;base64,<payload>.
          // Base64 inflates by ~4/3, so divide by that to get raw bytes.
          if (result.image.startsWith("data:")) {
            const commaIdx = result.image.indexOf(",");
            if (commaIdx > -1) {
              const b64Len = result.image.length - commaIdx - 1;
              setOutputBytes(Math.round((b64Len * 3) / 4));
            }
          }
        })
        .catch(() => {
          if (signal?.cancelled) return;
          setProcessed(imageSrc);
          setElapsedMs(Math.round(performance.now() - start));
        })
        .finally(() => {
          if (!signal?.cancelled) setLoading(false);
        });
    },
    [imageSrc, options],
  );

  // Re-run preprocessing whenever a new image lands, the dialog re-opens,
  // or the options change. Cancel-safe so rapid toggles don't race.
  useEffect(() => {
    if (!open || !imageSrc) {
      setProcessed(null);
      setElapsedMs(null);
      setOutputBytes(null);
      return;
    }
    setSlowDeviceActive(isSlowDevice());
    const signal = { cancelled: false };
    run(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [open, imageSrc, run]);

  const handleClearFlagAndRetry = () => {
    clearSlowDeviceFlag();
    setSlowDeviceActive(false);
    rerun();
  };

  const rerun = () => run();

  // Heuristic: if processed === original (object identity OR exact string
  // match), the pipeline made no change — usually because the image was too
  // small or already low-contrast. Worth surfacing so the operator doesn't
  // wonder why both sides look identical.
  const noChange =
    processed != null && imageSrc != null && processed === imageSrc;

  // Trigger a single download of a data URL or Blob URL.
  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Render an annotated PNG showing the original capture with the detected
  // crop box drawn on top. We map the crop (which lives in the downscaled
  // working frame the detector ran on) back into original-image coordinates
  // so the rectangle aligns with the full-resolution download.
  const buildOverlayDataUrl = async (
    src: string,
  ): Promise<{ dataUrl: string; meta: Record<string, unknown> } | null> => {
    const debug = await analyzeScanImage(src);
    if (!debug) return null;

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = src;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);

    const meta: Record<string, unknown> = {
      originalWidth: img.width,
      originalHeight: img.height,
      workingWidth: debug.workingWidth,
      workingHeight: debug.workingHeight,
      crop: null,
      skewAngleDeg: debug.skewAngle,
      generatedAt: new Date().toISOString(),
    };

    if (debug.crop) {
      // Scale crop box from working frame → original frame.
      const sx = img.width / debug.workingWidth;
      const sy = img.height / debug.workingHeight;
      const x = Math.round(debug.crop.x * sx);
      const y = Math.round(debug.crop.y * sy);
      const w = Math.round(debug.crop.w * sx);
      const h = Math.round(debug.crop.h * sy);
      meta.crop = { x, y, w, h };

      // Dim everything outside the crop so the detected region pops.
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.beginPath();
      ctx.rect(0, 0, img.width, img.height);
      ctx.rect(x + w, y, -w, h); // counter-clockwise inner rect = hole (evenodd)
      ctx.fill("evenodd");
      ctx.restore();

      // Stroke width scales with image size so it stays visible at any zoom.
      const stroke = Math.max(3, Math.round(Math.min(img.width, img.height) * 0.005));
      ctx.strokeStyle = "#ff3b30";
      ctx.lineWidth = stroke;
      ctx.strokeRect(x, y, w, h);

      const tick = Math.max(stroke * 4, 16);
      ctx.beginPath();
      ctx.moveTo(x, y + tick); ctx.lineTo(x, y); ctx.lineTo(x + tick, y);
      ctx.moveTo(x + w - tick, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + tick);
      ctx.moveTo(x, y + h - tick); ctx.lineTo(x, y + h); ctx.lineTo(x + tick, y + h);
      ctx.moveTo(x + w - tick, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - tick);
      ctx.stroke();

      const label = `crop ${w}×${h}${debug.skewAngle != null ? ` · skew ${debug.skewAngle.toFixed(1)}°` : ""}`;
      const fontSize = Math.max(14, Math.round(Math.min(img.width, img.height) * 0.022));
      ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
      const padding = Math.round(fontSize * 0.4);
      const labelW = ctx.measureText(label).width + padding * 2;
      const labelH = fontSize + padding * 1.2;
      const labelY = Math.max(0, y - labelH - 2);
      ctx.fillStyle = "#ff3b30";
      ctx.fillRect(x, labelY, labelW, labelH);
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + padding, labelY + labelH / 2);
    } else {
      ctx.fillStyle = "rgba(255, 59, 48, 0.9)";
      const fontSize = Math.max(18, Math.round(Math.min(img.width, img.height) * 0.03));
      ctx.font = `700 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText("no crop detected", 12, fontSize + 6);
    }

    return { dataUrl: canvas.toDataURL("image/png"), meta };
  };

  // Bundle the preprocessed image, the crop overlay, and a small JSON
  // metadata blob into three separate downloads. Using individual files
  // (instead of a zip) keeps us dependency-free — operators can drag them
  // straight into an issue or share folder.
  const downloadDebugBundle = async () => {
    if (!imageSrc || !processed) return;
    setDebugBusy(true);
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const stem = `scan-debug_${ts}`;

      triggerDownload(processed, `${stem}_preprocessed.jpg`);

      const overlay = await buildOverlayDataUrl(imageSrc);
      if (overlay) {
        triggerDownload(overlay.dataUrl, `${stem}_crop-overlay.png`);
        const metaBlob = new Blob(
          [JSON.stringify({ ...overlay.meta, options }, null, 2)],
          { type: "application/json" },
        );
        const metaUrl = URL.createObjectURL(metaBlob);
        triggerDownload(metaUrl, `${stem}_meta.json`);
        setTimeout(() => URL.revokeObjectURL(metaUrl), 5000);
      }
    } finally {
      setDebugBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Preprocessing preview
            {elapsedMs != null && (
              <span className="text-[11px] font-normal text-muted-foreground">
                · ran in {elapsedMs}ms
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Compare the raw capture with the auto-cropped, deskewed, contrast-boosted
            version that will be sent to OCR.
          </DialogDescription>
        </DialogHeader>

        {/* View mode + rerun controls */}
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => setView("side")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-sm transition-colors",
                view === "side"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Columns2 size={12} />
              Side by side
            </button>
            <button
              type="button"
              onClick={() => setView("toggle")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-sm transition-colors",
                view === "toggle"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ToggleLeft size={12} />
              Toggle
            </button>
          </div>

          <div className="flex items-center gap-2">
            {noChange && (
              <span className="text-[11px] text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded">
                Pipeline made no changes (image too small or low-contrast)
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1 text-[11px]"
              onClick={rerun}
              disabled={loading || !imageSrc}
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Re-run
            </Button>
            {slowDeviceActive && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 gap-1 text-[11px] border-primary text-primary hover:bg-primary/10"
                onClick={handleClearFlagAndRetry}
                disabled={loading || !imageSrc}
                title="This device was flagged as slow. Clear the flag and retry preprocessing."
              >
                <Zap size={12} />
                Clear flag & retry
              </Button>
            )}
            {/* Debug bundle download — exports the exact preprocessed JPEG
                that would be sent to OCR plus a PNG showing the original
                capture with the detected crop box highlighted, alongside a
                JSON sidecar with the resolved options + skew angle. Hidden
                until processing finishes so the operator never grabs a
                stale/empty bundle. */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1 text-[11px]"
              onClick={downloadDebugBundle}
              disabled={debugBusy || loading || !imageSrc || !processed}
              title="Download preprocessed image + crop overlay + metadata"
            >
              {debugBusy ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Bug size={12} />
              )}
              Debug
              <Download size={11} className="opacity-60" />
            </Button>
          </div>
        </div>

        {/* Pipeline controls — these settings persist via localStorage and
            are read by ScanBadge.processImage so the live scan uses the
            exact pipeline configuration the operator previewed here. */}
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pipeline settings
            </p>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw size={10} />
              Reset
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Auto-crop toggle */}
            <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
              <div className="min-w-0">
                <Label htmlFor="opt-autocrop" className="text-xs font-medium text-foreground cursor-pointer">
                  Auto-crop
                </Label>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                  Trim dark margins around the card
                </p>
              </div>
              <Switch
                id="opt-autocrop"
                checked={options.autoCrop}
                onCheckedChange={(v) => update({ autoCrop: v })}
              />
            </div>

            {/* Deskew toggle */}
            <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
              <div className="min-w-0">
                <Label htmlFor="opt-deskew" className="text-xs font-medium text-foreground cursor-pointer">
                  Deskew
                </Label>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                  Auto-rotate to straighten text
                </p>
              </div>
              <Switch
                id="opt-deskew"
                checked={options.deskew}
                onCheckedChange={(v) => update({ deskew: v })}
              />
            </div>

            {/* JPEG quality slider */}
            <div className="rounded-md border border-border bg-background px-3 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs font-medium text-foreground">
                  JPEG quality
                </Label>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {Math.round(options.quality * 100)}%
                  {outputBytes != null && (
                    <span className="ml-1 opacity-70">
                      · {(outputBytes / 1024).toFixed(0)}KB
                    </span>
                  )}
                </span>
              </div>
              <Slider
                value={[Math.round(options.quality * 100)]}
                min={50}
                max={100}
                step={5}
                onValueChange={([v]) => update({ quality: v / 100 })}
              />
            </div>
          </div>

          {/* Advanced controls — timeout & maxPixels tunables for power users
              on slower devices or working with very large captures. */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                size={12}
                className={cn("transition-transform", showAdvanced ? "rotate-180" : "")}
              />
              Advanced
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Timeout slider */}
                <div className="rounded-md border border-border bg-background px-3 py-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs font-medium text-foreground">
                      Timeout
                    </Label>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {(options.timeoutMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                  <Slider
                    value={[options.timeoutMs]}
                    min={500}
                    max={5000}
                    step={250}
                    onValueChange={([v]) => update({ timeoutMs: v })}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                    Abort preprocessing and fall back to the original if it takes longer than this.
                  </p>
                </div>

                {/* Max pixels preset buttons */}
                <div className="rounded-md border border-border bg-background px-3 py-2">
                  <Label className="text-xs font-medium text-foreground block mb-1.5">
                    Max source size
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { label: "8 MP", value: 8_000_000 },
                      { label: "12 MP", value: 12_000_000 },
                      { label: "24 MP", value: 24_000_000 },
                      { label: "32 MP", value: 32_000_000 },
                      { label: "48 MP", value: 48_000_000 },
                      { label: "64 MP", value: 64_000_000 },
                      { label: "No limit", value: null },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => update({ maxPixels: preset.value })}
                        className={cn(
                          "px-2 py-0.5 text-[10px] font-medium rounded-sm border transition-colors",
                          options.maxPixels === preset.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-muted/30 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">
                    Skip preprocessing when the capture exceeds this resolution.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-3 min-h-[300px]">
          {!imageSrc ? (
            <div className="flex items-center justify-center text-muted-foreground text-sm py-12">
              No capture yet — take or upload a photo first.
            </div>
          ) : view === "side" ? (
            <div className="grid grid-cols-2 gap-3">
              <ImagePane label="Original" src={imageSrc} loading={false} />
              <ImagePane label="Preprocessed" src={processed} loading={loading} />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowProcessed(false)}
                  className={cn(
                    "px-3 py-1 text-[11px] font-medium rounded-md border transition-colors",
                    !showProcessed
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:text-foreground",
                  )}
                >
                  Original
                </button>
                <button
                  type="button"
                  onClick={() => setShowProcessed(true)}
                  className={cn(
                    "px-3 py-1 text-[11px] font-medium rounded-md border transition-colors",
                    showProcessed
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:text-foreground",
                  )}
                >
                  Preprocessed
                </button>
              </div>
              <ImagePane
                label={showProcessed ? "Preprocessed" : "Original"}
                src={showProcessed ? processed : imageSrc}
                loading={showProcessed && loading}
                large
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Small inner component so the empty/loading/loaded states are consistent
// across both layouts.
const ImagePane = ({
  label,
  src,
  loading,
  large = false,
}: {
  label: string;
  src: string | null;
  loading: boolean;
  large?: boolean;
}) => (
  <div className="space-y-1.5">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </p>
    <div
      className={cn(
        "relative rounded-md border border-border bg-background overflow-hidden flex items-center justify-center",
        large ? "min-h-[400px]" : "min-h-[200px]",
      )}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Loader2 size={14} className="animate-spin" />
          Processing…
        </div>
      ) : src ? (
        <img
          src={src}
          alt={label}
          className="max-h-[60vh] w-auto object-contain"
        />
      ) : (
        <span className="text-muted-foreground text-xs">No image</span>
      )}
    </div>
  </div>
);

export default PreprocessPreviewDialog;
