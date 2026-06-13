import { motion, AnimatePresence } from "framer-motion";
import { useApp, type Contact } from "@/context/AppContext";
import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Camera, ScanLine, X, Check, Loader2, Upload, Sparkles, Globe, Linkedin,
  MapPin, RotateCcw, Play, AlertTriangle, UserPlus, CameraOff,
  HelpCircle, Flashlight, FlashlightOff, QrCode, CreditCard, BadgeCheck, Image as ImageIcon,
  Download, Mail, FileSpreadsheet, FolderOpen, ArrowRight, Plus, Settings2, ChevronDown, ChevronUp
} from "lucide-react";
import sampleBadge from "@/assets/sample-badge.jpg";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import UpgradePrompt from "@/components/UpgradePrompt";
import { useLanguage } from "@/context/LanguageContext";
import { useActiveEvent } from "@/hooks/useActiveEvent";
import { useAuth } from "@/context/AuthContext";
import { preprocessScanImage } from "@/lib/image-preprocess";
import { recordPreprocessRun } from "@/lib/preprocess-stats";
import PreprocessPreviewDialog from "@/components/scan/PreprocessPreviewDialog";
import {
  getScanPreprocessOptions,
  toPreprocessOptions,
} from "@/lib/scan-preprocess-options";
import { Eye } from "lucide-react";
import { persistScanArtifact } from "@/lib/scan-artifacts";
import { cleanFolderName, findFolderByName } from "@/lib/folder-match";
import { CalendarDays } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type CameraStatus = "unknown" | "available" | "denied" | "unavailable";
type ScanMode = "badge" | "card" | "qr";

const SCAN_MODES = [
  { id: "badge" as ScanMode, icon: BadgeCheck, label: "Event Badge" },
  { id: "card" as ScanMode, icon: CreditCard, label: "Paper Card" },
  { id: "qr" as ScanMode, icon: QrCode, label: "LinkedIn QR" },
];

const MODE_INSTRUCTIONS: Record<ScanMode, string> = {
  badge: "Capture the full badge,\nincluding all the text on it.",
  card: "Point at a paper card then\ntap the capture button.",
  qr: "Point at any\nLinkedIn QR code.",
};

type ExportColumn = {
  key: string;       // local Contact field
  remote: string;    // backend column name
  label: string;
  group: "Identity" | "Contact" | "Company" | "Context";
  defaultOn: boolean;
  required?: boolean;
};

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: "name",        remote: "name",                 label: "Name",         group: "Identity", defaultOn: true, required: true },
  { key: "title",       remote: "title",                label: "Title",        group: "Identity", defaultOn: true },
  { key: "company",     remote: "company",              label: "Company",      group: "Company",  defaultOn: true },
  { key: "email",       remote: "email",                label: "Email",        group: "Contact",  defaultOn: true },
  { key: "phone",       remote: "phone",                label: "Phone",        group: "Contact",  defaultOn: true },
  { key: "linkedin",    remote: "linkedin",             label: "LinkedIn",     group: "Contact",  defaultOn: true },
  { key: "website",     remote: "website",              label: "Website",      group: "Company",  defaultOn: false },
  { key: "location",    remote: "location",             label: "Location",     group: "Company",  defaultOn: false },
  { key: "industry",    remote: "industry",             label: "Industry",     group: "Company",  defaultOn: false },
  { key: "notes",       remote: "notes",                label: "Notes",        group: "Context",  defaultOn: true },
  { key: "scannedAt",   remote: "scanned_at",           label: "Scanned at",   group: "Context",  defaultOn: true },
  { key: "eventName",   remote: "__event_name",         label: "Event",        group: "Context",  defaultOn: true },
  { key: "folderName",  remote: "__folder_name",        label: "Folder",       group: "Context",  defaultOn: true },
  { key: "folderId",    remote: "folder_id",            label: "Folder ID",    group: "Context",  defaultOn: false },
];

const ScanBadge = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { addContact, updateContact, canAddContact, contacts, contactLimit, isGuest, folders, addFolder, profile } = useApp();
  const { activeEventId, activeEvent, setActiveEventId, events: eventList, linkContactToActiveEvent, createEvent } = useActiveEvent();
  const { user } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [scannedData, setScannedData] = useState<Partial<Contact> | null>(null);
  const [scanConfidence, setScanConfidence] = useState<Record<string, number>>({});
  const [scanBoxes, setScanBoxes] = useState<Record<string, { x: number; y: number; w: number; h: number }>>({});
  const [manualImage, setManualImage] = useState<string | null>(null);
  const [activeBoxField, setActiveBoxField] = useState<string | null>(null);
  // Small status indicator showing why preprocessing was skipped (timeout, max pixels, etc.)
  const [preprocessSkipReason, setPreprocessSkipReason] = useState<string | null>(null);
  // Folder concept replaced by event concept; keep dummy for compat with existing field shape
  const selectedFolder = "";
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  // Toggle for the preprocessing comparison dialog. Lets the operator inspect
  // what the OCR pipeline will see (auto-cropped + deskewed) vs the raw frame.
  const [showPreprocessPreview, setShowPreprocessPreview] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("unknown");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualData, setManualData] = useState({ name: "", company: "", title: "", email: "", phone: "", notes: "" });
  const [scanMode, setScanMode] = useState<ScanMode>("badge");
  const [flashOn, setFlashOn] = useState(false);
  const [showHowTo, setShowHowTo] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("cardscanpro_scan_intro_seen") !== "1";
  });
  const [dontShowIntro, setDontShowIntro] = useState(true);
  const [autoSaving, setAutoSaving] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState<{ existing: Contact; scanned: Partial<Contact>; reason: string } | null>(null);
  const [scanFailure, setScanFailure] = useState<{
    reason: "no_text" | "partial" | "error";
    message: string;
    attempts: number;
  } | null>(null);
  const [folderPrompt, setFolderPrompt] = useState<{
    contactId: string;
    contactName: string;
    suggestedName: string;
  } | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  // Post-save review: shows the saved contact + a folder picker before navigating away.
  const [postSaveReview, setPostSaveReview] = useState<{
    contactId: string;
    contactName: string;
    folderId: string | null;
  } | null>(null);
  const [savingFolderChange, setSavingFolderChange] = useState(false);
  const [reviewNewFolderName, setReviewNewFolderName] = useState("");

  // Auto-assign preference: when ON, every new scan is linked to the active event.
  // When ON but no active event is selected, we prompt the user post-save.
  const AUTO_ASSIGN_KEY = "cardscanpro_auto_assign_event";
  const [autoAssignToEvent, setAutoAssignToEventState] = useState<boolean>(() => {
    try { return localStorage.getItem(AUTO_ASSIGN_KEY) !== "0"; } catch { return true; }
  });
  const setAutoAssignToEvent = (v: boolean) => {
    setAutoAssignToEventState(v);
    try { localStorage.setItem(AUTO_ASSIGN_KEY, v ? "1" : "0"); } catch {}
  };
  // Post-scan event picker when auto-assign is ON but no active event is set.
  const [eventPickerPrompt, setEventPickerPrompt] = useState<{
    contactId: string;
    contactName: string;
  } | null>(null);
  const [linkingToEvent, setLinkingToEvent] = useState(false);

  // ─── Session-export tracking ───
  // Scanning session: contact IDs saved during the current run, plus
  // started/lastUpdated timestamps so we can auto-expire stale sessions
  // (default: 24h) and surface freshness to the user.
  const SESSION_KEY = "cardscanpro_scan_session_ids";          // legacy: ids only
  const SESSION_META_KEY = "cardscanpro_scan_session_v2";       // {ids, startedAt, lastUpdatedAt}
  const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;               // 24h

  type SessionState = { ids: string[]; startedAt: number | null; lastUpdatedAt: number | null };

  const readPersistedSession = (): SessionState => {
    if (typeof window === "undefined") return { ids: [], startedAt: null, lastUpdatedAt: null };
    try {
      const rawV2 = localStorage.getItem(SESSION_META_KEY);
      if (rawV2) {
        const parsed = JSON.parse(rawV2) as Partial<SessionState>;
        const ids = Array.isArray(parsed.ids) ? parsed.ids.filter((x): x is string => typeof x === "string") : [];
        const startedAt = typeof parsed.startedAt === "number" ? parsed.startedAt : null;
        const lastUpdatedAt = typeof parsed.lastUpdatedAt === "number" ? parsed.lastUpdatedAt : null;
        // Auto-expire stale sessions
        if (lastUpdatedAt && Date.now() - lastUpdatedAt > SESSION_MAX_AGE_MS) {
          try {
            localStorage.removeItem(SESSION_META_KEY);
            localStorage.removeItem(SESSION_KEY);
          } catch {}
          return { ids: [], startedAt: null, lastUpdatedAt: null };
        }
        return { ids, startedAt, lastUpdatedAt };
      }
      // Migrate legacy ids-only key (no timestamp → treat as freshly seen now)
      const rawLegacy = localStorage.getItem(SESSION_KEY);
      if (rawLegacy) {
        const ids = (JSON.parse(rawLegacy) as string[]).filter((x): x is string => typeof x === "string");
        const now = Date.now();
        const migrated: SessionState = { ids, startedAt: now, lastUpdatedAt: now };
        try { localStorage.setItem(SESSION_META_KEY, JSON.stringify(migrated)); } catch {}
        return migrated;
      }
    } catch {}
    return { ids: [], startedAt: null, lastUpdatedAt: null };
  };

  const [sessionState, setSessionState] = useState<SessionState>(() => readPersistedSession());
  const sessionContactIds = sessionState.ids;
  const sessionStartedAt = sessionState.startedAt;
  const sessionLastUpdatedAt = sessionState.lastUpdatedAt;
  const sessionExpiresAt = sessionLastUpdatedAt ? sessionLastUpdatedAt + SESSION_MAX_AGE_MS : null;



  const [showExportSheet, setShowExportSheet] = useState(false);
  const [exportingEmail, setExportingEmail] = useState(false);
  const [emailConfirmStep, setEmailConfirmStep] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("cardscanpro_export_columns");
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return EXPORT_COLUMNS.filter((c) => c.defaultOn).map((c) => c.key);
  });

  useEffect(() => {
    try {
      localStorage.setItem("cardscanpro_export_columns", JSON.stringify(selectedColumns));
    } catch {}
  }, [selectedColumns]);

  // Periodically re-check expiry while the page is open + on focus
  useEffect(() => {
    const tick = () => {
      setSessionState((prev) => {
        if (!prev.lastUpdatedAt) return prev;
        if (Date.now() - prev.lastUpdatedAt > SESSION_MAX_AGE_MS) {
          try {
            localStorage.removeItem(SESSION_META_KEY);
            localStorage.removeItem(SESSION_KEY);
          } catch {}
          return { ids: [], startedAt: null, lastUpdatedAt: null };
        }
        return prev;
      });
    };
    const id = window.setInterval(tick, 60_000);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, []);

  const persistSession = useCallback((ids: string[]) => {
    const now = Date.now();
    setSessionState((prev) => {
      const next: SessionState = {
        ids,
        startedAt: ids.length === 0 ? null : (prev.startedAt ?? now),
        lastUpdatedAt: ids.length === 0 ? null : now,
      };
      try {
        if (ids.length === 0) {
          localStorage.removeItem(SESSION_META_KEY);
          localStorage.removeItem(SESSION_KEY);
        } else {
          localStorage.setItem(SESSION_META_KEY, JSON.stringify(next));
          localStorage.setItem(SESSION_KEY, JSON.stringify(ids));
        }
      } catch {}
      return next;
    });
  }, []);

  const addToSession = useCallback((id: string) => {
    setSessionState((prev) => {
      if (prev.ids.includes(id)) return prev;
      const now = Date.now();
      const next: SessionState = {
        ids: [...prev.ids, id],
        startedAt: prev.startedAt ?? now,
        lastUpdatedAt: now,
      };
      try {
        localStorage.setItem(SESSION_META_KEY, JSON.stringify(next));
        localStorage.setItem(SESSION_KEY, JSON.stringify(next.ids));
      } catch {}
      return next;
    });
  }, []);

  const clearSession = useCallback(() => {
    setSessionState({ ids: [], startedAt: null, lastUpdatedAt: null });
    try {
      localStorage.removeItem(SESSION_META_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch {}
  }, []);


  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Last raw scan result — used to persist a debug/audit artifact after save.
  const lastScanRef = useRef<{
    imageDataUrl: string | null;
    rawText: string | null;
    structured: Record<string, unknown> | null;
    confidence: Record<string, number> | null;
    boxes: Record<string, { x: number; y: number; w: number; h: number }> | null;
    model: string | null;
    scanMode: string | null;
    preprocessGuard: string | null;
  } | null>(null);

  useEffect(() => {
    const checkCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setCameraStatus("unavailable"); return; }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCameraStatus(devices.some((d) => d.kind === "videoinput") ? "available" : "unavailable");
      } catch { setCameraStatus("unknown"); }
    };
    checkCamera();
  }, []);

  // Auto-trigger demo scan when navigated with ?demo=true
  const demoTriggered = useRef(false);
  useEffect(() => {
    if (searchParams.get("demo") === "true" && !demoTriggered.current && !scanning && !scannedData) {
      demoTriggered.current = true;
      setCapturedImage(sampleBadge);
      processImage(sampleBadge);
    }
  }, [searchParams]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("unavailable");
      setCameraError("Your browser doesn't support camera access.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      streamRef.current = stream;
      setCameraActive(true);
      setCameraStatus("available");
    } catch (err: any) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCameraStatus("denied");
        setCameraError("Camera permission denied. Allow access in browser settings.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setCameraStatus("unavailable");
        setCameraError("No camera found on this device.");
      } else if (name === "OverconstrainedError") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          streamRef.current = stream;
          setCameraActive(true); setCameraStatus("available"); return;
        } catch { setCameraError("Camera couldn't be started."); }
      } else {
        setCameraError(`Camera error: ${err?.message || "Unknown"}`);
      }
      toast.error(cameraError || "Camera unavailable");
    }
  }, []);

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.play().catch((e) => console.warn("video.play() failed:", e));
    }
  }, [cameraActive]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
    setFlashOn(false);
  }, []);

  const toggleFlash = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const capabilities = track.getCapabilities() as any;
      if (capabilities?.torch) {
        const newState = !flashOn;
        await track.applyConstraints({ advanced: [{ torch: newState } as any] });
        setFlashOn(newState);
      } else {
        toast.error("Flashlight not supported on this device");
      }
    } catch {
      toast.error("Flashlight not available");
    }
  }, [flashOn]);

  // Convert a Blob to a data URL without ever touching a canvas.
  // Critical for QR mode where any re-encode can damage finder patterns.
  const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
      reader.readAsDataURL(blob);
    });

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video) return;

    // ---- STRICT QR PATH ----
    // Bypass all canvas writes: grab the original camera frame as a Blob via
    // ImageCapture.takePhoto() and pass its raw bytes straight to OCR. If the
    // browser lacks ImageCapture, fall back to a lossless PNG canvas dump
    // (still no JPEG re-encode, no resizing, no preprocessing).
    if (scanMode === "qr") {
      try {
        const track = streamRef.current?.getVideoTracks()[0];
        const ImageCaptureCtor = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto: () => Promise<Blob> } }).ImageCapture;
        if (track && ImageCaptureCtor) {
          const ic = new ImageCaptureCtor(track);
          const blob = await ic.takePhoto();
          const dataUrl = await blobToDataUrl(blob);
          console.info("[scan][qr] strict capture via ImageCapture", { bytes: blob.size, type: blob.type });
          setCapturedImage(dataUrl);
          stopCamera();
          processImage(dataUrl);
          return;
        }
      } catch (err) {
        console.warn("[scan][qr] ImageCapture failed, falling back to lossless PNG", err);
      }
      if (!canvas) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/png"); // lossless, no quality param
      console.info("[scan][qr] fallback capture via lossless PNG", { w: canvas.width, h: canvas.height });
      setCapturedImage(dataUrl);
      stopCamera();
      processImage(dataUrl);
      return;
    }

    // ---- DEFAULT PATH (badge / card) ----
    if (!canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(dataUrl);
    stopCamera();
    processImage(dataUrl);
  }, [stopCamera, scanMode]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Image too large (max 10MB)."); return; }
    const reader = new FileReader();
    reader.onload = () => { const dataUrl = reader.result as string; setCapturedImage(dataUrl); processImage(dataUrl); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const toBase64 = async (src: string): Promise<string> => {
    const res = await fetch(src);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  // Helpers for duplicate detection
  const normalizeStr = (s?: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  const normalizePhone = (s?: string) => (s || "").replace(/[^0-9+]/g, "");

  const findExistingDuplicate = useCallback(
    (c: Partial<Contact>): { existing: Contact; reason: string } | null => {
      const email = normalizeStr(c.email);
      const phone = normalizePhone(c.phone);
      const name = normalizeStr(c.name);
      const company = normalizeStr(c.company);

      if (email) {
        const hit = contacts.find((x) => normalizeStr(x.email) === email);
        if (hit) return { existing: hit, reason: `Same email: ${hit.email}` };
      }
      if (phone && phone.length >= 7) {
        const hit = contacts.find((x) => normalizePhone(x.phone) === phone);
        if (hit) return { existing: hit, reason: `Same phone: ${hit.phone}` };
      }
      if (name && name.length >= 3) {
        // Require name + company match to avoid false positives on common names
        const hit = contacts.find(
          (x) => normalizeStr(x.name) === name && (!company || normalizeStr(x.company) === company)
        );
        if (hit) return { existing: hit, reason: `Same name${company ? " & company" : ""}: ${hit.name}` };
      }
      return null;
    },
    [contacts]
  );

  // Resolve (or lazily create) the folder that mirrors the active event.
  // Returns the folder id + name so callers can show a confirmation toast.
  const resolveActiveEventFolder = useCallback(async (): Promise<{ id: string; name: string } | null> => {
    if (!activeEvent || !autoAssignToEvent) return null;
    const eventFolderName = cleanFolderName(activeEvent.title);
    if (!eventFolderName) return null;
    const existing = findFolderByName(folders, eventFolderName);
    if (existing) return { id: existing.id, name: existing.name };
    const created = await addFolder({
      id: Date.now().toString(),
      name: eventFolderName,
      emoji: "📅",
      createdAt: new Date().toISOString(),
    });
    if (created) return { id: created.id, name: created.name };
    return null;
  }, [activeEvent, autoAssignToEvent, folders, addFolder]);

  // Auto-save and navigate to the new contact
  const autoSaveAndNavigate = useCallback(async (contact: Partial<Contact>) => {
    if (!contact.name) return;
    if (!canAddContact) { setShowUpgrade(true); return; }
    setAutoSaving(true);

    // If an active event is set AND auto-assign is on, ensure a matching folder exists and pre-assign it
    const eventFolder = await resolveActiveEventFolder();
    const folderIdForContact = eventFolder?.id;

    const newContact: Contact = {
      id: Date.now().toString(),
      name: contact.name || "",
      company: contact.company || "",
      title: contact.title || "",
      email: contact.email || "",
      phone: contact.phone || "",
      linkedin: contact.linkedin,
      website: contact.website,
      location: contact.location,
      industry: contact.industry,
      companySize: contact.companySize,
      enriched: false,
      notes: contact.notes,
      folderId: folderIdForContact,
      scannedAt: new Date().toISOString(),
    };
    const created = await addContact(newContact);
    const finalId = (created && (created as Contact).id) || newContact.id;
    if (finalId) addToSession(finalId);
    // Persist scan artifact (image + raw text + structured) for debugging/auditing.
    if (user && finalId && lastScanRef.current) {
      void persistScanArtifact({
        userId: user.id,
        contactId: finalId,
        imageDataUrl: lastScanRef.current.imageDataUrl,
        rawText: lastScanRef.current.rawText,
        structured: lastScanRef.current.structured,
        confidence: lastScanRef.current.confidence,
        boxes: lastScanRef.current.boxes,
        model: lastScanRef.current.model,
        scanMode: lastScanRef.current.scanMode,
        preprocessGuard: lastScanRef.current.preprocessGuard,
      });
      lastScanRef.current = null;
    }
    if (autoAssignToEvent && activeEventId && finalId) {
      const ok = await linkContactToActiveEvent(finalId);
      if (ok) {
        toast.success(`${contact.name} saved`, {
          description: eventFolder
            ? `Added to "${activeEvent?.title}" event · 📁 ${eventFolder.name}`
            : `Added to "${activeEvent?.title}" event`,
          icon: "📅",
        });
      } else {
        toast.success(`${contact.name} ${t("scan.saved")}`, { icon: "✨" });
      }
    } else {
      toast.success(`${contact.name} ${t("scan.saved")}`, { icon: "✨" });
    }

    // Auto-assign is ON but no active event chosen → ask which event (fallback to manual selection)
    if (autoAssignToEvent && !activeEventId && eventList.length > 0 && finalId) {
      setAutoSaving(false);
      setEventPickerPrompt({ contactId: finalId, contactName: contact.name || "Contact" });
      return;
    }

    // If no active event AND user has no folders yet, offer to create one
    // before navigating away — great for first-time scanners at an event.
    if (!activeEventId && folders.length === 0 && finalId) {
      setAutoSaving(false);
      setFolderPrompt({
        contactId: finalId,
        contactName: contact.name || "Contact",
        suggestedName: contact.company?.trim() || "Scanned today",
      });
      return;
    }

    // Show a brief post-save review so the user can change the assigned folder
    // before being taken to the contact page.
    setAutoSaving(false);
    setPostSaveReview({
      contactId: finalId,
      contactName: contact.name || "Contact",
      folderId: folderIdForContact ?? null,
    });
  }, [addContact, canAddContact, navigate, activeEventId, activeEvent, linkContactToActiveEvent, t, folders.length, addToSession, autoAssignToEvent, eventList.length, user, resolveActiveEventFolder]);

  // Merge scanned fields into an existing contact (fill empties only)
  const mergeIntoExisting = useCallback((existing: Contact, scanned: Partial<Contact>) => {
    setAutoSaving(true);
    const merged: Contact = {
      ...existing,
      company: existing.company || scanned.company || "",
      title: existing.title || scanned.title || "",
      email: existing.email || scanned.email || "",
      phone: existing.phone || scanned.phone || "",
      linkedin: existing.linkedin || scanned.linkedin,
      website: existing.website || scanned.website,
      location: existing.location || scanned.location,
      notes: existing.notes || scanned.notes,
      folderId: existing.folderId || (selectedFolder || undefined),
    };
    updateContact(existing.id, merged);
    if (user && lastScanRef.current) {
      void persistScanArtifact({
        userId: user.id,
        contactId: existing.id,
        imageDataUrl: lastScanRef.current.imageDataUrl,
        rawText: lastScanRef.current.rawText,
        structured: lastScanRef.current.structured,
        confidence: lastScanRef.current.confidence,
        boxes: lastScanRef.current.boxes,
        model: lastScanRef.current.model,
        scanMode: lastScanRef.current.scanMode,
        preprocessGuard: lastScanRef.current.preprocessGuard,
      });
      lastScanRef.current = null;
    }
    toast.success(`Updated ${existing.name}`, { icon: "🔗" });
    setTimeout(() => navigate(`/contact/${existing.id}`), 600);
  }, [updateContact, navigate, selectedFolder, user]);

  const processImage = async (imageSrc: string) => {
    setScanning(true);
    try {
      const rawBase64 = imageSrc.startsWith("data:") ? imageSrc : await toBase64(imageSrc);
      // Pre-process for non-QR scans: auto-crop, deskew, contrast boost.
      // QR codes need the original geometry & pixels, so we send the EXACT
      // bytes we received — no canvas, no resize, no quality re-encode.
      let imageBase64: string;
      let preprocessStatus: { skipped: boolean; reason?: string; guard?: string } | null = null;
      let preprocessAttempts = 1;
      if (scanMode === "qr") {
        imageBase64 = rawBase64;
        console.info("[scan][qr] strict OCR payload", {
          mime: rawBase64.slice(5, rawBase64.indexOf(";")),
          approxBytes: Math.round((rawBase64.length - rawBase64.indexOf(",") - 1) * 0.75),
        });
      } else {
        const ppStart = (typeof performance !== "undefined" ? performance.now() : Date.now());
        const pp = await preprocessScanImage(rawBase64, {
          ...toPreprocessOptions(getScanPreprocessOptions()),
          // Auto-retry once or twice with exponential backoff if the first
          // attempt times out — the second pass gets a longer budget and
          // bypasses the just-tripped slow-device flag.
          maxRetries: 2,
        });
        const ppDuration = (typeof performance !== "undefined" ? performance.now() : Date.now()) - ppStart;
        imageBase64 = pp.image;
        preprocessAttempts = pp.attempts ?? 1;
        if (pp.skipped) {
          preprocessStatus = { skipped: true, reason: pp.reason, guard: pp.guard };
        }
        // Record local-only perf stats so the user can see avg duration / skip
        // rate in Settings → Diagnostics. No network involved.
        try {
          recordPreprocessRun({
            durationMs: ppDuration,
            skipped: pp.skipped,
            guard: pp.guard ?? "none",
          });
        } catch {
          /* never let stats bookkeeping break a scan */
        }
      }
      setPreprocessSkipReason(preprocessStatus?.reason ?? null);
      const { data, error } = await supabase.functions.invoke("scan-badge", {
        body: {
          imageBase64,
          preprocessMeta: {
            skipped: preprocessStatus?.skipped ?? false,
            reason: preprocessStatus?.reason ?? null,
            guard: preprocessStatus?.guard ?? "none",
            attempts: preprocessAttempts,
          },
        },
      });
      if (error) throw new Error(error.message || "Scan failed");
      if (data?.error) throw new Error(data.error);
      const contact = data.contact;
      // Stash raw + structured response so we can persist a debug artifact on save.
      lastScanRef.current = {
        imageDataUrl: imageSrc.startsWith("data:") ? imageSrc : null,
        rawText: typeof data?.rawText === "string" ? data.rawText : null,
        structured: contact ?? null,
        confidence: data?.confidence ?? null,
        boxes: (data?.boxes ?? null) as Record<string, { x: number; y: number; w: number; h: number }> | null,
        model: typeof data?.model === "string" ? data.model : null,
        scanMode,
        preprocessGuard: data?.preprocessGuard ?? null,
      };
      setScanConfidence((data?.confidence ?? {}) as Record<string, number>);
      setScanBoxes((data?.boxes ?? {}) as Record<string, { x: number; y: number; w: number; h: number }>);
      if (!contact?.name) {
        setScanning(false);
        setScanFailure((prev) => ({
          reason: "no_text",
          message: t("scan.noInfoDetected"),
          attempts: (prev?.attempts || 0) + 1,
        }));
        return;
      }

      const scanned: Partial<Contact> = {
        name: contact.name || "", company: contact.company || "", title: contact.title || "",
        email: contact.email || "", phone: contact.phone || "",
        linkedin: contact.linkedin || undefined, website: contact.website || undefined,
        location: contact.location || undefined,
      };

      // Check for an existing contact first
      const dup = findExistingDuplicate(scanned);
      if (dup) {
        setScanning(false);
        setDuplicateMatch({ existing: dup.existing, scanned, reason: dup.reason });
        return;
      }

      // Stricter auto-save: need name + (strong identifier OR company+title)
      const hasStrongId = !!(contact.email || contact.phone || contact.linkedin);
      const hasCompanyAndTitle = !!(contact.company && contact.title);
      const hasEnoughInfo = contact.name && (hasStrongId || hasCompanyAndTitle);
      if (hasEnoughInfo) {
        setScanning(false);
        autoSaveAndNavigate(scanned);
      } else {
        setScannedData(scanned);
        toast.info(t("scan.partialDetected"));
        setScanning(false);
      }
    } catch (err: any) {
      console.error("Scan error:", err);
      setScanning(false);
      setScanFailure((prev) => ({
        reason: "error",
        message: err?.message || "Something went wrong while reading the image.",
        attempts: (prev?.attempts || 0) + 1,
      }));
    }
  };

  const handleSave = () => {
    if (!scannedData?.name) return;
    if (!canAddContact) { setShowUpgrade(true); return; }
    autoSaveAndNavigate(scannedData);
  };

  const handleManualSave = async () => {
    if (!manualData.name.trim()) { toast.error("Name is required"); return; }
    if (!canAddContact) { setShowUpgrade(true); return; }
    const eventFolder = await resolveActiveEventFolder();
    const newContact: Contact = {
      id: Date.now().toString(), name: manualData.name.trim(), company: manualData.company.trim(),
      title: manualData.title.trim(), email: manualData.email.trim(), phone: manualData.phone.trim(),
      notes: manualData.notes.trim() || undefined, folderId: eventFolder?.id,
      enriched: false, scannedAt: new Date().toISOString(),
    };
    const created = await addContact(newContact);
    const finalId = (created && (created as Contact).id) || newContact.id;
    if (finalId) addToSession(finalId);
    if (activeEventId && finalId) {
      await linkContactToActiveEvent(finalId);
      toast.success(`${manualData.name} saved`, {
        description: eventFolder
          ? `Added to "${activeEvent?.title}" event · 📁 ${eventFolder.name}`
          : `Added to "${activeEvent?.title}" event`,
        icon: "📅",
      });
    } else {
      toast.success(`${manualData.name} ${t("scan.saved")}`, { icon: "✨" });
    }
    setManualData({ name: "", company: "", title: "", email: "", phone: "", notes: "" });
    setShowManualEntry(false);
    setTimeout(() => navigate(`/contact/${finalId}`), 600);
  };

  const resetScan = () => { setScannedData(null); setScanConfidence({}); setScanBoxes({}); setManualImage(null); setActiveBoxField(null); setCapturedImage(null); setCameraError(null); setAutoSaving(false); setScanFailure(null); setFolderPrompt(null); setPreprocessSkipReason(null); stopCamera(); };
  const cameraUnavailable = cameraStatus === "unavailable" || cameraStatus === "denied";

  const handleRetryScan = () => {
    setCapturedImage(null);
    setScanFailure(null);
    setPreprocessSkipReason(null);
    if (cameraStatus === "available") startCamera();
  };

  const handleRetryUpload = () => {
    setCapturedImage(null);
    setScanFailure(null);
    setPreprocessSkipReason(null);
    setTimeout(() => fileInputRef.current?.click(), 50);
  };

  const handleSwitchToManual = () => {
    // Pre-fill manual form with anything we managed to extract
    if (scannedData) {
      setManualData({
        name: scannedData.name || "",
        company: scannedData.company || "",
        title: scannedData.title || "",
        email: scannedData.email || "",
        phone: scannedData.phone || "",
        notes: scannedData.notes || "",
      });
    }
    // Preserve the captured image so the manual form can show OCR boxes
    setManualImage(capturedImage);
    setScanFailure(null);
    setScannedData(null);
    setCapturedImage(null);
    setPreprocessSkipReason(null);
    setShowManualEntry(true);
  };

  // ─── Session export helpers ───
  const sessionContacts = contacts.filter((c) => sessionContactIds.includes(c.id));
  const sessionScopeLabel = activeEvent
    ? `${activeEvent.title} (this session)`
    : `Scanning session — ${new Date().toLocaleDateString()}`;

  const formatRelative = (ts: number | null): string => {
    if (!ts) return "";
    const diffMs = Date.now() - ts;
    const abs = Math.abs(diffMs);
    const future = diffMs < 0;
    const fmt = (n: number, unit: string) => `${n}${unit}`;
    let label: string;
    if (abs < 60_000) label = "just now";
    else if (abs < 3_600_000) label = fmt(Math.floor(abs / 60_000), "m");
    else if (abs < 86_400_000) label = fmt(Math.floor(abs / 3_600_000), "h");
    else label = fmt(Math.floor(abs / 86_400_000), "d");
    if (label === "just now") return label;
    return future ? `in ${label}` : `${label} ago`;
  };

  const formatTimeShort = (ts: number | null): string => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const sessionIsExpiringSoon = sessionExpiresAt ? (sessionExpiresAt - Date.now()) < 60 * 60 * 1000 : false;



  const buildSessionCsv = () => {
    const activeCols = EXPORT_COLUMNS.filter((c) => selectedColumns.includes(c.key));
    const cols = activeCols.length > 0
      ? activeCols
      : EXPORT_COLUMNS.filter((c) => c.defaultOn);
    const folderById = new Map(folders.map((f) => [f.id, f]));
    const esc = (v: unknown) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = cols.map((c) => c.label).join(",");
    const lines = sessionContacts.map((c) =>
      cols.map((col) => {
        if (col.key === "eventName") return esc(activeEvent?.title ?? "");
        if (col.key === "folderName") {
          const f = (c as any).folderId ? folderById.get((c as any).folderId) : null;
          return esc(f ? `${f.emoji ?? ""} ${f.name}`.trim() : "");
        }
        return esc((c as any)[col.key]);
      }).join(",")
    );
    return [header, ...lines].join("\n");
  };

  const handleDownloadSessionCsv = () => {
    if (sessionContacts.length === 0) return;
    const csv = buildSessionCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `scan-session-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${sessionContacts.length} contact${sessionContacts.length === 1 ? "" : "s"} downloaded`, { icon: "⬇️" });
  };

  const handleEmailSessionCsv = async () => {
    if (sessionContacts.length === 0) return;
    const recipient = (emailRecipient || profile.email || "").trim();
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (isGuest) {
      toast.error("Sign in to email exports — try the download instead");
      return;
    }
    setExportingEmail(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const remoteCols = EXPORT_COLUMNS
        .filter((c) => selectedColumns.includes(c.key))
        .map((c) => c.remote);
      const { data, error } = await supabase.functions.invoke("quick-export-contacts", {
        body: {
          recipientEmail: recipient,
          contactIds: sessionContacts.map((c) => c.id),
          scopeLabel: sessionScopeLabel,
          timezone: tz,
          eventName: activeEvent?.title ?? null,
          columns: remoteCols.length > 0 ? remoteCols : undefined,
        },
      });
      if (error) throw new Error(error.message || "Email export failed");
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Sent to ${recipient}`, { icon: "📧" });
      setEmailConfirmStep(false);
      setShowExportSheet(false);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't send the export");
    } finally {
      setExportingEmail(false);
    }
  };

  const reviewEmailExport = () => {
    const recipient = (emailRecipient || profile.email || "").trim();
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (isGuest) {
      toast.error("Sign in to email exports — try the download instead");
      return;
    }
    setEmailConfirmStep(true);
  };

  const closeExportSheet = () => {
    setShowExportSheet(false);
    setEmailConfirmStep(false);
  };

  const openExportSheet = () => {
    setEmailRecipient(profile.email || "");
    setEmailConfirmStep(false);
    setShowColumnPicker(false);
    setShowExportSheet(true);
  };

  const toggleColumn = (key: string) => {
    const col = EXPORT_COLUMNS.find((c) => c.key === key);
    if (col?.required) return;
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectAllColumns = () => {
    setSelectedColumns(EXPORT_COLUMNS.map((c) => c.key));
  };

  const resetColumnsToDefaults = () => {
    setSelectedColumns(EXPORT_COLUMNS.filter((c) => c.defaultOn).map((c) => c.key));
  };

  const columnGroups = ["Identity", "Contact", "Company", "Context"] as const;


  // ─── Duplicate match confirmation ───
  if (duplicateMatch) {
    const { existing, scanned, reason } = duplicateMatch;
    return (
      <div className="min-h-screen pb-24 px-5 pt-14 bg-background">
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4 max-w-md mx-auto">
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <AlertTriangle size={16} className="text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Possible duplicate</p>
                <p className="text-[11px] text-muted-foreground">{reason}</p>
              </div>
            </div>

            <div className="rounded-xl border border-border p-3 bg-muted/30">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Existing contact</p>
              <p className="text-sm font-semibold text-foreground">{existing.name}</p>
              {existing.company && <p className="text-xs text-muted-foreground">{existing.company}{existing.title ? ` · ${existing.title}` : ""}</p>}
              {existing.email && <p className="text-[11px] text-muted-foreground mt-1">{existing.email}</p>}
              {existing.phone && <p className="text-[11px] text-muted-foreground">{existing.phone}</p>}
            </div>

            <div className="rounded-xl border border-primary/20 p-3 bg-primary/5">
              <p className="text-[10px] uppercase tracking-wider text-primary mb-1">Just scanned</p>
              <p className="text-sm font-semibold text-foreground">{scanned.name}</p>
              {scanned.company && <p className="text-xs text-muted-foreground">{scanned.company}{scanned.title ? ` · ${scanned.title}` : ""}</p>}
              {scanned.email && <p className="text-[11px] text-muted-foreground mt-1">{scanned.email}</p>}
              {scanned.phone && <p className="text-[11px] text-muted-foreground">{scanned.phone}</p>}
            </div>

            <div className="grid grid-cols-1 gap-2 pt-1">
              <button
                onClick={() => { const m = duplicateMatch; setDuplicateMatch(null); mergeIntoExisting(m.existing, m.scanned); }}
                className="flex items-center justify-center gap-2 text-sm py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                <Check size={16} /> Merge into existing
              </button>
              <button
                onClick={() => { const s = duplicateMatch.scanned; setDuplicateMatch(null); autoSaveAndNavigate(s); }}
                className="flex items-center justify-center gap-2 text-sm py-2.5 rounded-xl border border-border text-foreground hover:bg-muted transition-colors"
              >
                <UserPlus size={16} /> Create as new contact
              </button>
              <button
                onClick={() => { setDuplicateMatch(null); resetScan(); }}
                className="flex items-center justify-center gap-2 text-sm py-2.5 rounded-xl text-muted-foreground hover:bg-muted transition-colors"
              >
                <X size={16} /> Cancel
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Scan failure / unreliable extraction ───
  if (scanFailure) {
    const isError = scanFailure.reason === "error";
    const showAdvancedTip = scanFailure.attempts >= 2;
    const tips = scanMode === "card"
      ? [
          "Place the card on a flat, dark surface for contrast",
          "Make sure all text is in the frame and in focus",
          "Avoid glare — try turning off the flash or moving the light",
        ]
      : scanMode === "qr"
      ? [
          "Center the QR code in the frame",
          "Move closer until the code fills most of the area",
          "Increase screen brightness if scanning from a phone",
        ]
      : [
          "Capture the entire badge, including the name and company",
          "Hold steady — wait for the image to focus before tapping",
          "Try better lighting or move out of direct sunlight",
        ];

    return (
      <div className="min-h-screen pb-24 px-5 pt-14 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 max-w-md mx-auto"
        >
          {capturedImage && (
            <div className="rounded-2xl overflow-hidden border border-border h-40 relative">
              <img src={capturedImage} alt="Last capture" className="w-full h-full object-cover opacity-70" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
            </div>
          )}

          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                isError ? "bg-destructive/10" : "bg-yellow-100 dark:bg-yellow-900/30"
              }`}>
                <AlertTriangle size={18} className={isError ? "text-destructive" : "text-yellow-600"} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {isError ? "We couldn't read that one" : "Hmm, no clear info on this one"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {scanFailure.message}
                </p>
                {scanFailure.attempts > 1 && (
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Attempt {scanFailure.attempts} — no worries, it happens with tricky lighting.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-muted/40 border border-border/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                Tips for a better scan
              </p>
              <ul className="space-y-1.5">
                {tips.map((tip) => (
                  <li key={tip} className="text-[12px] text-foreground/80 flex gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleRetryScan}
                className="flex items-center justify-center gap-2 text-sm py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                <Camera size={16} /> Retake photo
              </button>
              <button
                onClick={handleRetryUpload}
                className="flex items-center justify-center gap-2 text-sm py-2.5 rounded-xl border border-border text-foreground hover:bg-muted transition-colors"
              >
                <Upload size={16} /> Upload another
              </button>
            </div>

            <button
              onClick={handleSwitchToManual}
              className="w-full flex items-center justify-center gap-2 text-sm py-2.5 rounded-xl border border-primary/30 bg-primary/5 text-primary font-medium hover:bg-primary/10 transition-colors"
            >
              <UserPlus size={16} /> Enter details manually
            </button>

            {showAdvancedTip && (
              <p className="text-[11px] text-center text-muted-foreground">
                Still no luck? Manual entry only takes a few seconds and is always reliable.
              </p>
            )}

            <button
              onClick={resetScan}
              className="w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
      </div>
    );
  }

  // ─── Auto-saving overlay ───
  if (autoSaving) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center"
          >
            <Sparkles size={28} className="text-primary" />
          </motion.div>
          <div>
            <p className="text-foreground font-semibold">{t("scan.contactSaved")}</p>
            <p className="text-muted-foreground text-xs mt-1">{t("scan.enrichingBg")}</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Post-save review: change folder before navigating to the contact ───
  if (postSaveReview) {
    const review = postSaveReview;
    const currentFolder = review.folderId
      ? folders.find((f) => f.id === review.folderId) ?? null
      : null;

    const goToContact = () => {
      const id = review.contactId;
      setPostSaveReview(null);
      setReviewNewFolderName("");
      navigate(`/contact/${id}`);
    };

    const handleSelectChange = async (value: string) => {
      if (value === "__create__") {
        // Switch to inline create input — handled below.
        setReviewNewFolderName(currentFolder?.name ?? "");
        return;
      }
      const newFolderId = value === "__none__" ? null : value;
      if (newFolderId === review.folderId) return;
      setSavingFolderChange(true);
      try {
        await updateContact(review.contactId, { folderId: newFolderId ?? undefined });
        setPostSaveReview({ ...review, folderId: newFolderId });
        const target = newFolderId ? folders.find((f) => f.id === newFolderId) : null;
        toast.success(
          target ? `Moved to ${target.emoji} ${target.name}` : "Removed from folder",
          { icon: "📁" }
        );
      } catch (e) {
        toast.error("Could not change folder");
      } finally {
        setSavingFolderChange(false);
      }
    };

    const handleCreateFolderInline = async () => {
      const name = cleanFolderName(reviewNewFolderName);
      if (!name) return;
      setSavingFolderChange(true);
      try {
        const created = await addFolder({
          id: Date.now().toString(),
          name,
          emoji: "📁",
          createdAt: new Date().toISOString(),
        });
        if (created?.id) {
          await updateContact(review.contactId, { folderId: created.id });
          setPostSaveReview({ ...review, folderId: created.id });
          toast.success(`Moved to ${created.emoji} ${created.name}`, { icon: "📁" });
          setReviewNewFolderName("");
        }
      } catch (e) {
        toast.error("Could not create folder");
      } finally {
        setSavingFolderChange(false);
      }
    };

    const showCreateInput = reviewNewFolderName !== "" || (folders.length === 0 && !currentFolder);

    return (
      <div className="min-h-screen pb-24 px-5 pt-14 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 max-w-md mx-auto"
        >
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Check size={18} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {review.contactName} saved 🎉
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pick a folder for this contact, or continue to the profile.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <FolderOpen size={12} /> Folder
              </label>
              <Select
                value={review.folderId ?? "__none__"}
                onValueChange={handleSelectChange}
                disabled={savingFolderChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a folder…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No folder</SelectItem>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      <span className="mr-1">{f.emoji}</span> {f.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__create__">
                    <span className="flex items-center gap-1.5 text-primary">
                      <Plus size={12} /> Create new folder…
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              {showCreateInput && (
                <div className="flex gap-2 pt-1">
                  <Input
                    autoFocus
                    value={reviewNewFolderName}
                    onChange={(e) => setReviewNewFolderName(e.target.value)}
                    placeholder="Folder name"
                    disabled={savingFolderChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateFolderInline();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleCreateFolderInline}
                    disabled={!cleanFolderName(reviewNewFolderName) || savingFolderChange}
                  >
                    {savingFolderChange ? <Loader2 size={14} className="animate-spin" /> : "Create"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setReviewNewFolderName("")}
                    disabled={savingFolderChange}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <Button variant="ghost" size="sm" onClick={goToContact}>
                Skip
              </Button>
              <Button size="sm" onClick={goToContact} disabled={savingFolderChange}>
                Continue <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Post-scan event picker (auto-assign on, but no active event) ───
  if (eventPickerPrompt) {
    const finish = () => {
      const id = eventPickerPrompt.contactId;
      setEventPickerPrompt(null);
      setTimeout(() => navigate(`/contact/${id}`), 200);
    };
    const linkAndFinish = async (eventId: string, makeActive: boolean) => {
      if (!user) return finish();
      setLinkingToEvent(true);
      const { error } = await supabase.from("event_contacts").insert({
        event_id: eventId,
        contact_id: eventPickerPrompt.contactId,
        user_id: user.id,
      });
      setLinkingToEvent(false);
      if (error) {
        toast.error("Couldn't link to event");
        return finish();
      }
      const ev = eventList.find((e) => e.id === eventId);
      if (makeActive) setActiveEventId(eventId);
      toast.success(`${eventPickerPrompt.contactName} → ${ev?.title || "event"}`, { icon: "📅" });
      finish();
    };
    return (
      <div className="min-h-screen px-5 pt-14 pb-24 bg-background">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto space-y-4">
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <CalendarDays size={22} className="text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Which event?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {eventPickerPrompt.contactName} is saved. Pick the event to tag them under.
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-2 max-h-[50vh] overflow-y-auto">
            {eventList.map((ev) => (
              <button
                key={ev.id}
                disabled={linkingToEvent}
                onClick={() => linkAndFinish(ev.id, false)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left hover:bg-muted/60 transition-colors disabled:opacity-50"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <CalendarDays size={15} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{ev.title}</p>
                  {ev.location && (
                    <p className="text-[11px] text-muted-foreground truncate">{ev.location}</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={linkingToEvent}
                  onClick={(e) => { e.stopPropagation(); linkAndFinish(ev.id, true); }}
                  className="text-[11px] text-primary font-semibold px-2 py-1 rounded-lg hover:bg-primary/10 shrink-0"
                  title="Link this contact and remember as active event"
                >
                  Set active
                </button>
              </button>
            ))}
            {eventList.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">No events yet.</p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => navigate("/app/events")}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm text-foreground hover:bg-muted transition-colors"
            >
              + New event
            </button>
            <button
              onClick={finish}
              className="flex-1 py-2.5 rounded-xl bg-muted text-sm text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              Skip
            </button>
          </div>

          <button
            onClick={() => { setAutoAssignToEvent(false); finish(); }}
            className="w-full text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Turn off auto-assign and don't ask again
          </button>
        </motion.div>
      </div>
    );
  }

  // ─── First-folder prompt after a successful scan (no event, no folders yet) ───
  if (folderPrompt) {
    const goNext = () => {
      const id = folderPrompt.contactId;
      setFolderPrompt(null);
      setTimeout(() => navigate(`/contact/${id}`), 200);
    };

    // Path A: just create a folder and assign the contact (no event).
    const handleCreateFolder = async (name: string) => {
      const trimmed = cleanFolderName(name);
      if (!trimmed) { toast.error("Folder name is required"); return; }
      setCreatingFolder(true);
      const created = await addFolder({
        id: Date.now().toString(),
        name: trimmed,
        emoji: "📁",
        createdAt: new Date().toISOString(),
      });
      if (created) {
        await updateContact(folderPrompt.contactId, { folderId: created.id });
        toast.success(`${folderPrompt.contactName} → ${created.emoji} ${created.name}`, { icon: "📁" });
      } else {
        toast.error("Couldn't create folder. Saved without folder.");
      }
      setCreatingFolder(false);
      goNext();
    };

    // Path B: one-click — create a new event, set it active, ensure a matching
    // folder exists, link the contact to both, and continue.
    const handleCreateEventInline = async (eventName: string) => {
      const title = (eventName || "").trim();
      if (!title) { toast.error("Event name is required"); return; }
      setCreatingFolder(true);
      const ev = await createEvent({ title });
      if (!ev) {
        toast.error("Couldn't create event.");
        setCreatingFolder(false);
        return;
      }
      // Folder mirrors event title (deduped via addFolder)
      const folder = await addFolder({
        id: Date.now().toString(),
        name: ev.title,
        emoji: "📅",
        createdAt: new Date().toISOString(),
      });
      // Link contact to event + folder
      const { error: linkErr } = await supabase.from("event_contacts").insert({
        event_id: ev.id,
        contact_id: folderPrompt.contactId,
        user_id: user?.id,
      });
      if (linkErr) console.warn("event link failed", linkErr);
      if (folder) {
        await updateContact(folderPrompt.contactId, { folderId: folder.id });
      }
      toast.success(`${folderPrompt.contactName} saved`, {
        description: `New event "${ev.title}" created · 📁 ${folder?.name ?? ev.title}`,
        icon: "🎉",
      });
      setCreatingFolder(false);
      goNext();
    };

    // Path C: pick an existing event → set active, ensure folder, link contact.
    const handlePickExistingEvent = async (eventId: string) => {
      const ev = eventList.find((e) => e.id === eventId);
      if (!ev) return;
      setCreatingFolder(true);
      setActiveEventId(ev.id);
      const folder = await addFolder({
        id: Date.now().toString(),
        name: ev.title,
        emoji: "📅",
        createdAt: new Date().toISOString(),
      });
      const { error: linkErr } = await supabase.from("event_contacts").insert({
        event_id: ev.id,
        contact_id: folderPrompt.contactId,
        user_id: user?.id,
      });
      if (linkErr) console.warn("event link failed", linkErr);
      if (folder) {
        await updateContact(folderPrompt.contactId, { folderId: folder.id });
      }
      toast.success(`${folderPrompt.contactName} saved`, {
        description: `Added to "${ev.title}" · 📁 ${folder?.name ?? ev.title}`,
        icon: "📅",
      });
      setCreatingFolder(false);
      goNext();
    };

    return (
      <div className="min-h-screen pb-24 px-5 pt-14 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 max-w-md mx-auto"
        >
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles size={18} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {folderPrompt.contactName} saved 🎉
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Group this contact under an event — we'll create the matching folder for you and tag every future scan automatically.
                </p>
              </div>
            </div>

            <FolderPromptForm
              defaultName={folderPrompt.suggestedName}
              busy={creatingFolder}
              existingEvents={eventList}
              onCreateFolder={handleCreateFolder}
              onCreateEventInline={handleCreateEventInline}
              onPickExistingEvent={handlePickExistingEvent}
              onSkip={goNext}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Review & Confirm view (partial scans) ───
  if (scannedData) {
    const fieldMeta: Array<{ key: "name" | "company" | "title" | "email" | "phone"; label: string; placeholder: string; required?: boolean; type?: string }> = [
      { key: "name", label: "Full name", placeholder: "John Doe", required: true },
      { key: "company", label: "Company", placeholder: "Acme Inc." },
      { key: "title", label: "Job title", placeholder: "Head of Sales" },
      { key: "email", label: "Email", placeholder: "john@company.com", type: "email" },
      { key: "phone", label: "Phone", placeholder: "+1 555 000 0000", type: "tel" },
    ];
    const detectedCount = fieldMeta.filter((f) => (scannedData[f.key] || "").toString().trim()).length;
    const missingRequired = !scannedData.name?.trim();
    const LOW_CONF = 0.7;
    const lowConfFields = fieldMeta.filter((f) => {
      const v = (scannedData[f.key] || "").toString().trim();
      const c = scanConfidence[f.key];
      return v && typeof c === "number" && c < LOW_CONF;
    });

    return (
      <div className="min-h-screen pb-24 px-5 pt-14 bg-background">
        <canvas ref={canvasRef} className="hidden" />
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
          {/* Header banner */}
          <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-yellow-500/15 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-yellow-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Review & confirm</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                We detected {detectedCount} of {fieldMeta.length} fields.
                {lowConfFields.length > 0
                  ? ` ${lowConfFields.length} field${lowConfFields.length > 1 ? "s need" : " needs"} your confirmation (highlighted below).`
                  : " Please verify or fill in the missing details before saving."}
              </p>
            </div>
          </div>

          {capturedImage && (
            <div className="rounded-2xl overflow-hidden border border-border h-28">
              <img src={capturedImage} alt="Scanned" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="bg-card rounded-2xl border border-border p-5 space-y-3 shadow-sm">
            {fieldMeta.map((f) => {
              const value = (scannedData[f.key] || "") as string;
              const detected = !!value.trim();
              const showMissing = !detected;
              const conf = scanConfidence[f.key];
              const hasConf = typeof conf === "number" && detected;
              const confPct = hasConf ? Math.round(conf * 100) : null;
              const isLowConf = hasConf && conf < LOW_CONF;
              const confTone = !hasConf
                ? ""
                : conf >= 0.85
                  ? "text-emerald-600 bg-emerald-500/10"
                  : conf >= LOW_CONF
                    ? "text-amber-600 bg-amber-500/10"
                    : "text-orange-600 bg-orange-500/15";
              return (
                <div key={f.key}>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                      {f.label}{f.required && <span className="text-destructive ml-0.5">*</span>}
                    </label>
                    <div className="flex items-center gap-1.5">
                      {hasConf && (
                        <span
                          title={`OCR confidence ${confPct}%`}
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${confTone}`}
                        >
                          {isLowConf ? <AlertTriangle size={9} /> : <Check size={9} />} {confPct}%
                        </span>
                      )}
                      {detected ? (
                        isLowConf ? (
                          <span className="text-[10px] font-semibold text-orange-600">Confirm</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                            <Check size={10} /> Detected
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] font-semibold text-muted-foreground">Missing — please add</span>
                      )}
                    </div>
                  </div>
                  <input
                    type={f.type || "text"}
                    value={value}
                    onChange={(e) => {
                      setScannedData({ ...scannedData, [f.key]: e.target.value });
                      // User edited a low-confidence field — treat as confirmed.
                      if (isLowConf) {
                        setScanConfidence((prev) => ({ ...prev, [f.key]: 1 }));
                      }
                    }}
                    placeholder={f.placeholder}
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 ${
                      showMissing && f.required
                        ? "border-destructive/50 bg-background focus:ring-primary/20"
                        : showMissing
                          ? "border-dashed border-border bg-background focus:ring-primary/20"
                          : isLowConf
                            ? "border-orange-500/60 bg-orange-500/5 focus:ring-orange-500/30"
                            : "border-border bg-background focus:ring-primary/20"
                    }`}
                  />
                  {isLowConf && (
                    <p className="mt-1 text-[10px] text-orange-600/90 flex items-center gap-1">
                      <AlertTriangle size={9} /> Low OCR confidence — please verify this value.
                    </p>
                  )}
                </div>
              );
            })}
            <div>
              <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">Notes</label>
              <textarea value={scannedData.notes || ""} onChange={(e) => setScannedData({ ...scannedData, notes: e.target.value })}
                placeholder="e.g. Met at the keynote…" rows={2} maxLength={500}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          {(scannedData.linkedin || scannedData.website || scannedData.location) && (
            <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-primary" />
                <span className="text-xs font-semibold text-foreground">{t("scan.additionalDetails")}</span>
              </div>
              <div className="space-y-2.5">
                {[
                  { icon: Linkedin, label: "LinkedIn", value: scannedData.linkedin, key: "linkedin" as const },
                  { icon: Globe, label: "Website", value: scannedData.website, key: "website" as const },
                  { icon: MapPin, label: "Location", value: scannedData.location, key: "location" as const },
                ].filter((f) => f.value).map((field) => (
                  <div key={field.label} className="flex items-center gap-2.5 text-xs">
                    <field.icon size={14} className="text-primary shrink-0" />
                    <span className="text-muted-foreground w-16 shrink-0">{field.label}:</span>
                    <input
                      value={(scannedData[field.key] as string) || ""}
                      onChange={(e) => setScannedData({ ...scannedData, [field.key]: e.target.value })}
                      className="flex-1 bg-transparent text-foreground font-medium focus:outline-none border-b border-transparent focus:border-primary/30"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {missingRequired && (
            <p className="text-[11px] text-destructive text-center">Add a name to save this contact.</p>
          )}

          <div className="grid grid-cols-3 gap-3">
            <button onClick={resetScan} className="flex items-center justify-center gap-2 text-sm py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-muted transition-colors"><X size={16} /> {t("scan.cancel")}</button>
            <button onClick={resetScan} className="flex items-center justify-center gap-2 text-sm py-2.5 rounded-xl border border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 transition-colors"><RotateCcw size={16} /> {t("scan.rescan")}</button>
            <button
              onClick={handleSave}
              disabled={missingRequired}
              className="flex items-center justify-center gap-2 text-sm py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Check size={16} /> Confirm & save
            </button>
          </div>
        </motion.div>
        <UpgradePrompt open={showUpgrade} onClose={() => setShowUpgrade(false)}
          reason={`You've reached ${contactLimit} contacts on the free plan.`} />
      </div>
    );
  }

  // ─── Manual entry view ───
  if (showManualEntry) {
    const fieldColors: Record<string, string> = {
      name: "rgb(59 130 246)",       // blue
      company: "rgb(168 85 247)",    // purple
      title: "rgb(236 72 153)",      // pink
      email: "rgb(16 185 129)",      // emerald
      phone: "rgb(245 158 11)",      // amber
    };
    const ocrFields = ["name", "company", "title", "email", "phone"] as const;
    const hasAnyBox = manualImage && Object.keys(scanBoxes).length > 0;

    return (
      <div className="min-h-screen pb-24 px-5 pt-14 bg-background">
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
          {manualImage && (
            <div className="bg-card rounded-2xl border border-border p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                  Source image
                </span>
                {hasAnyBox && (
                  <span className="text-[10px] text-muted-foreground">
                    Hover or focus a field to highlight its source
                  </span>
                )}
              </div>
              <div className="relative w-full overflow-hidden rounded-xl border border-border bg-muted">
                <img src={manualImage} alt="Scanned source" className="w-full h-auto block" />
                {hasAnyBox && (
                  <div className="absolute inset-0 pointer-events-none">
                    {ocrFields.map((field) => {
                      const box = scanBoxes[field];
                      if (!box) return null;
                      const isActive = activeBoxField === field;
                      const dim = activeBoxField !== null && !isActive;
                      const color = fieldColors[field] || "rgb(59 130 246)";
                      return (
                        <div
                          key={field}
                          style={{
                            position: "absolute",
                            left: `${box.x * 100}%`,
                            top: `${box.y * 100}%`,
                            width: `${box.w * 100}%`,
                            height: `${box.h * 100}%`,
                            border: `2px solid ${color}`,
                            background: isActive ? `${color.replace("rgb", "rgba").replace(")", " / 0.18)")}` : "transparent",
                            boxShadow: isActive ? `0 0 0 2px ${color.replace("rgb", "rgba").replace(")", " / 0.25)")}` : "none",
                            opacity: dim ? 0.25 : 1,
                            borderRadius: 4,
                            transition: "opacity 150ms, background 150ms, box-shadow 150ms",
                          }}
                        >
                          <span
                            style={{
                              position: "absolute",
                              top: -18,
                              left: -2,
                              fontSize: 9,
                              fontWeight: 700,
                              padding: "1px 5px",
                              borderRadius: 4,
                              color: "white",
                              background: color,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {field}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {!hasAnyBox && (
                <p className="text-[10px] text-muted-foreground mt-2 px-1">
                  No bounding boxes returned for this image — fields below are still pre-filled from OCR.
                </p>
              )}
            </div>
          )}
          <div className="bg-card rounded-2xl border border-border p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                <UserPlus size={12} className="text-primary" />
              </div>
              <span className="text-xs font-semibold text-primary">{t("scan.manualEntry")}</span>
            </div>
            {ocrFields.map((field) => {
              const hasBox = !!scanBoxes[field];
              const color = fieldColors[field];
              return (
                <div
                  key={field}
                  onMouseEnter={() => hasBox && setActiveBoxField(field)}
                  onMouseLeave={() => setActiveBoxField((cur) => (cur === field ? null : cur))}
                >
                  <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    {hasBox && (
                      <span
                        style={{ background: color }}
                        className="inline-block w-2 h-2 rounded-sm"
                        aria-hidden
                      />
                    )}
                    {field}{field === "name" && " *"}
                  </label>
                  <input
                    value={manualData[field]}
                    onChange={(e) => setManualData({ ...manualData, [field]: e.target.value })}
                    onFocus={() => hasBox && setActiveBoxField(field)}
                    onBlur={() => setActiveBoxField((cur) => (cur === field ? null : cur))}
                    placeholder={field === "name" ? "John Doe" : field === "email" ? "john@company.com" : ""}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              );
            })}
            <div>
              <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">Notes</label>
              <textarea value={manualData.notes} onChange={(e) => setManualData({ ...manualData, notes: e.target.value })}
                placeholder="e.g. Met at the keynote…" rows={3} maxLength={500}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 block flex items-center gap-1.5">
              <CalendarDays size={12} className="text-primary" /> Assign to event
            </label>
            <select
              value={activeEventId || ""}
              onChange={(e) => setActiveEventId(e.target.value || null)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
            >
              <option value="">— No event —</option>
              {eventList.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.title}</option>
              ))}
            </select>
            {eventList.length === 0 && (
              <button
                type="button"
                onClick={() => navigate("/events")}
                className="mt-2 text-[11px] text-primary font-medium hover:underline"
              >
                + Create your first event
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setShowManualEntry(false)} className="flex items-center justify-center gap-2 text-sm py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-muted transition-colors"><X size={16} /> {t("scan.cancel")}</button>
            <button onClick={handleManualSave} disabled={!manualData.name.trim()} className="flex items-center justify-center gap-2 text-sm py-2.5 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"><Check size={16} /> {t("scan.save")}</button>
          </div>
        </motion.div>
        <UpgradePrompt open={showUpgrade} onClose={() => setShowUpgrade(false)}
          reason={`You've reached ${contactLimit} contacts on the free plan.`} />
      </div>
    );
  }

  // ─── Main scanner view ───
  return (
    <div className="min-h-screen pb-24 bg-background flex flex-col">
      <canvas ref={canvasRef} className="hidden" />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

      {/* Top instruction bar */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="relative z-10 mx-3 mt-3"
      >
        <div className="bg-muted/80 backdrop-blur-md rounded-2xl px-3 py-2.5 flex items-center gap-2 border border-border">
          <button onClick={() => window.history.back()} className="w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center shrink-0">
            <X size={15} className="text-muted-foreground" />
          </button>
          <p className="flex-1 text-center text-foreground text-[13px] font-medium leading-tight whitespace-pre-line">
            {MODE_INSTRUCTIONS[scanMode]}
          </p>
          <button onClick={() => setShowHowTo(true)} className="h-9 px-3 rounded-full bg-background border border-border flex items-center justify-center gap-1.5 shrink-0">
            <HelpCircle size={13} className="text-muted-foreground" />
            <span className="text-muted-foreground text-[11px] font-semibold">How To</span>
          </button>
        </div>
      </motion.div>

      {/* Free tier indicator */}
      {isGuest && (
        <div className="mx-6 mt-2 text-center">
          <span className="text-[11px] text-muted-foreground">{contacts.length}/{contactLimit} {t("scan.freeContacts")}</span>
        </div>
      )}

      {/* Active event picker + auto-assign toggle */}
      <div className="mx-6 mt-2 space-y-1.5">
        <div className="rounded-xl border border-border bg-card px-3 py-2 flex items-center gap-2">
          <CalendarDays size={14} className={activeEventId ? "text-primary" : "text-muted-foreground"} />
          <span className="text-[11px] text-muted-foreground shrink-0">Event:</span>
          <select
            value={activeEventId || ""}
            onChange={(e) => setActiveEventId(e.target.value || null)}
            className="flex-1 bg-transparent text-[12px] font-medium text-foreground focus:outline-none truncate"
          >
            <option value="">— None —</option>
            {eventList.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.title}</option>
            ))}
          </select>
          {eventList.length === 0 && (
            <button
              type="button"
              onClick={() => navigate("/app/events")}
              className="text-[11px] text-primary font-semibold hover:underline shrink-0"
            >
              + New
            </button>
          )}
        </div>
        {/* Auto-assign preference */}
        <label className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-muted/40 cursor-pointer select-none">
          <span className="text-[11px] text-foreground font-medium flex items-center gap-1.5">
            <Sparkles size={11} className="text-primary" />
            Auto-assign new scans to event
          </span>
          <input
            type="checkbox"
            checked={autoAssignToEvent}
            onChange={(e) => setAutoAssignToEvent(e.target.checked)}
            className="h-4 w-4 accent-primary cursor-pointer"
          />
        </label>
      </div>

      {/* Auto-save hint */}
      <div className="mx-6 mt-2 mb-1">
        <div className="flex items-center justify-center gap-1.5 bg-primary/5 rounded-xl py-1.5 px-3">
          <Sparkles size={11} className="text-primary" />
          <span className="text-[10px] text-primary font-medium">
            {autoAssignToEvent && activeEventId
              ? `Auto-tagging to "${activeEvent?.title}"`
              : autoAssignToEvent && eventList.length > 0
                ? "We'll ask which event after each scan"
                : autoAssignToEvent
                  ? "Auto-assign on — create an event to use it"
                  : t("scan.autoSaveHint")}
          </span>
        </div>
      </div>

      {/* Viewfinder area */}
      <div className="flex-1 flex items-center justify-center px-6 py-3 relative">
        {cameraActive ? (
          <div className="relative w-full aspect-[3/4] max-h-[50vh] rounded-2xl overflow-hidden border border-border">
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
            
            {/* Transparent overlay with scan guide — Popl-style */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Semi-transparent edges */}
              <div className="absolute inset-0 bg-background/40" />
              {/* Clear center cutout */}
              <div className="absolute inset-5 rounded-2xl bg-transparent" style={{ boxShadow: "0 0 0 9999px hsla(var(--background) / 0.45)" }} />
              
              {/* Animated scan line */}
              <motion.div
                animate={{ y: ["0%", "100%", "0%"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute left-5 right-5 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full"
                style={{ top: "20px" }}
              />
              
              {/* Corner brackets — bright primary */}
              {["top-5 left-5 border-t-[3px] border-l-[3px] rounded-tl-xl",
                "top-5 right-5 border-t-[3px] border-r-[3px] rounded-tr-xl",
                "bottom-5 left-5 border-b-[3px] border-l-[3px] rounded-bl-xl",
                "bottom-5 right-5 border-b-[3px] border-r-[3px] rounded-br-xl",
              ].map((cls, i) => (
                <div key={i} className={`absolute ${cls} w-10 h-10 border-primary`} />
              ))}

              {/* Guide text overlay */}
              <div className="absolute bottom-8 left-0 right-0 flex justify-center">
                <div className="bg-background/70 backdrop-blur-sm rounded-full px-4 py-1.5">
                  <p className="text-foreground text-[11px] font-medium">
                    {scanMode === "badge" ? t("scan.alignBadge") : scanMode === "card" ? t("scan.centerCard") : t("scan.pointQR")}
                  </p>
                </div>
              </div>
            </div>

            {scanning && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10">
                <Loader2 size={36} className="text-primary animate-spin" />
                <p className="text-foreground text-sm font-medium">{t("scan.extracting")}</p>
                <p className="text-muted-foreground text-[11px]">{t("scan.autoSaveReady")}</p>
              </div>
            )}
          </div>
        ) : capturedImage ? (
          <div className="relative w-full aspect-[3/4] max-h-[50vh] rounded-2xl overflow-hidden border border-border">
            <img src={capturedImage} alt="Captured" className="absolute inset-0 w-full h-full object-cover" />
            {/* Preprocessing preview toggle — hidden for QR (skipped in pipeline)
                and while a scan is in flight so it doesn't fight the spinner. */}
            {scanMode !== "qr" && !scanning && (
              <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowPreprocessPreview(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-background/80 backdrop-blur border border-border text-foreground text-[11px] font-medium hover:bg-background transition-colors shadow-sm"
                  title="Compare original vs auto-cropped/deskewed image"
                >
                  <Eye size={12} />
                  Preview preprocessing
                </button>
                {preprocessSkipReason && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-medium backdrop-blur">
                    <AlertTriangle size={10} />
                    Preprocessing skipped: {preprocessSkipReason}
                  </span>
                )}
              </div>
            )}
            {scanning && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                <Loader2 size={36} className="text-primary animate-spin" />
                <p className="text-foreground text-sm font-medium">{t("scan.analyzing")}</p>
                <p className="text-muted-foreground text-[11px]">{t("scan.autoSaving")}</p>
              </div>
            )}
          </div>
        ) : (
          /* Visual guide placeholder */
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full aspect-[3/4] max-h-[50vh] rounded-2xl border-2 border-border flex items-center justify-center relative overflow-hidden bg-muted/30"
          >
            {/* Corner brackets */}
            {["top-3 left-3 border-t-2 border-l-2 rounded-tl-lg",
              "top-3 right-3 border-t-2 border-r-2 rounded-tr-lg",
              "bottom-3 left-3 border-b-2 border-l-2 rounded-bl-lg",
              "bottom-3 right-3 border-b-2 border-r-2 rounded-br-lg",
            ].map((cls, i) => (
              <div key={i} className={`absolute ${cls} w-10 h-10 border-muted-foreground/30 pointer-events-none`} />
            ))}

            {scanMode === "qr" ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-48 h-48 rounded-xl border-2 border-border bg-muted/50 flex items-center justify-center">
                  <QrCode size={90} className="text-muted-foreground/20" />
                </div>
                <p className="text-muted-foreground text-xs font-medium">LinkedIn QR Code</p>
              </div>
            ) : scanMode === "badge" ? (
              <div className="w-[80%] max-w-[300px] rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                <div className="bg-muted/60 px-4 py-2.5 flex items-center justify-between border-b border-border">
                  <div>
                    <span className="text-muted-foreground text-[9px] font-bold uppercase tracking-widest">General Conference 2024</span>
                    <br />
                    <span className="text-muted-foreground/60 text-[8px]">Conference 2024</span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground/70 text-[8px]">August 27, 2024</span>
                    <br />
                    <span className="text-muted-foreground/60 text-[8px]">Los Angeles Convention Center</span>
                  </div>
                </div>
                <div className="px-5 py-7 text-center">
                  <p className="text-foreground font-bold text-xl">Full Name</p>
                  <p className="text-muted-foreground font-semibold text-sm mt-1">Company Name</p>
                  <p className="text-muted-foreground/50 text-[11px] mt-5 leading-relaxed">Make sure the full name and company<br />name are visible before capturing</p>
                  <div className="mt-5 mx-auto w-36 py-2 rounded-md bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-[0.2em]">
                    Attendee
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-[80%] max-w-[300px] rounded-xl border border-border bg-card overflow-hidden px-5 py-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-foreground font-bold text-xl">First Last</p>
                    <p className="text-muted-foreground text-sm mt-0.5">Job Title at Company</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Sparkles size={16} className="text-muted-foreground/30" />
                  </div>
                </div>
                <div className="mt-6 space-y-2">
                  <p className="text-muted-foreground/50 text-xs">email@company.com</p>
                  <p className="text-muted-foreground/50 text-xs">555-322-9364</p>
                  <p className="text-muted-foreground/50 text-xs">Company Name</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Camera error */}
        {cameraError && !cameraActive && (
          <div className="absolute inset-x-6 top-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-3 flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-yellow-800 dark:text-yellow-200 text-xs flex-1">{cameraError}</p>
              <button onClick={() => setCameraError(null)}><X size={14} className="text-yellow-600/60" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Scan mode tabs */}
      <div className="px-3 pb-3">
        <div className="flex gap-2">
          {SCAN_MODES.map((mode) => {
            const isActive = scanMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => { setScanMode(mode.id); resetScan(); }}
                className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all ${
                  isActive
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card"
                }`}
              >
                <mode.icon size={20} strokeWidth={isActive ? 2.2 : 1.5} className={isActive ? "text-primary" : "text-muted-foreground"} />
                <span className={`text-[11px] tracking-wide ${isActive ? "text-primary font-bold" : "text-muted-foreground font-medium"}`}>
                  {mode.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="px-6 pb-6">
        <div className="flex items-center justify-between">
          {/* Gallery upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center disabled:opacity-40"
          >
            <ImageIcon size={20} className="text-muted-foreground" />
          </button>

          {/* Center capture button */}
          {cameraActive ? (
            <button
              onClick={capturePhoto}
              disabled={scanning}
              className="w-[72px] h-[72px] rounded-full bg-primary flex items-center justify-center shadow-lg disabled:opacity-50 active:scale-95 transition-transform"
            >
              <Camera size={28} className="text-primary-foreground" />
            </button>
          ) : (
            <button
              onClick={cameraUnavailable ? () => fileInputRef.current?.click() : startCamera}
              disabled={scanning}
              className="w-[72px] h-[72px] rounded-full bg-primary flex items-center justify-center shadow-lg disabled:opacity-50 active:scale-95 transition-transform"
            >
              {scanning ? (
                <Loader2 size={28} className="text-primary-foreground animate-spin" />
              ) : cameraUnavailable ? (
                <Upload size={28} className="text-primary-foreground" />
              ) : (
                <Camera size={28} className="text-primary-foreground" />
              )}
            </button>
          )}

          {/* Flashlight / Manual entry toggle */}
          {cameraActive ? (
            <button onClick={toggleFlash} className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center">
              {flashOn ? <FlashlightOff size={20} className="text-yellow-500" /> : <Flashlight size={20} className="text-muted-foreground" />}
            </button>
          ) : (
            <button
              onClick={() => setShowManualEntry(true)}
              className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center"
            >
              <UserPlus size={20} className="text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Demo button */}
        {!cameraActive && !scanning && (
          <button
            onClick={() => { setCapturedImage(sampleBadge); processImage(sampleBadge); }}
            className="mt-3 w-full py-2.5 rounded-xl bg-primary/5 border border-primary/20 text-primary text-xs font-medium flex items-center justify-center gap-2 active:bg-primary/10 transition-colors"
          >
            <Play size={12} /> {t("scan.tryDemo")}
          </button>
        )}
      </div>

      {/* How To modal */}
      <AnimatePresence>
        {showHowTo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background flex flex-col"
          >
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
              className="relative w-full aspect-[4/3] overflow-hidden flex items-center justify-center bg-gradient-to-b from-muted to-background"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                {[
                  { label: "in", color: "#0A66C2", x: "-45%", y: "-35%", rotate: "-12deg", size: "w-16 h-16" },
                  { label: "dot.", color: "#fff", x: "35%", y: "-40%", rotate: "8deg", size: "w-14 h-14", textColor: "text-black" },
                  { label: "Blinq", color: "#fff", x: "-40%", y: "5%", rotate: "-6deg", size: "w-16 h-12", textColor: "text-red-500" },
                  { label: "tapt", color: "#fff", x: "40%", y: "10%", rotate: "10deg", size: "w-14 h-12", textColor: "text-gray-600" },
                  { label: "Hi", color: "#fff", x: "38%", y: "-20%", rotate: "5deg", size: "w-14 h-14", textColor: "text-blue-500" },
                  { label: "OVOU", color: "#fff", x: "-42%", y: "35%", rotate: "-8deg", size: "w-16 h-12", textColor: "text-gray-500" },
                ].map((card, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.7, scale: 1 }}
                    transition={{ delay: 0.2 + i * 0.08 }}
                    className={`absolute ${card.size} rounded-xl bg-white shadow-lg flex items-center justify-center border border-border`}
                    style={{
                      transform: `translate(${card.x}, ${card.y}) rotate(${card.rotate})`,
                      backgroundColor: card.color === "#fff" ? "#fff" : card.color,
                    }}
                  >
                    <span className={`font-bold text-xs ${card.textColor || "text-white"}`}>{card.label}</span>
                  </motion.div>
                ))}

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="relative z-10 w-44 bg-card rounded-[1.5rem] border border-border shadow-2xl overflow-hidden"
                >
                  <div className="flex justify-center pt-2 pb-1">
                    <div className="w-20 h-5 rounded-full bg-muted" />
                  </div>
                  <div className="px-3 pb-3 space-y-2">
                    <div className="bg-muted rounded-lg px-2 py-2 text-center">
                      <p className="text-muted-foreground text-[8px] font-medium">Point at a QR Code,</p>
                      <p className="text-muted-foreground text-[8px] font-medium">then tap the button below</p>
                    </div>
                    <div className="bg-muted/60 rounded-lg p-3 flex flex-col items-center gap-2">
                      <div className="flex items-center gap-1.5 self-start">
                        <div className="w-3 h-3 rounded-full bg-muted-foreground/20" />
                        <span className="text-muted-foreground text-[7px] font-semibold">Company Co.</span>
                      </div>
                      <QrCode size={52} className="text-muted-foreground/30" />
                    </div>
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between bg-muted/50 rounded-md px-2 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <CreditCard size={8} className="text-muted-foreground" />
                          <span className="text-muted-foreground text-[7px]">Paper Business Card</span>
                        </div>
                        <div className="w-3 h-3 rounded-full border border-border" />
                      </div>
                      <div className="flex items-center justify-between bg-muted/50 rounded-md px-2 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <QrCode size={8} className="text-muted-foreground" />
                          <span className="text-muted-foreground text-[7px]">Digital Business Card</span>
                        </div>
                        <div className="w-3 h-3 rounded-full bg-primary flex items-center justify-center">
                          <Check size={6} className="text-primary-foreground" />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            <div className="flex-1 px-6 pt-8 pb-6 flex flex-col">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <h2 className="text-foreground text-[28px] font-bold leading-tight">
                  Universal<br />
                  <span className="text-primary">Digital Business Card</span><br />
                  Scanner
                </h2>
                <p className="text-muted-foreground text-sm mt-4 leading-relaxed">
                  Scan any digital business card, paper card, or event badge — powered by Card ScanPro AI ✨
                </p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
                className="mt-8"
              >
                <p className="text-foreground font-semibold text-sm mb-4">You can scan:</p>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { icon: BadgeCheck, label: "Event\nBadges" },
                    { icon: CreditCard, label: "Paper\nCards" },
                    { icon: QrCode, label: "QR\nCodes" },
                    { icon: Linkedin, label: "LinkedIn\nQR" },
                  ].map((item, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center">
                        <item.icon size={20} className="text-primary" />
                      </div>
                      <span className="text-muted-foreground text-[9px] font-medium leading-tight whitespace-pre-line">{item.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <div className="mt-auto space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={dontShowIntro}
                    onChange={(e) => setDontShowIntro(e.target.checked)}
                    className="w-4 h-4 rounded border-border accent-primary"
                  />
                  <span className="text-xs text-muted-foreground">{t("scan.dontShowAgain") || "Don't show this again"}</span>
                </label>
                <button onClick={() => {
                  if (dontShowIntro && typeof window !== "undefined") {
                    localStorage.setItem("cardscanpro_scan_intro_seen", "1");
                  }
                  setShowHowTo(false);
                }}
                  className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm active:scale-[0.98] transition-transform">
                  Start Scanning
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating session-export pill (only when session has contacts) */}
      <AnimatePresence>
        {sessionContacts.length > 0 && !showExportSheet && (
          <motion.button
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={openExportSheet}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-4 py-2 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors"
          >
            <FileSpreadsheet size={16} />
            <div className="flex flex-col items-start leading-tight">
              <span className="text-sm font-semibold">
                Export {sessionContacts.length} from this session
              </span>
              {sessionStartedAt && (
                <span className="text-[10px] font-medium opacity-80">
                  started {formatRelative(sessionStartedAt)} · {formatTimeShort(sessionStartedAt)}
                </span>
              )}
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Session-export bottom sheet */}
      <AnimatePresence>
        {showExportSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-end justify-center"
            onClick={() => !exportingEmail && closeExportSheet()}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-card border-t border-border rounded-t-3xl p-5 pb-8 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground">
                    {emailConfirmStep ? "Confirm email export" : "Export this session"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {sessionContacts.length} contact{sessionContacts.length === 1 ? "" : "s"}
                    {activeEvent ? ` · ${activeEvent.title}` : ""}
                    {sessionStartedAt ? ` · started ${formatRelative(sessionStartedAt)}` : ""}
                  </p>
                </div>
                <button
                  onClick={closeExportSheet}
                  disabled={exportingEmail}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                >
                  <X size={14} className="text-muted-foreground" />
                </button>
              </div>

              {!emailConfirmStep && sessionStartedAt && (
                <div className={`rounded-xl border px-3 py-2.5 flex items-start gap-2.5 ${
                  sessionIsExpiringSoon
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-border bg-muted/40"
                }`}>
                  <div className="text-[14px] leading-none mt-0.5">{sessionIsExpiringSoon ? "⏳" : "🕒"}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-foreground">
                      Session started {formatTimeShort(sessionStartedAt)} · {formatRelative(sessionStartedAt)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Last scan {sessionLastUpdatedAt ? formatRelative(sessionLastUpdatedAt) : "—"}.
                      {sessionExpiresAt && ` Auto-clears ${formatRelative(sessionExpiresAt)}`}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      clearSession();
                      closeExportSheet();
                      toast.success("Session cleared", { icon: "🧹" });
                    }}
                    className="text-[11px] font-semibold text-muted-foreground hover:text-foreground underline underline-offset-2 shrink-0"
                  >
                    Start fresh
                  </button>
                </div>
              )}

              {emailConfirmStep ? (
                <>
                  {/* Confirmation summary */}
                  <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2.5">
                    <div className="flex items-start gap-2">
                      <Mail size={14} className="text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          Sending to
                        </p>
                        <p className="text-sm font-semibold text-foreground break-all">
                          {(emailRecipient || profile.email || "").trim()}
                        </p>
                      </div>
                    </div>
                    <div className="border-t border-border/60 pt-2 grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <p className="text-muted-foreground">Contacts</p>
                        <p className="text-foreground font-semibold">{sessionContacts.length}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Scope</p>
                        <p className="text-foreground font-semibold truncate">{sessionScopeLabel || "This session"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-muted/40 border border-border/60 p-2.5 max-h-28 overflow-y-auto">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 px-1">
                      Included
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {sessionContacts.slice(0, 20).map((c) => (
                        <span key={c.id} className="text-[11px] px-2 py-0.5 rounded-full bg-background border border-border text-foreground">
                          {c.name}
                        </span>
                      ))}
                      {sessionContacts.length > 20 && (
                        <span className="text-[11px] px-2 py-0.5 text-muted-foreground">
                          +{sessionContacts.length - 20} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setEmailConfirmStep(false)}
                      disabled={exportingEmail}
                      className="flex-1 text-sm py-3 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 disabled:opacity-50 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleEmailSessionCsv}
                      disabled={exportingEmail}
                      className="flex-1 flex items-center justify-center gap-2 text-sm py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {exportingEmail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                      Confirm & send
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Quick names preview */}
                  <div className="rounded-xl bg-muted/40 border border-border/60 p-2.5 max-h-24 overflow-y-auto">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 px-1">
                      Included
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {sessionContacts.slice(0, 12).map((c) => (
                        <span key={c.id} className="text-[11px] px-2 py-0.5 rounded-full bg-background border border-border text-foreground">
                          {c.name}
                        </span>
                      ))}
                      {sessionContacts.length > 12 && (
                        <span className="text-[11px] px-2 py-0.5 text-muted-foreground">
                          +{sessionContacts.length - 12} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Column picker */}
                  <div className="rounded-xl border border-border bg-muted/30">
                    <button
                      type="button"
                      onClick={() => setShowColumnPicker((v) => !v)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Settings2 size={13} className="text-muted-foreground shrink-0" />
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                          Columns
                        </p>
                        <span className="text-[11px] text-foreground font-semibold truncate">
                          {selectedColumns.length} of {EXPORT_COLUMNS.length} selected
                        </span>
                      </div>
                      {showColumnPicker
                        ? <ChevronUp size={14} className="text-muted-foreground shrink-0" />
                        : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                    </button>

                    {showColumnPicker && (
                      <div className="border-t border-border/60 p-3 space-y-3 max-h-64 overflow-y-auto">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={selectAllColumns}
                            className="text-[11px] font-medium text-primary hover:underline"
                          >
                            Select all
                          </button>
                          <button
                            type="button"
                            onClick={resetColumnsToDefaults}
                            className="text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
                          >
                            Reset to defaults
                          </button>
                        </div>
                        {columnGroups.map((group) => {
                          const cols = EXPORT_COLUMNS.filter((c) => c.group === group);
                          if (cols.length === 0) return null;
                          return (
                            <div key={group} className="space-y-1.5">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                                {group}
                              </p>
                              <div className="grid grid-cols-2 gap-1.5">
                                {cols.map((col) => {
                                  const checked = selectedColumns.includes(col.key);
                                  return (
                                    <label
                                      key={col.key}
                                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[12px] cursor-pointer transition-colors ${
                                        checked
                                          ? "bg-primary/10 border-primary/40 text-foreground"
                                          : "bg-background border-border text-muted-foreground hover:text-foreground"
                                      } ${col.required ? "opacity-90 cursor-not-allowed" : ""}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={col.required}
                                        onChange={() => toggleColumn(col.key)}
                                        className="w-3.5 h-3.5 accent-primary"
                                      />
                                      <span className="truncate">
                                        {col.label}
                                        {col.required && <span className="text-muted-foreground"> *</span>}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                        <p className="text-[10px] text-muted-foreground">
                          * Required column. Saved for next time.
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleDownloadSessionCsv}
                    disabled={exportingEmail}
                    className="w-full flex items-center justify-center gap-2 text-sm py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    <Download size={16} /> Download CSV now
                  </button>

                  <div className="space-y-2">
                    <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider block flex items-center gap-1.5">
                      <Mail size={11} /> Or email it
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={emailRecipient}
                        onChange={(e) => setEmailRecipient(e.target.value)}
                        placeholder="you@company.com"
                        disabled={exportingEmail}
                        className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <button
                        onClick={reviewEmailExport}
                        disabled={exportingEmail || !emailRecipient.trim()}
                        className="px-4 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5"
                      >
                        <Mail size={14} />
                        Review
                      </button>
                    </div>
                    {isGuest && (
                      <p className="text-[11px] text-yellow-600">
                        Sign in to email exports — download still works.
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => { clearSession(); closeExportSheet(); toast.success("Session cleared"); }}
                    disabled={exportingEmail}
                    className="w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    Clear session (start fresh)
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <UpgradePrompt open={showUpgrade} onClose={() => setShowUpgrade(false)}
        reason={`You've reached ${contactLimit} contacts on the free plan.`} />

      <PreprocessPreviewDialog
        open={showPreprocessPreview}
        onOpenChange={setShowPreprocessPreview}
        imageSrc={capturedImage}
      />
    </div>
  );
};

export default ScanBadge;

// ─── Small inline form for the first-folder prompt ───
const FolderPromptForm = ({
  defaultName,
  busy,
  existingEvents,
  onCreateFolder,
  onCreateEventInline,
  onPickExistingEvent,
  onSkip,
}: {
  defaultName: string;
  busy: boolean;
  existingEvents: { id: string; title: string }[];
  onCreateFolder: (name: string) => void;
  onCreateEventInline: (eventName: string) => void;
  onPickExistingEvent: (eventId: string) => void;
  onSkip: () => void;
}) => {
  const [mode, setMode] = useState<"event" | "folder" | "pick">(
    existingEvents.length > 0 ? "pick" : "event"
  );
  const [name, setName] = useState(defaultName);
  const [pickedId, setPickedId] = useState<string>(existingEvents[0]?.id ?? "");

  return (
    <div className="space-y-3">
      {/* Mode tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/50 text-[11px] font-medium">
        {existingEvents.length > 0 && (
          <button
            type="button"
            onClick={() => setMode("pick")}
            disabled={busy}
            className={`flex-1 py-1.5 rounded-lg transition-colors ${
              mode === "pick" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Existing event
          </button>
        )}
        <button
          type="button"
          onClick={() => setMode("event")}
          disabled={busy}
          className={`flex-1 py-1.5 rounded-lg transition-colors ${
            mode === "event" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          New event
        </button>
        <button
          type="button"
          onClick={() => setMode("folder")}
          disabled={busy}
          className={`flex-1 py-1.5 rounded-lg transition-colors ${
            mode === "folder" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Folder only
        </button>
      </div>

      {mode === "pick" && existingEvents.length > 0 && (
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">
              Active event
            </label>
            <select
              value={pickedId}
              onChange={(e) => setPickedId(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {existingEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.title}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Sets this as your active event and tags this contact (and future scans) automatically.
            </p>
          </div>
          <button
            onClick={() => pickedId && onPickExistingEvent(pickedId)}
            disabled={busy || !pickedId}
            className="w-full flex items-center justify-center gap-2 text-sm py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <CalendarDays size={16} /> Use this event
          </button>
        </div>
      )}

      {mode === "event" && (
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">
              Event name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SaaStr 2025"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              We'll create the event, set it active, add a 📅 folder, and tag this contact.
            </p>
          </div>
          <button
            onClick={() => onCreateEventInline(name)}
            disabled={busy || !name.trim()}
            className="w-full flex items-center justify-center gap-2 text-sm py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <CalendarDays size={16} /> Create event & assign
          </button>
        </div>
      )}

      {mode === "folder" && (
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">
              Folder name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Inc."
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              No event — just bucket this contact into a folder.
            </p>
          </div>
          <button
            onClick={() => onCreateFolder(name)}
            disabled={busy || !name.trim()}
            className="w-full flex items-center justify-center gap-2 text-sm py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Check size={16} /> Create folder & continue
          </button>
        </div>
      )}

      <button
        onClick={onSkip}
        disabled={busy}
        className="w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
      >
        Skip for now
      </button>
    </div>
  );
};
