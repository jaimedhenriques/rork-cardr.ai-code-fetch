// transcribe-diarize
//
// Server-side transcription WITH speaker diarization. Accepts an uploaded
// audio file (multipart/form-data, field `audio`) or a hosted `source_url`,
// runs it through ElevenLabs Scribe with `diarize=true`, then groups the
// word-level results into speaker turns and returns a transcript formatted as:
//
//   [00:00] Speaker 1: ...
//   [00:14] Speaker 2: ...
//
// This is what makes meetings read like a real conversation (Granola/Otter
// grade) instead of one undifferentiated block of text.
//
// Deploy:  supabase functions deploy transcribe-diarize --no-verify-jwt
//
// Required secrets (set ONE transcription path):
//   • Rork proxy (recommended — matches the rest of the app):
//       supabase secrets set TOOLKIT_URL="<EXPO_PUBLIC_TOOLKIT_URL>"
//       supabase secrets set RORK_TOOLKIT_SECRET_KEY="<EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY>"
//   • OR your own ElevenLabs key (used directly if present):
//       supabase secrets set ELEVENLABS_API_KEY="<your key>"

// deno-lint-ignore-file no-explicit-any
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ELEVEN_DIRECT = "https://api.elevenlabs.io";

interface ScribeWord {
  text?: string;
  type?: string; // "word" | "spacing" | "audio_event"
  start?: number;
  end?: number;
  speaker_id?: string;
}

interface ScribeResult {
  text?: string;
  language_code?: string;
  words?: ScribeWord[];
}

interface Segment {
  speaker: string; // human label, e.g. "Speaker 1"
  start: number; // seconds
  text: string;
}

function stamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * Group Scribe's word-level output into contiguous speaker turns and assign
 * stable, human-friendly labels ("Speaker 1", "Speaker 2", …) in the order
 * each speaker first appears.
 */
function buildSegments(result: ScribeResult): Segment[] {
  const words = result.words ?? [];
  if (words.length === 0) return [];

  const labels = new Map<string, string>();
  const labelFor = (id: string): string => {
    if (!labels.has(id)) labels.set(id, `Speaker ${labels.size + 1}`);
    return labels.get(id)!;
  };

  const segments: Segment[] = [];
  let current: Segment | null = null;

  for (const w of words) {
    if (w.type === "spacing") {
      if (current) current.text += w.text ?? " ";
      continue;
    }
    const id = w.speaker_id ?? "speaker_0";
    const label = labelFor(id);
    if (!current || current.speaker !== label) {
      if (current) segments.push(current);
      current = { speaker: label, start: w.start ?? 0, text: "" };
    }
    current.text += w.text ?? "";
  }
  if (current) segments.push(current);

  return segments
    .map((s) => ({ ...s, text: s.text.trim() }))
    .filter((s) => s.text.length > 0);
}

function formatTranscript(segments: Segment[]): string {
  return segments
    .map((s) => `[${stamp(s.start)}] ${s.speaker}: ${s.text}`)
    .join("\n");
}

async function callScribe(form: FormData): Promise<Response> {
  const toolkitUrl = Deno.env.get("TOOLKIT_URL") ??
    Deno.env.get("EXPO_PUBLIC_TOOLKIT_URL");
  const toolkitKey = Deno.env.get("RORK_TOOLKIT_SECRET_KEY") ??
    Deno.env.get("EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY");
  const elevenKey = Deno.env.get("ELEVENLABS_API_KEY");

  // Prefer the Rork proxy (keeps billing/cost-tracking consistent with the
  // rest of the app). Fall back to a direct ElevenLabs key if provided.
  if (toolkitUrl && toolkitKey) {
    const base = toolkitUrl.replace(/\/$/, "");
    return await fetch(`${base}/v2/elevenlabs/v1/speech-to-text`, {
      method: "POST",
      headers: { Authorization: `Bearer ${toolkitKey}` },
      body: form,
    });
  }
  if (elevenKey) {
    return await fetch(`${ELEVEN_DIRECT}/v1/speech-to-text`, {
      method: "POST",
      headers: { "xi-api-key": elevenKey },
      body: form,
    });
  }
  throw new Error("missing-transcription-credentials");
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const inbound = await req.formData();
    const audio = inbound.get("audio");
    const sourceUrl = inbound.get("source_url");
    const fallbackText = (inbound.get("fallbackText") as string) ?? "";
    const langCode = (inbound.get("langCode") as string) ?? "";

    // Build the Scribe request.
    const scribeForm = new FormData();
    scribeForm.append("model_id", "scribe_v2");
    scribeForm.append("diarize", "true");
    scribeForm.append("timestamps_granularity", "word");
    // Only constrain the language when the caller explicitly asked for one;
    // otherwise let Scribe auto-detect (more reliable across languages).
    if (langCode && langCode !== "en-US" && langCode !== "en") {
      scribeForm.append("language_code", langCode.split("-")[0]);
    }

    if (audio instanceof File) {
      scribeForm.append("file", audio, audio.name || "recording.webm");
    } else if (typeof sourceUrl === "string" && sourceUrl.length > 0) {
      scribeForm.append("source_url", sourceUrl);
    } else {
      // Nothing to transcribe server-side — echo the browser fallback so the
      // client still gets a usable transcript.
      return new Response(
        JSON.stringify({ transcript: fallbackText, source: "browser", segments: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resp = await callScribe(scribeForm);
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error("Scribe error", resp.status, detail.slice(0, 500));
      // Graceful degradation: fall back to the browser transcript if we have it.
      const status = resp.status === 429 || resp.status === 402 ? resp.status : 200;
      return new Response(
        JSON.stringify({
          transcript: fallbackText,
          source: "browser",
          segments: [],
          error: status === 200 ? undefined : "Transcription service unavailable",
        }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = (await resp.json()) as ScribeResult;
    const segments = buildSegments(result);
    const speakerCount = new Set(segments.map((s) => s.speaker)).size;
    const transcript = segments.length > 0
      ? formatTranscript(segments)
      : (result.text ?? fallbackText);

    return new Response(
      JSON.stringify({
        transcript,
        source: segments.length > 0 ? "diarized" : "ai",
        segments,
        speakerCount,
        language: result.language_code ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("transcribe-diarize failed", err);
    return new Response(
      JSON.stringify({ error: "Failed to transcribe audio" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
