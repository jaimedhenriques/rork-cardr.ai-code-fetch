import { useState, useRef, useCallback, useEffect } from "react";

interface StopResult {
  audioBlob: Blob | null;
  transcript: string;
  duration: number;
}

export const useAudioRecorder = (lang: string = "en-US") => {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [liveText, setLiveText] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fullTranscriptRef = useRef("");
  const recordingRef = useRef(false);
  const audioChunksRef = useRef<Blob[]>([]);
  const resolveStopRef = useRef<((value: StopResult) => void) | null>(null);
  const durationRef = useRef(0);
  const startedAtRef = useRef(0);
  const lastFinalAtRef = useRef(0);
  const speakerIdxRef = useRef(1);

  const isSupported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  const isSpeechSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch (err) { console.error("Error stopping recognition:", err); }
      if (mediaRecorderRef.current?.state !== "inactive") {
        try { mediaRecorderRef.current?.stop(); } catch (err) { console.error("Error stopping media recorder:", err); }
      }
    };
  }, []);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

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
      if (resolveStopRef.current) {
        resolveStopRef.current({
          audioBlob: blob,
          transcript: fullTranscriptRef.current.trim(),
          duration: durationRef.current,
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
    startedAtRef.current = Date.now();
    lastFinalAtRef.current = 0;
    speakerIdxRef.current = 1;
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDuration((d) => d + 1);
    }, 1000);
  }, [isSupported, isSpeechSupported]);

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
        });
      }
    });
  }, []);

  return { recording, paused, duration, liveText, isSupported, isSpeechSupported, start, stop, pause, resume };
};
