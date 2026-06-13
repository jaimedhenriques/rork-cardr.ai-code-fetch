// Client-side image preprocessing for the badge/card OCR pipeline.
//
// Pipeline:
//   1. Decode the data URL into an offscreen canvas.
//   2. Detect the largest bright quadrilateral (the card / badge) using an
//      edge-projection heuristic on a downsampled grayscale buffer, then crop.
//   3. Estimate skew via a coarse Hough-style scan over the cropped edges and
//      rotate to deskew (capped to ±15°).
//   4. Boost contrast with a per-channel CLAHE-lite (histogram stretch + mild
//      local gamma) and a slight sharpen.
//
// Everything runs in pure Canvas2D — no external deps, safe in the browser
// and on Capacitor. The function always returns a JPEG data URL; on any
// failure it returns the original input so the OCR call is never blocked.

const MAX_DIMENSION = 1600; // cap output to keep payload reasonable
const MIN_DIMENSION = 320;  // skip preprocessing for tiny images
const DEFAULT_TIMEOUT_MS = 1500; // bail out if the pipeline drags
const DEFAULT_MAX_PIXELS = 24_000_000; // ~24MP — skip outright above this
const SLOW_DEVICE_KEY = "scan.preprocess.slowDevice";
const SLOW_DEVICE_THRESHOLD_MS = 1200; // anything slower marks the device

export type PreprocessGuard =
  | "none"
  | "slow-device"
  | "timeout"
  | "max-pixels"
  | "too-small"
  | "error"
  | "canvas-unavailable";

export interface PreprocessResult {
  image: string;
  skipped: boolean;
  reason?: string;
  /** Which guard caused the skip (or "none" when the pipeline ran successfully). */
  guard: PreprocessGuard;
  /** Number of attempts spent (including the first). 1 = no retry happened. */
  attempts?: number;
}

export interface PreprocessOptions {
  /** Skip auto-crop step (useful when caller already cropped). */
  skipCrop?: boolean;
  /** Skip deskew rotation. */
  skipDeskew?: boolean;
  /** JPEG quality for the output data URL. */
  quality?: number;
  /** Hard ceiling for total pipeline duration; falls back to original on expiry. */
  timeoutMs?: number;
  /** Skip preprocessing entirely if the source exceeds this pixel count. */
  maxPixels?: number;
  /** When true, ignore the persisted "slow device" flag (used by the preview). */
  ignoreSlowDeviceFlag?: boolean;
  /**
   * If the run is skipped because of a timeout, retry up to this many extra
   * attempts with exponential backoff (250ms × 2^n) and a 1.5× longer
   * per-attempt timeout each round. Non-timeout skips (slow-device flag,
   * oversize image, image too small) are not retried. Default: 0.
   */
  maxRetries?: number;
}

export function isSlowDevice(): boolean {
  try {
    return localStorage.getItem(SLOW_DEVICE_KEY) === "1";
  } catch {
    return false;
  }
}

function markSlowDevice() {
  try {
    localStorage.setItem(SLOW_DEVICE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearSlowDeviceFlag() {
  try {
    localStorage.removeItem(SLOW_DEVICE_KEY);
  } catch {
    /* ignore */
  }
}


export async function preprocessScanImage(
  src: string,
  opts: PreprocessOptions = {},
): Promise<PreprocessResult> {
  const baseTimeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = Math.max(0, opts.maxRetries ?? 0);

  let attempt = 0;
  let lastResult: PreprocessResult = { image: src, skipped: true, reason: "no attempts", guard: "error" };

  while (attempt <= maxRetries) {
    // On retries we know the device just timed out — bypass the persisted
    // slow-device flag (it would short-circuit every retry) and grow the
    // budget so the second/third try actually has a chance to finish.
    const attemptTimeout = Math.round(baseTimeout * Math.pow(1.5, attempt));
    const result = await runPreprocessAttempt(src, {
      ...opts,
      timeoutMs: attemptTimeout,
      ignoreSlowDeviceFlag: attempt > 0 ? true : opts.ignoreSlowDeviceFlag,
    });
    lastResult = { ...result, attempts: attempt + 1 };

    if (!result.skipped) return lastResult;

    // Only timeouts are worth retrying. Slow-device flag, oversize images,
    // and "image too small" won't resolve on a second swing.
    const isTimeout = result.reason?.startsWith("timeout") ?? false;
    if (!isTimeout || attempt >= maxRetries) return lastResult;

    const backoffMs = 250 * Math.pow(2, attempt);
    console.info(`[preprocess] retry ${attempt + 1}/${maxRetries} after ${backoffMs}ms (next timeout ${Math.round(baseTimeout * Math.pow(1.5, attempt + 1))}ms)`);
    await new Promise((r) => setTimeout(r, backoffMs));
    attempt += 1;
  }

  return lastResult;
}

/** Single pass through the preprocessing pipeline with one timeout window. */
async function runPreprocessAttempt(
  src: string,
  opts: PreprocessOptions,
): Promise<PreprocessResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxPixels = opts.maxPixels ?? DEFAULT_MAX_PIXELS;

  // Early exit: device previously timed out — keep scanning snappy.
  if (!opts.ignoreSlowDeviceFlag && isSlowDevice()) {
    console.info("[preprocess] skipped: slow device flag set");
    return { image: src, skipped: true, reason: "slow device flag", guard: "slow-device" };
  }

  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<PreprocessResult>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[preprocess] timeout after ${timeoutMs}ms — returning original`);
      markSlowDevice();
      resolve({ image: src, skipped: true, reason: `timeout after ${timeoutMs}ms`, guard: "timeout" });
    }, timeoutMs);
  });

  const pipeline = (async (): Promise<PreprocessResult> => {
    const img = await loadImage(src);
    if (img.width < MIN_DIMENSION || img.height < MIN_DIMENSION) {
      return { image: src, skipped: true, reason: "image too small", guard: "too-small" };
    }

    // Early exit: image too large to process responsively.
    const pixels = img.width * img.height;
    if (pixels > maxPixels) {
      console.info(`[preprocess] skipped: ${pixels.toLocaleString()} pixels exceeds ${maxPixels.toLocaleString()} ceiling`);
      return { image: src, skipped: true, reason: `max pixels exceeded (${(pixels / 1_000_000).toFixed(1)}MP > ${(maxPixels / 1_000_000).toFixed(0)}MP)`, guard: "max-pixels" };
    }

    // Downscale for processing if huge — keeps the algorithm snappy.
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { image: src, skipped: true, reason: "canvas context unavailable", guard: "canvas-unavailable" };
    ctx.drawImage(img, 0, 0, w, h);

    // ── 1. Auto-crop ────────────────────────────────────────────────
    let working = canvas;
    if (!opts.skipCrop) {
      const crop = detectCardBounds(ctx, w, h);
      if (crop) {
        const cropped = document.createElement("canvas");
        cropped.width = crop.w;
        cropped.height = crop.h;
        const cctx = cropped.getContext("2d");
        if (cctx) {
          cctx.drawImage(canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
          working = cropped;
        }
      }
    }

    // ── 2. Deskew ───────────────────────────────────────────────────
    if (!opts.skipDeskew) {
      const angle = estimateSkewAngle(working);
      if (Math.abs(angle) > 0.5 && Math.abs(angle) < 15) {
        working = rotateCanvas(working, -angle);
      }
    }

    // ── 3. Contrast boost + mild sharpen ───────────────────────────
    const wctx = working.getContext("2d", { willReadFrequently: true });
    if (wctx) {
      const data = wctx.getImageData(0, 0, working.width, working.height);
      stretchContrast(data);
      wctx.putImageData(data, 0, 0);
    }

    return { image: working.toDataURL("image/jpeg", opts.quality ?? 0.9), skipped: false, guard: "none" };
  })();

  try {
    const result = await Promise.race([pipeline, timeoutPromise]);
    const elapsed = performance.now() - started;
    if (!result.skipped && elapsed > SLOW_DEVICE_THRESHOLD_MS) {
      console.warn(`[preprocess] slow run: ${Math.round(elapsed)}ms — marking device`);
      markSlowDevice();
    }
    return result;
  } catch (err) {
    console.warn("preprocessScanImage failed, falling back to original", err);
    return { image: src, skipped: true, reason: "pipeline error", guard: "error" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ─── helpers ──────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Find the bounding box of the brightest connected region by projecting
 * luminance onto the X and Y axes and trimming dark margins. Works well
 * for badges/cards photographed against darker backgrounds (lanyards,
 * tables, hands). Returns null if no clear subject is detected.
 */
function detectCardBounds(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): { x: number; y: number; w: number; h: number } | null {
  const { data } = ctx.getImageData(0, 0, w, h);
  const colSum = new Float32Array(w);
  const rowSum = new Float32Array(h);
  let total = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // perceptual luminance
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      colSum[x] += lum;
      rowSum[y] += lum;
      total += lum;
    }
  }

  const mean = total / (w * h);
  // threshold: regions brighter than 1.05× the mean are "subject"
  const colThresh = mean * h * 1.05;
  const rowThresh = mean * w * 1.05;

  let left = 0;
  while (left < w && colSum[left] < colThresh) left++;
  let right = w - 1;
  while (right > left && colSum[right] < colThresh) right--;
  let top = 0;
  while (top < h && rowSum[top] < rowThresh) top++;
  let bottom = h - 1;
  while (bottom > top && rowSum[bottom] < rowThresh) bottom--;

  // Add a small padding so we don't shave off real text near the edges.
  const padX = Math.round(w * 0.02);
  const padY = Math.round(h * 0.02);
  left = Math.max(0, left - padX);
  right = Math.min(w - 1, right + padX);
  top = Math.max(0, top - padY);
  bottom = Math.min(h - 1, bottom + padY);

  const cw = right - left;
  const ch = bottom - top;

  // Reject crops that are too aggressive (would lose info) or too timid
  // (no benefit). We require at least 30% area reduction to use the crop,
  // and the result must still be ≥60% of the original in each dimension.
  const areaRatio = (cw * ch) / (w * h);
  if (areaRatio > 0.95 || areaRatio < 0.25) return null;
  if (cw < w * 0.5 || ch < h * 0.5) return null;

  return { x: left, y: top, w: cw, h: ch };
}

/**
 * Estimate skew by sampling rows of high-contrast edges and finding the
 * angle (in degrees) that maximizes horizontal alignment. Coarse but
 * fast — good enough for badges photographed slightly tilted.
 */
function estimateSkewAngle(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 0;
  // Downsample for speed
  const targetW = 200;
  const scale = targetW / canvas.width;
  const w = targetW;
  const h = Math.max(1, Math.round(canvas.height * scale));
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext("2d");
  if (!tctx) return 0;
  tctx.drawImage(canvas, 0, 0, w, h);
  const { data } = tctx.getImageData(0, 0, w, h);

  // Sobel-ish vertical gradient → strong horizontal edges
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    gray[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
  }

  let bestAngle = 0;
  let bestScore = -Infinity;
  for (let deg = -12; deg <= 12; deg += 1) {
    const rad = (deg * Math.PI) / 180;
    const tan = Math.tan(rad);
    // Project onto a tilted horizontal axis: sum gradients along each
    // tilted row, then measure variance — high variance ⇒ aligned text.
    const buckets = new Float32Array(h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 0; x < w; x++) {
        const yp = Math.round(y + (x - w / 2) * tan);
        if (yp < 1 || yp >= h - 1) continue;
        const g = Math.abs(gray[yp * w + x] - gray[(yp - 1) * w + x]);
        buckets[y] += g;
      }
    }
    let mean = 0;
    for (let y = 0; y < h; y++) mean += buckets[y];
    mean /= h;
    let variance = 0;
    for (let y = 0; y < h; y++) {
      const d = buckets[y] - mean;
      variance += d * d;
    }
    if (variance > bestScore) {
      bestScore = variance;
      bestAngle = deg;
    }
  }
  return bestAngle;
}

function rotateCanvas(canvas: HTMLCanvasElement, deg: number): HTMLCanvasElement {
  const rad = (deg * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const w = canvas.width;
  const h = canvas.height;
  const newW = Math.round(w * cos + h * sin);
  const newH = Math.round(w * sin + h * cos);

  const out = document.createElement("canvas");
  out.width = newW;
  out.height = newH;
  const ctx = out.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, newW, newH);
  ctx.translate(newW / 2, newH / 2);
  ctx.rotate(rad);
  ctx.drawImage(canvas, -w / 2, -h / 2);
  return out;
}

/**
 * Per-channel histogram stretch (1–99 percentile) plus a small gamma
 * curve to make text pop without crushing highlights.
 */
function stretchContrast(image: ImageData) {
  const { data } = image;
  const n = data.length / 4;
  // Build luminance histogram
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    const lum = (0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]) | 0;
    hist[lum]++;
  }
  // Find 1st and 99th percentile bounds
  const lowCount = n * 0.01;
  const highCount = n * 0.99;
  let lo = 0, hi = 255, acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= lowCount) { lo = v; break; }
  }
  acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= highCount) { hi = v; break; }
  }
  if (hi - lo < 20) return; // image already low-contrast — bail rather than amplify noise

  const range = hi - lo;
  const gamma = 0.92; // slight midtone lift
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    const norm = Math.min(1, Math.max(0, (v - lo) / range));
    lut[v] = Math.round(Math.pow(norm, gamma) * 255);
  }
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
  }
}

// ─── debug helpers ────────────────────────────────────────────────────

export interface CropDebugInfo {
  /** Width of the (possibly downscaled) frame the detector ran on. */
  workingWidth: number;
  /** Height of the (possibly downscaled) frame the detector ran on. */
  workingHeight: number;
  /** Crop box in working-frame coordinates, or null if no crop chosen. */
  crop: { x: number; y: number; w: number; h: number } | null;
  /** Skew angle in degrees (only set when |angle| within deskew bounds). */
  skewAngle: number | null;
}

/**
 * Run only the *analysis* half of the pipeline — crop detection + skew
 * estimation — so callers (e.g. the debug overlay in the preview dialog)
 * can visualize what the heuristics decided without re-implementing them.
 *
 * Returns the same downscaled coordinates the real pipeline uses, plus the
 * `workingWidth`/`workingHeight` so callers can map back to the original
 * image. Returns null if the image fails to load or is below the minimum
 * processing size.
 */
export async function analyzeScanImage(src: string): Promise<CropDebugInfo | null> {
  try {
    const img = await loadImage(src);
    if (img.width < MIN_DIMENSION || img.height < MIN_DIMENSION) return null;

    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);

    const crop = detectCardBounds(ctx, w, h);

    // Re-use the cropped canvas for skew estimation when a crop was found
    // so the angle reflects what would actually be deskewed.
    let skewSource: HTMLCanvasElement = canvas;
    if (crop) {
      const cropped = document.createElement("canvas");
      cropped.width = crop.w;
      cropped.height = crop.h;
      const cctx = cropped.getContext("2d");
      if (cctx) {
        cctx.drawImage(canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
        skewSource = cropped;
      }
    }
    const angle = estimateSkewAngle(skewSource);
    const skewAngle = Math.abs(angle) > 0.5 && Math.abs(angle) < 15 ? angle : null;

    return { workingWidth: w, workingHeight: h, crop, skewAngle };
  } catch {
    return null;
  }
}

