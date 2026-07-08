import { useState, useRef, useCallback, useEffect } from "react";

interface StopResult {
  audioBlob: Blob | null;
  transcript: string;
  duration: number;
  highlights: RecordingHighlight[];
}

/** A moment the user flagged while recording (Otter-style highlight). */
export interface RecordingHighlight {
  time: number; // seconds from recording start
  snippet: string; // last words heard around that moment
}

/**
 * Audio source for a recording session:
 * - "mic": your microphone only (in-person meetings, calls on speaker).
 * - "system": the other participants' audio captured from a shared browser
 *   tab or your screen (e.g. Zoom/Meet/Teams running in the browser) — this is
 *   what lets Cardr transcribe people you're talking to on a video call.
 * - "both": mixes your mic with the shared tab/system audio so the whole
 *   conversation is captured in one track.
 */
export type AudioSource = "mic" | "system" | "both";

export const useAudioRecorder = (lang: string = "en-US") => {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [liveText, setLiveText] = useState("");
  const [highlightCount, setHighlightCount] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fullTranscriptRef = useRef("");
  const recordingRef = useRef(false);
  const audioChunksRef = useRef<Blob[]>([]);
  const resolveStopRef = useRef<((value: StopResult) => void) | null>(null);
  const durationRef = useRef(0);
  const startedAtRef = useRef(0);
  const highlightsRef = useRef<RecordingHighlight[]>([]);
  const lastFinalAtRef = useRef(0);
  const speakerIdxRef = useRef(1);
  // Streams + Web Audio graph we must tear down on stop.
  const sourceStreamsRef = useRef<MediaStream[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  const isSupported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  const isSpeechSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const isSystemAudioSupported = typeof window !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch (err) { console.error("Error stopping recognition:", err); }
      if (mediaRecorderRef.current?.state !== "inactive") {
        try { mediaRecorderRef.current?.stop(); } catch (err) { console.error("Error stopping media recorder:", err); }
      }
    };
  }, []);

  const start = useCallback(async (source: AudioSource = "mic") => {
    // Build the recording stream from the requested source(s). For "system"
    // and "both" we ask the browser to share a tab/screen with its audio, then
    // (for "both") mix it with the mic into a single track via Web Audio.
    sourceStreamsRef.current = [];
    let stream: MediaStream;

    if (source === "mic") {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      sourceStreamsRef.current.push(mic);
      stream = mic;
    } else {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      sourceStreamsRef.current.push(display);
      if (display.getAudioTracks().length === 0) {
        display.getTracks().forEach((t) => t.stop());
        throw new Error("no-system-audio");
      }

      if (source === "system") {
        stream = display;
      } else {
        // "both": mix mic + shared audio into one output track.
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        sourceStreamsRef.current.push(mic);
        const ctx = new AudioContext();
        audioContextRef.current = ctx;
        const destination = ctx.createMediaStreamDestination();
        ctx.createMediaStreamSource(display).connect(destination);
        ctx.createMediaStreamSource(mic).connect(destination);
        stream = new MediaStream([
          ...destination.stream.getAudioTracks(),
          ...display.getVideoTracks(),
        ]);
      }
    }

    // MediaRecorder for actual audio capture
    audioChunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const mediaRecorder = new MediaRecorder(stream, { mimeType });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      stream.getTracks().forEach((t) => t.stop());
      sourceStreamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      sourceStreamsRef.current = [];
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (resolveStopRef.current) {
        resolveStopRef.current({
          audioBlob: blob,
          transcript: fullTranscriptRef.current.trim(),
          duration: durationRef.current,
          highlights: highlightsRef.current,
        });
        resolveStopRef.current = null;
      }
    };

    mediaRecorder.start(1000);
    mediaRecorderRef.current = mediaRecorder;

    // Web Speech API for live preview text
    fullTranscriptRef.current = "";
    setLiveText("");

    if (isSpeechSupported) {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            const text = event.results[i][0].transcript.trim();
            if (!text) continue;
            // Timestamp + speaker-turn markers help the AI summarizer infer
            // who said what. We rotate between Speaker 1/2 after a >=1.5s gap.
            const now = Date.now();
            const gap = lastFinalAtRef.current ? (now - lastFinalAtRef.current) / 1000 : 0;
            const elapsed = Math.max(0, Math.floor((now - startedAtRef.current) / 1000));
            const stamp = `[${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}]`;
            if (!fullTranscriptRef.current) {
              speakerIdxRef.current = 1;
              fullTranscriptRef.current = `${stamp} Speaker 1: ${text} `;
            } else if (gap >= 1.5) {
              speakerIdxRef.current = speakerIdxRef.current === 1 ? 2 : 1;
              fullTranscriptRef.current += `\n${stamp} Speaker ${speakerIdxRef.current}: ${text} `;
            } else {
              fullTranscriptRef.current += `${text} `;
            }
            lastFinalAtRef.current = now;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setLiveText(`${fullTranscriptRef.current}${interim}`.trim());
      };

      recognition.onerror = (event: any) => {
        if (event.error === "no-speech" || event.error === "aborted") return;
      };

      recognition.onend = () => {
        if (recordingRef.current) try { recognition.start(); } catch (err) { console.error("Error restarting recognition:", err); }
      };

      recognition.start();
      recognitionRef.current = recognition;
    }

    setRecording(true);
    recordingRef.current = true;
    setDuration(0);
    durationRef.current = 0;
    highlightsRef.current = [];
    setHighlightCount(0);
    startedAtRef.current = Date.now();
    lastFinalAtRef.current = 0;
    speakerIdxRef.current = 1;
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDuration((d) => d + 1);
    }, 1000);
  }, [isSupported, isSpeechSupported]);

  /** Flag the current moment as a highlight, capturing the last words heard. */
  const markHighlight = useCallback(() => {
    if (!recordingRef.current) return;
    const words = fullTranscriptRef.current
      .replace(/\[\d{1,2}:\d{2}\]\s*/g, "")
      .replace(/Speaker\s+\d+:\s*/g, "")
      .trim()
      .split(/\s+/);
    const snippet = words.slice(-18).join(" ");
    highlightsRef.current.push({ time: durationRef.current, snippet });
    setHighlightCount(highlightsRef.current.length);
  }, []);

  const pause = useCallback(() => {
    if (!recordingRef.current) return;
    setPaused(true);
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
    }
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch (err) { console.error("Error stopping recognition:", err); }
  }, []);

  const resume = useCallback(() => {
    if (!recordingRef.current) return;
    setPaused(false);
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
    }
    if (isSpeechSupported && recognitionRef.current) {
      try { recognitionRef.current.start(); } catch (err) { console.error("Error starting recognition:", err); }
    }
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDuration((d) => d + 1);
    }, 1000);
  }, [isSpeechSupported]);

  const stop = useCallback((): Promise<StopResult> => {
    return new Promise((resolve) => {
      recordingRef.current = false;
      setRecording(false);
      setPaused(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch (err) { console.error("Error stopping recognition:", err); }

      resolveStopRef.current = resolve;

      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop();
      } else {
        resolve({
          audioBlob: null,
          transcript: fullTranscriptRef.current.trim(),
          duration: durationRef.current,
          highlights: highlightsRef.current,
        });
      }
    });
  }, []);

  return { recording, paused, duration, liveText, highlightCount, isSupported, isSpeechSupported, isSystemAudioSupported, start, stop, pause, resume, markHighlight };
};
