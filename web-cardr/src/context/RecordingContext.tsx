import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

interface RecordingState {
  /** The note title currently being recorded */
  noteTitle: string | null;
  /** Contact name associated with the recording */
  contactName: string | null;
  /** Timestamp when recording started */
  startedAt: number | null;
}

interface RecordingContextType {
  recording: RecordingState;
  startRecording: (noteTitle: string, contactName?: string | null) => void;
  stopRecording: () => void;
  isRecording: boolean;
}

const STORAGE_KEY = "cardscanpro_active_recording";

const emptyState: RecordingState = { noteTitle: null, contactName: null, startedAt: null };

const load = (): RecordingState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : emptyState;
  } catch {
    return emptyState;
  }
};

const RecordingContext = createContext<RecordingContextType>({
  recording: emptyState,
  startRecording: () => {},
  stopRecording: () => {},
  isRecording: false,
});

export const useRecording = () => useContext(RecordingContext);

export const RecordingProvider = ({ children }: { children: ReactNode }) => {
  const [recording, setRecording] = useState<RecordingState>(load);

  const persist = (state: RecordingState) => {
    if (state.startedAt) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const startRecording = useCallback((noteTitle: string, contactName?: string | null) => {
    const state: RecordingState = { noteTitle, contactName: contactName || null, startedAt: Date.now() };
    setRecording(state);
    persist(state);
  }, []);

  const stopRecording = useCallback(() => {
    setRecording(emptyState);
    persist(emptyState);
  }, []);

  return (
    <RecordingContext.Provider value={{ recording, startRecording, stopRecording, isRecording: !!recording.startedAt }}>
      {children}
    </RecordingContext.Provider>
  );
};
