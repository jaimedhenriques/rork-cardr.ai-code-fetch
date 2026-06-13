import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { EN_STRINGS, APP_LANGUAGES } from "@/lib/translations";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LanguageContextType {
  /** Current app language code (e.g. "en", "pt") */
  appLang: string;
  /** Current transcription language code (e.g. "en-US", "pt-BR") */
  transcriptionLang: string;
  /** Translate a key. Falls back to English. */
  t: (key: string) => string;
  /** Set app display language — triggers translation fetch */
  setAppLang: (code: string) => void;
  /** Set transcription language */
  setTranscriptionLang: (code: string) => void;
  /** Whether translations are loading */
  translating: boolean;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be inside LanguageProvider");
  return ctx;
};

const CACHE_PREFIX = "csp_i18n_v3_";
const APP_LANG_KEY = "csp_app_lang";
const REC_LANG_KEY = "cardscanpro_rec_lang";

// One-time cleanup of older cache versions to prevent stale strings (e.g. missing shareCard.* keys)
try {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith("csp_i18n_") && !k.startsWith(CACHE_PREFIX)) {
      localStorage.removeItem(k);
    }
  }
} catch {}

function loadCache(lang: string, keyCount: number): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${lang}`);
    if (!raw) return null;
    const { translations, timestamp, keys } = JSON.parse(raw);
    // Cache for 7 days
    if (Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000) return null;
    // Invalidate if key count changed (new strings added)
    if (keys && keys !== keyCount) return null;
    return translations;
  } catch {
    return null;
  }
}

function saveCache(lang: string, translations: Record<string, string>, keyCount: number) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${lang}`, JSON.stringify({ translations, timestamp: Date.now(), keys: keyCount }));
  } catch {}
}

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [appLang, setAppLangState] = useState(() =>
    localStorage.getItem(APP_LANG_KEY) || "en"
  );
  const [transcriptionLang, setTranscriptionLangState] = useState(() =>
    localStorage.getItem(REC_LANG_KEY) || navigator.language || "en-US"
  );
  const [translations, setTranslations] = useState<Record<string, string>>(EN_STRINGS);
  const [translating, setTranslating] = useState(false);

  const fetchTranslations = useCallback(async (lang: string) => {
    if (lang === "en") {
      setTranslations(EN_STRINGS);
      return;
    }

    const enKeyCount = Object.keys(EN_STRINGS).length;
    const cached = loadCache(lang, enKeyCount);
    if (cached && Object.keys(cached).length > 10) {
      // Verify multiple values differ from English (not a stale/bad cache)
      const sampleKeys = Object.keys(EN_STRINGS).slice(0, 5);
      const diffCount = sampleKeys.filter(k => cached[k] && cached[k] !== EN_STRINGS[k]).length;
      if (diffCount >= 2) {
        console.log(`[i18n] Using cached ${lang} translations (${Object.keys(cached).length} keys)`);
        setTranslations(cached);
        return;
      }
      // Bad cache — remove it
      console.log(`[i18n] Clearing stale cache for ${lang}`);
      localStorage.removeItem(`${CACHE_PREFIX}${lang}`);
    }

    setTranslating(true);
    try {
      console.log(`[i18n] Fetching translations for ${lang}...`);
      
      // Split into smaller batches to avoid timeout with large string dicts
      const allKeys = Object.keys(EN_STRINGS);
      const batchSize = 80;
      const batches: Record<string, string>[] = [];
      
      for (let i = 0; i < allKeys.length; i += batchSize) {
        const batchKeys = allKeys.slice(i, i + batchSize);
        const batchStrings: Record<string, string> = {};
        batchKeys.forEach(k => batchStrings[k] = EN_STRINGS[k]);
        batches.push(batchStrings);
      }

      let merged = { ...EN_STRINGS };
      
      for (let i = 0; i < batches.length; i++) {
        console.log(`[i18n] Translating batch ${i + 1}/${batches.length}...`);
        const { data, error } = await supabase.functions.invoke("translate-ui", {
          body: { strings: batches[i], targetLang: lang },
        });

        if (error) {
          console.error(`[i18n] Batch ${i + 1} error:`, error);
          throw error;
        }

        if (data?.translations) {
          merged = { ...merged, ...data.translations };
        } else if (data?.error) {
          console.error(`[i18n] Batch ${i + 1} API error:`, data.error);
          toast.error(data.error);
          setTranslations(EN_STRINGS);
          return;
        }
      }
      
      setTranslations(merged);
      saveCache(lang, merged, enKeyCount);
      console.log(`[i18n] Successfully translated to ${lang} (${Object.keys(merged).length} keys)`);
    } catch (err) {
      console.error("[i18n] Failed to fetch translations:", err);
      toast.error("Failed to translate. Using English.");
      setTranslations(EN_STRINGS);
    } finally {
      setTranslating(false);
    }
  }, []);

  // Load translations when app lang changes
  useEffect(() => {
    fetchTranslations(appLang);
  }, [appLang, fetchTranslations]);

  const setAppLang = useCallback((code: string) => {
    setAppLangState(code);
    localStorage.setItem(APP_LANG_KEY, code);
  }, []);

  const setTranscriptionLang = useCallback((code: string) => {
    setTranscriptionLangState(code);
    localStorage.setItem(REC_LANG_KEY, code);
  }, []);

  const t = useCallback((key: string): string => {
    const val = translations[key];
    // If a translated value is literally the key (translation provider echoed it back), fall through to English
    if (val && val !== key) return val;
    return EN_STRINGS[key] || key;
  }, [translations]);

  return (
    <LanguageContext.Provider value={{
      appLang, transcriptionLang, t, setAppLang, setTranscriptionLang, translating,
    }}>
      {children}
    </LanguageContext.Provider>
  );
};
